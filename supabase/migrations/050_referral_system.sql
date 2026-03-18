-- ============================================================================
-- 050: Referral system
--
-- Each user gets a unique referral code. When someone signs up via ?ref=CODE,
-- a row links the two users. Treasury STORM reward is triggered on the
-- referred user's first paid action.
-- ============================================================================

create table if not exists referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references users(id) on delete cascade,
  referral_code text unique not null,
  referred_user_id uuid references users(id) on delete set null,
  status        text not null default 'pending'
                  check (status in ('pending', 'signed_up', 'rewarded')),
  storm_tx_hash text,
  created_at    timestamptz not null default now(),
  rewarded_at   timestamptz,

  -- Anti-sybil: a user cannot refer themselves
  constraint no_self_referral check (referrer_id != referred_user_id),
  -- Each user can only be referred once (prevents double-dipping)
  constraint one_referral_per_user unique (referred_user_id)
);

create index if not exists idx_referrals_code on referrals(referral_code);
create index if not exists idx_referrals_referrer on referrals(referrer_id);
create index if not exists idx_referrals_referred on referrals(referred_user_id);

alter table referrals enable row level security;

-- Users can read their own referral rows (both as referrer and referred)
create policy "Users can read own referrals"
  on referrals for select
  using (
    auth.uid() = referrer_id
    or auth.uid() = referred_user_id
  );

-- Users can insert referral rows where they are the referrer
create policy "Users can create referrals"
  on referrals for insert
  with check (auth.uid() = referrer_id);

-- Service role can do anything (for API routes using admin client)
create policy "Service role full access"
  on referrals for all
  using (auth.role() = 'service_role');
