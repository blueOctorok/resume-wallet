# 🚀 Vercel Deployment Guide

## Overview

Your DriverAppChain application is ready for production deployment on Vercel! The codebase is well-architected with proper environment variable usage and no hardcoded localhost dependencies.

## ✅ Pre-Deployment Checklist

### 1. Environment Variables Setup

Create these environment variables in your Vercel dashboard:

#### **Required Variables:**

```bash
# App Configuration
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_ALCHEMY_BASE_MAINNET_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Contract Configuration
NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address
BASESCAN_API_KEY=your_basescan_api_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# IPFS Configuration (Pinata)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# Deployment Keys (for contract deployment)
PRIVATE_KEY=your_deployment_private_key
```

#### **Optional Variables:**

```bash
# Rate Limiting
RATE_LIMIT_ENABLED=true
UPLOAD_RATE_LIMIT=20
VERIFICATION_RATE_LIMIT=50

# Pricing Configuration
FREE_UPLOADS_PER_WEEK=1
PAID_UPLOAD_COST_USDC=1
```

### 2. Contract Deployment

**Before deploying to Vercel, deploy your smart contract:**

```bash
# Deploy to Base Sepolia (recommended for testing)
npm run deploy:base-sepolia

# Get the contract address from the deployment output
# Set NEXT_PUBLIC_CONTRACT_ADDRESS in Vercel environment variables
```

### 3. Database Setup

Ensure your Supabase database is configured with:

- ✅ `resumes` table with all required columns
- ✅ `driver_applications` table
- ✅ `payments` table
- ✅ Row Level Security (RLS) policies enabled

## 🚀 Deployment Steps

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Vercel will auto-detect Next.js configuration

### Step 2: Configure Environment Variables

1. In Vercel dashboard → Settings → Environment Variables
2. Add all required variables from the checklist above
3. Make sure to set `NEXT_PUBLIC_APP_URL` to your Vercel domain

### Step 3: Deploy

1. Click "Deploy" in Vercel dashboard
2. Wait for build to complete
3. Test your deployed application

## 🔍 What Works Out of the Box

### ✅ **No Code Changes Required:**

1. **API Routes** - All use relative paths (`/api/resumes/upload`)
2. **Environment Variables** - Properly configured with fallbacks
3. **Blockchain Integration** - Uses production Alchemy endpoints
4. **Database Connections** - Supabase works globally
5. **File Uploads** - IPFS integration is network-agnostic
6. **Authentication** - Alchemy Smart Wallets work on any domain

### ✅ **Smart Fallbacks Already Built:**

- `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`
- Contract addresses use environment variables
- API keys have proper fallback configurations

## 🔧 Post-Deployment Configuration

### 1. Update Webhook URLs

If you're using Alchemy webhooks, update the webhook URLs to point to your Vercel domain:

```bash
# Example webhook URL
https://your-app.vercel.app/api/webhooks/alchemy
```

### 2. Test Core Functionality

1. **Authentication** - Test email OTP and Google OAuth
2. **Resume Upload** - Upload a test PDF
3. **Driver Application** - Complete a test application
4. **Blockchain Verification** - Verify resume uploads work
5. **Database Operations** - Check data persistence

### 3. Monitor Performance

- Check Vercel Analytics for performance metrics
- Monitor API route execution times
- Watch for any 500 errors in Vercel logs

## 🚨 Common Issues & Solutions

### Issue: "Contract not deployed"

**Solution:** Ensure `NEXT_PUBLIC_CONTRACT_ADDRESS` is set correctly

### Issue: "Alchemy API errors"

**Solution:** Verify `NEXT_PUBLIC_ALCHEMY_API_KEY` is correct and has proper permissions

### Issue: "Supabase connection failed"

**Solution:** Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Issue: "IPFS upload fails"

**Solution:** Verify `PINATA_API_KEY` and `PINATA_SECRET_KEY` are correct

## 📊 Production Optimizations

### 1. Enable Vercel Analytics

```bash
# In your Vercel dashboard
Analytics → Enable
```

### 2. Configure Custom Domain

```bash
# In Vercel dashboard
Settings → Domains → Add your custom domain
```

### 3. Set Up Monitoring

```bash
# Consider adding:
- Sentry for error tracking
- LogRocket for user session replay
- Uptime monitoring
```

## 🎯 Expected Behavior

Your application will behave **identically** to localhost with these key differences:

- ✅ **Faster Performance** - Vercel's global CDN
- ✅ **Better Reliability** - Vercel's infrastructure
- ✅ **Production URLs** - Real blockchain explorer links
- ✅ **Scalable** - Automatic scaling based on traffic

## 🔐 Security Considerations

1. **Environment Variables** - Never commit `.env.local` to Git
2. **API Keys** - Rotate keys regularly
3. **Rate Limiting** - Already implemented for production
4. **CORS** - Configured for your domain only

## 📈 Next Steps After Deployment

1. **Test thoroughly** - Run through all user flows
2. **Monitor logs** - Watch for any errors
3. **Optimize** - Use Vercel Analytics to identify bottlenecks
4. **Scale** - Add monitoring and alerting as needed

---

**Your app is production-ready!** 🎉
