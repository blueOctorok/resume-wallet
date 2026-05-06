'use client'

import { useState, useEffect } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'

interface PspViewModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
  orderId: string | null
}

/**
 * PSP result viewer — status + stub detail until Accio sample XML drives a full parser.
 */
export default function PspViewModal({ isOpen, onClose, walletAddress, orderId }: PspViewModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<{
    order: { status: string; dlState: string; orderedAt: string }
    result: { resultStatus: string | null } | null
  } | null>(null)

  useEffect(() => {
    if (!isOpen || !orderId || !walletAddress) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/psp/status/${orderId}?walletAddress=${encodeURIComponent(walletAddress)}`,
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load PSP order')
        if (!cancelled) {
          setPayload({
            order: data.order,
            result: data.result,
          })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, orderId, walletAddress])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={10100}>
      <ModalHeader title="PSP Report" subtitle="FMCSA crash & inspection history" onClose={onClose} />
      <div
        className={`p-5 space-y-4 ${isDarkTheme(theme) ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}
        {error && (
          <div
            className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
              isDarkTheme(theme) ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && payload && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className={isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}>Status</dt>
                <dd className="font-medium">{payload.order.status}</dd>
              </div>
              <div>
                <dt className={isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}>License state</dt>
                <dd className="font-medium">{payload.order.dlState}</dd>
              </div>
              <div className="col-span-2">
                <dt className={isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}>Ordered</dt>
                <dd className="font-medium">
                  {payload.order.orderedAt
                    ? new Date(payload.order.orderedAt).toLocaleString()
                    : '—'}
                </dd>
              </div>
              {payload.result && (
                <div className="col-span-2">
                  <dt className={isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'}>Result</dt>
                  <dd className="font-medium">{payload.result.resultStatus ?? 'received'}</dd>
                </div>
              )}
            </dl>
            <p className={`text-xs leading-relaxed ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
              Detailed crash and inspection rows will appear here after we map Accio&apos;s PSP XML
              format (pending vendor sample).
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
