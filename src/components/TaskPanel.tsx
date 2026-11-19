import { useState } from 'react'
import { ArrowUpRight, Bell, CalendarDays, Folder, Gauge, Link2, Lock, Plus, Trash2, Unlock, X, Flag, CircleCheck, Repeat as RepeatIcon } from 'lucide-react'
import { backlinks, dependents, EFFORTS, type Effort, isBlocked, mentions, PRIORITIES, PRIORITY_ORDER, REPEATS, type Repeat, type Task } from '../lib/model'
import type { Store } from '../lib/store'
import { Check, EffortBars } from './TaskRow'

function Prop({ icon: Icon, label, children }: { icon: typeof Bell; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-start gap-2 py-1.5">
      <span className="flex items-center gap-2 pt-1 text-[13px] text-stone-500">
        <Icon className="size-4" /> {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function LinkChip({ task, onOpen, onRemove }: { task: Task; onOpen: (id: string) => void; onRemove?: () => void }) {
  return (
    <span className="group inline-flex max-w-full items-center gap-1.5 rounded-md bg-stone-100 py-0.5 pl-2 pr-1 text-[13px] text-stone-700">
      <span className={`size-1.5 shrink-0 rounded-full ${PRIORITIES[task.priority].dot}`} />
      <button onClick={() => onOpen(task.id)} className={`truncate hover:underline ${task.done ? 'text-stone-400 line-through' : ''}`}>
        {task.title || 'Chưa đặt tên'}
      </button>
      {onRemove ? (
        <button onClick={onRemove} aria-label="Gỡ liên kết" className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700">
          <X className="size-3" />
        </button>
      ) : (
        <ArrowUpRight className="size-3 text-stone-400" />
      )}
    </span>
  )
}

export function TaskPanel({ task, store, onOpen, onClose }: { task: Task; store: Store; onOpen: (id: string) => void; onClose: () => void }) {
  const [sub, setSub] = useState('')
  const [picking, setPicking] = useState(false)
  const all = store.tasks
  const up = (patch: Partial<Task>) => store.updateTask(task.id, patch)
  const blocked = isBlocked(task, all)
  const deps = task.dependsOn.map((id) => all.find((t) => t.id === id)).filter(Boolean) as Task[]
  const waiting = dependents(task, all)
  const back = backlinks(task, all).filter((t) => !waiting.includes(t))
  const mentioned = [...new Set(mentions(task.notes))]
  // Candidates for dependency: not self, not already linked, and not something that depends on this (avoid cycles).
  const candidates = all.filter((t) => t.id !== task.id && !task.dependsOn.includes(t.id) && !t.dependsOn.includes(task.id))
  const subDone = task.subtasks.filter((s) => s.done).length

  return (
    <aside className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-white lg:static lg:inset-auto lg:z-auto lg:w-[460px] lg:shrink-0 lg:border-l lg:border-stone-200">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 px-5 pt-[calc(12px+env(safe-area-inset-top))] pb-3 backdrop-blur lg:pt-3">
        <span className="text-[12px] text-stone-400">
          {store.projects.find((p) => p.id === task.projectId)?.name ?? 'Không thuộc dự án'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              store.deleteTask(task.id)
              onClose()
            }}
            className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Xóa"
          >
            <Trash2 className="size-4" />
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="px-5 pb-[calc(64px+env(safe-area-inset-bottom))] sm:px-7">
        {blocked && !task.done && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <span>Việc này đang chờ {deps.filter((d) => !d.done).map((d) => `“${d.title}”`).join(', ')}. Hoàn thành chúng trước nhé.</span>
          </div>
        )}

        <textarea
          value={task.title}
          onChange={(e) => up({ title: e.target.value })}
          placeholder="Chưa đặt tên"
          rows={1}
          autoFocus={!task.title}
          className="field-sizing-content w-full resize-none bg-transparent font-serif text-[30px] leading-tight tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
        />

        <div className="mt-4 border-b border-stone-100 pb-4">
          <Prop icon={CircleCheck} label="Trạng thái">
            <label className="inline-flex cursor-pointer items-center gap-2 pt-1 text-[13px] text-stone-700">
              <Check done={task.done} onToggle={() => up({ done: !task.done })} />
              {task.done ? 'Đã xong' : 'Đang làm'}
            </label>
          </Prop>
          <Prop icon={Flag} label="Ưu tiên">
            <div className="flex flex-wrap gap-1">
              {PRIORITY_ORDER.map((p) => (
                <button
                  key={p}
                  onClick={() => up({ priority: p })}
                  className={`rounded px-2 py-1 text-[12px] font-medium ring-1 ring-inset transition ${
                    task.priority === p ? PRIORITIES[p].chip : 'text-stone-500 ring-transparent hover:bg-stone-100'
                  }`}
                >
                  {PRIORITIES[p].label}
                </button>
              ))}
            </div>
          </Prop>
          <Prop icon={Gauge} label="Độ nặng">
            <div className="flex flex-wrap gap-1">
              {([1, 2, 3] as Effort[]).map((e) => (
                <button
                  key={e}
                  onClick={() => up({ effort: e })}
                  title={EFFORTS[e].hint}
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] font-medium transition ${
                    task.effort === e ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  {EFFORTS[e].label}
                </button>
              ))}
              <span className="ml-1 self-center text-[11px] text-stone-400">{EFFORTS[task.effort].hint}</span>
            </div>
          </Prop>
          <Prop icon={CalendarDays} label="Hạn chót">
            <input
              type="date"
              value={task.due ?? ''}
              onChange={(e) => up({ due: e.target.value || null })}
              className="rounded px-1.5 py-1 text-[13px] text-stone-700 outline-none hover:bg-stone-100"
            />
          </Prop>
          <Prop icon={Bell} label="Nhắc lúc">
            <input
              type="datetime-local"
              value={task.remindAt ?? ''}
              onChange={(e) => {
                up({ remindAt: e.target.value || null, reminded: false })
                if (e.target.value && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission()
              }}
              className="rounded px-1.5 py-1 text-[13px] text-stone-700 outline-none hover:bg-stone-100"
            />
          </Prop>
          <Prop icon={RepeatIcon} label="Lặp lại">
            <select
              value={task.repeat}
              onChange={(e) => up({ repeat: e.target.value as Repeat })}
              className="rounded px-1 py-1 text-[13px] text-stone-700 outline-none hover:bg-stone-100"
            >
              {(Object.keys(REPEATS) as Repeat[]).map((r) => (
                <option key={r} value={r}>
                  {REPEATS[r]}
                </option>
              ))}
            </select>
            {task.repeat !== 'none' && <p className="mt-0.5 px-1.5 text-[11px] text-stone-400">Đánh dấu xong sẽ tự chuyển sang lần kế tiếp</p>}
          </Prop>
          <Prop icon={Folder} label="Dự án">
            <select
              value={task.projectId ?? ''}
              onChange={(e) => up({ projectId: e.target.value || null })}
              className="rounded px-1 py-1 text-[13px] text-stone-700 outline-none hover:bg-stone-100"
            >
              <option value="">Không có</option>
              {store.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Prop>
          <Prop icon={Link2} label="Phụ thuộc vào">
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {deps.map((d) => (
                <LinkChip key={d.id} task={d} onOpen={onOpen} onRemove={() => up({ dependsOn: task.dependsOn.filter((x) => x !== d.id) })} />
              ))}
              {picking ? (
                <select
                  autoFocus
                  defaultValue=""
                  onBlur={() => setPicking(false)}
                  onChange={(e) => {
                    if (e.target.value) up({ dependsOn: [...task.dependsOn, e.target.value] })
                    setPicking(false)
                  }}
                  className="max-w-[220px] rounded border border-stone-200 px-1 py-0.5 text-[13px] outline-none"
                >
                  <option value="">Chọn việc…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || 'Chưa đặt tên'}
                    </option>
                  ))}
                </select>
              ) : (
                <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] text-stone-400 hover:bg-stone-100 hover:text-stone-700">
                  <Plus className="size-3.5" /> Thêm
                </button>
              )}
            </div>
          </Prop>
          {waiting.length > 0 && (
            <Prop icon={Unlock} label="Đang chặn">
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {waiting.map((w) => (
                  <LinkChip key={w.id} task={w} onOpen={onOpen} />
                ))}
              </div>
            </Prop>
          )}
        </div>

        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold text-stone-800">Các bước nhỏ</h3>
            {task.subtasks.length > 0 && (
              <span className="text-[12px] tabular-nums text-stone-400">
                {subDone}/{task.subtasks.length}
              </span>
            )}
          </div>
          <p className="text-[12px] text-stone-400">Chia việc lớn thành bước nhỏ để dễ bắt đầu hơn.</p>
          {task.subtasks.length > 0 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-stone-800 transition-all" style={{ width: `${(subDone / task.subtasks.length) * 100}%` }} />
            </div>
          )}
          <div className="mt-2">
            {task.subtasks.map((s) => (
              <div key={s.id} className="group flex items-center gap-2.5 py-1">
                <Check done={s.done} onToggle={() => up({ subtasks: task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })} />
                <input
                  value={s.text}
                  onChange={(e) => up({ subtasks: task.subtasks.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)) })}
                  className={`flex-1 bg-transparent text-[14px] outline-none ${s.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}
                />
                <button
                  onClick={() => up({ subtasks: task.subtasks.filter((x) => x.id !== s.id) })}
                  className="text-stone-300 opacity-0 hover:text-stone-600 group-hover:opacity-100"
                  aria-label="Xóa bước"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2.5 py-1 text-stone-400">
              <Plus className="size-[18px]" />
              <input
                value={sub}
                onChange={(e) => setSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && sub.trim()) {
                    up({ subtasks: [...task.subtasks, { id: Math.random().toString(36).slice(2), text: sub.trim(), done: false }] })
                    setSub('')
                  }
                }}
                placeholder="Thêm bước…"
                className="flex-1 bg-transparent text-[14px] text-stone-800 outline-none placeholder:text-stone-400"
              />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-[13px] font-semibold text-stone-800">Ghi chú</h3>
          <textarea
            value={task.notes}
            onChange={(e) => up({ notes: e.target.value })}
            placeholder="Viết ghi chú… Gõ [[tên việc]] để liên kết tới việc khác."
            className="field-sizing-content mt-2 min-h-[110px] w-full resize-none rounded-lg bg-stone-50 p-3 text-[14px] leading-relaxed text-stone-800 outline-none placeholder:text-stone-400 focus:bg-stone-100/70"
          />
          {mentioned.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mentioned.map((m) => {
                const target = all.find((t) => t.title.trim().toLowerCase() === m.toLowerCase())
                return target ? (
                  <LinkChip key={m} task={target} onOpen={onOpen} />
                ) : (
                  <button
                    key={m}
                    onClick={() => onOpen(store.addTask({ title: m, projectId: task.projectId }).id)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-stone-300 px-2 py-0.5 text-[13px] text-stone-500 hover:border-stone-500 hover:text-stone-800"
                  >
                    <Plus className="size-3" /> Tạo “{m}”
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-8 border-t border-stone-100 pt-4">
          <h3 className="text-[13px] font-semibold text-stone-800">Được nhắc tới ở</h3>
          {back.length === 0 ? (
            <p className="mt-1 text-[13px] text-stone-400">Chưa có trang nào liên kết tới việc này.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {back.map((b) => (
                <button key={b.id} onClick={() => onOpen(b.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-stone-700 hover:bg-stone-50">
                  <ArrowUpRight className="size-3.5 text-stone-400" />
                  <span className="flex-1 truncate">{b.title}</span>
                  <EffortBars effort={b.effort} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}
