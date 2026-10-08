-- 117: Stripe Checkout for driver-initiated MVR orders (DEC-2026-10-001).
--
-- `payments` was built for the retired Base/USDC rail (tx_hash / amount_usdc).
-- Stripe rows need their own identifiers, and every row needs to say which rail
-- it came from so the self-serve order route can require a real card payment
-- while company-sponsored (Pace) orders keep using the $0 "waived" rows.

-- Default 'waived': every non-Stripe insert still in the codebase is a company-
-- sponsored $0 row (resolve-waived-screening-payment.ts, employer/screenings/order).
alter table public.payments
  add column if not exists provider text not null default 'waived',
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists amount_cents integer,
  add column if not exists currency text;

comment on column public.payments.provider is
  'stripe = Checkout session paid by the driver; waived = company-sponsored $0 row; legacy = pre-Stripe on-chain rows.';

-- amount_usdc only ever meant something on the retired rail. New inserts stop
-- writing it; keep the column (historical rows) but let it default instead of
-- forcing every writer to supply 0.
alter table public.payments
  alter column amount_usdc drop not null,
  alter column amount_usdc set default 0;

comment on column public.payments.amount_usdc is
  'Legacy — retired Base/USDC rail. Stripe amounts live in amount_cents / currency.';

-- One Checkout session can only ever back one payment row (webhook + return-page
-- settlement are both idempotent on this).
create unique index if not exists payments_stripe_session_id_key
  on public.payments (stripe_session_id)
  where stripe_session_id is not null;

-- Credit lookup: "this driver's Stripe payments of this type, newest first".
create index if not exists payments_user_provider_type_idx
  on public.payments (user_id, provider, type, created_at desc);

-- Pre-Stripe on-chain rows carry a real tx hash; keep them distinguishable.
update public.payments
set provider = 'legacy'
where tx_hash is not null and tx_hash not like 'waived-%';
