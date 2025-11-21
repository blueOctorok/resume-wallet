# Database Migration Guide: Role-Based System

## 🎯 **What This Migration Does**

This migration is **100% safe** - it only **adds** new columns and tables. It does **NOT**:
- ❌ Delete any existing data
- ❌ Replace any tables
- ❌ Modify existing columns
- ❌ Break any existing functionality

## 📋 **Step-by-Step Instructions**

### **Option 1: Supabase Dashboard (Easiest - Recommended)**

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy the Migration**
   - Open `database_migrations/002_add_role_and_companies.sql`
   - Copy the **entire file** (Ctrl+A, Ctrl+C)

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)
   - Wait for "Success" message

5. **Verify It Worked**
   - Go to "Table Editor" in left sidebar
   - Check `users` table - you should see a new `role` column
   - Check for new tables: `companies`, `job_postings`, `applications`

### **Option 2: Supabase CLI (For Developers)**

```bash
# If you have Supabase CLI installed
supabase db push database_migrations/002_add_role_and_companies.sql
```

### **Option 3: psql Command Line**

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f database_migrations/002_add_role_and_companies.sql
```

---

## ✅ **What Happens After Migration**

### **Existing Users:**
- All existing users will have `role = NULL`
- On their next login, they'll see the role selection modal
- Once they select a role, it's saved permanently

### **New Users:**
- New users will also see the role selection modal on first login
- Role is saved immediately after selection

### **No Data Loss:**
- All existing user data remains intact
- All resumes, applications, and blockchain data unchanged
- Only new functionality is added

---

## 🔍 **Verification Checklist**

After running the migration, verify:

- [ ] `users` table has a new `role` column (can be NULL)
- [ ] `companies` table exists (empty initially)
- [ ] `job_postings` table exists (empty initially)
- [ ] `applications` table exists (empty initially)
- [ ] Existing users still have all their data
- [ ] You can still log in and see your resume/forms

---

## ⚠️ **Troubleshooting**

### **Error: "column already exists"**
- The migration was already run. This is fine - skip it.

### **Error: "table already exists"**
- The tables were already created. This is fine - the `CREATE TABLE IF NOT EXISTS` will skip them.

### **Error: "permission denied"**
- Make sure you're using the correct database credentials
- Check that you have admin access to the Supabase project

### **Want to Rollback?**
If you need to undo this migration (not recommended, but possible):

```sql
-- Remove the role column
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- Drop the new tables (only if empty)
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS job_postings;
DROP TABLE IF EXISTS companies;
```

---

## 📚 **Understanding SQL Commands**

### **`ALTER TABLE users ADD COLUMN role`**
- **ALTER** = Modify an existing table
- **ADD COLUMN** = Add a new column (doesn't touch existing columns)
- **Result**: Your `users` table now has one more column. All existing rows get `NULL` for this column.

### **`CREATE TABLE IF NOT EXISTS companies`**
- **CREATE TABLE** = Make a new table
- **IF NOT EXISTS** = Only create if it doesn't already exist (safe to run multiple times)
- **Result**: A brand new empty table is created. Doesn't affect any existing tables.

### **Why This is Safe:**
- SQL `ALTER` commands are **additive** - they add structure, not remove it
- `IF NOT EXISTS` prevents errors if you run it twice
- No `DROP` or `DELETE` commands in this migration
- All existing data remains untouched

---

## 🎓 **Educational Note**

**SQL Migration Best Practices:**

1. **Always use `IF NOT EXISTS`** for `CREATE TABLE` - makes migrations idempotent (safe to run multiple times)

2. **Use `ALTER TABLE ADD COLUMN`** instead of recreating tables - preserves data

3. **Test on a backup first** if you're nervous (Supabase has automatic backups)

4. **One migration = One logical change** - This migration adds role-based system, that's it.

5. **Never use `DROP TABLE` in migrations** unless you're absolutely sure (and even then, use `DROP TABLE IF EXISTS`)

---

## ✅ **You're Safe!**

This migration is designed to be **non-destructive**. It only adds new capabilities without breaking anything. Your existing users, resumes, and applications will all continue working exactly as before.

