'use client'

import { useState } from 'react'
import { ShieldCheck, Info } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export interface DriverScreeningOwnershipAcknowledgmentProps {
  companyName: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * Mandatory driver-ownership acknowledgment (DEC-2026-06-005 / P3.4-C).
 * Standalone from the FMCSA PSP form — ownership framing lives here, not in federal copy.
 * Wording is placeholder pending FCRA counsel review.
 */
export default function DriverScreeningOwnershipAcknowledgment({
  companyName,
  checked,
  onCheckedChange,
  disabled = false,
}: DriverScreeningOwnershipAcknowledgmentProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [learnMoreOpen, setLearnMoreOpen] = useState(false)

  const recipient = companyName.trim() || 'the requesting employer'

  return (
    <>
      <div
        className={`rounded-xl border p-4 sm:p-5 ${
          isDark ? 'border-teal-500/30 bg-teal-500/5' : 'border-teal-200 bg-teal-50/80'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                Your screening report stays yours
              </p>
              <p className={`mt-1 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                When you submit, <strong>you</strong> are ordering your MVR and PSP reports for your Provven career
                file — <strong>at no cost to you</strong>. The report belongs to you and is portable across
                employers. You choose what to share on your career card.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onCheckedChange(e.target.checked)}
              />
              <span className={`text-sm leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                I understand that I am ordering these reports for my own Provven file and that I control how they
                are shared. I authorize Provven to submit MVR and PSP orders to the screening vendor on my behalf.
              </span>
            </label>

            <button
              type="button"
              onClick={() => setLearnMoreOpen(true)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline ${
                isDark ? 'text-teal-300' : 'text-teal-700'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
              Learn more
            </button>
          </div>
        </div>
      </div>

      {learnMoreOpen && (
        <Modal onClose={() => setLearnMoreOpen(false)} maxWidth="max-w-lg" panelShape="block">
          <ModalHeader
            title="Driver-owned screening"
            subtitle="How Provven handles MVR and PSP"
            onClose={() => setLearnMoreOpen(false)}
            variant="block"
          />
          <div className={`space-y-4 px-6 pb-6 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <p>
              <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>Who owns the report?</strong> You do.
              Provven records you as the consumer of record on the order. The completed report lives in your career
              file and can travel with you to future employers.
            </p>
            <p>
              <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>Do I pay anything?</strong> No. There
              is <strong>no charge to you</strong>. Provven never asks candidates for payment or card details to run
              these reports. {recipient} covers the screening on their end.
            </p>
            <p>
              <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>What does {recipient} see?</strong>{' '}
              Because you applied through them and signed consent, they can view your results in Provven while
              evaluating your application. Other employers only see what you choose to share on your career card.
            </p>
            <p>
              <strong className={isDark ? 'text-gray-100' : 'text-gray-900'}>Hire-time checks.</strong> If you are
              hired, your employer may still order their own FMCSA-required background pull for the official DQ
              file. That is separate from your portable pre-screen.
            </p>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Placeholder copy — final language pending legal review.
            </p>
            <Button variant="primary" onClick={() => setLearnMoreOpen(false)}>
              Got it
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
