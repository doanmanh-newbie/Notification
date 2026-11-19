import { useMemo, useState } from 'react'
import { mentions, PRIORITIES, type Task } from '../lib/model'
import type { Store } from '../lib/store'

const COLORS: Record<Task['priority'], string> = { urgent: '#ef4444', high: '#f97316', medium: '#0ea5e9', low: '#a8a29e' }

export function GraphView({ store, onOpen, activeId }: { store: Store; onOpen: (id: string) => void; activeId: string | null }) {
  const [hover, setHover] = useState<string | null>(null)
  const tasks = store.tasks

  const edges = useMemo(() => {
    const list: { from: string; to: string; kind: 'dep' | 'mention' }[] = []
    for (const t of tasks) {
      for (const d of t.dependsOn) list.push({ from: d, to: t.id, kind: 'dep' })
      for (const m of mentions(t.notes)) {
        const target = tasks.find((x) => x.title.trim().toLowerCase() === m.toLowerCase())
        if (target && target.id !== t.id && !t.dependsOn.includes(target.id) && !target.dependsOn.includes(t.id))
          list.push({ from: t.id, to: target.id, kind: 'mention' })
      }
    }
    return list
  }, [tasks])

  // Group nodes by project into clusters around a circle.
  const W = 900
  const H = 600
  const positions = useMemo(() => {
    const groups = [...store.projects.map((p) => p.id), null]
    const pos: Record<string, { x: number; y: number }> = {}
    const cx = W / 2
    const cy = H / 2
    groups.forEach((g, gi) => {
      const members = tasks.filter((t) => t.projectId === g)
      const angle = (gi / groups.length) * Math.PI * 2 - Math.PI / 2
      const gx = cx + Math.cos(angle) * 210
      const gy = cy + Math.sin(angle) * 170
      members.forEach((t, i) => {
        const a = (i / Math.max(members.length, 1)) * Math.PI * 2
        const r = members.length > 1 ? 70 + members.length * 4 : 0
        pos[t.id] = { x: gx + Math.cos(a) * r, y: gy + Math.sin(a) * r }
      })
    })
    return pos
  }, [tasks, store.projects])

  const focus = hover ?? activeId
  const related = new Set<string>()
  if (focus) {
    related.add(focus)
    edges.forEach((e) => {
      if (e.from === focus) related.add(e.to)
      if (e.to === focus) related.add(e.from)
    })
  }

  return (
    <div className="wide pb-24 pt-10 sm:pt-14">
      <h1 className="font-serif text-[36px] tracking-tight text-stone-900">Bản đồ liên kết</h1>
      <p className="mt-2 max-w-prose text-[14px] text-stone-500">
        Thấy ngay việc nào kéo theo việc nào. Mũi tên liền là quan hệ phụ thuộc, nét đứt là nhắc tới bằng <code className="rounded bg-stone-100 px-1">[[tên việc]]</code>.
      </p>
      <div className="mt-6 flex flex-wrap gap-4 text-[12px] text-stone-500">
        {Object.entries(PRIORITIES).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[k as Task['priority']] }} />
            {v.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-stone-300 bg-white" /> Đã xong
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-[#fbfaf8]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#78716c" />
            </marker>
          </defs>
          {store.projects.map((p, gi) => {
            const n = store.projects.length + 1
            const angle = (gi / n) * Math.PI * 2 - Math.PI / 2
            return (
              <text key={p.id} x={W / 2 + Math.cos(angle) * 210} y={H / 2 + Math.sin(angle) * 170 - 110} textAnchor="middle" className="fill-stone-400 text-[12px] font-medium uppercase tracking-wider">
                {p.name}
              </text>
            )
          })}
          {edges.map((e, i) => {
            const a = positions[e.from]
            const b = positions[e.to]
            if (!a || !b) return null
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy) || 1
            const off = 16
            const dim = focus && !(related.has(e.from) && related.has(e.to))
            return (
              <line
                key={i}
                x1={a.x + (dx / len) * off}
                y1={a.y + (dy / len) * off}
                x2={b.x - (dx / len) * off}
                y2={b.y - (dy / len) * off}
                stroke="#78716c"
                strokeWidth={1.4}
                strokeDasharray={e.kind === 'mention' ? '4 4' : undefined}
                markerEnd={e.kind === 'dep' ? 'url(#arrow)' : undefined}
                opacity={dim ? 0.12 : 0.8}
              />
            )
          })}
          {tasks.map((t) => {
            const p = positions[t.id]
            if (!p) return null
            const dim = focus && !related.has(t.id)
            const r = t.priority === 'urgent' ? 12 : t.priority === 'high' ? 10 : 8
            return (
              <g
                key={t.id}
                transform={`translate(${p.x} ${p.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.25 : 1}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onOpen(t.id)}
              >
                <circle r={r + 6} fill="transparent" />
                <circle
                  r={r}
                  fill={t.done ? '#fff' : COLORS[t.priority]}
                  stroke={activeId === t.id ? '#1c1917' : t.done ? '#d6d3d1' : '#fff'}
                  strokeWidth={activeId === t.id ? 2.5 : 2}
                />
                <text y={r + 16} textAnchor="middle" className={`text-[12px] ${t.done ? 'fill-stone-400' : 'fill-stone-700'}`}>
                  {t.title.length > 22 ? t.title.slice(0, 21) + '…' : t.title || 'Chưa đặt tên'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
