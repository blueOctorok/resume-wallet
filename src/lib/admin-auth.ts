/**
 * Admin Authentication Helper
 * 
 * Provides wallet-based admin access control.
 * Only wallets listed in ADMIN_WALLETS env variable can access admin features.
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Check if a wallet address is in the admin whitelist
 */
export function isAdminWallet(walletAddress: string | null | undefined): boolean {
  if (!walletAddress) return false
  
  const adminWallets = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0)
  
  if (adminWallets.length === 0) {
    console.warn('[ADMIN AUTH] No ADMIN_WALLETS configured in environment')
    return false
  }
  
  return adminWallets.includes(walletAddress.toLowerCase())
}

/**
 * API route helper - verifies admin access from request headers
 * Returns error response if not authorized
 */
export function requireAdmin(request: NextRequest): { 
  authorized: boolean
  walletAddress: string | null
  error?: NextResponse 
} {
  const walletAddress = request.headers.get('x-wallet-address')
  
  if (!walletAddress) {
    return { 
      authorized: false, 
      walletAddress: null,
      error: NextResponse.json(
        { error: 'Authentication required. Please sign in.' }, 
        { status: 401 }
      ) 
    }
  }
  
  if (!isAdminWallet(walletAddress)) {
    console.warn(`[ADMIN AUTH] Unauthorized access attempt from wallet: ${walletAddress}`)
    return { 
      authorized: false, 
      walletAddress,
      error: NextResponse.json(
        { error: 'Admin access required. Your wallet is not authorized.' }, 
        { status: 403 }
      ) 
    }
  }
  
  return { authorized: true, walletAddress }
}

/**
 * Get list of admin wallets (for debugging/display)
 */
export function getAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0)
}
