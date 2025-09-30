// lib/pricing.ts
// Simple pricing model: 1 free per week, $1 USDC after that

import { createClient } from '@/utils/supabase/server'

export const PRICING = {
  FREE_UPLOADS_PER_WEEK: 999, // Disabled for development - unlimited free uploads
  PAID_UPLOAD_COST_USDC: 1,
  FREE_WINDOW_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
}

export async function checkUploadEligibility(userId: string): Promise<{
  canUploadFree: boolean
  uploadsThisWeek: number
  requiresPayment: boolean
  costUSDC: number
  nextFreeUpload?: Date
}> {
  const supabase = await createClient()
  const weekAgo = new Date(Date.now() - PRICING.FREE_WINDOW_MS)

  // Count uploads in last 7 days
  const { count: uploadsThisWeek, error } = await supabase
    .from('resumes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', weekAgo.toISOString())

  if (error) {
    console.error('Error checking upload eligibility:', error)
    // Default to allowing upload if we can't check
    return {
      canUploadFree: true,
      uploadsThisWeek: 0,
      requiresPayment: false,
      costUSDC: 0,
    }
  }

  const canUploadFree = (uploadsThisWeek || 0) < PRICING.FREE_UPLOADS_PER_WEEK
  const requiresPayment = !canUploadFree

  // Calculate when next free upload will be available
  let nextFreeUpload: Date | undefined
  if (requiresPayment) {
    // Find the oldest upload in the current week window
    const { data: oldestUpload } = await supabase
      .from('resumes')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(1)

    if (oldestUpload && oldestUpload[0]) {
      const oldestDate = new Date(oldestUpload[0].created_at)
      nextFreeUpload = new Date(oldestDate.getTime() + PRICING.FREE_WINDOW_MS)
    }
  }

  return {
    canUploadFree,
    uploadsThisWeek: uploadsThisWeek || 0,
    requiresPayment,
    costUSDC: requiresPayment ? PRICING.PAID_UPLOAD_COST_USDC : 0,
    nextFreeUpload,
  }
}

export async function recordPaidUpload(
  userId: string,
  txHash: string,
  amountUSDC: number
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('payments').insert({
    user_id: userId,
    type: 'RESUME_UPLOAD',
    amount_usdc: amountUSDC,
    tx_hash: txHash,
    status: 'COMPLETED',
  })

  if (error) {
    console.error('Error recording paid upload:', error)
    throw new Error('Failed to record payment')
  }
}
