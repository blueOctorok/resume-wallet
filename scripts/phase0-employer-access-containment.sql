-- Phase 0 containment — employer access hardening (2026-08-11)
--
-- Run these in order in the Supabase SQL editor. Each step is idempotent and
-- prints what it changed, so it is safe to re-run.
--
-- Context: no breach occurred. Pace's roster is clean (4 verified
-- @pacedrivers.com members). This script fixes a locked-out CEO, clears a stale
-- approval queue, and verifies the set-role ordering bug was never exercised.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Give Jason Peterson the Pace access he should have had
--
-- j.peterson@pacedrivers.com (38ea317e-…) is a VERIFIED corporate address that
-- was auto_approved twice yet never received a company_members row, so the CEO
-- of the design partner has been locked out. Central admin was the workaround.
-- This must land BEFORE step 2 revokes that workaround.
--
-- Shape matches exactly what POST /api/employer/team inserts: user_id is set
-- because the account already exists, accepted_at stays null (pending), and the
-- invite is claimed on next sign-in by resolveEmployerLink.
--
-- ROLE DECISION: 'admin' grants full team + company management without
-- displacing Sam's owner row. Change to 'owner' if Pace should hold ownership
-- (see the owner-transfer note in the plan — that is a separate piece of work).
-- ─────────────────────────────────────────────────────────────────────────────

insert into company_members (
  company_id, user_id, role, invited_by, invite_email, invite_expires_at, is_active
)
select
  'a292d466-00d3-4aa5-a4b2-5263d79266c6',        -- Pace Drivers
  '38ea317e-b938-44c7-9e48-5e67b1ec0c0b',        -- j.peterson@pacedrivers.com
  'admin',
  '5f49469b-64fc-4055-be13-9000ca7b68e0',        -- invited by Sam (owner)
  'j.peterson@pacedrivers.com',
  now() + interval '7 days',
  true
where not exists (
  select 1 from company_members
  where company_id = 'a292d466-00d3-4aa5-a4b2-5263d79266c6'
    and lower(invite_email) = 'j.peterson@pacedrivers.com'
)
returning id, role, invite_email, user_id, accepted_at, invite_expires_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Clear the stale flagged access requests
--
-- Kyle Evans, Richard Garry, Martin Grant, Emery Irby, Eddieneyo Lopez are all
-- drivers who reached the employer door through the invite funnel. None gained
-- access (all still role='candidate' with zero memberships). Rejecting them
-- only clears the queue so nothing sits one click from approval.
--
-- Rows are kept, not deleted: they are the evidence trail for this incident and
-- AccessRequestsTab becomes read-only history.
-- ─────────────────────────────────────────────────────────────────────────────

update employer_access_requests
set status = 'rejected',
    rejection_reason = 'Driver/candidate account — employer access is admin-provisioned only (2026-08-11 access hardening). No action needed by the requester; they already have candidate access.',
    reviewed_at = now(),
    updated_at = now()
where status = 'flagged'
returning email, company_name, status, rejection_reason;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Verify the set-role ordering bug was never exercised
--
-- users.role was written before the authorization check and never rolled back
-- on the 403, so a rejected request could leave a permanent employer role.
-- This returned 0 rows on 2026-08-11. Re-run after the code fix to confirm it
-- stays empty. ANY row here is someone told "no" who got the role anyway —
-- clear their role and check career_card_views for what they accessed.
-- ─────────────────────────────────────────────────────────────────────────────

select u.id, u.email, u.role, u.created_at
from users u
left join company_members cm on cm.user_id = u.id and cm.is_active
left join companies c on c.employer_user_id = u.id
where u.role = 'employer' and cm.id is null and c.id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Post-change verification
-- Expect: Pace has 5 members (4 active + Jason pending until he signs in).
-- ─────────────────────────────────────────────────────────────────────────────

select cm.role, cm.invite_email, cm.is_active, cm.accepted_at,
       case when cm.accepted_at is null then 'pending — claims on next sign-in' else 'active' end as state
from company_members cm
where cm.company_id = 'a292d466-00d3-4aa5-a4b2-5263d79266c6'
order by cm.role, cm.invite_email;
