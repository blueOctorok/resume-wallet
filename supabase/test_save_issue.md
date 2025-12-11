# Testing DOT Application Saves After RLS Enabled

## Current Status
- ✅ 2 completed applications exist in database (saved before RLS enabled)
- ⚠️ RLS is now enabled on all tables
- ⚠️ Client-side saves use anon key (respects RLS)
- ⚠️ RLS policies use `auth.uid()` which is NULL with Alchemy auth

## To Test
1. Try saving a DOT application step in the UI
2. Check browser console for errors
3. Check if the save succeeds or fails

## Expected Behavior
- **Before RLS:** Saves worked (anon key had access)
- **After RLS:** Saves likely FAIL (RLS blocks anon key without auth.uid())

## If Failing
- New applications won't save to database
- Need to route through API route (uses service role, bypasses RLS)

