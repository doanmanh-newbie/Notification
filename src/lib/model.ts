import type { Repeat } from '../../supabase/functions/_shared/recur.ts'
export type { Repeat }

export type Priority = 'urgent' | 'high' | 'medium' | 'low'
export type Effort = 1 | 2 | 3
export type Energy = 1 | 2 | 3

export interface Subtask {
  id: string
  text: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  notes: string
  priority: Priority
  effort: Effort
  due: string | null // yyyy-mm-dd
  remindAt: string | null // yyyy-mm-ddThh:mm
  reminded: boolean
  done: boolean
  projectId: string | null
  dependsOn: string[]
  subtasks: Subtask[]
  createdAt: number
  updatedAt: number
  repeat: Repeat
  /** Day of month a monthly repeat is anchored to (managed by rollForward). */
  repeatAnchor?: number | null
}

export interface Project {
  id: string
  name: string
  color: string
  updatedAt?: number
}

export const PRIORITIES: Record<Priority, { label: string; short: string; weight: number; dot: string; chip: string }> = {
  urgent: { label: 'Khẩn cấp', short: 'P0', weight: 40, dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 ring-red-200' },
  high: { label: 'Cao', short: 'P1', weight: 26, dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 ring-orange-200' },
  medium: { label: 'Trung bình', short: 'P2', weight: 14, dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200' },
  low: { label: 'Thấp', short: 'P3', weight: 5, dot: 'bg-stone-400', chip: 'bg-stone-100 text-stone-600 ring-stone-200' },
}

export const REPEATS: Record<Repeat, string> = {
  none: 'Không lặp',
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng',
}

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low']

export const EFFORTS: Record<Effort, { label: string; hint: string; minutes: number }> = {
  1: { label: 'Nhẹ', hint: '≈ 15 phút, ít tập trung', minutes: 15 },
  2: { label: 'Vừa', hint: '≈ 45 phút, cần chú ý', minutes: 45 },
  3: { label: 'Sâu', hint: '≈ 2 giờ, tập trung cao', minutes: 120 },
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const todayISO = () => toISO(new Date())
export function toISO(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
export function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Days from today until due (negative = overdue). */
export function daysUntil(due: string | null) {
  if (!due) return null
  const [y, m, d] = due.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86400000)
}

export function dueLabel(due: string | null) {
  const n = daysUntil(due)
  if (n === null) return null
  if (n < 0) return `Quá hạn ${-n} ngày`
  if (n === 0) return 'Hôm nay'
  if (n === 1) return 'Ngày mai'
  if (n < 7) return `Còn ${n} ngày`
  const [, m, d] = due!.split('-')
  return `${d}/${m}`
}

export function isBlocked(task: Task, all: Task[]) {
  return task.dependsOn.some((id) => {
    const dep = all.find((t) => t.id === id)
    return dep && !dep.done
  })
}

/** Tasks that wait on this one (direct). */
export function dependents(task: Task, all: Task[]) {
  return all.filter((t) => t.dependsOn.includes(task.id))
}

/** Extract [[Title]] mentions from notes. */
export function mentions(notes: string) {
  return [...notes.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim())
}

export function backlinks(task: Task, all: Task[]) {
  const title = task.title.trim().toLowerCase()
  return all.filter(
    (t) =>
      t.id !== task.id &&
      (t.dependsOn.includes(task.id) || mentions(t.notes).some((m) => m.toLowerCase() === title)),
  )
}

/**
 * Score how much a task deserves attention now. Combines priority, deadline
 * pressure and how many other tasks it unblocks; blocked tasks sink.
 */
export function score(task: Task, all: Task[]) {
  let s = PRIORITIES[task.priority].weight
  const n = daysUntil(task.due)
  if (n !== null) s += n < 0 ? 35 + Math.min(-n, 7) * 2 : n === 0 ? 30 : n <= 2 ? 18 : n <= 7 ? 8 : 0
  s += dependents(task, all).filter((t) => !t.done).length * 10
  if (isBlocked(task, all)) s -= 60
  return s
}

export function reasonFor(task: Task, all: Task[]) {
  const parts: string[] = []
  const n = daysUntil(task.due)
  if (n !== null && n < 0) parts.push('đã quá hạn')
  else if (n === 0) parts.push('đến hạn hôm nay')
  else if (n !== null && n <= 2) parts.push('sắp đến hạn')
  if (task.priority === 'urgent' || task.priority === 'high') parts.push(`ưu tiên ${PRIORITIES[task.priority].label.toLowerCase()}`)
  const unblocks = dependents(task, all).filter((t) => !t.done).length
  if (unblocks) parts.push(`mở khóa ${unblocks} việc khác`)
  return parts.length ? parts.join(' · ') : 'phù hợp với năng lượng hiện tại'
}
