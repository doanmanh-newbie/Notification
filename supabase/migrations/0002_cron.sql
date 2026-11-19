-- Server-side helpers for the push pipeline and the per-minute cron job.
-- Secrets (vapid_public, vapid_private, vapid_subject, cron_secret) are created separately
-- with vault.create_secret — never committed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function public.get_secret(secret_name text) returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name
$$;

-- Claim due reminders so overlapping cron runs never send the same one twice. A claim lasts 2^attempts minutes
-- (max 60), which doubles as backoff for rows whose pushes keep failing.
create function public.claim_due_reminders(max_rows int) returns setof public.tasks
language sql security definer set search_path = '' as $$
  update public.tasks t
  set claimed_until = now() + make_interval(mins => least(power(2, t.push_attempts)::int, 60)),
      push_attempts = t.push_attempts + 1
  where (t.user_id, t.id) in (
    select c.user_id, c.id from public.tasks c
    where c.remind_at <= now() and not c.deleted
      and (c.claimed_until is null or c.claimed_until < now())
      and exists (select 1 from public.push_subscriptions s where s.user_id = c.user_id)
    order by c.remind_at
    limit max_rows
    for update skip locked
  )
  returning t.*
$$;

-- Only mark as reminded if nobody edited the task while the push was in flight.
create function public.mark_reminded(p_user uuid, p_id text, p_token uuid, p_updated_at timestamptz) returns void
language sql security definer set search_path = '' as $$
  update public.tasks
  set data = data || jsonb_build_object('reminded', true, 'updatedAt', (extract(epoch from now()) * 1000)::bigint),
      remind_at = null, action_token = p_token, updated_at = now()
  where user_id = p_user and id = p_id and updated_at = p_updated_at
$$;

revoke all on function public.get_secret(text) from public, anon, authenticated;
revoke all on function public.claim_due_reminders(int) from public, anon, authenticated;
revoke all on function public.mark_reminded(uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_secret(text) to service_role;
grant execute on function public.claim_due_reminders(int) to service_role;
grant execute on function public.mark_reminded(uuid, text, uuid, timestamptz) to service_role;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://lsznbtcmrbeougdjgnye.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  $cron$
);
