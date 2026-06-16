-- Deliver cards to registered recipients automatically when a card is inserted.
-- Fixes silent client-side delivery failures caused by RLS.

create unique index if not exists received_cards_card_recipient_uidx
  on public.received_cards (card_id, recipient_id);

drop policy if exists "Senders can read deliveries for their cards" on public.received_cards;
create policy "Senders can read deliveries for their cards"
  on public.received_cards
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cards c
      where c.id = card_id
        and c.sender_id = auth.uid()
    )
  );

create or replace function public.deliver_card_to_recipient_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id_text text;
  recipient_uuid uuid;
begin
  for recipient_id_text in
    select jsonb_array_elements_text(coalesce(new.recipient_info->'ids', '[]'::jsonb))
  loop
    if recipient_id_text is null or recipient_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      continue;
    end if;

    recipient_uuid := recipient_id_text::uuid;

    if not exists (
      select 1
      from public.user_profiles up
      where up.id = recipient_uuid
    ) then
      continue;
    end if;

    insert into public.received_cards (card_id, recipient_id, is_read, is_pinned)
    values (new.id, recipient_uuid, false, false)
    on conflict (card_id, recipient_id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists cards_deliver_to_recipient_ids on public.cards;
create trigger cards_deliver_to_recipient_ids
after insert on public.cards
for each row execute function public.deliver_card_to_recipient_ids();

-- Backfill cards that were saved but never delivered to registered recipients.
insert into public.received_cards (card_id, recipient_id, is_read, is_pinned)
select
  c.id,
  recipient_id_text::uuid,
  false,
  false
from public.cards c
cross join lateral jsonb_array_elements_text(coalesce(c.recipient_info->'ids', '[]'::jsonb)) as recipient_id_text
join public.user_profiles up on up.id = recipient_id_text::uuid
where recipient_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (card_id, recipient_id) do nothing;
