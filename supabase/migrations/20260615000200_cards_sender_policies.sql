-- Ensure senders can create and read their own cards when RLS is enabled.

drop policy if exists "Senders can create cards" on public.cards;
create policy "Senders can create cards"
  on public.cards
  for insert
  to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "Senders can update own cards" on public.cards;
create policy "Senders can update own cards"
  on public.cards
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "Senders can delete own cards" on public.cards;
create policy "Senders can delete own cards"
  on public.cards
  for delete
  to authenticated
  using (sender_id = auth.uid());
