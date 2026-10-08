'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import type { PaidScreeningKind } from '@/lib/screening-stripe-payment'

type CreditState =
  | { phase: 'loading' }
  | { phase: 'paid' }
  | { phase: 'unpaid'; priceLabel: string }
  | { phase: 'error'; message: string }

const LABEL: Record<PaidScreeningKind, string> = { mvr: 'MVR' }

function formatPrice(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    amountCents / 100,
  )
}

/**
 * Pay-first gate for driver-initiated MVR orders (DEC-2026-10-001).
 *
 * Mirrors the server: /api/mvr/order refuses with 402 unless the driver holds
 * an unused paid Checkout session. Renders `children` (the order form) only
 * once that credit exists. Company-sponsored flows never mount this — the
 * company is billed per pull, not the driver.
 */
export default function ScreeningPayGate({ kind, children }: { kind: PaidScreeningKind; children: ReactNode }) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [state, setState] = useState<CreditState>({ phase: 'loading' })
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/screening/checkout?kind=${kind}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          paid?: boolean
          price?: { amountCents: number; currency: string }
          error?: string
        }
        if (cancelled) return
        if (!res.ok || !data.price) {
          setState({ phase: 'error', message: data.error ?? 'Could not check payment status.' })
        } else if (data.paid) {
          setState({ phase: 'paid' })
        } else {
          setState({ phase: 'unpaid', priceLabel: formatPrice(data.price.amountCents, data.price.currency) })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'error', message: 'Could not check payment status.' })
      })
    return () => {
      cancelled = true
    }
  }, [kind])

  const startCheckout = async () => {
    setRedirecting(true)
    try {
      const res = await fetch('/api/screening/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not start checkout.')
      window.location.assign(data.url)
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Could not start checkout.' })
      setRedirecting(false)
    }
  }

  if (state.phase === 'paid') return <>{children}</>

  if (state.phase === 'loading') {
    return (
      <div className='flex justify-center py-10'>
        <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
      </div>
    )
  }

  const label = LABEL[kind]

  return (
    <HubSectionPanel isDark={isDark} accent='teal'>
      <BlockCard
        variant='embed'
        icon={CreditCard}
        title={`Pay for your ${label}`}
        description={
          state.phase === 'unpaid'
            ? `${state.priceLabel} one-time. You pay first, then fill in the order — nothing is sent to the vendor until both are done.`
            : 'Payment is required before this report can be ordered.'
        }
      >
        <div className='space-y-4'>
          <div className='flex items-start gap-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400'>
            <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-teal-500' />
            <p>
              Ordering through an employer&apos;s request on your hub is covered by that employer. This charge only
              applies when you order the {label} yourself. The report is yours either way.
            </p>
          </div>

          {state.phase === 'error' && (
            <p className='text-sm text-red-600 dark:text-red-400'>{state.message}</p>
          )}

          <Button
            onClick={startCheckout}
            isLoading={redirecting}
            disabled={state.phase === 'error' || redirecting}
          >
            {state.phase === 'unpaid' ? `Pay ${state.priceLabel} and continue` : 'Unavailable'}
          </Button>
        </div>
      </BlockCard>
    </HubSectionPanel>
  )
}
