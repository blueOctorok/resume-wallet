// lib/rate-limit.ts
// Resource protection rate limiting (spam handled by hash-first flow)

interface RateLimitEntry {
  count: number
  resetTime: number
}

class SimpleRateLimiter {
  private limits = new Map<string, RateLimitEntry>()

  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = this.limits.get(key)

    // No entry or window expired - allow and reset
    if (!entry || now > entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + windowMs,
      })
      return true
    }

    // Within window - check count
    if (entry.count >= maxRequests) {
      return false // Rate limited
    }

    // Increment and allow
    entry.count++
    return true
  }

  getRemainingTime(key: string): number {
    const entry = this.limits.get(key)
    if (!entry) return 0
    return Math.max(0, entry.resetTime - Date.now())
  }

  // Development helper: Clear rate limit for a specific key
  clearLimit(key: string): void {
    this.limits.delete(key)
  }

  // Development helper: Clear all rate limits
  clearAllLimits(): void {
    this.limits.clear()
  }
}

// Export singleton instances
export const uploadRateLimiter = new SimpleRateLimiter()
export const verificationRateLimiter = new SimpleRateLimiter()

// Simple usage constants
export const RATE_LIMITS = {
  UPLOAD: {
    maxRequests: 20, // Reasonable limit for legitimate users (resource protection)
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  VERIFICATION: {
    maxRequests: 50, // Reasonable limit for testing and legitimate use
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
}
