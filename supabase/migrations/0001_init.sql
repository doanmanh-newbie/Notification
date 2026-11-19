-- Nhắc Việc: core tables, RLS, last-write-wins guard, realtime.

create table public.tasks (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb,
  remind_at timestamptz,
  tz_offset int not null default 0,
  action_token uuid,
  claimed_until timestamptz,
  push_attempts int not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index tasks_due_idx on public.tasks (remind_at) where remind_at is not null and not deleted;

create table public.projects (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.tasks enable row level security;
alter table public.projects enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "own tasks" on public.tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own projects" on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Last write wins: an upsert carrying an older version must not overwrite a newer row
-- (e.g. the server marking a reminder as sent while a stale client edit is in flight).
-- A delete always wins, and is stamped newer than what it replaces so no device resurrects it.
create function public.keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted and not old.deleted then
    new.updated_at := greatest(new.updated_at, old.updated_at, now());
    return new;
  end if;
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end $$;

-- A new reminder time starts a fresh delivery cycle.
create function public.reset_delivery() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.remind_at is distinct from old.remind_at then
    new.push_attempts := 0;
    new.claimed_until := null;
  end if;
  return new;
end $$;

create trigger tasks_keep_newest before update on public.tasks for each row execute function public.keep_newest();
create trigger tasks_reset_delivery before update on public.tasks for each row execute function public.reset_delivery();
create trigger projects_keep_newest before update on public.projects for each row execute function public.keep_newest();

alter publication supabase_realtime add table public.tasks, public.projects;
