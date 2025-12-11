# RLS API Route Fixes

## Issue
After enabling RLS, API routes using `createClient()` from `@/utils/supabase/server` (which uses anon key) were being blocked because:
- RLS policies use `auth.uid()` which is NULL with Alchemy wallet auth
- Anon key respects RLS, so queries are blocked

## Solution
All API routes should use `getAdminSupabaseClient()` (service role key) which bypasses RLS.

## Fixed Routes

### ✅ Fixed
- `/api/user/profile` - User profile fetching
- `/api/user/set-role` - Role setting
- `/api/driver/profile` - Driver profile
- `/api/resumes/upload` - Resume upload (already using admin for duplicate check)
- `/api/driver-applications/save-employment-verification` - Employment verification (already using admin for duplicate check)

### ⚠️ Need to Check/Fix
- `/api/applications/*` - Application routes
- `/api/mvr/*` - MVR routes
- `/api/driver/*` - Driver routes (except profile, which is fixed)
- `/api/ai/*` - AI routes
- `/api/blockchain/*` - Blockchain routes
- Any other routes that query/update Supabase

## Pattern to Fix

**Before (BLOCKED by RLS):**
```typescript
import { createClient } from '@/utils/supabase/server'

const supabase = await createClient()
```

**After (BYPASSES RLS):**
```typescript
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const supabase = await getAdminSupabaseClient()
```

## Why This is Safe
- Service role key bypasses RLS (by design)
- All API routes validate wallet addresses server-side
- No direct client-side DB access
- RLS still provides defense in depth for unauthorized direct access attempts

