import { useEffect, useState } from 'react'
import { CalendarDays, Grid2x2, ListTodo, Network, Plus, RotateCcw, Sun, Menu, X } from 'lucide-react'
import { useStore } from './lib/store'
import { FocusView } from './components/FocusView'
import { ListView } from './components/ListView'
import { MatrixView } from './components/MatrixView'
import { GraphView } from './components/GraphView'
import { CalendarView } from './components/CalendarView'
import { TaskPanel } from './components/TaskPanel'
import { Reminders } from './components/Reminders'
import { daysUntil } from './lib/model'
import { useSession } from './lib/auth'
import { useSync } from './lib/sync'
import { Account } from './components/Account'
import { PushCard } from './components/PushCard'

type View = 'focus' | 'list' | 'calendar' | 'matrix' | 'graph'

const NAV: { id: View; label: string; icon: typeof Sun }[] = [
  { id: 'focus', label: 'Tập trung hôm nay', icon: Sun },
  { id: 'list', label: 'Tất cả việc', icon: ListTodo },
  { id: 'calendar', label: 'Lịch', icon: CalendarDays },
  { id: 'matrix', label: 'Ma trận ưu tiên', icon: Grid2x2 },
  { id: 'graph', label: 'Bản đồ liên kết', icon: Network },
]

export default function App() {
  const store = useStore()
  const { session, recovery, endRecovery } = useSession()
  const sync = useSync(store, session)
  const [view, setView] = useState<View>('focus')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.search).get('task'))
  const [newProject, setNewProject] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  // Tapping a notification focuses the app and asks it to open that task.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.data?.type === 'open-task' && e.data.taskId && setOpenId(e.data.taskId)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [])
  const openTask = store.tasks.find((t) => t.id === openId) ?? null
  const overdue = store.tasks.filter((t) => !t.done && (daysUntil(t.due) ?? 1) <= 0).length

  const go = (v: View, p: string | null = null) => {
    setView(v)
    setProjectId(p)
    setNavOpen(false)
  }

  const sidebar = (
    <nav className="flex h-full w-[248px] flex-col overflow-y-auto bg-[#f7f6f3] px-2 py-3 text-[14px] max-md:pt-[calc(12px+env(safe-area-inset-top))] max-md:pb-[calc(12px+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="grid size-6 place-items-center rounded bg-stone-900 font-serif text-[13px] text-white">N</span>
        <span className="font-semibold text-stone-800">Nhắc Việc</span>
      </div>
      <button
        onClick={() => {
          const t = store.addTask({ projectId })
          setOpenId(t.id)
          setNavOpen(false)
        }}
        className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-stone-600 hover:bg-stone-200/60"
      >
        <Plus className="size-4" /> Việc mới
      </button>
      <div className="mt-3 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
              view === id && !projectId ? 'bg-stone-200/80 font-medium text-stone-900' : 'text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {id === 'focus' && overdue > 0 && <span className="rounded bg-red-100 px-1.5 text-[11px] font-medium text-red-700">{overdue}</span>}
          </button>
        ))}
      </div>

      <p className="mt-6 px-2 text-[11px] font-medium uppercase tracking-wider text-stone-400">Dự án</p>
      <div className="mt-1 space-y-0.5">
        {store.projects.map((p) => {
          const count = store.tasks.filter((t) => t.projectId === p.id && !t.done).length
          return (
            <button
              key={p.id}
              onClick={() => go('list', p.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                projectId === p.id ? 'bg-stone-200/80 font-medium text-stone-900' : 'text-stone-600 hover:bg-stone-200/60'
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-[12px] text-stone-400">{count}</span>
            </button>
          )
        })}
        {newProject !== null ? (
          <input
            autoFocus
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            onBlur={() => setNewProject(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newProject.trim()) {
                store.addProject(newProject.trim())
                setNewProject(null)
              }
              if (e.key === 'Escape') setNewProject(null)
            }}
            placeholder="Tên dự án…"
            className="w-full rounded-md bg-white px-2 py-1.5 text-[14px] outline-none ring-1 ring-stone-300"
          />
        ) : (
          <button
            onClick={() => setNewProject('')}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-600"
          >
            <Plus className="size-4" /> Thêm dự án
          </button>
        )}
      </div>

      <div className="mt-auto px-2 pt-6">
        <Account session={session} status={sync.status} store={store} recovery={recovery} onRecovered={endRecovery}>
          {session && <PushCard userId={session.user.id} store={store} />}
        </Account>
        <div className="mt-3 rounded-lg bg-white/70 p-3 text-[12px] leading-relaxed text-stone-500 ring-1 ring-stone-200">
          Mẹo: gõ <code className="rounded bg-stone-100 px-1 text-stone-700">[[tên việc]]</code> trong ghi chú để liên kết các trang với nhau.
        </div>
        {!session && (
          <button
            onClick={() => {
              if (confirm('Khôi phục dữ liệu mẫu? Mọi thay đổi sẽ mất.')) {
                store.reset()
                setOpenId(null)
              }
            }}
            className="mt-3 flex items-center gap-2 text-[12px] text-stone-400 hover:text-stone-700"
          >
            <RotateCcw className="size-3.5" /> Khôi phục dữ liệu mẫu
          </button>
        )}
      </div>
    </nav>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-stone-800">
      <div className="hidden shrink-0 border-r border-stone-200 md:block">{sidebar}</div>
      {navOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="shadow-xl">{sidebar}</div>
          <button className="flex-1 bg-black/20" onClick={() => setNavOpen(false)} aria-label="Đóng menu" />
        </div>
      )}

      <main className="@container relative min-w-0 flex-1 overflow-y-auto pb-safe">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-100 bg-white/90 pt-[calc(8px+env(safe-area-inset-top))] pb-2 pr-[calc(16px+env(safe-area-inset-right))] pl-[calc(12px+env(safe-area-inset-left))] backdrop-blur md:hidden">
          <button onClick={() => setNavOpen(true)} className="rounded-md p-1.5 hover:bg-stone-100" aria-label="Mở menu">
            {navOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="text-[14px] font-medium">Nhắc Việc</span>
        </div>
        {view === 'focus' && <FocusView store={store} onOpen={setOpenId} activeId={openId} />}
        {view === 'list' && <ListView store={store} onOpen={setOpenId} activeId={openId} projectId={projectId} />}
        {view === 'matrix' && <MatrixView store={store} onOpen={setOpenId} activeId={openId} />}
        {view === 'graph' && <GraphView store={store} onOpen={setOpenId} activeId={openId} />}
        {view === 'calendar' && <CalendarView store={store} onOpen={setOpenId} activeId={openId} />}
      </main>

      {openTask && <TaskPanel key={openTask.id} task={openTask} store={store} onOpen={setOpenId} onClose={() => setOpenId(null)} />}
      <Reminders store={store} onOpen={setOpenId} synced={!!session} />
    </div>
  )
}
