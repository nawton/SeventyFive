-- =============================================================================
-- ABONNEMANG — Stripe-synkad status per användare.
-- Skrivs ENDAST av stripe-webhook-funktionen (service role). Klienten läser
-- sin egen rad; källan till sanning är alltid Stripe via webhooken.
-- =============================================================================

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  -- Stripes statusar: active, trialing, past_due, canceled, incomplete, unpaid …
  status                 text not null default 'none',
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Användare får läsa sin egen rad — aldrig skriva (bara webhooken gör det)
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Webhooken slår upp kund via stripe_customer_id
create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);
