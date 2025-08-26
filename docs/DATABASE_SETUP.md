# Database Setup Guide

## Option 1: Supabase (Recommended for Development)

### Why Supabase?

- **Free tier** with 500MB database
- **PostgreSQL** with real-time features
- **Built-in authentication** (we can use this later)
- **Easy setup** - no local installation needed
- **Production ready** - same database for dev and production

### Setup Steps

1. **Create Supabase Account**
   - Go to [supabase.com](https://supabase.com)
   - Sign up with GitHub/Google
   - Create new project

2. **Get Database Connection String**
   - In your project dashboard, go to Settings → Database
   - Copy the connection string
   - Replace `[YOUR-PASSWORD]` with your database password

3. **Update .env.local**

   ```bash
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

4. **Run Database Migrations**
   ```bash
   npx prisma db push
   ```

## Option 2: Local PostgreSQL (Advanced)

### Install PostgreSQL

- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- **macOS**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql`

### Create Database

```bash
createdb driverappchain
```

### Update .env.local

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/driverappchain"
```

---

## Testing the Database Connection

After setting up either option:

1. **Test Connection**

   ```bash
   npx prisma db push
   ```

2. **Verify Tables Created**

   ```bash
   npx prisma studio
   ```

3. **Test API Endpoints**
   - Start dev server: `npm run dev`
   - Try uploading a resume
   - Check database for saved data

---

## Current Database Schema

Our Prisma schema includes:

- **Users**: CDL driver profiles with wallet addresses
- **Resumes**: File metadata, IPFS hashes, visibility settings
- **Relationships**: One user can have many resumes

This gives us a solid foundation for the resume management system.
