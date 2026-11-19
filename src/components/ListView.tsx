import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PRIORITIES, PRIORITY_ORDER, type Priority, score } from '../lib/model'
import type { Store } from '../lib/store'
import { TaskRow } from './TaskRow'

export function ListView({
  store,
  onOpen,
  activeId,
  projectId,
}: {
  store: Store
  onOpen: (id: string) => void
  activeId: string | null
  projectId: string | null
}) {
  const [showDone, setShowDone] = useState(false)
  const project = store.projects.find((p) => p.id === projectId)
  const tasks = store.tasks.filter((t) => (projectId ? t.projectId === projectId : true))
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  return (
    <div className="wide pb-24 pt-10 sm:pt-14">
      <h1 className="flex items-center gap-3 font-serif text-[36px] tracking-tight text-stone-900">
        {project && <span className="size-3 rounded-full" style={{ background: project.color }} />}
        {project ? project.name : 'Tất cả việc'}
      </h1>
      <p className="mt-2 max-w-prose text-[14px] text-stone-500">Nhóm theo mức độ ưu tiên. Trong mỗi nhóm, việc cần chú ý nhất nằm trên cùng.</p>

      <div className="grid @5xl:grid-cols-2 @5xl:gap-x-10 @7xl:grid-cols-3">
        {PRIORITY_ORDER.map((p) => (
          <Group
            key={p}
            priority={p}
            tasks={open.filter((t) => t.priority === p).sort((a, b) => score(b, store.tasks) - score(a, store.tasks))}
            store={store}
            onOpen={onOpen}
            activeId={activeId}
            projectId={projectId}
          />
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-10">
          <button onClick={() => setShowDone((v) => !v)} className="text-[13px] text-stone-500 hover:text-stone-800">
            {showDone ? 'Ẩn' : 'Hiện'} {done.length} việc đã xong
          </button>
          {showDone && (
            <div className="bleed mt-2">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} store={store} onOpen={onOpen} active={activeId === t.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Group({
  priority,
  tasks,
  store,
  onOpen,
  activeId,
  projectId,
}: {
  priority: Priority
  tasks: ReturnType<Store['addTask']>[]
  store: Store
  onOpen: (id: string) => void
  activeId: string | null
  projectId: string | null
}) {
  const [draft, setDraft] = useState('')
  const p = PRIORITIES[priority]
  const add = () => {
    if (!draft.trim()) return
    store.addTask({ title: draft.trim(), priority, projectId })
    setDraft('')
  }
  return (
    <section className="@container mt-9 min-w-0">
      <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
        <span className={`size-2 rounded-full ${p.dot}`} />
        <h2 className="text-[13px] font-semibold text-stone-800">{p.label}</h2>
        <span className="text-[12px] text-stone-400">{tasks.length}</span>
      </div>
      <div className="bleed mt-1">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} store={store} onOpen={onOpen} active={activeId === t.id} />
        ))}
        <div className="flex items-center gap-3 px-2 py-1.5 text-stone-400">
          <Plus className="size-4" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Thêm việc mới…"
            className="flex-1 bg-transparent text-[14px] text-stone-800 outline-none placeholder:text-stone-400"
          />
        </div>
      </div>
    </section>
  )
}
