'use client'

import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useTheme } from '@/contexts/ThemeContext'
import EmployerAccessModal from '@/components/employer/EmployerAccessModal'
import type { PoolStats } from '@/lib/pool-stats'

/**
 * Public-card sales strip. Counts only — copy stays neutral (no "verified
 * pool" / EV language). Counsel should review the sentence before production.
 */
export default function PoolTeaserStrip({
  shareToken,
  onDark = false,
  showAccessCta = true,
}: {
  shareToken: string
  /** Public card page is always a dark canvas, even if the saved theme is light. */
  onDark?: boolean
  /** Pending employers already have an account — don't offer signup again. */
  showAccessCta?: boolean
}) {
  const { theme } = useTheme()
  const dark = onDark || theme === 'dark'
  const [stats, setStats] = useState<PoolStats | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/career-card/pool-stats?token=${encodeURIComponent(shareToken)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.stats) setStats(json.stats as PoolStats)
      })
      .catch(() => {
        /* teaser is optional — the card still stands without it */
      })
    return () => {
      cancelled = true
    }
  }, [shareToken])

  if (!stats || stats.driverCount < 2) return null

  return (
    <>
      <div
        className={`max-w-2xl mx-auto mb-6 rounded-xl border px-4 py-4 ${
          dark
            ? 'border-teal-500/30 bg-teal-500/10'
            : 'border-teal-200 bg-teal-50'
        }`}
      >
        <p className={`text-sm ${dark ? 'text-teal-50' : 'text-[#173150]'}`}>{teaserSentence(stats)}</p>
        {showAccessCta && (
          <div className="mt-3">
            <Button type="button" variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Building2 className="mr-1.5 inline h-4 w-4" />
              Get employer access
            </Button>
          </div>
        )}
      </div>
      {showAccessCta && showForm && (
        <EmployerAccessModal shareToken={shareToken} onClose={() => setShowForm(false)} />
      )}
    </>
  )
}

function teaserSentence(stats: PoolStats): string {
  const who = stats.cdlClass
    ? `${stats.driverCount} CDL-${stats.cdlClass} drivers`
    : `${stats.driverCount} drivers`
  const where = stats.scope === 'state' && stats.state ? ` in ${stats.state}` : ''
  const clean =
    stats.cleanDrivingRecordCount > 0
      ? ` — ${stats.cleanDrivingRecordCount} with clean driving records`
      : ''
  return `One of ${who}${where} on Provven${clean}.`
}
