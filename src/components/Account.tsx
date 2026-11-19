import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Cloud, CloudOff, LogOut, Mail, RefreshCw, TriangleAlert } from 'lucide-react'
import { requestPasswordReset, setNewPassword, signInAnonymously, signInWithPassword, signOut, signUp, upgradeAccount } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { SyncStatus } from '../lib/sync'
import { OFFLINE } from '../lib/config'
import { disablePush } from '../lib/push'
import type { Store } from '../lib/store'

const STATUS: Record<SyncStatus, { label: string; icon: typeof Cloud; tone: string }> = {
  off: { label: 'Chưa đồng bộ', icon: CloudOff, tone: 'text-stone-400' },
  syncing: { label: 'Đang đồng bộ…', icon: RefreshCw, tone: 'text-stone-500' },
  synced: { label: 'Đã đồng bộ', icon: Cloud, tone: 'text-emerald-700' },
  offline: { label: 'Ngoại tuyến – sẽ đồng bộ sau', icon: CloudOff, tone: 'text-amber-700' },
  error: { label: 'Lỗi đồng bộ', icon: TriangleAlert, tone: 'text-red-600' },
}

/** Sign out: stop this device's pushes for the old account and drop its local copy so the next account starts clean. */
async function leave(store: Store, anonymous: boolean) {
  const pending = Object.keys(store.dirty).length + Object.keys(store.deletedIds).length
  if (anonymous && !confirm('Đây là tài khoản dùng thử: đăng xuất sẽ mất vĩnh viễn mọi việc trong tài khoản này. Tiếp tục?')) return
  if (!anonymous && pending && !confirm(`Còn ${pending} thay đổi chưa đồng bộ sẽ bị mất khi đăng xuất. Tiếp tục?`)) return
  await disablePush().catch(() => undefined)
  await signOut()
  store.clearAll()
}

