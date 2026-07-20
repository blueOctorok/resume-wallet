'use client'

import { ShieldCheck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import BackToHubButton from '@/components/ui/BackToHubButton'
import Button from '@/components/ui/Button'
import type { ScreeningOrderLock } from '@/hooks/use-screening-order-lock'

interface ScreeningReportOnFileCardProps {
  kind: 'mvr' | 'psp'
  lock: ScreeningOrderLock
  onBack: () => void
}

/**
 * Shown in place of the MVR/PSP self-order form when the driver already has
 * an active order of that kind. Ordering again would be a duplicate vendor
 * charge — the server guard rejects it anyway (screening-validation.ts), this
 * card just stops the attempt from being offered.
 */
export default function ScreeningReportOnFileCard({ kind, lock, onBack }: ScreeningReportOnFileCardProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const label = kind === 'mvr' ? 'MVR' : 'PSP'

  const statusLine =
    lock.status === 'pending' || lock.status === 'processing'
      ? `Your ${label} order is processing. Results usually arrive within a few hours.`
      : lock.status === 'needs_review'
        ? `Your ${label} report is on file and being reviewed. No action needed from you.`
        : `Your ${label} report is on file.`

  const validUntil = lock.expiresAt ? new Date(lock.expiresAt).toLocaleDateString() : null

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <BackToHubButton onClick={onBack} />
        </div>
        <div
          className={`rounded-2xl border p-8 text-center transition-all duration-200 ${
            isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
          }`}
        >
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              isDark ? 'bg-teal-500/20' : 'bg-teal-50'
            }`}
          >
            <ShieldCheck className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          </div>
          <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {label} report already on file
          </h3>
          <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{statusLine}</p>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Reports are valid for 30 days{validUntil ? ` — this one is good through ${validUntil}` : ''}. Track it
            in My Files on your hub. Ordering another one isn&apos;t needed and isn&apos;t possible while this one
            is active.
          </p>
          <Button variant="primary" onClick={onBack}>
            Back to Hub
          </Button>
        </div>
      </div>
    </div>
  )
}
