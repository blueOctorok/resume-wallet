/**
 * STORM Token Reward Calculation
 *
 * Implements the smooth decay reward formula from the whitepaper:
 * tokens = (USDC_spent x baseRate x userMultiplier) x (remaining / totalPool)^0.7
 *
 * - baseRate: ~3.33 tokens per $1 USDC at 0% distributed ($3 -> 10 tokens)
 * - totalPool: 25,000,000 STORM (user rewards allocation)
 * - exponent 0.7: gradual decay (no sudden halvings like Bitcoin)
 * - userMultiplier: 1.0 for applicants, 0.5 for employers
 *   (keeps token community-first while rewarding all economic activity)
 */

// Total reward pool (25M STORM — decay-based, from RewardDistributor)
export const TOTAL_REWARD_POOL = 25_000_000

// Total treasury pool (17M STORM — 15M original + 2M reserve, in TreasuryDistributor)
export const TOTAL_TREASURY_POOL = 17_000_000

// Base rate: ~3.33 tokens per $1 USDC (so $3 -> 10 tokens at start)
export const BASE_RATE = 10 / 3 // ~3.333...

// Decay exponent (0.7 = gradual decay, per whitepaper)
export const DECAY_EXPONENT = 0.7

export type UserType = 'applicant' | 'employer'
export const USER_MULTIPLIERS: Record<UserType, number> = {
  applicant: 1.0,
  employer: 0.5,
}

// Referral rewards (paid from treasury, not the decay pool)
export const REFERRAL_REWARD_PER_PERSON = 2.5 // Each party gets 2.5 STORM
export const REFERRAL_REWARD_TOTAL = 5 // 5 STORM total per successful referral

/**
 * Calculate STORM reward for a given USDC spend.
 *
 * @param usdcSpent - Amount of USDC spent (e.g., 2.99 for resume verification)
 * @param totalDistributed - Total STORM already distributed from the 25M pool
 * @param userType - 'applicant' (1x rate) or 'employer' (0.5x rate)
 * @returns STORM tokens to reward (as a number, e.g., 9.21)
 *
 * @example
 * // At 0% distributed, $3 spend by applicant -> 10 STORM
 * calculateReward(3, 0, 'applicant') // -> 10
 *
 * // At 50% distributed, $3 spend by applicant -> ~6.16 STORM
 * calculateReward(3, 12_500_000, 'applicant') // -> ~6.16
 */
export function calculateReward(
  usdcSpent: number,
  totalDistributed: number,
  userType: UserType = 'applicant'
): number {
  if (usdcSpent <= 0) return 0
  if (totalDistributed < 0) totalDistributed = 0
  if (totalDistributed >= TOTAL_REWARD_POOL) return 0

  const remaining = TOTAL_REWARD_POOL - totalDistributed
  const userMultiplier = USER_MULTIPLIERS[userType] ?? 1.0
  const decayMultiplier = Math.pow(remaining / TOTAL_REWARD_POOL, DECAY_EXPONENT)
  const tokens = usdcSpent * BASE_RATE * userMultiplier * decayMultiplier

  return Math.min(tokens, remaining)
}

/**
 * Convert human-readable STORM amount to wei (18 decimals).
 */
export function toWei(tokens: number): bigint {
  const [whole, decimal = ''] = tokens.toString().split('.')
  const paddedDecimal = decimal.padEnd(18, '0').slice(0, 18)
  return BigInt(whole + paddedDecimal)
}

/**
 * Convert wei to human-readable STORM amount.
 */
export function fromWei(wei: bigint | string): number {
  const weiBigInt = typeof wei === 'string' ? BigInt(wei) : wei
  const divisor = 10n ** 18n
  const whole = weiBigInt / divisor
  const remainder = weiBigInt % divisor
  const decimal = remainder.toString().padStart(18, '0')
  return parseFloat(`${whole}.${decimal}`)
}

/**
 * Get the current reward rate (tokens per $1 USDC).
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
  const checkpoints = [
    0, 1_250_000, 2_500_000, 5_000_000, 7_500_000,
    12_500_000, 17_500_000, 20_000_000, 22_500_000,
    24_000_000, 24_750_000,
  ]

  return checkpoints.map((distributed) => ({
    distributed,
    percentUsed: Math.round((distributed / TOTAL_REWARD_POOL) * 100),
    tokensPer3Usdc: Math.round(calculateReward(3, distributed) * 100) / 100,
  }))
}

/**
 * Trigger STORM reward distribution for a USDC payment.
 * Call this from ANY payment route after recording the payment.
 */
export async function triggerStormReward(
  walletAddress: string,
  usdcAmount: number,
  paymentId: string,
  paymentType: string,
  userType: UserType = 'applicant',
  companyId?: string | null
): Promise<void> {
  try {
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
        companyId: companyId ?? undefined,
      }),
    })

    const result = await response.json()

    if (result.success) {
      console.log(`[STORM] Reward distributed for ${paymentType} (${userType}):`, {
        walletAddress, usdcAmount, userType,
        rewardAmount: result.reward?.amount,
        txHash: result.txHash,
      })
    } else if (result.skipped) {
      console.log(`[STORM] Reward skipped for ${paymentType}:`, result.reason)
    } else {
      console.warn(`[STORM] Distribution failed for ${paymentType}:`, result.error)
    }
  } catch (error) {
    console.error(`[STORM] Error triggering reward for ${paymentType}:`, error)
  }
}

/**
 * Trigger referral STORM reward from the treasury.
 * Called when a referred user completes their first paid action.
 * Distributes REFERRAL_REWARD_PER_PERSON to both referrer and referred.
 */
export async function triggerReferralReward(
  referrerWallet: string,
  referredWallet: string,
  referralId: string
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const response = await fetch(`${baseUrl}/api/referrals/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ referralId }),
    })

    const result = await response.json()

    if (result.success) {
      console.log(`[STORM] Referral reward distributed:`, {
        referralId,
        referrerWallet,
        referredWallet,
        txHash: result.txHash,
      })
    } else {
      console.warn(`[STORM] Referral reward failed:`, result.error)
    }
  } catch (error) {
    console.error(`[STORM] Error triggering referral reward:`, error)
  }
}