export function Account({
  session,
  status,
  store,
  recovery = false,
  onRecovered,
  children,
}: {
  session: Session | null
  status: SyncStatus
  store: Store
  recovery?: boolean
  onRecovered?: () => void
  children?: React.ReactNode
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [state, setState] = useState<'idle' | 'busy' | 'confirm' | 'resetSent'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!supabase) return OFFLINE ? <OfflineNote /> : null

  if (session && recovery) return <NewPasswordForm onDone={() => onRecovered?.()} />

  if (!session) {
    const field = 'mt-2 w-full rounded-md bg-white px-2 py-1.5 text-[13px] text-stone-800 outline-none ring-1 ring-stone-300 focus:ring-stone-500'
    return (
      <form
        className="rounded-lg bg-white/70 p-3 text-[12px] leading-relaxed text-stone-500 ring-1 ring-stone-200"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!email.trim() || !password) return
          setState('busy')
          setError(null)
          const r = mode === 'signin' ? await signInWithPassword(email.trim(), password) : await signUp(email.trim(), password)
          if (r.error) setError(r.error)
          setState(r.needsConfirmation ? 'confirm' : 'idle')
        }}
      >
        {state === 'resetSent' ? (
          <p className="flex items-start gap-2 text-stone-700">
            <Mail className="mt-0.5 size-4 shrink-0" /> Đã gửi link đặt lại mật khẩu tới {email}. Mở email trên thiết bị này.
          </p>
        ) : state === 'confirm' ? (
          <p className="flex items-start gap-2 text-stone-700">
            <Mail className="mt-0.5 size-4 shrink-0" /> Đã tạo tài khoản. Mở email {email} để xác nhận rồi đăng nhập.
          </p>
        ) : (
          <>
            <p>Đăng nhập để đồng bộ và nhận thông báo trên điện thoại.</p>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cua-ban.com" className={field} />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signin' ? 'Mật khẩu' : 'Mật khẩu (ít nhất 6 ký tự)'}
              className={field}
            />
            <button
              disabled={state === 'busy'}
              className="mt-2 w-full rounded-md bg-stone-900 px-2 py-1.5 text-[13px] font-medium text-white hover:bg-stone-700 disabled:opacity-60"
            >
              {state === 'busy' ? 'Đang xử lý…' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
              }}
              className="mt-1.5 w-full text-center text-stone-500 hover:text-stone-800"
            >
              {mode === 'signin' ? 'Chưa có tài khoản? Tạo tài khoản' : 'Đã có tài khoản? Đăng nhập'}
            </button>
            {mode === 'signin' && (
              <button
                type="button"
                disabled={state === 'busy'}
                onClick={async () => {
                  if (!email.trim()) return setError('Nhập email trước rồi bấm “Quên mật khẩu”')
                  setState('busy')
                  setError(null)
                  const r = await requestPasswordReset(email.trim())
                  if (r.error) {
                    setError(r.error)
                    setState('idle')
                  } else setState('resetSent')
                }}
                className="mt-0.5 w-full text-center text-[11px] text-stone-400 hover:text-stone-700"
              >
                Quên mật khẩu?
              </button>
            )}
            <div className="mt-2 border-t border-stone-200 pt-2">
              <button
                type="button"
                disabled={state === 'busy'}
                onClick={async () => {
                  setState('busy')
                  setError(null)
                  const r = await signInAnonymously()
                  if (r.error) setError(r.error)
                  setState('idle')
                }}
                className="w-full rounded-md bg-white px-2 py-1.5 text-[13px] text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
              >
                Dùng thử không cần tài khoản
              </button>
              <p className="mt-1 text-[11px] text-stone-400">Bản thử: dữ liệu chỉ gắn với thiết bị này.</p>
            </div>
            {error && <p className="mt-1.5 text-red-600">{error}</p>}
          </>
        )}
      </form>
    )
  }

  const S = STATUS[status]
  return (
    <div className="space-y-2 rounded-lg bg-white/70 p-3 text-[12px] text-stone-500 ring-1 ring-stone-200">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-stone-700" title={session.user.email}>
          {session.user.is_anonymous ? 'Tài khoản dùng thử' : session.user.email}
        </span>
        <button onClick={() => leave(store, !!session.user.is_anonymous)} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Đăng xuất" title="Đăng xuất">
          <LogOut className="size-3.5" />
        </button>
      </div>
      <p className={`flex items-center gap-1.5 ${S.tone}`}>
        <S.icon className={`size-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} /> {S.label}
      </p>
      {session.user.is_anonymous && <UpgradeForm />}
      {children}
    </div>
  )
}

/** Keep a trial account: attach email + password so the same data is reachable from other devices. */
function UpgradeForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = 'mt-1.5 w-full rounded-md bg-white px-2 py-1.5 text-[13px] text-stone-800 outline-none ring-1 ring-stone-300 focus:ring-stone-500'
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-md bg-white px-2 py-1 text-[12px] text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50">
        Lưu thành tài khoản thật (giữ nguyên dữ liệu)
      </button>
    )
  return (
    <form
      className="border-t border-stone-200 pt-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        const r = await upgradeAccount(email.trim(), password)
        setBusy(false)
        if (r.error) setError(r.error)
      }}
    >
      <p className="text-stone-600">Thêm email + mật khẩu để dùng tài khoản này trên máy khác.</p>
      <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cua-ban.com" className={field} />
      <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu (ít nhất 6 ký tự)" className={field} />
      <div className="mt-1.5 flex gap-1.5">
        <button disabled={busy} className="flex-1 rounded-md bg-stone-900 px-2 py-1 text-[12px] font-medium text-white hover:bg-stone-700 disabled:opacity-60">
          {busy ? 'Đang lưu…' : 'Lưu tài khoản'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-[12px] text-stone-400 hover:bg-stone-100 hover:text-stone-700">
          Huỷ
        </button>
      </div>
      {error && <p className="mt-1.5 text-red-600">{error}</p>}
    </form>
  )
}

/** Shown after opening a password-reset link. */
function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="rounded-lg bg-white/70 p-3 text-[12px] text-stone-500 ring-1 ring-stone-200"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        const r = await setNewPassword(password)
        setBusy(false)
        if (r.error) setError(r.error)
        else onDone()
      }}
    >
      <p className="font-medium text-stone-700">Đặt mật khẩu mới</p>
      <input
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
        className="mt-2 w-full rounded-md bg-white px-2 py-1.5 text-[13px] text-stone-800 outline-none ring-1 ring-stone-300 focus:ring-stone-500"
      />
      <button disabled={busy} className="mt-2 w-full rounded-md bg-stone-900 px-2 py-1.5 text-[13px] font-medium text-white hover:bg-stone-700 disabled:opacity-60">
        {busy ? 'Đang lưu…' : 'Lưu mật khẩu'}
      </button>
      {error && <p className="mt-1.5 text-red-600">{error}</p>}
    </form>
  )
}

/** Offline edition: no account, no server push — tell people how reminders work here. */
function OfflineNote() {
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  return (
    <div className="rounded-lg bg-white/70 p-3 text-[12px] leading-relaxed text-stone-500 ring-1 ring-stone-200">
      <p className="font-medium text-stone-700">Bản offline</p>
      <p className="mt-1">Dữ liệu lưu trên máy này. Nhắc việc hiện khi app đang mở — hãy để cửa sổ Nhắc Việc mở (có thể thu nhỏ).</p>
      {perm === 'default' && (
        <button
          onClick={async () => setPerm(await Notification.requestPermission())}
          className="mt-2 w-full rounded-md bg-stone-900 px-2 py-1.5 text-[13px] font-medium text-white hover:bg-stone-700"
        >
          Cho phép thông báo
        </button>
      )}
      {perm === 'denied' && <p className="mt-1 text-amber-700">Thông báo đang bị chặn trong cài đặt trình duyệt.</p>}
    </div>
  )
}
