// Pure calendar helpers. Dates are local wall-clock strings (yyyy-mm-dd) — no timezone maths.
import { addDaysToDate } from '../../supabase/functions/_shared/time.ts'
import { EFFORTS, PRIORITY_ORDER, type Task } from './model'

/** Same daily capacity as "Tải hôm nay" on the Focus view: 6 hours. */
export const CAPACITY_MIN = 6 * 60

export type LoadLevel = 'free' | 'ok' | 'busy' | 'over'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m0: number, d: number) => {
  const dt = new Date(Date.UTC(y, m0, d))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** 6 weeks × 7 days, Monday first, covering the given month (month0 = 0..11). */
export function monthGrid(year: number, month0: number): string[] {
  const weekday = new Date(Date.UTC(year, month0, 1)).getUTCDay() // 0 = Sunday
  const back = (weekday + 6) % 7 // days since Monday
  return Array.from({ length: 42 }, (_, i) => iso(year, month0, 1 - back + i))
}

/** The 7 days (Monday → Sunday) of the week containing `day`. */
export function weekDays(day: string): string[] {
  const [y, m, d] = day.split('-').map(Number)
  const back = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => iso(y, m - 1, d - back + i))
}

/** The day a task belongs to on the calendar: its due date, else the day of its reminder. */
export function taskDay(t: Task): string | null {
  return t.due ?? (t.remindAt ? t.remindAt.slice(0, 10) : null)
}

const rank = (t: Task) => PRIORITY_ORDER.indexOf(t.priority)

/** Tasks per day (optionally one project). Open before done, then priority, then reminder time. */
export function groupByDay(tasks: Task[], projectId?: string | null): Map<string, Task[]> {
  const by = new Map<string, Task[]>()
  for (const t of tasks) {
    if (projectId && t.projectId !== projectId) continue
    const day = taskDay(t)
    if (!day) continue
    const list = by.get(day)
    if (list) list.push(t)
    else by.set(day, [t])
  }
  for (const list of by.values())
    list.sort((a, b) => Number(a.done) - Number(b.done) || rank(a) - rank(b) || (a.remindAt ?? '~').localeCompare(b.remindAt ?? '~'))
  return by
}

/** Planned effort of the open tasks of one day against a 6-hour capacity. */
export function dayLoad(tasks: Task[]): { minutes: number; pct: number; level: LoadLevel } {
  const minutes = tasks.filter((t) => !t.done).reduce((sum, t) => sum + EFFORTS[t.effort].minutes, 0)
  const pct = Math.round((minutes / CAPACITY_MIN) * 100)
  const level: LoadLevel = minutes === 0 ? 'free' : pct > 100 ? 'over' : pct > 60 ? 'busy' : 'ok'
  return { minutes, pct, level }
}

/** Whole days from `a` to `b` (both yyyy-mm-dd). */
export function daysBetween(a: string, b: string): number {
  const ms = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
  return Math.round((ms(b) - ms(a)) / 86400000)
}

/**
 * Patch that moves a task so it lands on `day`. Due date and reminder shift by the same number of days, so
 * "remind me the day before at 08:00" stays the day before. A task without a due date only moves its reminder.
 * The reminder is re-armed only if its new time is still ahead (`nowLocal` = yyyy-mm-ddThh:mm; omitted = re-arm).
 */
export function moveToDay(t: Task, day: string, nowLocal?: string): Partial<Task> {
  const from = taskDay(t) ?? day
  const diff = daysBetween(from, day)
  const patch: Partial<Task> = {}
  if (t.due) patch.due = addDaysToDate(t.due, diff)
  else if (!t.remindAt) patch.due = day
  if (t.remindAt) {
    patch.remindAt = addDaysToDate(t.remindAt, diff)
    if (!nowLocal || patch.remindAt > nowLocal) patch.reminded = false
  }
  return patch
}

const FREE_LIMIT_MIN = CAPACITY_MIN * 0.6

/** Next days after `from` that stay within "ok" load (≤ 60%) even after adding `extraMinutes`. */
export function freeDays(from: string, byDay: Map<string, Task[]>, count = 3, horizon = 21, extraMinutes = 0): string[] {
  const out: string[] = []
  for (let i = 1; i <= horizon && out.length < count; i++) {
    const day = addDaysToDate(from, i)
    if (dayLoad(byDay.get(day) ?? []).minutes + extraMinutes <= FREE_LIMIT_MIN) out.push(day)
  }
  return out
}

/** The open task cheapest to move away: lowest priority first, then lightest. */
export function lightestToMove(tasks: Task[]): Task | null {
  const open = tasks.filter((t) => !t.done)
  if (!open.length) return null
  return [...open].sort((a, b) => rank(b) - rank(a) || a.effort - b.effort)[0]
}
