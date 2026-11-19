import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, ChevronLeft, ChevronRight, MoveRight, Plus } from 'lucide-react'
import { dayLoad, freeDays, groupByDay, type LoadLevel, lightestToMove, monthGrid, moveToDay, taskDay, weekDays } from '../lib/calendar'
import { addDaysToDate } from '../../supabase/functions/_shared/time.ts'
import { dueLabel, EFFORTS, PRIORITIES, type Task, toISO, todayISO } from '../lib/model'
import type { Store } from '../lib/store'
import { Check } from './TaskRow'

/** Custom drag type so a dragged task is never pasted into text fields, and foreign drags are ignored. */
const DRAG_TYPE = 'application/x-nhacviec-task'
const pad = (n: number) => String(n).padStart(2, '0')
const nowLocal = () => {
  const d = new Date()
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MODE_KEY = 'nhac-nho-calendar-mode'
type Mode = 'month' | 'week'
const LOAD_BAR: Record<LoadLevel, string> = { free: 'bg-transparent', ok: 'bg-emerald-400', busy: 'bg-amber-400', over: 'bg-red-500' }
const LOAD_TEXT: Record<LoadLevel, string> = { free: 'Trống', ok: 'Vừa sức', busy: 'Khá nhiều', over: 'Quá tải' }

const dayNum = (day: string) => Number(day.slice(8, 10))
const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
function longDate(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })
}

