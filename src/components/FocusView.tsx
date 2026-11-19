import { useState } from 'react'
import { ArrowRight, BatteryLow, BatteryMedium, BatteryFull, ChevronDown, Sparkles } from 'lucide-react'
import { daysUntil, EFFORTS, type Energy, isBlocked, reasonFor, score } from '../lib/model'
import type { Store } from '../lib/store'
import { Check, EffortBars, PriorityChip, TaskRow } from './TaskRow'

const ENERGY: { value: Energy; label: string; icon: typeof BatteryLow; desc: string }[] = [
  { value: 1, label: 'Mệt', icon: BatteryLow, desc: 'Chỉ gợi ý việc nhẹ' },
  { value: 2, label: 'Bình thường', icon: BatteryMedium, desc: 'Việc nhẹ và vừa' },
  { value: 3, label: 'Sung sức', icon: BatteryFull, desc: 'Sẵn sàng cho việc sâu' },
]

const CAPACITY_MIN = 6 * 60

export function FocusView({ store, onOpen, activeId }: { store: Store; onOpen: (id: string) => void; activeId: string | null }) {
  const [energy, setEnergy] = useState<Energy>(2)
  const [showRest, setShowRest] = useState(false)
  const all = store.tasks
  const open = all.filter((t) => !t.done)

  const ranked = open.filter((t) => !isBlocked(t, all)).sort((a, b) => score(b, all) - score(a, all))
  // Overdue/today tasks always surface; otherwise respect energy.
  const suggested = ranked.filter((t) => {
    const n = daysUntil(t.due)
    return t.effort <= energy || (n !== null && n <= 0)
  })
  const [first, ...next] = suggested
  const upNext = next.slice(0, 2)
  const shownIds = new Set([first?.id, ...upNext.map((t) => t.id)])
  const rest = open.filter((t) => !shownIds.has(t.id)).sort((a, b) => score(b, all) - score(a, all))

  const overdue = open.filter((t) => (daysUntil(t.due) ?? 1) < 0).length
  const dueToday = open.filter((t) => daysUntil(t.due) === 0).length
  const blocked = open.filter((t) => isBlocked(t, all)).length
  const doneToday = all.filter((t) => t.done).length

  const todayLoad = open.filter((t) => (daysUntil(t.due) ?? 99) <= 0).reduce((sum, t) => sum + EFFORTS[t.effort].minutes, 0)
  const loadPct = Math.min(100, Math.round((todayLoad / CAPACITY_MIN) * 100))
  const loadTone = loadPct > 85 ? 'bg-red-500' : loadPct > 60 ? 'bg-orange-400' : 'bg-emerald-500'

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="wide pb-24 pt-10 sm:pt-14">
      <div className="@5xl:grid @5xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] @5xl:items-start @5xl:gap-12">
        <div className="@container min-w-0">
          <p className="text-[13px] capitalize text-stone-500">{dateStr}</p>
          <h1 className="mt-1 font-serif text-[40px] leading-tight tracking-tight text-stone-900">{greet}.</h1>

          {/* Digest: one sentence so the user grasps the day at a glance */}
          <p className="mt-4 max-w-prose text-[16px] leading-relaxed text-stone-600">
            {open.length === 0 ? (
              'Không còn việc nào. Hãy nghỉ ngơi.'
            ) : (
              <>
                Bạn có <b className="font-semibold text-stone-900">{open.length} việc</b> đang mở
                {overdue > 0 && (
                  <>
                    , <b className="font-semibold text-red-600">{overdue} quá hạn</b>
                  </>
                )}
                {dueToday > 0 && (
                  <>
                    , <b className="font-semibold text-orange-600">{dueToday} đến hạn hôm nay</b>
                  </>
                )}
                {blocked > 0 && <>, {blocked} đang chờ việc khác</>}. Chỉ cần nhìn vào 3 việc bên dưới.
              </>
            )}
          </p>

          <div className="mt-8 grid gap-3 @2xl:grid-cols-[1fr_220px]">
            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Năng lượng của bạn lúc này</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {ENERGY.map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setEnergy(value)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${
                      energy === value ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Icon className="size-4" />
                    <p className="mt-1.5 text-[13px] font-medium">{label}</p>
                    <p className={`text-[11px] ${energy === value ? 'text-stone-300' : 'text-stone-500'}`}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-stone-500">Tải hôm nay</p>
              <p className="mt-2 font-serif text-[28px] tabular-nums text-stone-900">
                {Math.round((todayLoad / 60) * 10) / 10}
                <span className="text-[14px] text-stone-500"> / 6 giờ</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className={`h-full rounded-full transition-all ${loadTone}`} style={{ width: `${loadPct}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-stone-500">
                {loadPct > 85 ? 'Quá tải – cân nhắc dời bớt việc' : loadPct > 60 ? 'Khá nhiều, nghỉ giữa các việc' : 'Vừa sức'} · {doneToday} đã xong
              </p>
            </div>
          </div>

          {first ? (
            <>
              <h2 className="mt-10 flex items-center gap-2 text-[13px] font-medium text-stone-500">
                <Sparkles className="size-4" /> Bắt đầu với
              </h2>
              <div
                onClick={() => onOpen(first.id)}
                className="mt-3 cursor-pointer rounded-xl border border-stone-200 bg-[#fbfaf8] p-5 transition hover:border-stone-300 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <Check done={first.done} onToggle={() => store.updateTask(first.id, { done: true })} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[20px] font-semibold leading-snug text-stone-900">{first.title}</p>
                    <p className="mt-1 text-[13px] text-stone-500">Vì sao: {reasonFor(first, all)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-stone-500">
                      <PriorityChip task={first} />
                      <span className="inline-flex items-center gap-1.5">
                        <EffortBars effort={first.effort} /> {EFFORTS[first.effort].hint}
                      </span>
                    </div>
                    {first.subtasks.some((s) => !s.done) && (
                      <p className="mt-3 text-[13px] text-stone-700">
                        Bước tiếp theo: <span className="font-medium">{first.subtasks.find((s) => !s.done)!.text}</span>
                      </p>
                    )}
                  </div>
                  <ArrowRight className="mt-1 size-4 text-stone-400" />
                </div>
              </div>
            </>
          ) : (
            open.length > 0 && (
              <p className="mt-10 rounded-xl border border-dashed border-stone-300 p-6 text-center text-[14px] text-stone-500">
                Không có việc phù hợp với mức năng lượng này. Thử chọn mức cao hơn.
              </p>
            )
          )}
        </div>

        <aside className="@container min-w-0 @5xl:sticky @5xl:top-6 @5xl:mt-[52px]">
          {first && upNext.length > 0 && (
            <>
              <h2 className="mt-8 text-[13px] font-medium text-stone-500 @5xl:mt-0">Tiếp theo</h2>
              <div className="bleed mt-2">
                {upNext.map((t) => (
                  <div key={t.id}>
                    <TaskRow task={t} store={store} onOpen={onOpen} active={activeId === t.id} />
                    <p className="-mt-1 pb-1 pl-[54px] text-[12px] text-stone-400">{reasonFor(t, all)}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {rest.length > 0 && (
            <div className="mt-8 border-t border-stone-100 pt-4 @5xl:mt-6">
              <button onClick={() => setShowRest((v) => !v)} className="flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-stone-800">
                <ChevronDown className={`size-4 transition ${showRest ? '' : '-rotate-90'}`} />
                Để sau ({rest.length}) – ẩn đi để bạn không bị phân tâm
              </button>
              {showRest && (
                <div className="bleed mt-2">
                  {rest.map((t) => (
                    <TaskRow key={t.id} task={t} store={store} onOpen={onOpen} active={activeId === t.id} />
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
