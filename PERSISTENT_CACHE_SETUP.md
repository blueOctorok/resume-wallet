# Persistent Prefill Cache Setup Guide

## 🎯 What This Does
Creates a persistent cache table that preserves AI resume extraction results even when resumes are deleted. This solves the T Backend duplicate detection issue.

## 📋 Setup Steps

### Step 1: Create the Cache Table

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project: `qlxvcjxjrkphobcgvcmb`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the contents of `CREATE_T_PREFILL_CACHE_TABLE.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

You should see:
```
Success. No rows returned
```

### Step 2: Verify the Table Was Created

In the SQL Editor, run:
```sql
SELECT * FROM t_prefill_cache LIMIT 1;
```

You should see the column headers (no rows yet).

### Step 3: Test the Flow

1. **Upload a Resume** (e.g., Victor Lebron's resume)
   - Should extract and prefill successfully
   - Check console logs for: `✅ [AI PREFILL] Data cached in persistent cache (t_prefill_cache)`

2. **Verify Cache Entry**
   Run in Supabase SQL Editor:
   ```sql
   SELECT cache_key, ipfs_hash, file_id, created_at 
   FROM t_prefill_cache 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

3. **Test Admin Delete + Re-upload**
   - Clear data from admin panel (deletes resume from `resumes` table)
   - Re-upload the **same** resume file
   - Should see: `✅ [AI PREFILL] Persistent cache hit! (t_prefill_cache)`
   - Forms should prefill **instantly** (no T Backend call needed!)

## 🔍 How to Monitor

### Check Cache Status
```sql
-- See all cached resumes
SELECT 
  cache_key,
  ipfs_hash,
  file_id,
  created_at,
  (payload->>'extractedAt') as extracted_at
FROM t_prefill_cache
ORDER BY created_at DESC;
```

### Check Cache Size
```sql
-- Count cached entries
SELECT COUNT(*) as total_cached FROM t_prefill_cache;
```

### View Cache for Specific Resume
```sql
-- Replace with your IPFS hash
SELECT * FROM t_prefill_cache 
WHERE ipfs_hash = 'bafkreidhh3xov72ljkomrzmkzrlak734groz2bafeh6lil2wkevlccgrg4';
```

## 🧹 Maintenance

### Clear Old Cache Entries (Optional)
If you want to clean up old cache entries after 30 days:
```sql
DELETE FROM t_prefill_cache 
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Clear Specific Cache Entry
```sql
-- Replace with the IPFS hash you want to clear
DELETE FROM t_prefill_cache 
WHERE ipfs_hash = 'bafkrei...';
```

### Clear ALL Cache (for fresh testing)
```sql
TRUNCATE TABLE t_prefill_cache;
```

## ✅ Success Indicators

After setup, you should see these console logs:

**First Upload (Cache Miss):**
```
📦 [AI PREFILL] Checking persistent cache for IPFS hash: bafkrei...
📦 [AI PREFILL] Checking resumes table cache...
📭 [AI PREFILL] Cache miss - will call T Backend
✅ [AI PREFILL] Extracted 5/9 fields
💾 [AI PREFILL] Caching extracted data for future requests...
✅ [AI PREFILL] Data cached in persistent cache (t_prefill_cache)
✅ [AI PREFILL] Data cached in resumes table
```

**Re-upload After Delete (Cache Hit):**
```
📦 [AI PREFILL] Checking persistent cache for IPFS hash: bafkrei...
✅ [AI PREFILL] Persistent cache hit! (t_prefill_cache)
```

**Time Difference:**
- First upload: ~25-30 seconds (T Backend processing)
- Re-upload: <1 second (instant cache hit)

## 🚨 Troubleshooting

### Issue: "relation 't_prefill_cache' does not exist"
**Solution:** Run the SQL migration script again. Make sure you're connected to the correct database.

### Issue: Cache not being saved
**Solution:** Check console logs for errors. Verify Supabase connection is working.

### Issue: Still getting "duplicate" errors
**Solution:** 
1. Check if table exists: `SELECT * FROM t_prefill_cache LIMIT 1;`
2. Check if data is being saved: `SELECT COUNT(*) FROM t_prefill_cache;`
3. Verify console shows persistent cache checks

## 📊 Expected Database State

After successful setup:

**Before First Upload:**
- `t_prefill_cache`: 0 rows
- `resumes`: May have rows, but no `extracted_data`

**After First Upload:**
- `t_prefill_cache`: 1 row (persistent)
- `resumes`: 1 row with `extracted_data` filled

**After Admin Delete:**
- `t_prefill_cache`: 1 row (PRESERVED ✅)
- `resumes`: 0 rows (deleted)

**After Re-upload:**
- `t_prefill_cache`: 1 row (same as before)
- `resumes`: 1 row (new), but prefill pulls from `t_prefill_cache`

## 🎓 Why This Works

T Backend identifies files by content hash (`file_id`). When you:
1. Upload → They process and cache internally
2. Delete from your DB → Their cache stays
3. Re-upload same file → They say "already processed" → Return empty

**Our solution:** We cache their first successful extraction forever. Even if they refuse to reprocess, we already have the data!

---

**Questions?** Check `docs/CHANGES.md` for full technical documentation.

