import { useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import type { Store } from '../lib/store'
import { toISO } from '../lib/model'
import { IS_DESKTOP_SHELL, pushState } from '../lib/push'
import { loadShown, reminderKey, saveShown } from '../lib/shown'

const pad = (n: number) => String(n).padStart(2, '0')
const toLocal = (d: Date) => `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`

const SNOOZES: { label: string; at: () => string }[] = [
  { label: '10 phút', at: () => toLocal(new Date(Date.now() + 10 * 60000)) },
  { label: '1 giờ', at: () => toLocal(new Date(Date.now() + 60 * 60000)) },
  {
    label: 'Mai',
    at: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(8, 0, 0, 0)
      return toLocal(d)
    },
  },
]

/**
 * In-app reminders while the app is open. When signed in, the server owns the "reminded" flag (so other devices
 * still get their push); this component only shows a toast once per reminder time.
 */
export function Reminders({ store, onOpen, synced }: { store: Store; onOpen: (id: string) => void; synced: boolean }) {
  const [toasts, setToasts] = useState<{ id: string; title: string }[]>([])
  const shown = useRef<Set<string>>(loadShown())

  // The Windows app is its own notification host: ask once, the shell auto-allows it.
  useEffect(() => {
    if (IS_DESKTOP_SHELL && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  useEffect(() => {
    const check = async () => {
      const now = Date.now()
      for (const t of store.tasks) {
        if (!t.remindAt || t.reminded || t.done) continue
        const key = reminderKey(t.id, t.remindAt)
        if (shown.current.has(key) || new Date(t.remindAt).getTime() > now) continue
        shown.current.add(key)
        saveShown(shown.current, store.tasks)
        if (!synced) store.updateTask(t.id, { reminded: true })
        setToasts((s) => [...s.filter((x) => x.id !== t.id), { id: t.id, title: t.title }])
        if ('Notification' in window && Notification.permission === 'granted' && (await pushState()) !== 'on') new Notification('Nhắc nhở', { body: t.title })
      }
    }
    check()
    const i = setInterval(check, 15000)
    return () => clearInterval(i)
  }, [store, synced])

  const dismiss = (id: string) => setToasts((s) => s.filter((x) => x.id !== id))

  if (!toasts.length) return null
  return (
    <div className="fixed right-[max(20px,env(safe-area-inset-right))] bottom-[max(20px,env(safe-area-inset-bottom))] left-[max(20px,env(safe-area-inset-left))] z-50 flex flex-col gap-2 sm:left-auto sm:w-[340px]">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600">
            <Bell className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-stone-500">Đến giờ rồi</p>
            <button
              onClick={() => {
                onOpen(t.id)
                dismiss(t.id)
              }}
              className="block max-w-full truncate text-left text-[14px] font-medium text-stone-900 hover:underline"
            >
              {t.title || 'Chưa đặt tên'}
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[12px]">
              <span className="text-stone-400">Hoãn:</span>
              {SNOOZES.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    store.updateTask(t.id, { remindAt: s.at(), reminded: false })
                    dismiss(t.id)
                  }}
                  className="rounded px-1.5 py-0.5 text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => {
                  store.updateTask(t.id, { done: true })
                  dismiss(t.id)
                }}
                className="ml-auto rounded px-1.5 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Xong
              </button>
            </div>
          </div>
          <button onClick={() => dismiss(t.id)} className="text-stone-400 hover:text-stone-700" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
