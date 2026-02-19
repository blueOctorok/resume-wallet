# StormChain Employer Phases

## ✅ Phase 1: Foundation
Role selection (driver/employer/developer). Database schema with users, companies, job_postings, applications tables. Role-based navigation and API endpoints.

## ✅ Phase 2: Company Profiles
Company setup wizard (name, DOT/MC, contact, fleet size). Multi-user access with 7 role levels. Team invitation system.

## ✅ Phase 3: Job Posting System
Full job CRUD. Role-agnostic via `target_role` (driver, developer, warehouse). Pay range, benefits, requirements, location.

## ✅ Phase 4: Generic Employer Architecture
`company_members` table for team permissions. `employer_candidate_data` for notes/ratings. Employer-ordered MVRs. Team-based RLS policies.

## ✅ Phase 5: Company Approval System
Status workflow (pending → active → suspended). Admin pre-creates or approves companies. Audit trail for all status changes.

## ✅ Phase 6: Employer Onboarding UX
Inline company registration at signup. Central admin sidebar. Email notifications for new registrations.

## ✅ Phase 7: Talent Search & Career Cards
Search candidates with filters. View career cards (profile, resume, MVR, work history). Request documents/MVRs. Recruit directly from career cards. Candidates notified via email and hub UI.

## ✅ Employment Verification
DOT-compliant 3-party verification. 6 FMCSA questions. Token-based previous employer portal. Up to 3 contact attempts.

---

## 🔜 Phase 8: Applicant Review & Hiring
Pipeline management (Submitted → Review → Interview → Offer → Hired). Internal notes/ratings. Messaging system. Document viewer.

## 🔜 Phase 9: Advanced Features
Analytics (time-to-hire, pipeline metrics). Saved searches & alerts. ATS integrations. AvA for employers (AI job posting, candidate matching).
