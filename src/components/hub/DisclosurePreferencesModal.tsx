'use client'

import { useEffect } from 'react'
import { Building2, Loader2, Shield, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import { FACT_TYPE_UI } from '@/lib/attestation-fact-ui'
import { useDisclosurePreferencesStore } from '@/stores/disclosure-preferences-store'
import type { ShippedFactType } from '@/lib/fact-registry'

interface DisclosurePreferencesModalProps {
  isOpen: boolean
  onClose: () => void
}

function FactShareToggle({
  label,
  description,
  allowed,
  disabled,
  isDark,
  onChange,
}: {
  label: string
  description: string
  allowed: boolean
  disabled: boolean
  isDark: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5',
        isDark ? 'border-gray-700/80 bg-gray-900/40' : 'border-gray-200 bg-white/80',
      )}
    >
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', isDark ? 'text-gray-100' : 'text-gray-900')}>
          {label}
        </p>
        <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
          {description}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-label={`${allowed ? 'Stop sharing' : 'Share'} ${label}`}
        onClick={() => onChange(!allowed)}
        className={cn(
          'relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50',
          allowed ? 'bg-teal-600' : isDark ? 'bg-gray-600' : 'bg-gray-300',
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform',
            allowed ? 'translate-x-4' : '',
          )}
        />
      </button>
    </div>
  )
}

export default function DisclosurePreferencesModal({
  isOpen,
  onClose,
}: DisclosurePreferencesModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const audiences = useDisclosurePreferencesStore((s) => s.audiences)
  const isLoaded = useDisclosurePreferencesStore((s) => s.isLoaded)
  const isMutating = useDisclosurePreferencesStore((s) => s.isMutating)
  const error = useDisclosurePreferencesStore((s) => s.error)
  const fetchPreferences = useDisclosurePreferencesStore((s) => s.fetchPreferences)
  const setFactAllowed = useDisclosurePreferencesStore((s) => s.setFactAllowed)
  const reset = useDisclosurePreferencesStore((s) => s.reset)

  useEffect(() => {
    if (!isOpen) return
    void fetchPreferences()
  }, [isOpen, fetchPreferences])

  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" panelShape="block">
      <ModalHeader
        variant="block"
        title="Verified fact sharing"
        subtitle="Choose which employers see each verified fact. Toggled off hides it from that employer only."
        onClose={onClose}
      />
      <div className="p-4 sm:p-5">
        {!isLoaded ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={cn('h-6 w-6 animate-spin', isDark ? 'text-teal-300' : 'text-teal-600')} />
          </div>
        ) : error ? (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-sm',
              isDark ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700',
            )}
          >
            {error}
          </div>
        ) : audiences.length === 0 ? (
          <HubSectionPanel isDark={isDark} accent="indigo">
            <BlockCard
              variant="embed"
              icon={Package}
              title="No employers yet"
              description="When a carrier requests your career card or you apply to their jobs, you can control verified facts per employer here."
            >
              <div className="text-center py-6">
                <Building2 className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-gray-500' : 'text-gray-400')} />
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Verified facts stay private to you until you share them with a specific employer.
                </p>
              </div>
            </BlockCard>
          </HubSectionPanel>
        ) : (
          <div className="space-y-4 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
            {audiences.map((audience) => (
              <HubSectionPanel key={audience.companyId} isDark={isDark} accent="indigo">
                <BlockCard
                  variant="embed"
                  icon={Building2}
                  title={audience.companyName}
                  description="Toggle verified facts this employer can see on your career card."
                >
                  <div className="space-y-2">
                    {audience.facts.map((fact) => {
                      const ui = FACT_TYPE_UI[fact.factType as ShippedFactType]
                      return (
                        <FactShareToggle
                          key={fact.factType}
                          label={ui?.label ?? fact.label}
                          description={fact.description}
                          allowed={fact.allowed}
                          disabled={isMutating}
                          isDark={isDark}
                          onChange={(next) =>
                            void setFactAllowed(
                              audience.companyId,
                              fact.factType as ShippedFactType,
                              next,
                            )
                          }
                        />
                      )
                    })}
                  </div>
                </BlockCard>
              </HubSectionPanel>
            ))}
            <p className={cn('text-xs px-1', isDark ? 'text-gray-500' : 'text-gray-500')}>
              <Shield className="inline h-3 w-3 mr-1 -mt-0.5" aria-hidden />
              Turning a fact off hides it from that employer&apos;s verified panel only — your own view is unchanged.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
