'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useAuthStore } from '@/stores'
import Button from '@/components/ui/Button'
import Modal, { ModalHeader } from '@/components/ui/Modal'

/**
 * AvA Context Modal — same fields as first-time hub onboarding ("what you do", etc.).
 *
 * Opened via **Edit intro** under Ask AvA, or **Edit what you told AvA** on the profile
 * card. Pre-fills from `hub_onboarding` and upserts through POST /api/hub/onboarding.
 */
export default function AvaContextModal() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const onboarding = useHubBlocksStore((s) => s.onboarding)
  const closeAvAContextModal = useHubBlocksStore((s) => s.closeAvAContextModal)
  const completeOnboarding = useHubBlocksStore((s) => s.completeOnboarding)
  const fetchHubData = useHubBlocksStore((s) => s.fetchHubData)
  const walletAddress = useAuthStore((s) => s.walletAddress)

  const [occupation, setOccupation] = useState('')
  const [seekingReason, setSeekingReason] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (onboarding) {
      setOccupation(onboarding.occupation ?? '')
      setSeekingReason(onboarding.seekingReason ?? '')
      setExtraContext(onboarding.extraContext ?? '')
    }
  }, [onboarding])

  const canSubmit = occupation.trim().length > 0 && seekingReason.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walletAddress || !canSubmit) return

    setIsSubmitting(true)
    setError(null)

    try {
      await completeOnboarding(
        occupation.trim(),
        seekingReason.trim(),
        walletAddress,
        extraContext.trim() || null
      )
      if (walletAddress) await fetchHubData(walletAddress)
      closeAvAContextModal()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClasses = isDark
    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'

  return (
    <Modal onClose={closeAvAContextModal} maxWidth="max-w-lg" zIndex={1000}>
      <ModalHeader
        title="Tell AvA more about you"
        subtitle="The more context you share, the better she can coach you and suggest next steps."
        onClose={closeAvAContextModal}
      />

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            What do you do?
          </label>
          <input
            type="text"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g. CDL-A truck driver, React developer"
            required
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${inputClasses}`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Why are you here?
          </label>
          <textarea
            value={seekingReason}
            onChange={(e) => setSeekingReason(e.target.value)}
            placeholder="e.g. Looking for regional routes, building a verifiable portfolio"
            required
            rows={2}
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none ${inputClasses}`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Additional context for AvA <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="Goals, preferences, constraints, or anything else that helps AvA give you better advice"
            rows={4}
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none ${inputClasses}`}
          />
          <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            This is only shared with AvA so she can personalize her guidance. Examples: &quot;I want to go OTR in 6 months&quot;, &quot;Prefer local only&quot;, &quot;Building a dev portfolio for fintech&quot;.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={closeAvAContextModal}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </span>
            ) : (
              'Save for AvA'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
