import { useEffect, useState } from 'react'
import { addDays, type Project, type Task, toISO, uid } from './model'
import { rollForward } from '../../supabase/functions/_shared/recur.ts'

const KEY = 'nhac-nho-v1'

export interface State {
  tasks: Task[]
  projects: Project[]
  /** id → thời điểm xoá (ms), chờ đẩy tombstone lên máy chủ */
  deletedIds: Record<string, number>
  /** Task / project ids edited locally and not yet confirmed by the server. */
  dirty: Record<string, true>
  dirtyProjects: Record<string, true>
}

function seed(): State {
  const projects: Project[] = [
    { id: 'p-work', name: 'Công việc', color: '#2f6fdf', updatedAt: 0 },
    { id: 'p-study', name: 'Học tập', color: '#9b51e0', updatedAt: 0 },
    { id: 'p-life', name: 'Cá nhân', color: '#2f9e6b', updatedAt: 0 },
  ]
  const base = (t: Partial<Task> & { id: string; title: string }): Task => ({
    notes: '',
    priority: 'medium',
    effort: 2,
    due: null,
    remindAt: null,
    reminded: false,
    done: false,
    projectId: null,
    dependsOn: [],
    subtasks: [],
    createdAt: Date.now(),
    // Sample data must never win a merge against real data from another device.
    updatedAt: 0,
    repeat: 'none',
    ...t,
  })
  const tasks: Task[] = [
    base({
      id: 't1',
      title: 'Chốt yêu cầu dự án Q3',
      priority: 'urgent',
      effort: 3,
      due: addDays(0),
      projectId: 'p-work',
      notes: 'Tổng hợp phản hồi từ khách hàng. Sau khi chốt mới làm được [[Thiết kế wireframe]].',
      subtasks: [
        { id: uid(), text: 'Đọc lại biên bản họp', done: true },
        { id: uid(), text: 'Liệt kê tính năng bắt buộc', done: false },
        { id: uid(), text: 'Gửi bản nháp cho trưởng nhóm', done: false },
      ],
    }),
    base({ id: 't2', title: 'Thiết kế wireframe', priority: 'high', effort: 3, due: addDays(3), projectId: 'p-work', dependsOn: ['t1'] }),
    base({ id: 't3', title: 'Trả lời email đối tác', priority: 'high', effort: 1, due: addDays(-1), projectId: 'p-work' }),
    base({
      id: 't4',
      title: 'Ôn chương 4 – Cấu trúc dữ liệu',
      priority: 'medium',
      effort: 2,
      due: addDays(2),
      projectId: 'p-study',
      notes: 'Tập trung vào cây nhị phân và heap. Làm xong thì chuyển sang [[Làm bài tập lớn]].',
    }),
    base({ id: 't5', title: 'Làm bài tập lớn', priority: 'high', effort: 3, due: addDays(6), projectId: 'p-study', dependsOn: ['t4'] }),
    base({ id: 't6', title: 'Đặt lịch khám răng', priority: 'low', effort: 1, due: addDays(5), projectId: 'p-life' }),
    base({ id: 't7', title: 'Mua quà sinh nhật mẹ', priority: 'medium', effort: 1, due: addDays(4), projectId: 'p-life' }),
    base({ id: 't8', title: 'Dọn hộp thư đến', priority: 'low', effort: 1, projectId: 'p-work', done: true }),
  ]
  return { tasks, projects, deletedIds: {}, dirty: {}, dirtyProjects: {} }
}

