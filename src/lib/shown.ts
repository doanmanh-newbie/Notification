// Remembers which in-app reminders this device already showed, so a reload does not repeat them.
const KEY = 'nhac-nho-shown'

export const reminderKey = (id: string, remindAt: string) => `${id}@${remindAt}`

/** Drop keys whose task is gone or whose reminder time changed. */
export function pruneShown(keys: string[], tasks: { id: string; remindAt: string | null }[]): string[] {
  const live = new Set(tasks.filter((t) => t.remindAt).map((t) => reminderKey(t.id, t.remindAt!)))
  return keys.filter((k) => live.has(k))
}

export function loadShown(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw : [])
  } catch {
    return new Set()
  }
}

export function saveShown(keys: Set<string>, tasks: { id: string; remindAt: string | null }[]) {
  localStorage.setItem(KEY, JSON.stringify(pruneShown([...keys], tasks)))
}
