-- Improve push dispatch: anon key for gateway, retry pending events, reset stale no-token sends.

alter table public.notification_dispatch_config
  add column if not exists dispatch_anon_key text;

comment on column public.notification_dispatch_config.dispatch_anon_key is
  'Supabase anon key (public) used when pg_net calls the Edge Function gateway.';

-- Re-queue events that were marked sent with no device tokens so they can retry after registration.
update public.notification_events
set status = 'pending',
    last_error = null
where status = 'sent'
  and last_error = 'No active push tokens for recipient';

create or replace function public.dispatch_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dispatch_url text;
  dispatch_secret text;
  dispatch_anon_key text;
  request_headers jsonb;
begin
  select c.dispatch_url, c.dispatch_secret, c.dispatch_anon_key
  into dispatch_url, dispatch_secret, dispatch_anon_key
  from public.notification_dispatch_config c
  where c.id = 1;

  if dispatch_url is null or dispatch_url = '' then
    return new;
  end if;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Push-Dispatch-Secret', coalesce(dispatch_secret, '')
  );

  if dispatch_anon_key is not null and dispatch_anon_key <> '' then
    request_headers := request_headers || jsonb_build_object(
      'apikey', dispatch_anon_key,
      'Authorization', 'Bearer ' || dispatch_anon_key
    );
  end if;

  perform net.http_post(
    url := dispatch_url,
    headers := request_headers,
    body := jsonb_build_object('eventId', new.id)
  );

  return new;
end;
$$;

-- Callable from SQL or cron to flush pending notification_events.
create or replace function public.request_pending_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dispatch_url text;
  dispatch_secret text;
  dispatch_anon_key text;
  request_headers jsonb;
  request_id bigint;
begin
  select c.dispatch_url, c.dispatch_secret, c.dispatch_anon_key
  into dispatch_url, dispatch_secret, dispatch_anon_key
  from public.notification_dispatch_config c
  where c.id = 1;

  if dispatch_url is null or dispatch_url = '' then
    raise exception 'notification_dispatch_config row is missing dispatch_url';
  end if;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Push-Dispatch-Secret', coalesce(dispatch_secret, '')
  );

  if dispatch_anon_key is not null and dispatch_anon_key <> '' then
    request_headers := request_headers || jsonb_build_object(
      'apikey', dispatch_anon_key,
      'Authorization', 'Bearer ' || dispatch_anon_key
    );
  end if;

  select net.http_post(
    url := dispatch_url,
    headers := request_headers,
    body := jsonb_build_object('processPending', true)
  ) into request_id;

  return request_id;
end;
$$;

grant execute on function public.request_pending_push_dispatch() to service_role;