/** Chuẩn hoá dữ liệu đọc từ localStorage (kể cả bản v1 cũ chưa có repeat/updatedAt). */
export function migrateState(raw: unknown): State {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as State).tasks)) return seed()
  const r = raw as Partial<State>
  return {
    tasks: r.tasks!.map((t) => ({ ...t, repeat: t.repeat ?? 'none', updatedAt: t.updatedAt ?? t.createdAt ?? 0 })),
    projects: Array.isArray(r.projects) ? r.projects : [],
    deletedIds: r.deletedIds && typeof r.deletedIds === 'object' ? r.deletedIds : {},
    dirty: r.dirty && typeof r.dirty === 'object' ? r.dirty : {},
    dirtyProjects: r.dirtyProjects && typeof r.dirtyProjects === 'object' ? r.dirtyProjects : {},
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
function nowLocal(ms: number) {
  const d = new Date(ms)
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Apply an edit; completing a repeating task rolls it to the next occurrence instead. */
export function applyPatch(task: Task, patch: Partial<Task>, now: number): Task {
  const next: Task = { ...task, ...patch, updatedAt: now }
  // A manual change of schedule starts a new monthly series.
  if ('due' in patch || 'remindAt' in patch || 'repeat' in patch) next.repeatAnchor = null
  if (patch.done === true && !task.done && task.repeat !== 'none') return rollForward({ ...next, done: false }, nowLocal(now))
  return next
}

/**
 * After a successful push: un-dirty items that were not edited again meanwhile, and forget deletions whose
 * tombstones the server confirmed.
 */
export function clearPushed(
  s: State,
  tasks: { id: string; updatedAt: number }[],
  projects: { id: string; updatedAt?: number }[],
  confirmedDeletes: string[],
): State {
  const dirty = { ...s.dirty }
  for (const p of tasks) if (s.tasks.find((t) => t.id === p.id)?.updatedAt === p.updatedAt) delete dirty[p.id]
  const dirtyProjects = { ...s.dirtyProjects }
  for (const p of projects) if (s.projects.find((x) => x.id === p.id)?.updatedAt === p.updatedAt) delete dirtyProjects[p.id]
  const deletedIds = { ...s.deletedIds }
  for (const id of confirmedDeletes) delete deletedIds[id]
  return { ...s, dirty, dirtyProjects, deletedIds }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrateState(JSON.parse(raw))
  } catch {
    /* ignore corrupt storage */
  }
  return seed()
}

export function useStore() {
  const [state, setState] = useState<State>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  const updateTask = (id: string, patch: Partial<Task>) =>
    setState((s) => ({ ...s, dirty: { ...s.dirty, [id]: true }, tasks: s.tasks.map((t) => (t.id === id ? applyPatch(t, patch, Date.now()) : t)) }))

  const addTask = (partial: Partial<Task> = {}) => {
    const task: Task = {
      id: uid(),
      title: '',
      notes: '',
      priority: 'medium',
      effort: 2,
      due: null,
      remindAt: null,
      reminded: false,
      done: false,
      projectId: null,
      dependsOn: [],
      subtasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      repeat: 'none',
      ...partial,
    }
    setState((s) => ({ ...s, dirty: { ...s.dirty, [task.id]: true }, tasks: [task, ...s.tasks] }))
    return task
  }

  const deleteTask = (id: string) =>
    setState((s) => {
      const now = Date.now()
      const dirty = { ...s.dirty }
      delete dirty[id]
      for (const t of s.tasks) if (t.dependsOn.includes(id)) dirty[t.id] = true
      return {
        ...s,
        dirty,
        deletedIds: { ...s.deletedIds, [id]: now },
        tasks: s.tasks
          .filter((t) => t.id !== id)
          .map((t) => (t.dependsOn.includes(id) ? { ...t, dependsOn: t.dependsOn.filter((d) => d !== id), updatedAt: now } : t)),
      }
    })

  const addProject = (name: string) => {
    const palette = ['#2f6fdf', '#9b51e0', '#2f9e6b', '#d9730d', '#e03e3e', '#0f7b6c']
    const id = uid()
    setState((s) => ({
      ...s,
      dirtyProjects: { ...s.dirtyProjects, [id]: true },
      projects: [...s.projects, { id, name, color: palette[s.projects.length % palette.length], updatedAt: Date.now() }],
    }))
  }

  const reset = () => setState(seed())

  /** Apply a merged server snapshot; ids that still need pushing are marked dirty. */
  const applyRemote = (next: Pick<State, 'tasks' | 'projects' | 'deletedIds'>, pushTasks: string[], pushProjects: string[]) =>
    setState((s) => ({
      ...s,
      ...next,
      dirty: { ...s.dirty, ...Object.fromEntries(pushTasks.map((id) => [id, true as const])) },
      dirtyProjects: { ...s.dirtyProjects, ...Object.fromEntries(pushProjects.map((id) => [id, true as const])) },
    }))

  const markPushed = (tasks: { id: string; updatedAt: number }[], projects: { id: string; updatedAt?: number }[], confirmedDeletes: string[]) =>
    setState((s) => clearPushed(s, tasks, projects, confirmedDeletes))

  /** Wipe local data (used on sign-out so the next account does not inherit it). */
  const clearAll = () => setState({ tasks: [], projects: [], deletedIds: {}, dirty: {}, dirtyProjects: {} })

  return { ...state, updateTask, addTask, deleteTask, addProject, reset, applyRemote, markPushed, clearAll }
}

export type Store = ReturnType<typeof useStore>
