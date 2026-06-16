-- Supabase hosted Postgres does not allow ALTER DATABASE for custom GUC parameters.
-- Store push dispatch settings in a table instead.

create table if not exists public.notification_dispatch_config (
  id integer primary key default 1 check (id = 1),
  dispatch_url text not null,
  dispatch_secret text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_dispatch_config enable row level security;

comment on table public.notification_dispatch_config is
  'Push dispatch target for notification_events trigger. Single row id=1.';

create or replace function public.dispatch_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  select c.dispatch_url, c.dispatch_secret
  into dispatch_url, dispatch_secret
  from public.notification_dispatch_config c
  where c.id = 1;

  if dispatch_url is null or dispatch_url = '' then
    return new;
  end if;

  perform net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Dispatch-Secret', coalesce(dispatch_secret, '')
    ),
    body := jsonb_build_object('eventId', new.id)
  );

  return new;
end;
$$;

comment on function public.dispatch_notification_event() is
  'Posts new notification_events rows to send-push-notification. Configure public.notification_dispatch_config row id=1.';
