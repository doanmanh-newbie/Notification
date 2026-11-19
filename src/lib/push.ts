import { VAPID_PUBLIC_KEY } from './config'
import { supabase } from './supabase'

export type PushState = 'unsupported' | 'denied' | 'off' | 'on'

/** The Windows desktop shell (NhacViec.exe, WebView2) has no Web Push; it reminds while running in the tray instead. */
export const IS_DESKTOP_SHELL = typeof navigator !== 'undefined' && navigator.userAgent.includes('NhacViecDesktop')

export function pushSupported(): boolean {
  return !IS_DESKTOP_SHELL && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isInstalled(): boolean {
  return matchMedia('(display-mode: standalone)').matches
}

async function registration() {
  return navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/** Ask permission, subscribe this device and store the subscription for the signed-in user. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported() || !supabase) throw new Error('Thiết bị này không hỗ trợ thông báo đẩy')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Bạn chưa cho phép thông báo')
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready)
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, user_id: userId, p256dh: json.keys!.p256dh, auth: json.keys!.auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

export async function disablePush(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription()
  if (!sub) return
  const res = await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
  // The server row becomes a dead endpoint and is removed on its next 404/410, so this is informational only.
  if (res?.error) throw new Error('Đã tắt trên máy này; máy chủ sẽ tự dọn đăng ký cũ.')
}
