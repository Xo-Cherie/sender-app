-- Fix push enqueue triggers (display_name column does not exist), then backfill email-invited cards.

create or replace function public.profile_display_name(
  p_first_name text,
  p_last_name text,
  p_email text
)
returns text
language sql
immutable
as $$
  select trim(coalesce(nullif(trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), ''), p_email, 'Someone'));
$$;

create or replace function public.enqueue_card_received_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select public.profile_display_name(up.first_name, up.last_name, up.email)
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

  select public.profile_display_name(up.first_name, up.last_name, up.email)
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

  select public.profile_display_name(up.first_name, up.last_name, up.email)
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

insert into public.received_cards (card_id, recipient_id, is_read, is_pinned)
select
  c.id,
  up.id,
  false,
  false
from public.cards c
cross join lateral jsonb_array_elements_text(coalesce(c.recipient_info->'emails', '[]'::jsonb)) as invite_email
join public.user_profiles up on lower(trim(up.email)) = lower(trim(invite_email))
where invite_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
on conflict (card_id, recipient_id) do nothing;
