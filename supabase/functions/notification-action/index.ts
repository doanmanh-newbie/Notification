// Handles the "Xong" / "Hoãn 10 phút" buttons on a push notification. Called by the service worker without a JWT;
// authorised by the one-time action_token that send-reminders put in the payload.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { rollForward } from '../_shared/recur.ts'
import { toLocal, toUtcIso } from '../_shared/time.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const SNOOZE_MIN = 10

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  let body: { userId?: string; taskId?: string; token?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400, headers: cors })
  }
  const { userId, taskId, token, action } = body
  if (!userId || !taskId || !token || (action !== 'done' && action !== 'snooze')) {
    return new Response('bad request', { status: 400, headers: cors })
  }

  const { data: row } = await db
    .from('tasks')
    .select('data, tz_offset, action_token')
    .eq('user_id', userId)
    .eq('id', taskId)
    .maybeSingle()
  if (!row || !row.data || row.action_token !== token) return new Response('forbidden', { status: 403, headers: cors })

  const now = Date.now()
  let data = row.data
  let remindAt: string | null
  if (action === 'done') {
    data = rollForward(data, toLocal(now, row.tz_offset))
    remindAt = data.remindAt && !data.done ? toUtcIso(data.remindAt, row.tz_offset) : null
  } else {
    const at = now + SNOOZE_MIN * 60000
    data = { ...data, remindAt: toLocal(at, row.tz_offset), reminded: false }
    remindAt = new Date(at).toISOString()
  }
  data = { ...data, updatedAt: now }

  const { error } = await db
    .from('tasks')
    .update({ data, remind_at: remindAt, action_token: null, updated_at: new Date(now).toISOString() })
    .eq('user_id', userId)
    .eq('id', taskId)
  if (error) return new Response(error.message, { status: 500, headers: cors })
  return new Response('ok', { headers: cors })
})
