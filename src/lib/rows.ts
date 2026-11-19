import type { Project, Task } from './model'
import { toUtcIso } from '../../supabase/functions/_shared/time.ts'

export interface TaskRow {
  id: string
  user_id: string
  data: Task | null
  remind_at: string | null
  tz_offset: number
  action_token: string | null
  deleted: boolean
  updated_at: string
}

export interface ProjectRow {
  id: string
  user_id: string
  data: Project | null
  deleted: boolean
  updated_at: string
}

/** The server only scans rows with a remind_at, so done/already-reminded tasks get null. */
export function taskToRow(t: Task, userId: string, offsetMin: number): TaskRow {
  return {
    id: t.id,
    user_id: userId,
    data: t,
    remind_at: t.remindAt && !t.done && !t.reminded ? toUtcIso(t.remindAt, offsetMin) : null,
    tz_offset: offsetMin,
    // Any client edit invalidates the buttons on an already-delivered notification.
    action_token: null,
    deleted: false,
    updated_at: new Date(t.updatedAt).toISOString(),
  }
}

export function tombstoneRow(id: string, userId: string, at: number): TaskRow {
  return { id, user_id: userId, data: null, remind_at: null, tz_offset: 0, action_token: null, deleted: true, updated_at: new Date(at).toISOString() }
}

export function rowToTask(r: TaskRow): Task {
  const d = r.data as Task
  return { ...d, repeat: d.repeat ?? 'none', subtasks: d.subtasks ?? [], dependsOn: d.dependsOn ?? [], updatedAt: Date.parse(r.updated_at) }
}

export function projectToRow(p: Project, userId: string): ProjectRow {
  return { id: p.id, user_id: userId, data: p, deleted: false, updated_at: new Date(p.updatedAt ?? 0).toISOString() }
}

export function rowToProject(r: ProjectRow): Project {
  return { ...(r.data as Project), updatedAt: Date.parse(r.updated_at) }
}
