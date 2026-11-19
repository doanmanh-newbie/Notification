import type { Project, Task } from './model'
import { type ProjectRow, rowToProject, rowToTask, type TaskRow } from './rows'

export interface TaskMerge {
  tasks: Task[]
  /** Deletions still waiting for a tombstone on the server. */
  deletedIds: Record<string, number>
  toPush: Task[]
  toDelete: string[]
}

/** Last-write-wins merge of local state with server rows, including tombstones both ways. */
export function mergeTasks(local: Task[], deleted: Record<string, number>, remote: TaskRow[]): TaskMerge {
  const remoteById = new Map(remote.map((r) => [r.id, r]))
  const tasks: Task[] = []
  const toPush: Task[] = []
  const pending: Record<string, number> = {}
  const toDelete: string[] = []

  for (const l of local) {
    const r = remoteById.get(l.id)
    if (!r) {
      tasks.push(l)
      toPush.push(l)
      continue
    }
    const rt = Date.parse(r.updated_at)
    if (r.deleted) {
      if (rt >= l.updatedAt) continue
      tasks.push(l)
      toPush.push(l)
    } else if (l.updatedAt > rt) {
      tasks.push(l)
      toPush.push(l)
    } else {
      tasks.push(rowToTask(r))
    }
  }

  const localIds = new Set(local.map((t) => t.id))
  for (const r of remote) {
    if (localIds.has(r.id)) continue
    const rt = Date.parse(r.updated_at)
    const delAt = deleted[r.id]
    if (delAt !== undefined) {
      if (r.deleted) continue
      if (delAt >= rt) {
        pending[r.id] = delAt
        toDelete.push(r.id)
        continue
      }
    }
    if (!r.deleted && r.data) tasks.push(rowToTask(r))
  }

  return { tasks, deletedIds: pending, toPush, toDelete }
}

export function mergeProjects(local: Project[], remote: ProjectRow[]): { projects: Project[]; toPush: Project[] } {
  const remoteById = new Map(remote.map((r) => [r.id, r]))
  const projects: Project[] = []
  const toPush: Project[] = []
  for (const l of local) {
    const r = remoteById.get(l.id)
    if (!r || (l.updatedAt ?? 0) > Date.parse(r.updated_at)) {
      projects.push(l)
      toPush.push(l)
    } else if (!r.deleted) projects.push(rowToProject(r))
  }
  const localIds = new Set(local.map((p) => p.id))
  for (const r of remote) if (!localIds.has(r.id) && !r.deleted && r.data) projects.push(rowToProject(r))
  return { projects, toPush }
}
