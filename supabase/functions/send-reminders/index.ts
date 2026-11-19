// Called every minute by pg_cron. Sends a Web Push for every task whose remind_at has passed.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { afterSend, type SendResult } from '../_shared/delivery.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function secret(name: string): Promise<string> {
  const { data, error } = await db.rpc('get_secret', { secret_name: name })
  if (error || !data) throw new Error(`missing secret ${name}`)
  return data as string
}

function bodyFor(data: { due?: string | null }) {
  if (!data.due) return 'Đến giờ rồi'
  const [, m, d] = data.due.split('-')
  return `Đến giờ rồi · hạn ${d}/${m}`
}

type Sub = { endpoint: string; p256dh: string; auth: string }

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== (await secret('cron_secret'))) return new Response('unauthorized', { status: 401 })
  webpush.setVapidDetails(await secret('vapid_subject'), await secret('vapid_public'), await secret('vapid_private'))

  const { data: due, error } = await db.rpc('claim_due_reminders', { max_rows: 200 })
  if (error) return new Response(error.message, { status: 500 })

  const subsByUser = new Map<string, Sub[]>()
  let sent = 0
  for (const row of due ?? []) {
    if (!subsByUser.has(row.user_id)) {
      const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', row.user_id)
      subsByUser.set(row.user_id, subs ?? [])
    }
    const subs = subsByUser.get(row.user_id)!
    const token = crypto.randomUUID()
    const payload = JSON.stringify({
      taskId: row.id,
      userId: row.user_id,
      token,
      title: row.data?.title || 'Nhắc việc',
      body: bodyFor(row.data ?? {}),
    })
    const results: SendResult[] = await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'high' })
          .then((r) => ({ endpoint: s.endpoint, status: r.statusCode }))
          .catch((e) => ({ endpoint: s.endpoint, status: (e as { statusCode?: number }).statusCode ?? 0 })),
      ),
    )
    const { reminded, deadEndpoints } = afterSend(results)
    if (deadEndpoints.length) {
      await db.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
      subsByUser.set(row.user_id, subs.filter((s) => !deadEndpoints.includes(s.endpoint)))
    }
    if (reminded) {
      await db.rpc('mark_reminded', { p_user: row.user_id, p_id: row.id, p_token: token, p_updated_at: row.updated_at })
      sent++
    }
  }
  return Response.json({ due: due?.length ?? 0, sent })
})
