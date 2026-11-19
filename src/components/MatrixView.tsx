import { daysUntil, score, type Task } from '../lib/model'
import type { Store } from '../lib/store'
import { TaskRow } from './TaskRow'

const QUADS = [
  { key: 'do', title: 'Làm ngay', sub: 'Quan trọng · Gấp', tone: 'border-red-200 bg-red-50/40' },
  { key: 'plan', title: 'Lên lịch', sub: 'Quan trọng · Chưa gấp', tone: 'border-sky-200 bg-sky-50/40' },
  { key: 'quick', title: 'Làm nhanh / Nhờ người', sub: 'Ít quan trọng · Gấp', tone: 'border-amber-200 bg-amber-50/40' },
  { key: 'drop', title: 'Để sau', sub: 'Ít quan trọng · Chưa gấp', tone: 'border-stone-200 bg-stone-50/60' },
] as const

function quadOf(t: Task) {
  const important = t.priority === 'urgent' || t.priority === 'high'
  const n = daysUntil(t.due)
  const soon = t.priority === 'urgent' || (n !== null && n <= 2)
  if (important && soon) return 'do'
  if (important) return 'plan'
  if (soon) return 'quick'
  return 'drop'
}

export function MatrixView({ store, onOpen, activeId }: { store: Store; onOpen: (id: string) => void; activeId: string | null }) {
  const open = store.tasks.filter((t) => !t.done)
  return (
    <div className="wide pb-24 pt-10 sm:pt-14">
      <h1 className="font-serif text-[36px] tracking-tight text-stone-900">Ma trận ưu tiên</h1>
      <p className="mt-2 max-w-prose text-[14px] text-stone-500">
        Tự động xếp theo mức ưu tiên và hạn chót. Đổi ưu tiên hoặc ngày hạn trong trang chi tiết để di chuyển việc giữa các ô.
      </p>
      <div className="mt-8 grid gap-4 @3xl:grid-cols-2">
        {QUADS.map((q) => {
          const items = open.filter((t) => quadOf(t) === q.key).sort((a, b) => score(b, store.tasks) - score(a, store.tasks))
          return (
            <section key={q.key} className={`@container min-h-[220px] min-w-0 rounded-xl border p-4 ${q.tone}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold text-stone-900">{q.title}</h2>
                <span className="text-[12px] text-stone-500">{items.length}</span>
              </div>
              <p className="text-[12px] text-stone-500">{q.sub}</p>
              <div className="mt-3 -mx-2">
                {items.length === 0 && <p className="px-2 py-3 text-[13px] text-stone-400">Trống</p>}
                {items.map((t) => (
                  <TaskRow key={t.id} task={t} store={store} onOpen={onOpen} active={activeId === t.id} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
