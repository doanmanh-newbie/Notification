// Pure date helpers shared by the web client and Supabase Edge Functions (Deno).
// Never depend on the timezone of the machine running the code: only Date.UTC / getUTC*.

const pad = (n: number) => String(n).padStart(2, '0')

function parseLocal(local: string) {
  const [d, t = '00:00'] = local.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  return { y, m, day, hh, mm }
}

function formatUtcParts(ms: number, withTime: boolean) {
  const d = new Date(ms)
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  return withTime ? `${date}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date
}

/** Local wall-clock `yyyy-mm-ddThh:mm` → UTC ISO. `offsetMin` follows Date#getTimezoneOffset (Vietnam = -420). */
export function toUtcIso(local: string, offsetMin: number): string {
  const { y, m, day, hh, mm } = parseLocal(local)
  return new Date(Date.UTC(y, m - 1, day, hh, mm) + offsetMin * 60000).toISOString()
}

/** UTC instant → local wall-clock `yyyy-mm-ddThh:mm`. */
export function toLocal(utcMs: number, offsetMin: number): string {
  return formatUtcParts(utcMs - offsetMin * 60000, true)
}

/** Add days to `yyyy-mm-dd` or `yyyy-mm-ddThh:mm`, keeping the time part. */
export function addDaysToDate(date: string, n: number): string {
  const { y, m, day, hh, mm } = parseLocal(date)
  return formatUtcParts(Date.UTC(y, m - 1, day + n, hh, mm), date.includes('T'))
}

/**
 * Add months, clamping to the last day of the target month (31/01 + 1 → 28/02). Keeps the time part.
 * `anchorDay` (the day the series started on) stops the drift 31 → 28 → 28: 28/02 + 1 with anchor 31 → 31/03.
 */
export function addMonthsClamped(date: string, n: number, anchorDay?: number): string {
  const { y, m, day: d0, hh, mm } = parseLocal(date)
  const day = anchorDay ?? d0
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate()
  return formatUtcParts(Date.UTC(y, m - 1 + n, Math.min(day, lastDay), hh, mm), date.includes('T'))
}
