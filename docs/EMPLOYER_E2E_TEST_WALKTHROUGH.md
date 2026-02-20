# Employer Features – End-to-End Test Walkthrough

Quick guide to test employer flows: Job Posting → Talent Search → Career Card → Requests/Recruit → Pipeline (Kanban) → Notes.

---

## Prerequisites

1. **Employer account** – Sign in with a wallet; select **Employer** at role selection. Complete company form (name, optional DOT) so company is active (or have admin approve).
2. **Candidate data (optional but useful)** – One or more users with **Driver** or **Developer** role who have built their hub (profile, resume, DOT app, etc.) so they appear in talent search and have a meaningful career card.

---

## 0. Post a Job (Required First!)

- **Where:** Employer Hub → **Post Job** button (top right of Job Postings section, or Quick Actions).
- **Steps:**
  1. Select **Target Role** (Driver, Developer, Warehouse, Other)
  2. Fill in **Job Title** (required) and optionally description/requirements
  3. For **Driver** roles: select Route Type (OTR, Regional, Local, Dedicated)
  4. For **Developer** roles: toggle Remote Allowed if applicable
  5. Add **Location** (city/state) and **Salary Range** (optional)
  6. Click **Post Job**
- **Verify:** Job appears in your "Job Postings" list in the hub. Status should be "Active".

---

## 1. Employer Hub (Home)

- **Where:** Log in as employer → land on Employer Hub.
- **Check:**
  - Stats (active jobs, applicants, pipeline counts).
  - **Hiring Pipeline** – Toggle **List** vs **Kanban** (default). List = summary bars; Kanban = drag columns (New → Reviewing → Interviewing → Offer Sent → Hired → Rejected).
  - If you have applicants: drag a card to another column → status updates and candidate gets an email (if Resend is configured).
  - Click an applicant card → detail panel opens with **Status** dropdown and **Notes & Activity** panel (add note, star rating, tags). Notes are private to your company.
- **Navigation:** Use "View All" (or similar) to go to **Applicants** page; use **Find Talent** to go to **Talent Search**.

---

## 2. Find Talent (Search)

- **Where:** Employer Hub → **Find Talent**.
- **Check:**
  - Set role filter (Driver / Developer) and optional search → **Search**. Results show candidates (name, role, location, etc.).
  - Click a candidate row → **Career Card** modal opens (portal, no nav overlap; scroll inside modal).
- **Career card shows:** Profile completeness, contact, CDL/dev info, resume, MVR, DOT application, work history. Any section can show "No X on file" or "Request X".

---

## 3. Career Card – Requests

- **Where:** Same career card modal (from Find Talent).
- **Check:**
  - **Order MVR** – If no MVR: "Order MVR" runs employer MVR order flow; candidate is notified; result can appear on their career card.
  - **Request document / verification / etc.** – Use request controls per section (e.g. "Request document") if available. Candidate gets email and sees the request in their hub (Driver Hub or Developer Hub).
- **Recruit (create application):**
  - Click **Recruit Candidate** (or "Create Application") → modal to pick a **job** and optional message.
  - Select job → Send. Backend creates an application (snapshot) and notifies candidate. Applicant then appears in your pipeline under that job.

---

## 4. Applicants Page

- **Where:** Employer Hub → **View All** applicants (or "Applicants" in nav).
- **Check:** List/table of all applicants across jobs. Click one → same applicant detail as in the hub (status, notes, docs). Use this to change status, add notes, or open resume/verification.

---

## 5. Candidate Side (Request & Application)

- **Driver/Developer Hub:** "Requests" or "Employer requests" section shows pending requests (MVR, document, etc.). Candidate can view, complete, or decline.
- **After recruit:** Candidate may get email "X invited you to apply for [Job]". The new application shows in your pipeline (e.g. **New**).

---

## 6. Pipeline (Kanban) – Full Flow

1. Get applicants (either by candidates applying to your job, or by **Recruit** from Find Talent).
2. In Employer Hub, Kanban view: see cards in **New**.
3. Drag a card to **Reviewing** (or use status dropdown in detail) → status updates; candidate gets "your application is being reviewed" email.
4. Open card → add **notes**, **rating**, **tags** in the right panel.
5. Move to **Interviewing** → **Offer Sent** → **Hired** (or **Rejected**). Each status change can trigger the corresponding email to the candidate.

---

## Quick Checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as employer, open Employer Hub | Hub loads; pipeline (list or Kanban) and stats visible |
| 2 | Click **Post Job** → fill form → submit | Job created; appears in Job Postings list |
| 3 | Click Find Talent → Search (e.g. Driver) | Candidate list appears |
| 4 | Click a candidate | Career card modal opens (no z-index/scroll issues) |
| 5 | On career card: Order MVR or Request document | Request created; candidate notified (email + hub) |
| 6 | On career card: Recruit Candidate → pick job → Send | Application created; candidate in pipeline |
| 7 | In hub: drag applicant to "Reviewing" | Status updates; candidate email (if Resend on) |
| 8 | Open applicant → add note + rating in right panel | Saved; visible in timeline |
| 9 | Log in as that driver/dev → open hub | "Requests" shows employer request; can complete/decline |

---

## Troubleshooting

- **No candidates in Find Talent:** Need users with Driver/Developer role and some profile data (so they appear in `career_cards` / search).
- **Recruit fails / no jobs:** Create at least one **active** job posting for your company using **Post Job**.
- **No status emails:** Configure Resend (e.g. `verify.stormchain.ai`) and env vars; status emails are sent for under_review, interview, offer, hired, rejected.
- **Company "pending":** Admin approves in `/admin` → Companies, or use pre-create flow so company is active when employer signs up.
