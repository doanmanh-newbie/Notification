import { useEffect, useState } from 'react'
import { BellRing, BellOff } from 'lucide-react'
import { disablePush, enablePush, IS_DESKTOP_SHELL, isInstalled, pushState, type PushState } from '../lib/push'
import { toISO } from '../lib/model'
import type { Store } from '../lib/store'

const pad = (n: number) => String(n).padStart(2, '0')
const localIn = (minutes: number) => {
  const d = new Date(Date.now() + minutes * 60000)
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Thông báo trên điện thoại" card: enable/disable Web Push for this device and send a test reminder. */
export function PushCard({ userId, store }: { userId: string; store: Store }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    pushState().then(async (s) => {
      // Re-register on every start: the browser may have rotated the endpoint, or the row was removed after a 410.
      if (s === 'on') await enablePush(userId).catch(() => undefined)
      setState(s)
    })
  }, [userId])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg((e as Error).message)
    }
    setState(await pushState())
    setBusy(false)
  }

  if (state === null) return null
  if (IS_DESKTOP_SHELL)
    return (
      <div className="border-t border-stone-200 pt-2">
        <p className="flex items-center gap-1.5 font-medium text-stone-700">
          <BellRing className="size-3.5 text-emerald-700" /> Nhắc việc trên Windows
        </p>
        <p className="mt-1">App chạy ngầm ở khay hệ thống và hiện thông báo Windows khi đến giờ. Nhấn X chỉ thu nhỏ xuống khay; chuột phải biểu tượng → Thoát để tắt hẳn.</p>
        <button
          onClick={() => {
            store.addTask({ title: 'Thử thông báo Nhắc Việc', remindAt: localIn(1) })
            setMsg('Đã đặt nhắc thử — sẽ hiện thông báo trong khoảng 1 phút. Có thể thu app xuống khay để thử.')
          }}
          className="mt-1.5 w-full rounded-md bg-white px-2 py-1 text-[12px] text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
        >
          Gửi thử
        </button>
        {msg && <p className="mt-1.5 text-stone-600">{msg}</p>}
      </div>
    )
  return (
    <div className="border-t border-stone-200 pt-2">
      <p className="flex items-center gap-1.5 font-medium text-stone-700">
        {state === 'on' ? <BellRing className="size-3.5 text-emerald-700" /> : <BellOff className="size-3.5" />} Thông báo trên điện thoại
      </p>
      {state === 'unsupported' && <p className="mt-1">Trình duyệt này không hỗ trợ thông báo đẩy. Hãy mở bằng Chrome trên Android.</p>}
      {state === 'denied' && <p className="mt-1">Thông báo đang bị chặn. Vào Cài đặt trang web của Chrome → Thông báo → Cho phép.</p>}
      {state === 'off' && (
        <button
          disabled={busy}
          onClick={() => run(() => enablePush(userId))}
          className="mt-1.5 w-full rounded-md bg-stone-900 px-2 py-1.5 text-[13px] font-medium text-white hover:bg-stone-700 disabled:opacity-60"
        >
          {busy ? 'Đang bật…' : 'Bật thông báo'}
        </button>
      )}
      {state === 'on' && (
        <div className="mt-1.5 flex gap-1.5">
          <button
            onClick={() => {
              store.addTask({ title: 'Thử thông báo Nhắc Việc', remindAt: localIn(2) })
              setMsg('Đã đặt nhắc thử — thông báo sẽ đến trong khoảng 1–2 phút. Có thể khoá máy để thử.')
            }}
            className="flex-1 rounded-md bg-white px-2 py-1 text-[12px] text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
          >
            Gửi thử
          </button>
          <button disabled={busy} onClick={() => run(disablePush)} className="rounded-md px-2 py-1 text-[12px] text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            Tắt
          </button>
        </div>
      )}
      {state !== 'unsupported' && !isInstalled() && <p className="mt-1.5 text-stone-400">Mẹo: Menu ⋮ → “Thêm vào màn hình chính” để dùng như app.</p>}
      {msg && <p className="mt-1.5 text-stone-600">{msg}</p>}
    </div>
  )
}
