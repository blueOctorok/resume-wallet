# RLS Enabled - Safety Documentation

## ✅ **It's Safe to Enable RLS**

### **Why This Works:**

1. **Server-Side Uses Service Role**
   - All API routes use `getAdminSupabaseClient()` (service role key)
   - Service role **bypasses RLS completely** (by design)
   - This is the correct approach for server-side operations

2. **Client-Side Access is Blocked**
   - Since we use Alchemy wallet auth (not Supabase Auth), `auth.uid()` is NULL
   - RLS policies won't allow client-side direct DB access
   - **This is expected** - all access should go through API routes anyway

3. **RLS Provides Defense in Depth**
   - Blocks unauthorized direct DB access attempts
   - Prevents accidental exposure of direct DB queries
   - Adds security layer even though it's not the primary protection

---

## 🔐 **Current Architecture (Correct)**

```
Client (Browser)
    ↓
Next.js API Routes (/api/*)
    ↓
getAdminSupabaseClient() [Service Role - BYPASSES RLS]
    ↓
Supabase Database
```

**All operations:**
- ✅ Validate wallet addresses server-side
- ✅ Use service role (bypasses RLS)
- ✅ Have proper authorization checks in code

---

## ⚠️ **Important Notes**

### **RLS Policies Won't Work for Clients**

The RLS policies use `auth.uid()` which requires Supabase Auth:
```sql
USING (user_id = auth.uid())  -- This will be NULL for Alchemy auth
```

**But that's OK because:**
- We don't do direct client-side DB queries
- All access goes through API routes (service role)
- RLS still blocks unauthorized direct access attempts

### **If You Add Direct Client-Side Queries:**

If you ever want to add direct client-side DB queries (using anon key):
1. You'll need to create custom RLS functions that check `wallet_address`
2. Or create a custom auth function that maps wallet addresses to user IDs
3. For now, keep all access through API routes (recommended)

---

## 🚀 **After Enabling RLS**

### **What Will Work:**
- ✅ All API routes (use service role, bypass RLS)
- ✅ Server-side operations (use service role)
- ✅ Duplicate checks (use admin client, bypass RLS)

### **What Will Be Blocked:**
- ❌ Direct client-side DB queries (expected)
- ❌ Unauthorized direct DB access attempts (good!)
- ❌ Accidental exposure of direct queries (security improvement)

---

## 📋 **Migration Steps**

1. Run migration `004_enable_rls_safe.sql`
2. Verify all tables have RLS enabled (Supabase dashboard)
3. Test API routes (should work - they use service role)
4. Monitor for any issues

**Expected:** Everything continues to work because API routes use service role.

---

## 🔍 **Verification**

After enabling RLS, verify:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show rowsecurity = true for all tables
```

---

## ✅ **Summary**

**Enable RLS?** YES - It's safe and recommended.

**Will it break anything?** NO - All operations use service role (bypasses RLS).

**Why enable it?** Defense in depth - blocks unauthorized direct DB access.

**Is this the final solution?** YES for current architecture. Future enhancement possible if direct client queries are needed.

