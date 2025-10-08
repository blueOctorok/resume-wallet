# Vercel Environment Variables Checklist

Copy these from your `.env.local` file to Vercel:

## Public Variables (NEXT*PUBLIC*\*)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_ALCHEMY_POLICY_ID=
NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=
NEXT_PUBLIC_BASE_SEPOLIA_RPC=
NEXT_PUBLIC_PINATA_JWT=
NEXT_PUBLIC_RESUME_CONTRACT_ADDRESS=
```

## Private Variables (Backend only - DO NOT prefix with NEXT*PUBLIC*)

```
PRIVATE_KEY=
ALCHEMY_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## How to Add in Vercel:

1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add each variable one by one
3. Select all environments (Production, Preview, Development)
4. Click "Save"
5. Redeploy your project

## Google OAuth Issue:

The error `OauthFailedError: Opener origin not allowed: https://veree.vercel.app` means:

- Go to Alchemy Dashboard
- Add `https://veree.vercel.app` to allowed origins
- Save and try again

## After Adding Variables:

- Go to Deployments tab
- Click "..." on latest deployment
- Click "Redeploy"
- Wait for build to complete
- Test your app!
