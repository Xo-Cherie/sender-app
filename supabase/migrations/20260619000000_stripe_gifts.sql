-- Stripe monetary gifts: payment tracking, Connect payouts, transaction history.

create table if not exists public.card_gifts (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards(id) on delete set null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete set null,
  recipient_email text,
  amount_cents integer not null check (amount_cents >= 50 and amount_cents <= 1000000),
  currency text not null default 'usd' check (char_length(currency) = 3),
  gift_message text,
  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'paid',
      'failed',
      'canceled',
      'refunded',
      'payout_pending',
      'payout_completed',
      'payout_failed'
    )
  ),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text,
  failure_reason text,
  paid_at timestamptz,
  canceled_at timestamptz,
  claimed_at timestamptz,
  payout_completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_gifts_sender_idx on public.card_gifts (sender_id, created_at desc);
create index if not exists card_gifts_recipient_idx on public.card_gifts (recipient_id, created_at desc);
create index if not exists card_gifts_status_idx on public.card_gifts (status, created_at desc);
create index if not exists card_gifts_card_idx on public.card_gifts (card_id);
create index if not exists card_gifts_session_idx on public.card_gifts (stripe_checkout_session_id);

create table if not exists public.user_stripe_connect (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_connect_account_id text unique,
  onboarding_complete boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists card_gifts_set_updated_at on public.card_gifts;
create trigger card_gifts_set_updated_at
before update on public.card_gifts
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists user_stripe_connect_set_updated_at on public.user_stripe_connect;
create trigger user_stripe_connect_set_updated_at
before update on public.user_stripe_connect
for each row execute function public.set_updated_at_timestamp();

alter table public.card_gifts enable row level security;
alter table public.user_stripe_connect enable row level security;

drop policy if exists "Senders read own card gifts" on public.card_gifts;
create policy "Senders read own card gifts"
  on public.card_gifts for select
  using (sender_id = auth.uid());

drop policy if exists "Recipients read own card gifts" on public.card_gifts;
create policy "Recipients read own card gifts"
  on public.card_gifts for select
  using (recipient_id = auth.uid());

drop policy if exists "Users read own stripe connect" on public.user_stripe_connect;
create policy "Users read own stripe connect"
  on public.user_stripe_connect for select
  using (user_id = auth.uid());

comment on table public.card_gifts is 'Monetary gifts attached to cards with Stripe payment and payout status.';
comment on table public.user_stripe_connect is 'Stripe Connect Express accounts for recipient gift payouts.';

create or replace function public.sync_gift_recipient_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.card_gifts
  set recipient_id = new.recipient_id
  where card_id = new.card_id
    and (recipient_id is null or recipient_id = new.recipient_id);

  return new;
end;
$$;

drop trigger if exists received_cards_sync_gift_recipient on public.received_cards;
create trigger received_cards_sync_gift_recipient
after insert on public.received_cards
for each row execute function public.sync_gift_recipient_on_delivery();
