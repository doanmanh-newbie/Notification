-- Only real Web Push services may be stored as endpoints. Without this, any signed-in (incl. anonymous) user
-- could register an arbitrary URL and make send-reminders POST to it every minute.
alter table public.push_subscriptions
  add constraint push_endpoint_known_service check (
    endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com)/'
  );
