'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useAuthStore } from '@/stores'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

/**
 * HubOnboardingForm — shown once to new candidates before their hub loads.
 *
 * Uses the shared Modal component so the background does not scroll and the nav
 * sits behind the overlay. The hub is blocked until both required fields are submitted.
 *
 * On success: overlay disappears and the user lands on their hub with the
 * career path sidebar already guiding next steps.
 */
export default function HubOnboardingForm() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [occupation, setOccupation] = useState('')
  const [seekingReason, setSeekingReason] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completeOnboarding = useHubBlocksStore((s) => s.completeOnboarding)
  const walletAddress = useAuthStore((s) => s.walletAddress)

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
    } catch {
      setError('Something went wrong saving your answers. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClasses = isDark
    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'

  return (
    <Modal
      onClose={() => {}}
      disableBackdropClose
      maxWidth="max-w-lg"
      zIndex={1000}
    >
      {/* Header — no close button; user must complete the form */}
      <div className={`p-6 sm:p-8 text-center border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 mb-4">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Let's build your hub
        </h2>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Tell AvA a bit about yourself. She'll suggest exactly which blocks to add first.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            What do you do?
          </label>
          <input
            type="text"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g. CDL-A truck driver, React developer, airline pilot"
            required
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${inputClasses}`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Why are you here?
          </label>
          <textarea
            value={seekingReason}
            onChange={(e) => setSeekingReason(e.target.value)}
            placeholder="e.g. Looking for regional routes, building a verifiable work history"
            required
            rows={3}
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none ${inputClasses}`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            Anything else you want AvA to know? <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="e.g. Goals, preferences, constraints — the more context, the better she can help"
            rows={2}
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none ${inputClasses}`}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </span>
          ) : (
            'Build My Hub'
          )}
        </Button>
      </form>
    </Modal>
  )
}
