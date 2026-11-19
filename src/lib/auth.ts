import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** `recovery` is true after opening a password-reset link, until a new password is saved. */
export function useSession(): { session: Session | null; ready: boolean; recovery: boolean; endRecovery: () => void } {
  const [session, setSession] = useState<Session | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, ready, recovery, endRecovery: () => setRecovery(false) }
}

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Sai email hoặc mật khẩu'],
  [/already registered|already exists/i, 'Email này đã có tài khoản — hãy bấm “Đăng nhập”'],
  [/password should be at least/i, 'Mật khẩu cần ít nhất 6 ký tự'],
  [/email not confirmed/i, 'Email chưa được xác nhận'],
  [/rate limit|too many/i, 'Thử lại sau ít phút (quá nhiều lần thử)'],
  [/invalid email|unable to validate email/i, 'Email không hợp lệ'],
  [/anonymous sign-ins are disabled/i, 'Chế độ dùng thử đang tắt trên máy chủ'],
  [/different from the old password|same as the old/i, 'Mật khẩu mới phải khác mật khẩu cũ'],
]

/** Translate Supabase auth errors into short Vietnamese messages. */
export function authMessage(raw: string): string {
  return MESSAGES.find(([re]) => re.test(raw))?.[1] ?? raw
}

type AuthResult = { error?: string; needsConfirmation?: boolean }

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'Chưa cấu hình máy chủ' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { error: authMessage(error.message) } : {}
}

/** Create an account. While "Confirm email" is off in Supabase (test phase) this signs in immediately. */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'Chưa cấu hình máy chủ' }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL },
  })
  if (error) return { error: authMessage(error.message) }
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) return { error: authMessage('already registered') }
  return data.session ? {} : { needsConfirmation: true }
}

/** Test phase only: a throwaway account per device (requires "Allow anonymous sign-ins" in Supabase). */
export async function signInAnonymously(): Promise<AuthResult> {
  if (!supabase) return { error: 'Chưa cấu hình máy chủ' }
  const { error } = await supabase.auth.signInAnonymously()
  return error ? { error: authMessage(error.message) } : {}
}

/** Turn the current anonymous trial account into a permanent one, keeping all its data. */
export async function upgradeAccount(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'Chưa cấu hình máy chủ' }
  const { error } = await supabase.auth.updateUser({ email, password })
  return error ? { error: authMessage(error.message) } : {}
}

/** Email a password-reset link that brings the user back to this app. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return { error: 'Chưa cấu hình máy chủ' }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + import.meta.env.BASE_URL })
  return error ? { error: authMessage(error.message) } : {}
}

export async function setNewPassword(password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'Chưa cấu hình máy chủ' }
  const { error } = await supabase.auth.updateUser({ password })
  return error ? { error: authMessage(error.message) } : {}
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}