/** Month calendar for planning: tasks on their due day, daily load against 6 hours, drag to reschedule. */
export function CalendarView({ store, onOpen, activeId }: { store: Store; onOpen: (id: string) => void; activeId: string | null }) {
  const today = todayISO()
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))
  const [selected, setSelected] = useState(today)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const panel = useRef<HTMLElement>(null)
  const [mode, setModeState] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) === 'week' ? 'week' : 'month'))
  const setMode = (m: Mode) => {
    setModeState(m)
    localStorage.setItem(MODE_KEY, m)
    setMonth({ y: Number(selected.slice(0, 4)), m: Number(selected.slice(5, 7)) - 1 }) // keep the selected day in view
  }

  // On narrow screens the day panel sits below the grid: bring it into view after picking a day.
  const pick = (day: string) => {
    setSelected(day)
    if (window.matchMedia('(max-width: 1279px)').matches) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const grid = useMemo(() => monthGrid(month.y, month.m), [month])
  const week = useMemo(() => weekDays(selected), [selected])
  // What is shown follows the project filter; load and suggestions always count every project (real workload).
  const byDay = useMemo(() => groupByDay(store.tasks, projectId), [store.tasks, projectId])
  const allByDay = useMemo(() => groupByDay(store.tasks), [store.tasks])
  const inMonth = (day: string) => Number(day.slice(5, 7)) - 1 === month.m
  const shift = (n: number) => {
    if (mode === 'week') {
      const d = addDaysToDate(selected, 7 * n)
      setSelected(d)
      setMonth({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 })
      return
    }
    const y = month.m + n < 0 ? month.y - 1 : month.m + n > 11 ? month.y + 1 : month.y
    const m = (month.m + n + 12) % 12
    setMonth({ y, m })
    setSelected(`${y}-${pad(m + 1)}-01`)
  }
  const goToday = () => {
    setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })
    setSelected(today)
  }

  const move = (taskId: string, day: string) => {
    const task = store.tasks.find((t) => t.id === taskId)
    if (task && taskDay(task) !== day) store.updateTask(task.id, moveToDay(task, day, nowLocal()))
    setSelected(day)
    setMonth({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 }) // follow the task into its new month
  }

  const dayTasks = byDay.get(selected) ?? []
  const load = dayLoad(allByDay.get(selected) ?? [])
  const candidate = load.level === 'over' ? lightestToMove(allByDay.get(selected) ?? []) : null
  const suggestions = candidate ? freeDays(selected < today ? today : selected, allByDay, 3, 21, EFFORTS[candidate.effort].minutes) : []
  const visible = mode === 'month' ? grid.filter(inMonth) : week
  const monthOpen = visible.reduce((n, d) => n + (byDay.get(d) ?? []).filter((t) => !t.done).length, 0)
  const monthOver = visible.filter((d) => dayLoad(allByDay.get(d) ?? []).level === 'over').length
  const rangeLabel = mode === 'month' ? `Tháng ${month.m + 1}, ${month.y}` : `${dm(week[0])} – ${dm(week[6])}/${week[6].slice(0, 4)}`

  // Drop target props for week columns.
  const dropZone = (day: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      setDragOver(day)
    },
    onDragLeave: () => setDragOver((d) => (d === day ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(null)
      const id = e.dataTransfer.getData(DRAG_TYPE)
      if (id) move(id, day)
    },
  })

  const addQuick = () => {
    if (!draft.trim()) return
    store.addTask({ title: draft.trim(), due: selected, projectId })
    setDraft('')
  }

  return (
    <div className="wide pb-24 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[36px] tracking-tight text-stone-900">Lịch</h1>
          <p className="mt-1 max-w-prose text-[14px] text-stone-500">
            {mode === 'month' ? `Tháng ${month.m + 1}/${month.y}` : `Tuần ${dm(week[0])} – ${dm(week[6])}`}: {monthOpen} việc chưa xong
            {monthOver > 0 && <span className="text-red-600"> · {monthOver} ngày quá tải</span>}.
            <span className="hidden @3xl:inline"> Kéo một việc sang ngày khác để dời hạn.</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="rounded-md bg-white px-2 py-1.5 text-stone-700 ring-1 ring-stone-200 outline-none hover:ring-stone-300"
            aria-label="Lọc theo dự án"
          >
            <option value="">Tất cả dự án</option>
            {store.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-md p-0.5 ring-1 ring-stone-200" role="group" aria-label="Chế độ xem">
            {(['month', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                aria-pressed={mode === v}
                className={`rounded px-2.5 py-1 ${mode === v ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                {v === 'month' ? 'Tháng' : 'Tuần'}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-md ring-1 ring-stone-200">
            <button
              onClick={() => shift(-1)}
              className="rounded-l-md p-1.5 text-stone-500 hover:bg-stone-100"
              aria-label={mode === 'month' ? 'Tháng trước' : 'Tuần trước'}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[124px] text-center font-medium tabular-nums text-stone-800">{rangeLabel}</span>
            <button
              onClick={() => shift(1)}
              className="rounded-r-md p-1.5 text-stone-500 hover:bg-stone-100"
              aria-label={mode === 'month' ? 'Tháng sau' : 'Tuần sau'}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button onClick={goToday} className="rounded-md px-2.5 py-1.5 text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100">
            Hôm nay
          </button>
        </div>
      </div>

      <div className={`mt-6 ${mode === 'month' ? '@5xl:grid @5xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] @5xl:items-start @5xl:gap-8' : ''}`}>
        {/* Month grid / week columns */}
        <div className="@container min-w-0">
          {mode === 'week' ? (
            <div className="grid gap-2 @3xl:grid-cols-7">
              {week.map((day, i) => {
                const tasks = byDay.get(day) ?? []
                const l = dayLoad(allByDay.get(day) ?? [])
                return (
                  <section
                    key={day}
                    {...dropZone(day)}
                    aria-label={`${longDate(day)}: ${tasks.length} việc, ${LOAD_TEXT[l.level]}`}
                    className={`flex min-w-0 flex-col rounded-xl border p-2 transition @3xl:min-h-[440px] ${
                      selected === day ? 'border-stone-400 bg-stone-50' : 'border-stone-200 bg-white'
                    } ${dragOver === day ? 'ring-2 ring-sky-400' : ''}`}
                  >
                    <button onClick={() => pick(day)} className="flex items-center justify-between gap-1 rounded-md px-1 py-0.5 text-left hover:bg-stone-100">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{WEEKDAYS[i]}</span>
                      <span
                        className={`grid size-7 place-items-center rounded-full text-[13px] tabular-nums ${
                          day === today ? 'bg-stone-900 font-semibold text-white' : 'text-stone-800'
                        }`}
                      >
                        {dayNum(day)}
                      </span>
                    </button>
                    <div className="mt-1 px-1" title={`${LOAD_TEXT[l.level]} · ${l.pct}%`}>
                      <div className="flex justify-between text-[11px] text-stone-400">
                        <span>{Math.round((l.minutes / 60) * 10) / 10}/6 giờ</span>
                        {l.level === 'over' && <span className="font-medium text-red-600">Quá tải</span>}
                      </div>
                      <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-stone-100">
                        <div className={`h-full rounded-full ${LOAD_BAR[l.level]}`} style={{ width: `${Math.min(100, l.pct)}%` }} />
                      </div>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {tasks.length === 0 && <li className="px-1 text-[12px] text-stone-300">Trống</li>}
                      {tasks.map((t) => (
                        <li key={t.id}>
                          <WeekCard task={t} overdue={!t.done && !!t.due && t.due < today} active={activeId === t.id} onOpen={onOpen} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-stone-400">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="pb-2">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-stone-200 bg-stone-200 [gap:1px]">
                {grid.map((day) => {
                  const tasks = byDay.get(day) ?? []
                  const l = dayLoad(allByDay.get(day) ?? [])
                  const isToday = day === today
                  return (
                    <div
                      key={day}
                      role="button"
                      tabIndex={0}
                      aria-label={`${longDate(day)}: ${tasks.length} việc, ${LOAD_TEXT[l.level]}`}
                      onClick={() => pick(day)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return // keys on a task chip belong to the chip
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          pick(day)
                        }
                      }}
                      onDragOver={(e) => {
                        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
                        e.preventDefault()
                        setDragOver(day)
                      }}
                      onDragLeave={() => setDragOver((d) => (d === day ? null : d))}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(null)
                        const id = e.dataTransfer.getData(DRAG_TYPE)
                        if (id) move(id, day)
                      }}
                      className={`relative flex min-h-[64px] cursor-pointer flex-col bg-white p-1 text-left outline-none transition @xl:min-h-[104px] @xl:p-1.5 ${
                        inMonth(day) ? '' : 'bg-stone-50 text-stone-400'
                      } ${selected === day ? 'bg-stone-100' : 'hover:bg-stone-50'} ${dragOver === day ? 'ring-2 ring-inset ring-sky-400' : ''} focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-500`}
                    >
                      <span
                        className={`grid size-6 place-items-center self-start rounded-full text-[12px] tabular-nums ${
                          isToday ? 'bg-stone-900 font-semibold text-white' : inMonth(day) ? 'text-stone-700' : ''
                        }`}
                      >
                        {dayNum(day)}
                      </span>

                      {/* narrow: dots only */}
                      <div className="mt-1 flex flex-wrap gap-0.5 @xl:hidden">
                        {tasks.slice(0, 6).map((t) => (
                          <span key={t.id} className={`size-1.5 rounded-full ${t.done ? 'bg-stone-300' : PRIORITIES[t.priority].dot}`} />
                        ))}
                      </div>

                      {/* wide: up to 3 draggable chips */}
                      <div className="mt-1 hidden min-w-0 flex-col gap-0.5 @xl:flex">
                        {tasks.slice(0, 3).map((t) => (
                          <Chip key={t.id} task={t} overdue={!t.done && !!t.due && t.due < today} active={activeId === t.id} onOpen={onOpen} />
                        ))}
                        {tasks.length > 3 && <span className="px-1 text-[11px] text-stone-500">+{tasks.length - 3} việc</span>}
                      </div>

                      {l.level !== 'free' && (
                        <span
                          className="absolute inset-x-1 bottom-1 h-[3px] overflow-hidden rounded-full bg-stone-100"
                          title={`${LOAD_TEXT[l.level]} · ${l.pct}%`}
                        >
                          <span className={`block h-full rounded-full ${LOAD_BAR[l.level]}`} style={{ width: `${Math.min(100, l.pct)}%` }} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
            <span>Tải ngày (6 giờ):</span>
            {(['ok', 'busy', 'over'] as LoadLevel[]).map((lv) => (
              <span key={lv} className="inline-flex items-center gap-1">
                <span className={`h-[3px] w-4 rounded-full ${LOAD_BAR[lv]}`} /> {LOAD_TEXT[lv]}
              </span>
            ))}
          </div>
        </div>

        {/* Selected day */}
        <aside
          ref={panel}
          className={`mt-6 min-w-0 scroll-mt-16 rounded-xl border border-stone-200 p-4 ${mode === 'month' ? '@5xl:sticky @5xl:top-6 @5xl:mt-[26px]' : 'max-w-2xl'}`}
        >
          <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">{selected === today ? 'Hôm nay' : 'Ngày đã chọn'}</p>
          <h2 className="mt-0.5 font-serif text-[22px] capitalize leading-tight text-stone-900">{longDate(selected)}</h2>

          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[12px] text-stone-500">
              <span>
                {Math.round((load.minutes / 60) * 10) / 10} / 6 giờ · {LOAD_TEXT[load.level]}
              </span>
              <span className="tabular-nums">{load.pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className={`h-full rounded-full ${LOAD_BAR[load.level]}`} style={{ width: `${Math.min(100, load.pct)}%` }} />
            </div>
          </div>

          {load.level === 'over' && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-[13px] text-red-800">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Ngày này vượt 6 giờ làm việc.
                  {suggestions.length > 0 && <> Ngày còn trống gần nhất: {suggestions.map(dm).join(', ')}.</>}
                </span>
              </p>
              {candidate && suggestions[0] && (
                <button
                  onClick={() => move(candidate.id, suggestions[0])}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[12px] font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100"
                >
                  <MoveRight className="size-3.5" /> Dời “{candidate.title || 'Chưa đặt tên'}” sang {dm(suggestions[0])}
                </button>
              )}
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {dayTasks.length === 0 && <li className="text-[13px] text-stone-400">Chưa có việc nào. Thêm việc bên dưới hoặc kéo một việc vào ngày này.</li>}
            {dayTasks.map((t) => (
              <DayItem key={t.id} task={t} store={store} onOpen={onOpen} overdue={!t.done && !!t.due && t.due < today} onMove={(day) => move(t.id, day)} />
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2 rounded-md px-1 py-1 ring-1 ring-stone-200 focus-within:ring-stone-400">
            <Plus className="size-4 shrink-0 text-stone-400" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addQuick()}
              aria-label={`Thêm việc hạn ${dm(selected)}`}
              placeholder={`Thêm việc hạn ${dm(selected)}…`}
              className="min-w-0 flex-1 bg-transparent py-1 text-[14px] text-stone-800 outline-none placeholder:text-stone-400"
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Chip({ task, overdue, active, onOpen }: { task: Task; overdue: boolean; active: boolean; onOpen: (id: string) => void }) {
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(task.id)
      }}
      title={task.notes ? `${task.title}\n\n${task.notes}` : task.title}
      className={`flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[11.5px] leading-tight transition ${
        active ? 'bg-stone-200' : 'hover:bg-stone-100'
      } ${task.done ? 'text-stone-400 line-through' : overdue ? 'text-red-600' : 'text-stone-700'}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${task.done ? 'bg-stone-300' : PRIORITIES[task.priority].dot}`} />
      <span className="truncate">{task.title || 'Chưa đặt tên'}</span>
    </button>
  )
}

function DayItem({
  task,
  store,
  onOpen,
  overdue,
  onMove,
}: {
  task: Task
  store: Store
  onOpen: (id: string) => void
  overdue: boolean
  onMove: (day: string) => void
}) {
  const time = task.remindAt ? task.remindAt.slice(11, 16) : null
  const due = dueLabel(task.due)
  return (
    <li className="flex gap-2.5">
      <div className="pt-0.5">
        <Check done={task.done} onToggle={() => store.updateTask(task.id, { done: !task.done })} />
      </div>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => onOpen(task.id)}
          className={`block max-w-full truncate text-left text-[14px] font-medium hover:underline ${task.done ? 'text-stone-400 line-through' : 'text-stone-900'}`}
        >
          {task.title || 'Chưa đặt tên'}
        </button>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-stone-500">
          <span className={`inline-flex items-center gap-1`}>
            <span className={`size-1.5 rounded-full ${PRIORITIES[task.priority].dot}`} /> {PRIORITIES[task.priority].label}
          </span>
          {due && <span className={overdue ? 'font-medium text-red-600' : ''}>Hạn: {due}</span>}
          {time && (
            <span className="inline-flex items-center gap-1">
              <Bell className="size-3" /> nhắc {time}
            </span>
          )}
        </p>
        {task.notes.trim() && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-stone-600">{task.notes}</p>}
        {!task.done && (
          <label className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-stone-500">
            Dời sang
            <input
              type="date"
              value=""
              onChange={(e) => e.target.value && onMove(e.target.value)}
              className="rounded px-1 py-0.5 text-[12px] text-stone-700 ring-1 ring-stone-200 outline-none hover:ring-stone-300"
              aria-label={`Dời “${task.title}” sang ngày khác`}
            />
          </label>
        )}
      </div>
    </li>
  )
}

/** Week view card: full title, reminder time, overdue flag and the first lines of the note. Draggable. */
function WeekCard({ task, overdue, active, onOpen }: { task: Task; overdue: boolean; active: boolean; onOpen: (id: string) => void }) {
  const time = task.remindAt ? task.remindAt.slice(11, 16) : null
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onOpen(task.id)}
      className={`block w-full rounded-lg border px-2 py-1.5 text-left transition ${
        active ? 'border-stone-400 bg-stone-100' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
      }`}
    >
      <span
        className={`flex items-start gap-1.5 text-[12.5px] font-medium leading-snug ${task.done ? 'text-stone-400 line-through' : overdue ? 'text-red-600' : 'text-stone-800'}`}
      >
        <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${task.done ? 'bg-stone-300' : PRIORITIES[task.priority].dot}`} />
        <span className="line-clamp-2">{task.title || 'Chưa đặt tên'}</span>
      </span>
      {(time || overdue) && (
        <span className="mt-0.5 flex items-center gap-1.5 pl-3 text-[11px] text-stone-500">
          {time && (
            <span className="inline-flex items-center gap-0.5">
              <Bell className="size-3" /> {time}
            </span>
          )}
          {overdue && <span className="text-red-600">{dueLabel(task.due)}</span>}
        </span>
      )}
      {task.notes.trim() && !task.done && <span className="mt-0.5 line-clamp-2 pl-3 text-[11.5px] leading-snug text-stone-500">{task.notes}</span>}
    </button>
  )
}
