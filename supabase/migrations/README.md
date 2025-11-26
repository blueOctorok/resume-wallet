# Veree Database Migrations

This folder contains all database migrations for the Veree platform in chronological order.

## Migration Order

Run migrations in order:

0. **000_driver_applications_and_resumes.sql** - Foundation tables (DOT forms, resumes) - ALREADY RUN
1. **001_role_based_architecture.sql** - Driver/Employer roles, companies, job postings, applications - ALREADY RUN
2. **002_external_job_aggregation.sql** - External job support (Adzuna, etc.) [TO BE CREATED]
3. **003_driver_profiles.sql** - Driver profile system for quick applications [TO BE CREATED]

## How to Run Migrations

### In Supabase Dashboard:

1. Go to SQL Editor
2. Copy the entire migration file contents
3. Click "Run"
4. Verify tables were created in Table Editor

### Using Supabase CLI:

```bash
supabase db push
```

## Current Schema Overview

### Users & Auth (Foundation)

- `users` - Base user table
  - Authentication: wallet_address (unique), email
  - Profile: name, CDL info (number, state, class)
  - **role** column (driver/employer) - added in Migration 001
  - RLS policies for privacy

### Driver Credentials (Blockchain-Verified)

- `driver_applications` - DOT application forms (Forms 1, 2, 3) with IPFS + smart contract verification
- `resumes` - Resume file uploads with IPFS + smart contract verification, AI extraction
- `driver_profiles` - Quick apply profiles (parsed from above) [TO BE CREATED]

### Employer Tables

- `companies` - Employer company profiles
- `job_postings` - Jobs posted by employers
  - Internal jobs (posted on Veree)
  - External jobs (aggregated from Adzuna) [TO BE ADDED]

### Application Tracking

- `applications` - Driver applications to jobs
  - Links to job_postings, driver_applications, resumes
  - Status tracking, cover letters, reviewer notes

## Migration 000: Foundation Tables

**Documented:**

- `users` - Base user/authentication table
  - wallet_address (unique), email, name
  - CDL information (number, state, class)
  - RLS policies for profile privacy
  - Indexes on wallet_address, email, created_at
- `driver_applications` - DOT application forms (blockchain-verified)
  - JSONB application_data for all form fields
  - IPFS storage, SHA-256 hashing
  - Smart contract integration (ProductionDriverRegistry)
  - Step tracking (1, 2, 3), completion status
- `resumes` - Resume uploads (blockchain-verified)
  - File storage via IPFS/Pinata
  - AI extraction to JSONB (cached)
  - Smart contract integration (ResumeRegistry)
  - Public/private visibility control
- `t_prefill_cache` - AI extraction cache (persistent)
  - Survives resume deletions
  - Fixes T Backend cache lock issues
  - Two-layer caching strategy

**Status:** ✅ Completed and running in production since Sep 2024

## Migration 001: Role-Based Architecture

**Created:**

- `users.role` column (driver/employer)
- `companies` table (employer profiles)
- `job_postings` table (employer job listings)
- `applications` table (driver applications to jobs)
  - Links to driver_applications (DOT form)
  - Links to resumes (resume file)
  - Status workflow, cover letters, reviewer notes

**Status:** ✅ Completed and running in production since Nov 2024

## Migration 002: External Jobs & Driver Profiles (READY TO RUN)

**Adds:**

- **External job support** in `job_postings`:
  - `is_external`, `external_source`, `external_job_id`
  - `redirect_url`, `external_data` (JSONB)
  - Unique constraint to prevent duplicate external jobs
  
- **driver_profiles table** for quick applications:
  - Cached DOT application data
  - CDL info, experience, job preferences
  - Profile completion score (0-100)
  - Resume links
  
- **Shareable application links**:
  - `share_token` column in applications
  - `view_count` and `last_viewed_at` tracking
  - Application data snapshot (immutable)
  
- **application_views table** for analytics:
  - Track employer engagement
  - View count, time spent, sections viewed
  - Auto-increment trigger for view count
  
- **Helper views**:
  - `complete_applications` - joins all application data

**Purpose:**

- Unify internal and external jobs in one table
- Enable "Apply with Veree" one-click applications
- Track application analytics and employer engagement
- Provide shareable public application links

**Status:** ⏳ **READY TO RUN** - See `HOW_TO_RUN_MIGRATIONS.md`

## Notes

- All tables have RLS (Row Level Security) enabled
- Auto-updating `updated_at` timestamps via triggers
- Indexes on foreign keys and frequently queried columns
- Comments on tables and important columns for documentation
