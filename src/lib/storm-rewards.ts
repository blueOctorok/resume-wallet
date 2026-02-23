/**
 * STORM Token Reward Calculation
 *
 * Implements the smooth decay reward formula from the whitepaper:
 * tokens = (USDC_spent × baseRate × userMultiplier) × (remaining / totalPool)^0.7
 *
 * - baseRate: ~3.33 tokens per $1 USDC at 0% distributed ($3 → 10 tokens)
 * - totalPool: 9,000,000 STORM (user rewards allocation)
 * - exponent 0.7: gradual decay (no sudden halvings like Bitcoin)
 * - userMultiplier: 1.0 for applicants, 0.5 for employers
 *   (keeps token community-first while rewarding all economic activity)
 */

// Total reward pool (9M STORM)
export const TOTAL_REWARD_POOL = 9_000_000

// Base rate: ~3.33 tokens per $1 USDC (so $3 → 10 tokens at start)
export const BASE_RATE = 10 / 3 // ≈ 3.333...

// Decay exponent (0.7 = gradual decay, per whitepaper)
export const DECAY_EXPONENT = 0.7

// User type multipliers - applicants earn more to keep token community-first
export type UserType = 'applicant' | 'employer'
export const USER_MULTIPLIERS: Record<UserType, number> = {
  applicant: 1.0,   // Full rate - token belongs to job seekers
  employer: 0.5,    // Half rate - employers participate but don't dominate
}

/**
 * Calculate STORM reward for a given USDC spend.
 *
 * @param usdcSpent - Amount of USDC spent (e.g., 2.99 for resume verification)
 * @param totalDistributed - Total STORM already distributed from the 9M pool
 * @param userType - 'applicant' (1x rate) or 'employer' (0.5x rate)
 * @returns STORM tokens to reward (as a number, e.g., 9.21)
 *
 * @example
 * // At 0% distributed, $3 spend by applicant → 10 STORM
 * calculateReward(3, 0, 'applicant') // → 10
 *
 * // At 0% distributed, $3 spend by employer → 5 STORM (half rate)
 * calculateReward(3, 0, 'employer') // → 5
 *
 * // At 50% distributed, $3 spend by applicant → ~6.16 STORM
 * calculateReward(3, 4_500_000, 'applicant') // → ~6.16
 */
export function calculateReward(
  usdcSpent: number,
  totalDistributed: number,
  userType: UserType = 'applicant'
): number {
  // Validate inputs
  if (usdcSpent <= 0) return 0
  if (totalDistributed < 0) totalDistributed = 0
  if (totalDistributed >= TOTAL_REWARD_POOL) return 0 // Pool exhausted

  // Calculate remaining pool
  const remaining = TOTAL_REWARD_POOL - totalDistributed

  // Get user type multiplier (applicants 1x, employers 0.5x)
  const userMultiplier = USER_MULTIPLIERS[userType] ?? 1.0

  // Apply decay formula: tokens = (USDC × baseRate × userMultiplier) × (remaining / total)^0.7
  const decayMultiplier = Math.pow(remaining / TOTAL_REWARD_POOL, DECAY_EXPONENT)
  const tokens = usdcSpent * BASE_RATE * userMultiplier * decayMultiplier

  // Don't exceed remaining pool
  return Math.min(tokens, remaining)
}

/**
 * Convert human-readable STORM amount to wei (18 decimals).
 * Use this when calling the smart contract.
 *
 * @param tokens - STORM tokens (e.g., 9.21)
 * @returns BigInt in wei (e.g., 9210000000000000000n)
 */
export function toWei(tokens: number): bigint {
  // Multiply by 10^18, handling floating point carefully
  // Use string conversion to avoid floating point precision issues
  const [whole, decimal = ''] = tokens.toString().split('.')
  const paddedDecimal = decimal.padEnd(18, '0').slice(0, 18)
  return BigInt(whole + paddedDecimal)
}

