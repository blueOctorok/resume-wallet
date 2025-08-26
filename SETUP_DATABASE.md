# 🚀 Quick Database Setup

## Step 1: Get Supabase Database (5 minutes)

1. **Go to [supabase.com](https://supabase.com)**
2. **Sign up with GitHub/Google**
3. **Create new project** (name it `driverappchain`)
4. **Wait for project to be ready** (green checkmark)

## Step 2: Get Connection String

1. **In your project dashboard, click Settings → Database**
2. **Copy the connection string** (looks like this):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```
3. **Replace `[YOUR-PASSWORD]` with your database password**

## Step 3: Update Environment

1. **Open your `.env.local` file**
2. **Replace the DATABASE_URL line with your Supabase connection string**
3. **Save the file**

## Step 4: Test Database

Run these commands in order:

```bash
# Test database connection
npm run db:test

# If successful, push schema to database
npm run db:push

# Open database viewer (optional)
npm run db:studio
```

## Step 5: Test the App

```bash
# Start development server
npm run dev

# Open http://localhost:3000
# Try uploading a resume (it will save to database now!)
```

---

## 🆘 If Something Goes Wrong

### Connection Failed?

- Check your DATABASE_URL format
- Make sure you replaced `[YOUR-PASSWORD]` with actual password
- Verify project is active in Supabase dashboard

### Schema Push Failed?

- Run `npm run db:generate` first
- Check if tables already exist in Supabase dashboard

### Still Stuck?

- Check the `docs/DATABASE_SETUP.md` for detailed troubleshooting
- Look at error messages in terminal for specific issues

---

## 🎯 What This Gives You

✅ **Working database** with real data persistence  
✅ **Resume uploads** that actually save to database  
✅ **API endpoints** that work end-to-end  
✅ **Foundation** for blockchain integration

Once this is working, we can move on to **wallet authentication** and **blockchain deployment**!
