-- Dispatch pending notification events to the send-push-notification Edge Function.

create extension if not exists pg_net with schema extensions;

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
  dispatch_url := current_setting('app.push_dispatch_url', true);
  dispatch_secret := current_setting('app.push_dispatch_secret', true);

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

drop trigger if exists notification_events_dispatch_push on public.notification_events;
create trigger notification_events_dispatch_push
after insert on public.notification_events
for each row execute function public.dispatch_notification_event();

comment on function public.dispatch_notification_event() is
  'Posts new notification_events rows to the send-push-notification Edge Function. Configure app.push_dispatch_url and app.push_dispatch_secret in the database.';
