-- Device push tokens and notification outbox for Expo push delivery.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_variant text not null default 'main' check (app_variant in ('main', 'device')),
  device_id text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists device_push_tokens_user_id_idx
  on public.device_push_tokens (user_id);

create index if not exists device_push_tokens_active_user_idx
  on public.device_push_tokens (user_id, is_active)
  where is_active = true;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('card_received', 'friend_request', 'xo_received')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists notification_events_pending_idx
  on public.notification_events (status, created_at)
  where status = 'pending';

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists device_push_tokens_set_updated_at on public.device_push_tokens;
create trigger device_push_tokens_set_updated_at
before update on public.device_push_tokens
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists notification_events_set_updated_at on public.notification_events;
create trigger notification_events_set_updated_at
before update on public.notification_events
for each row execute function public.set_updated_at_timestamp();

alter table public.device_push_tokens enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists "Users can read own push tokens" on public.device_push_tokens;
create policy "Users can read own push tokens"
  on public.device_push_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push tokens" on public.device_push_tokens;
create policy "Users can insert own push tokens"
  on public.device_push_tokens
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.device_push_tokens;
create policy "Users can update own push tokens"
  on public.device_push_tokens
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push tokens" on public.device_push_tokens;
create policy "Users can delete own push tokens"
  on public.device_push_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own notification events" on public.notification_events;
create policy "Users can read own notification events"
  on public.notification_events
  for select
  to authenticated
  using (auth.uid() = recipient_user_id);

create or replace function public.enqueue_card_received_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select trim(coalesce(up.display_name, up.first_name || ' ' || up.last_name, up.email, 'Someone'))
  into sender_name
  from public.cards c
  left join public.user_profiles up on up.id = c.sender_id
  where c.id = new.card_id;

  insert into public.notification_events (
    recipient_user_id,
    event_type,
    title,
    body,
    data
  ) values (
    new.recipient_id,
    'card_received',
    'New card received',
    coalesce(nullif(sender_name, ''), 'Someone') || ' sent you a card',
    jsonb_build_object(
      'type', 'card_received',
      'cardId', new.card_id
    )
  );

  return new;
end;
$$;

create or replace function public.enqueue_friend_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select trim(coalesce(up.display_name, up.first_name || ' ' || up.last_name, up.email, 'Someone'))
  into sender_name
  from public.user_profiles up
  where up.id = new.from_user_id;

  insert into public.notification_events (
    recipient_user_id,
    event_type,
    title,
    body,
    data
  ) values (
    new.to_user_id,
    'friend_request',
    'New friend request',
    coalesce(nullif(sender_name, ''), 'Someone') || ' sent you a friend request',
    jsonb_build_object(
      'type', 'friend_request',
      'requestId', new.id
    )
  );

  return new;
end;
$$;

create or replace function public.enqueue_xo_received_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_id uuid;
  recipient_name text;
begin
  if old.acknowledged_at is not null or new.acknowledged_at is null then
    return new;
  end if;

  select c.sender_id
  into sender_id
  from public.cards c
  where c.id = new.card_id;

  if sender_id is null then
    return new;
  end if;

  select trim(coalesce(up.display_name, up.first_name || ' ' || up.last_name, up.email, 'Someone'))
  into recipient_name
  from public.user_profiles up
  where up.id = new.recipient_id;

  insert into public.notification_events (
    recipient_user_id,
    event_type,
    title,
    body,
    data
  ) values (
    sender_id,
    'xo_received',
    'Xo received',
    coalesce(nullif(recipient_name, ''), 'Someone') || ' sent you an Xo',
    jsonb_build_object(
      'type', 'xo_received',
      'cardId', new.card_id
    )
  );

  return new;
end;
$$;

drop trigger if exists received_cards_enqueue_push on public.received_cards;
create trigger received_cards_enqueue_push
after insert on public.received_cards
for each row execute function public.enqueue_card_received_notification();

drop trigger if exists friend_requests_enqueue_push on public.friend_requests;
create trigger friend_requests_enqueue_push
after insert on public.friend_requests
for each row execute function public.enqueue_friend_request_notification();

drop trigger if exists received_cards_xo_enqueue_push on public.received_cards;
create trigger received_cards_xo_enqueue_push
after update of acknowledged_at on public.received_cards
for each row execute function public.enqueue_xo_received_notification();
