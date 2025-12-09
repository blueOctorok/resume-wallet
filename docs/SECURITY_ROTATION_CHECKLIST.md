# 🔒 Security Rotation Checklist - CVE-2025-66478

**CRITICAL**: If your application was online and unpatched as of December 4, 2025 at 1:00 PM PT, you MUST rotate all secrets.

## ✅ Next.js Update Status

- [x] Next.js upgraded to 15.5.7 (patched)
- [x] Security fix script run (`npx fix-react2shell-next`)
- [x] Vulnerability confirmed patched

## 🔑 Secrets to Rotate

### Priority 1 - Rotate IMMEDIATELY (Critical)

#### Payment & Wallet Keys
- [ ] `X402_PAYMENT_PRIVATE_KEY` - Payment wallet private key
  - **Action**: Generate new wallet with `npm run payment:create`
  - **Steps**:
    1. Create new wallet
    2. Fund with USDC and ETH on Base Mainnet
    3. Update `.env.local`
    4. Update Vercel environment variables
    5. Test payment flow
    6. **DO NOT DELETE OLD WALLET** - transfer remaining funds first

- [ ] `PRIVATE_KEY` - Deployment wallet private key
  - **Action**: Generate new wallet or import existing backup
  - **Steps**:
    1. Create/import new wallet
    2. Update `.env.local`
    3. Update Vercel environment variables
    4. Update any deployment scripts

#### Database & Service Keys
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Database service role key
  - **Action**: Generate new key in Supabase Dashboard
  - **Location**: Supabase Dashboard → Settings → API → Service Role Key
  - **Steps**:
    1. Generate new service role key
    2. Update `.env.local`
    3. Update Vercel environment variables
    4. Revoke old key

- [ ] `ADMIN_API_KEY` - Admin authentication key
  - **Action**: Generate new secure random key
  - **Steps**:
    1. Generate new key (e.g., `openssl rand -hex 32`)
    2. Update `.env.local`
    3. Update Vercel environment variables
    4. Update any scripts/tools using this key

#### API Keys
- [ ] `T_BACKEND_API_KEY` - AI service API key
  - **Action**: Request new key from T Backend team
  - **Steps**:
    1. Contact team for new API key
    2. Update `.env.local`
    3. Update Vercel environment variables
    4. Revoke old key with team

### Priority 2 - Rotate Soon (Important)

#### Blockchain Services
- [ ] `ALCHEMY_API_KEY` - Alchemy RPC API key
  - **Action**: Generate new key in Alchemy Dashboard
  - **Location**: Alchemy Dashboard → Apps → API Keys
  - **Note**: Update both `ALCHEMY_API_KEY` and `NEXT_PUBLIC_ALCHEMY_API_KEY`

- [ ] `ALCHEMY_AUTH_TOKEN` - Alchemy webhook auth token
  - **Action**: Generate new token in Alchemy Dashboard

- [ ] `ALCHEMY_WEBHOOK_SIGNING_KEY` - Webhook signing key
  - **Action**: Generate new key in Alchemy Dashboard

#### Third-Party Services
- [ ] `ACCIO_PASSWORD` - MVR service password
  - **Action**: Reset password in Accio dashboard
  - **Note**: Also update `ACCIO_USERNAME` if compromised

- [ ] `ADZUNA_APP_KEY` - Job search API key
  - **Action**: Generate new key in Adzuna dashboard

- [ ] `PINATA_API_KEY` / `PINATA_API_SECRET` - IPFS service keys
  - **Action**: Generate new keys in Pinata dashboard
  - **Note**: Also update `NEXT_PUBLIC_PINATA_JWT` if using JWT auth

- [ ] `DYNAMIC_API_TOKEN` - Dynamic.xyz API token
  - **Action**: Generate new token in Dynamic dashboard

#### Other Keys
- [ ] `BASESCAN_API_KEY` - BaseScan API key (if used)
- [ ] Any other API keys or credentials in `.env.local`

## 📋 Rotation Steps

### For Each Secret:

1. **Generate New Key**
   - Use service dashboard or secure key generator
   - Store new key securely (password manager)

2. **Update Local Environment**
   - Update `.env.local` with new key
   - Test locally to ensure functionality

3. **Update Vercel**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Update the secret for all environments (Production, Preview, Development)
   - Save changes

4. **Redeploy**
   - Trigger a new deployment or wait for next deployment
   - Verify functionality in production

5. **Revoke Old Key**
   - Once new key is confirmed working
   - Revoke old key in service dashboard
   - **Exception**: Payment wallet - transfer funds first, then consider old wallet compromised

## ⚠️ Special Considerations

### Payment Wallet (`X402_PAYMENT_PRIVATE_KEY`)

**DO NOT DELETE OLD WALLET IMMEDIATELY**

1. Create new payment wallet
2. Fund new wallet with USDC and ETH
3. Update environment variables
4. Test payment flow
5. **Transfer any remaining funds** from old wallet to new wallet
6. Mark old wallet as compromised (do not use for new transactions)

### Database Service Role Key

- This key has full database access
- Rotate immediately if exposed
- Update all services using this key simultaneously
- Test database operations after rotation

### Public vs Private Keys

- `NEXT_PUBLIC_*` keys are exposed to client-side code
- These are less critical but should still be rotated
- Focus on private keys first (no `NEXT_PUBLIC_` prefix)

## ✅ Verification Checklist

After rotation, verify:

- [ ] Application builds successfully
- [ ] All API routes work correctly
- [ ] Database connections work
- [ ] Payment flow works (if applicable)
- [ ] Third-party integrations work
- [ ] No errors in production logs
- [ ] Old keys are revoked/disabled

## 📝 Notes

- **Timeline**: Complete Priority 1 rotations within 24 hours
- **Documentation**: Update this checklist as you rotate each secret
- **Backup**: Keep old keys in secure backup until rotation is complete
- **Testing**: Test each service after rotation before moving to next

## 🔗 References

- [Next.js Security Advisory](https://nextjs.org/security)
- [CVE-2025-66478](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-66478)
- [Vercel Environment Variables Guide](https://vercel.com/docs/concepts/projects/environment-variables)

