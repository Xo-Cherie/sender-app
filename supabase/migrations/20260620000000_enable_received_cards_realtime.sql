-- Ensure received_cards changes propagate to Supabase Realtime subscribers.
alter table public.received_cards replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'received_cards'
    ) then
      alter publication supabase_realtime add table public.received_cards;
    end if;
  end if;
end $$;
