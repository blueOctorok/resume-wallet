import { describe, it, expect } from 'vitest'
import {
  calculateReward,
  toWei,
  fromWei,
  getCurrentRate,
  getDecayCurve,
  TOTAL_REWARD_POOL,
  BASE_RATE,
  USER_MULTIPLIERS,
  REFERRAL_REWARD_PER_PERSON,
  REFERRAL_REWARD_TOTAL,
} from './storm-rewards'

describe('storm-rewards', () => {
  describe('calculateReward', () => {
    it('returns ~10 STORM for $3 at 0% distributed (applicant)', () => {
      const reward = calculateReward(3, 0, 'applicant')
      expect(reward).toBeCloseTo(10, 1)
    })

    it('returns ~6.16 STORM for $3 at 50% distributed (applicant)', () => {
      const reward = calculateReward(3, 12_500_000, 'applicant')
      expect(reward).toBeCloseTo(6.16, 1)
    })

    it('returns ~2.04 STORM for $3 at 90% distributed (applicant)', () => {
      const reward = calculateReward(3, 22_500_000, 'applicant')
      expect(reward).toBeCloseTo(2.04, 0)
    })

    it('returns 0 for 0 USDC spent', () => {
      expect(calculateReward(0, 0)).toBe(0)
    })

    it('returns 0 when pool is exhausted', () => {
      expect(calculateReward(3, TOTAL_REWARD_POOL)).toBe(0)
    })

    it('scales linearly with USDC spent', () => {
      const reward1 = calculateReward(1, 0)
      const reward10 = calculateReward(10, 0)
      expect(reward10).toBeCloseTo(reward1 * 10, 1)
    })

    it('handles fractional USDC amounts', () => {
      const reward = calculateReward(2.99, 0)
      expect(reward).toBeGreaterThan(0)
      expect(reward).toBeCloseTo(2.99 * BASE_RATE, 1)
    })

    it('defaults to applicant rate when userType not specified', () => {
      const rewardNoType = calculateReward(3, 0)
      const rewardApplicant = calculateReward(3, 0, 'applicant')
      expect(rewardNoType).toBe(rewardApplicant)
    })

    it('gives employers half the rate of applicants', () => {
      const applicantReward = calculateReward(10, 0, 'applicant')
      const employerReward = calculateReward(10, 0, 'employer')
      expect(employerReward).toBeCloseTo(applicantReward * USER_MULTIPLIERS.employer, 2)
      expect(employerReward).toBeCloseTo(applicantReward * 0.5, 2)
    })

    it('returns ~5 STORM for $3 employer spend at 0% distributed', () => {
      const reward = calculateReward(3, 0, 'employer')
      expect(reward).toBeCloseTo(5, 1)
    })
  })

  describe('toWei / fromWei', () => {
    it('converts whole numbers correctly', () => {
      const wei = toWei(10)
      expect(wei).toBe(10n * 10n ** 18n)
      expect(fromWei(wei)).toBe(10)
    })

    it('converts decimals correctly', () => {
      const wei = toWei(0.44)
      expect(fromWei(wei)).toBeCloseTo(0.44, 10)
    })

    it('handles small decimals (sub-token amounts)', () => {
      const wei = toWei(0.000001)
      expect(fromWei(wei)).toBeCloseTo(0.000001, 10)
    })

    it('handles large numbers', () => {
      const wei = toWei(25_000_000)
      expect(fromWei(wei)).toBe(25_000_000)
    })
  })

  describe('getCurrentRate', () => {
    it('returns BASE_RATE at 0% distributed', () => {
      expect(getCurrentRate(0)).toBeCloseTo(BASE_RATE, 2)
    })

    it('returns 0 when pool exhausted', () => {
      expect(getCurrentRate(TOTAL_REWARD_POOL)).toBe(0)
    })

    it('decreases as more is distributed', () => {
      const rate0 = getCurrentRate(0)
      const rate50 = getCurrentRate(12_500_000)
      expect(rate50).toBeLessThan(rate0)
    })
  })

  describe('getDecayCurve', () => {
    it('returns expected checkpoint data', () => {
      const curve = getDecayCurve()
      
      expect(curve[0].distributed).toBe(0)
      expect(curve[0].percentUsed).toBe(0)
      expect(curve[0].tokensPer3Usdc).toBeCloseTo(10, 0)
      
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].tokensPer3Usdc).toBeLessThan(curve[i - 1].tokensPer3Usdc)
      }
    })
  })

  describe('referral constants', () => {
    it('has correct referral reward amounts', () => {
      expect(REFERRAL_REWARD_PER_PERSON).toBe(2.5)
      expect(REFERRAL_REWARD_TOTAL).toBe(5)
    })
  })
})
