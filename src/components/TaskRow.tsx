import { CalendarDays, Link2, Lock, Bell, Repeat } from 'lucide-react'
import { daysUntil, dueLabel, EFFORTS, isBlocked, PRIORITIES, type Task } from '../lib/model'
import type { Store } from '../lib/store'

export function Check({ done, onToggle, disabled }: { done: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={done ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      disabled={disabled}
      className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition ${
        done ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white hover:border-stone-500'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {done && (
        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.2 5 8.5l4.5-5" />
        </svg>
      )}
    </button>
  )
}

export function PriorityChip({ task }: { task: Task }) {
  const p = PRIORITIES[task.priority]
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${p.chip}`}>
      {p.short} · {p.label}
    </span>
  )
}

export function EffortBars({ effort }: { effort: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-end gap-[2px]" title={`Độ nặng: ${EFFORTS[effort].label}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-[3px] rounded-sm ${i <= effort ? 'bg-stone-600' : 'bg-stone-200'}`} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  )
}

export function TaskRow({ task, store, onOpen, active }: { task: Task; store: Store; onOpen: (id: string) => void; active?: boolean }) {
  const blocked = isBlocked(task, store.tasks)
  const n = daysUntil(task.due)
  const project = store.projects.find((p) => p.id === task.projectId)
  const doneSubs = task.subtasks.filter((s) => s.done).length
  const links = task.dependsOn.length
  return (
    <div
      onClick={() => onOpen(task.id)}
      className={`group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition max-sm:min-h-12 [.bleed_&]:max-sm:rounded-none [.bleed_&]:max-sm:px-[var(--gutter,16px)] ${active ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
    >
      <Check done={task.done} onToggle={() => store.updateTask(task.id, { done: !task.done })} />
      <span className={`size-2 shrink-0 rounded-full ${PRIORITIES[task.priority].dot}`} title={PRIORITIES[task.priority].label} />
      <span className={`min-w-0 flex-1 truncate text-[14px] ${task.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
        {task.title || <span className="text-stone-400">Chưa đặt tên</span>}
      </span>
      <div className="flex shrink-0 items-center gap-3 text-[12px] text-stone-500">
        {blocked && !task.done && (
          <span className="inline-flex items-center gap-1 text-amber-700" title="Đang chờ việc khác">
            <Lock className="size-3.5" /> Bị chặn
          </span>
        )}
        {task.subtasks.length > 0 && <span className="tabular-nums">{doneSubs}/{task.subtasks.length}</span>}
        {links > 0 && (
          <span className="inline-flex items-center gap-1" title="Số việc phụ thuộc">
            <Link2 className="size-3.5" />
            {links}
          </span>
        )}
        {task.repeat !== 'none' && <Repeat className="size-3.5" aria-label="Việc lặp lại" />}
        {task.remindAt && !task.done && <Bell className="size-3.5" />}
        {task.due && (
          <span className={`hidden items-center gap-1 @md:inline-flex ${!task.done && n !== null && n < 0 ? 'text-red-600' : n === 0 ? 'text-orange-600' : ''}`}>
            <CalendarDays className="size-3.5" />
            {dueLabel(task.due)}
          </span>
        )}
        {project && (
          <span className="hidden items-center gap-1.5 @2xl:inline-flex">
            <span className="size-1.5 rounded-full" style={{ background: project.color }} />
            {project.name}
          </span>
        )}
        <EffortBars effort={task.effort} />
      </div>
    </div>
  )
}
