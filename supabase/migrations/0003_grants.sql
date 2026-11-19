-- Newer Supabase projects no longer grant table privileges to API roles by default.
-- Signed-in users get table access (RLS still limits them to their own rows); anon gets nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tasks, public.projects, public.push_subscriptions to authenticated;
revoke all on public.tasks, public.projects, public.push_subscriptions from anon;

-- Edge Functions use the service role.
grant select, insert, update, delete on public.tasks, public.projects, public.push_subscriptions to service_role;