/**
 * Convert wei to human-readable STORM amount.
 *
 * @param wei - Amount in wei (BigInt or string)
 * @returns STORM tokens as number
 */
export function fromWei(wei: bigint | string): number {
  const weiBigInt = typeof wei === 'string' ? BigInt(wei) : wei
  // Divide by 10^18
  const divisor = 10n ** 18n
  const whole = weiBigInt / divisor
  const remainder = weiBigInt % divisor
  // Convert remainder to decimal
  const decimal = remainder.toString().padStart(18, '0')
  return parseFloat(`${whole}.${decimal}`)
}

/**
 * Get the current reward rate (tokens per $1 USDC).
 *
 * @param totalDistributed - Total STORM already distributed
 * @param userType - 'applicant' (1x rate) or 'employer' (0.5x rate)
 * @returns Tokens per $1 USDC at current decay level
 */
export function getCurrentRate(totalDistributed: number, userType: UserType = 'applicant'): number {
  if (totalDistributed >= TOTAL_REWARD_POOL) return 0
  const remaining = TOTAL_REWARD_POOL - totalDistributed
  const userMultiplier = USER_MULTIPLIERS[userType] ?? 1.0
  const decayMultiplier = Math.pow(remaining / TOTAL_REWARD_POOL, DECAY_EXPONENT)
  return BASE_RATE * userMultiplier * decayMultiplier
}

/**
 * Get decay curve data for display (e.g., in UI or whitepaper).
 * Shows tokens per $3 USDC at various distribution levels.
 */
export function getDecayCurve(): Array<{
  distributed: number
  percentUsed: number
  tokensPer3Usdc: number
}> {
  const checkpoints = [0, 500_000, 1_000_000, 2_000_000, 3_000_000, 4_500_000, 6_000_000, 7_000_000, 8_000_000, 8_500_000, 8_900_000]
  
  return checkpoints.map((distributed) => ({
    distributed,
    percentUsed: Math.round((distributed / TOTAL_REWARD_POOL) * 100),
    tokensPer3Usdc: Math.round(calculateReward(3, distributed) * 100) / 100,
  }))
}

/**
 * Trigger STORM reward distribution for a USDC payment.
 * Call this from ANY payment route after recording the payment.
 * 
 * @param walletAddress - User's wallet address
 * @param usdcAmount - Amount of USDC spent
 * @param paymentId - Payment record ID (for tracking)
 * @param paymentType - Type of payment (e.g., "MVR_ORDER", "SUBSCRIPTION", "RESUME_VERIFICATION")
 * @param userType - 'applicant' (1x rate) or 'employer' (0.5x rate)
 * 
 * @example
 * // Applicant payment (full rate):
 * triggerStormReward(walletAddress, 2.99, payment.id, 'MVR_ORDER', 'applicant')
 * 
 * // Employer payment (half rate):
 * triggerStormReward(walletAddress, 50.00, payment.id, 'BACKGROUND_CHECK', 'employer')
 */
export async function triggerStormReward(
  walletAddress: string,
  usdcAmount: number,
  paymentId: string,
  paymentType: string,
  userType: UserType = 'applicant'
): Promise<void> {
  try {
    // Get the base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/storm/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        usdcAmount,
        paymentId,
        paymentType,
        userType,
      }),
    })

    const result = await response.json()
    
    if (result.success) {
      console.log(`[STORM] ⛈️ Reward distributed for ${paymentType} (${userType}):`, {
        walletAddress,
        usdcAmount,
        userType,
        rewardAmount: result.reward?.amount,
        txHash: result.txHash,
      })
    } else if (result.skipped) {
      console.log(`[STORM] ⛈️ Reward skipped for ${paymentType}:`, result.reason)
    } else {
      console.warn(`[STORM] ⛈️ Distribution failed for ${paymentType}:`, result.error)
    }
  } catch (error) {
    // Non-fatal - payment succeeded, just log the reward failure
    console.error(`[STORM] ⛈️ Error triggering reward for ${paymentType}:`, error)
  }
}
