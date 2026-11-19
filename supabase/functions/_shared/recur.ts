import { addDaysToDate, addMonthsClamped } from './time.ts'

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'

export interface RollTask {
  due: string | null
  remindAt: string | null
  repeat: Repeat
  done: boolean
  reminded: boolean
  subtasks: { done: boolean }[]
  /** Day of month a monthly series is anchored to (set on first roll). */
  repeatAnchor?: number | null
}

/** Next occurrence of a local date or datetime string; the time part is preserved. */
export function nextOccurrence(date: string, repeat: Repeat, anchorDay?: number): string {
  switch (repeat) {
    case 'daily':
      return addDaysToDate(date, 1)
    case 'weekly':
      return addDaysToDate(date, 7)
    case 'monthly':
      return addMonthsClamped(date, 1, anchorDay)
    default:
      return date
  }
}

/**
 * Complete a task: repeating tasks roll to their next occurrence and reopen; others are marked done.
 * `nowLocal` (`yyyy-mm-ddThh:mm`, the user's wall clock) makes overdue tasks skip ahead to the first future occurrence.
 */
export function rollForward<T extends RollTask>(task: T, nowLocal?: string): T & { repeatAnchor?: number | null } {
  if (task.repeat === 'none') return { ...task, done: true }
  let { due, remindAt } = task
  const anchor = task.repeat === 'monthly' ? (task.repeatAnchor ?? Number((due ?? remindAt ?? '').slice(8, 10))) || undefined : undefined
  const inFuture = () => !nowLocal || (remindAt ? remindAt > nowLocal : !due || due > nowLocal.slice(0, 10))
  for (let i = 0; i === 0 || (!inFuture() && i < 1000); i++) {
    due = due && nextOccurrence(due, task.repeat, anchor)
    remindAt = remindAt && nextOccurrence(remindAt, task.repeat, anchor)
  }
  return {
    ...task,
    due,
    remindAt,
    ...(anchor ? { repeatAnchor: anchor } : {}),
    done: false,
    reminded: false,
    subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
  }
}
