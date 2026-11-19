import type { Task } from './model'
import type { TaskRow } from './rows'

export const task: Task = {
  id: 't', title: 'Viết báo cáo', notes: '', priority: 'medium', effort: 2, due: null, remindAt: null, reminded: false,
  done: false, projectId: null, dependsOn: [], subtasks: [], createdAt: 1, updatedAt: 1, repeat: 'none',
}

export const rowOf = (t: Task, updatedAtMs: number): TaskRow => ({
  id: t.id, user_id: 'u', data: t, remind_at: null, tz_offset: -420, action_token: null, deleted: false,
  updated_at: new Date(updatedAtMs).toISOString(),
})
