import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Store } from './store'
import type { Project, Task } from './model'
import { mergeProjects, mergeTasks } from './merge'
import { projectToRow, type ProjectRow, taskToRow, type TaskRow, tombstoneRow } from './rows'

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error'

const PUSH_DEBOUNCE_MS = 800

const offsetFor = (t: Task) => (t.remindAt ? new Date(t.remindAt) : new Date()).getTimezoneOffset()

/**
 * Keeps the local store and the user's Supabase rows in step (last write wins).
 * What needs pushing is tracked per id (store.dirty / dirtyProjects / deletedIds), never by comparing clocks.
 */
export function useSync(store: Store, session: Session | null): { status: SyncStatus; lastSyncedAt: number | null } {
  const [status, setStatus] = useState<SyncStatus>('off')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const userId = session?.user.id ?? null
  const busy = useRef(false)
  const again = useRef(false)

  const push = useCallback(
    async (tasks: Task[], deletes: [string, number][], projects: Project[]) => {
      if (!supabase || !userId) return
      const taskRows = [...tasks.map((t) => taskToRow(t, userId, offsetFor(t))), ...deletes.map(([id, at]) => tombstoneRow(id, userId, at))]
      let confirmed: string[] = []
      if (taskRows.length) {
        // Rows skipped by the server's keep-newest trigger are not returned; a later pull reconciles them.
        const { data, error } = await supabase.from('tasks').upsert(taskRows, { onConflict: 'user_id,id' }).select('id, deleted')
        if (error) throw error
        confirmed = (data ?? []).filter((r) => r.deleted).map((r) => r.id)
      }
      if (projects.length) {
        const { error } = await supabase.from('projects').upsert(projects.map((p) => projectToRow(p, userId)), { onConflict: 'user_id,id' })
        if (error) throw error
      }
      storeRef.current.markPushed(tasks, projects, confirmed)
    },
    [userId],
  )

  /** Run one sync operation at a time; a request arriving mid-flight re-runs once afterwards. */
  const exclusive = useCallback(async (op: () => Promise<void>) => {
    if (busy.current) {
      again.current = true
      return false
    }
    busy.current = true
    setStatus('syncing')
    try {
      await op()
      setStatus('synced')
      setLastSyncedAt(Date.now())
    } catch {
      setStatus(navigator.onLine ? 'error' : 'offline')
    } finally {
      busy.current = false
    }
    return true
  }, [])

  const pull = useCallback(async () => {
    if (!supabase || !userId) return
    if (!navigator.onLine) return setStatus('offline')
    await exclusive(async () => {
      const [t, p] = await Promise.all([supabase!.from('tasks').select('*'), supabase!.from('projects').select('*')])
      if (t.error) throw t.error
      if (p.error) throw p.error
      const s = storeRef.current
      const m = mergeTasks(s.tasks, s.deletedIds, t.data as TaskRow[])
      const pm = mergeProjects(s.projects, p.data as ProjectRow[])
      s.applyRemote(
        { tasks: m.tasks, projects: pm.projects, deletedIds: m.deletedIds },
        m.toPush.map((x) => x.id),
        pm.toPush.map((x) => x.id),
      )
      await push(
        m.toPush,
        m.toDelete.map((id) => [id, m.deletedIds[id]]),
        pm.toPush,
      )
    })
    if (again.current) {
      again.current = false
      pull()
    }
  }, [userId, push, exclusive])

  // Initial pull + re-pull triggers.
  useEffect(() => {
    if (!supabase || !userId) {
      setStatus('off')
      return
    }
    pull()
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(pull, 500)
    }
    const onVisible = () => document.visibilityState === 'visible' && soon()
    const onSwMessage = (e: MessageEvent) => e.data?.type === 'sync' && soon()
    const onOffline = () => setStatus('offline')
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', soon)
    window.addEventListener('offline', onOffline)
    navigator.serviceWorker?.addEventListener('message', onSwMessage)
    const channel = supabase
      .channel(`sync-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, soon)
      .subscribe()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', soon)
      window.removeEventListener('offline', onOffline)
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
      supabase?.removeChannel(channel)
    }
  }, [userId, pull])

  // Debounced push of local edits.
  useEffect(() => {
    if (!supabase || !userId) return
    const s = store
    const tasks = s.tasks.filter((t) => s.dirty[t.id])
    const projects = s.projects.filter((p) => s.dirtyProjects[p.id])
    const deletes = Object.entries(s.deletedIds)
    if (!tasks.length && !projects.length && !deletes.length) return
    const timer = setTimeout(() => {
      if (!navigator.onLine) return setStatus('offline')
      exclusive(() => push(tasks, deletes, projects))
    }, PUSH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // Depend on data only: a status change after a failed push must not retrigger it in a tight loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.tasks, store.projects, store.deletedIds, store.dirty, store.dirtyProjects, userId, push, exclusive])

  return { status, lastSyncedAt }
}
