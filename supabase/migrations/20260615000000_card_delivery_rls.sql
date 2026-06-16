-- Allow card delivery to registered friends and let recipients read delivered cards.

drop policy if exists "Recipients can read own received cards" on public.received_cards;
create policy "Recipients can read own received cards"
  on public.received_cards
  for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "Senders can deliver cards to recipients" on public.received_cards;
create policy "Senders can deliver cards to recipients"
  on public.received_cards
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.cards c
      where c.id = card_id
        and c.sender_id = auth.uid()
    )
  );

drop policy if exists "Recipients can update own received cards" on public.received_cards;
create policy "Recipients can update own received cards"
  on public.received_cards
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "Recipients can delete own received cards" on public.received_cards;
create policy "Recipients can delete own received cards"
  on public.received_cards
  for delete
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "Recipients can read delivered cards" on public.cards;
create policy "Recipients can read delivered cards"
  on public.cards
  for select
  to authenticated
  using (
    sender_id = auth.uid()
    or exists (
      select 1
      from public.received_cards rc
      where rc.card_id = id
        and rc.recipient_id = auth.uid()
    )
  );

create or replace function public.find_cards_for_invite_email(p_email text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.cards c
  where exists (
    select 1
    from jsonb_array_elements_text(coalesce(c.recipient_info->'emails', '[]'::jsonb)) as invite_email
    where lower(trim(invite_email)) = lower(trim(p_email))
  );
$$;

grant execute on function public.find_cards_for_invite_email(text) to service_role;
