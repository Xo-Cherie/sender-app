-- Break infinite RLS recursion between cards <-> received_cards policies.

create or replace function public.is_card_sender(p_card_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cards c
    where c.id = p_card_id
      and c.sender_id = p_user_id
  );
$$;

create or replace function public.is_card_recipient(p_card_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.received_cards rc
    where rc.card_id = p_card_id
      and rc.recipient_id = p_user_id
  );
$$;

create or replace function public.user_can_read_card(p_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_card_sender(p_card_id, auth.uid())
      or public.is_card_recipient(p_card_id, auth.uid());
$$;

grant execute on function public.is_card_sender(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_card_recipient(uuid, uuid) to authenticated, service_role;
grant execute on function public.user_can_read_card(uuid) to authenticated, service_role;

drop policy if exists "Recipients can read delivered cards" on public.cards;
create policy "Recipients can read delivered cards"
  on public.cards
  for select
  to authenticated
  using (public.user_can_read_card(id));

drop policy if exists "Senders can deliver cards to recipients" on public.received_cards;
create policy "Senders can deliver cards to recipients"
  on public.received_cards
  for insert
  to authenticated
  with check (public.is_card_sender(card_id, auth.uid()));

drop policy if exists "Recipients can read own received cards" on public.received_cards;
drop policy if exists "Senders can read deliveries for their cards" on public.received_cards;
create policy "Users can read relevant received cards"
  on public.received_cards
  for select
  to authenticated
  using (
    recipient_id = auth.uid()
    or public.is_card_sender(card_id, auth.uid())
  );
