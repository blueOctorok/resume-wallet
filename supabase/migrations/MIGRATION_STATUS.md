# Migration Status

Track which migrations have been run in your Supabase instance.

## Production Status

| Migration                                      | Status       | Date Run     | Notes                              |
| ---------------------------------------------- | ------------ | ------------ | ---------------------------------- |
| 000_driver_applications_and_resumes.sql        | ✅ Completed | Sep 26, 2024 | Foundation - Already in production |
| 001_role_based_architecture.sql                | ✅ Completed | Nov 20, 2024 | Already in production              |
| 002_external_jobs_and_driver_profiles.sql      | ✅ Completed | Nov 24, 2024 | "Apply with Veree" system enabled  |
| 003_mvr_integration.sql                        | ⏳ Pending   | -            | MVR integration with Accio API     |

## How to Update This File

After running a migration:

1. Change status from ⏳ Pending to ✅ Completed
2. Add the date
3. Add any notes or issues encountered

## Rollback Plan

If a migration needs to be rolled back, the SQL to undo changes will be documented here.

### 001 Rollback (if needed):

```sql
-- WARNING: This will delete all data in these tables!
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS job_postings CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS role;
```

**⚠️ Only run rollback if absolutely necessary and you have backups!**
