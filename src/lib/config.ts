// Public, client-safe configuration (read from .env.local / .env at build time).
// Never put the service-role key or the VAPID private key in a VITE_ variable: those end up in the browser bundle.
// Use import.meta.env.VITE_* literally: Vite replaces it at build time, so the offline build drops the Supabase values entirely.

/** Offline edition (VITE_OFFLINE=1): no server at all — data stays in this browser, reminders only while the app is open. */
export const OFFLINE = import.meta.env.VITE_OFFLINE === '1'

export const SUPABASE_URL: string =
  import.meta.env.VITE_OFFLINE === '1' ? '' : import.meta.env.VITE_SUPABASE_URL || 'https://lsznbtcmrbeougdjgnye.supabase.co'

/** Supabase anon / publishable key (public by design; access is enforced by RLS). Committed default so hosted builds (no .env.local) still connect. */
export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_OFFLINE === '1' ? '' : import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6ZfadEamqTgM6uJ23zqkLg_rgflQs6s'

export const VAPID_PUBLIC_KEY: string =
  import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BOTFuhomuhNiFuCYlDjfTkt-4eS7UhZSBp35mUx9jNfg8MLOU9SOMcgDs6ZD7rQrjbJo155u8x_GvhVTFWfVdNo'

export const NOTIFICATION_ACTION_URL = `${SUPABASE_URL}/functions/v1/notification-action`
