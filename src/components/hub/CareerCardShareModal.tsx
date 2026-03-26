'use client'

/**
 * Shareable public career card link + QR (opens from hub mini card or profile share UI).
 * Uses GET/POST /api/career-card/share — public view at /card/[token].
 */

import { useState, useEffect, useCallback } from 'react'
import type { QRCodeToDataURLOptions } from 'qrcode'
import { Copy, Check, Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const SHARE_API = '/api/career-card/share'
const PROFILE_BASE = '/card'

/** Client-generated PNG (same colors as the old qrserver embed). `download` only works for same-origin or data: URLs — not cross-origin image URLs. */
const QR_OPTS_LIGHT: QRCodeToDataURLOptions = {
  width: 280,
  margin: 2,
  color: { dark: '#0d9488', light: '#ffffff' },
}
const QR_OPTS_DARK: QRCodeToDataURLOptions = {
  width: 280,
  margin: 2,
  color: { dark: '#2dd4bf', light: '#1f2937' },
}

function profileUrlFromToken(token: string): string {
  if (typeof window === 'undefined') return `${PROFILE_BASE}/${token}`
  return `${window.location.origin}${PROFILE_BASE}/${token}`
}

export interface CareerCardShareModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
  /** Shown under QR (e.g. candidate name) */
  displayName?: string
  /** After token create/regenerate — refresh parent share stats if needed */
  onShareUpdated?: () => void
}

export default function CareerCardShareModal({
  isOpen,
  onClose,
  walletAddress,
  displayName,
  onShareUpdated,
}: CareerCardShareModalProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [shareToken, setShareToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrWorking, setQrWorking] = useState(false)

  const loadToken = useCallback(async () => {
    if (!walletAddress) return
    setLoading(true)
    try {
      const res = await fetch(SHARE_API, { headers: { 'x-wallet-address': walletAddress } })
      if (res.ok) {
        const data = await res.json()
        setShareToken(data.shareToken ?? null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    if (!isOpen || !walletAddress) return
    setCopied(false)
    void loadToken()
  }, [isOpen, walletAddress, loadToken])

  const fullUrl = shareToken ? profileUrlFromToken(shareToken) : ''

  useEffect(() => {
    if (!fullUrl) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    setQrWorking(true)
    const opts = isDark ? QR_OPTS_DARK : QR_OPTS_LIGHT
    void (async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(fullUrl, opts)
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setQrDataUrl(null)
      } finally {
        if (!cancelled) setQrWorking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fullUrl, isDark])

  const generateToken = async (regenerate: boolean) => {
    if (!walletAddress) return
    setGenerating(true)
    try {
      const res = await fetch(SHARE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ regenerate }),
      })
      if (res.ok) {
        const data = await res.json()
        setShareToken(data.shareToken ?? null)
        onShareUpdated?.()
      }
    } catch {
      /* ignore */
    } finally {
      setGenerating(false)
    }
  }

  const copyLink = () => {
    if (!fullUrl) return
    void navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQr = () => {
    if (!qrDataUrl || !shareToken) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `stormchain-career-card-${shareToken}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} maxWidth='max-w-md' zIndex={1100}>
      <ModalHeader
        title='Share your career card'
        subtitle='Anyone with this link sees your public StormChain card — great for employers, networking, and resumes.'
        onClose={onClose}
      />

      <div className='p-4 space-y-4'>
        {!walletAddress ? (
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
            Connect your wallet to create a share link.
          </p>
        ) : loading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className={cn('w-8 h-8 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
          </div>
        ) : !shareToken ? (
          <div className='space-y-3 text-center'>
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
              Create a unique link and QR code you can share anywhere.
            </p>
            <Button
              variant='primary'
              onClick={() => void generateToken(false)}
              isLoading={generating}
              className='w-full'
            >
              Create share link
            </Button>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'flex flex-col items-center p-4 rounded-2xl border',
                isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-200 shadow-sm',
              )}
            >
              <div className='w-52 h-52 flex items-center justify-center rounded-lg'>
                {qrWorking || !qrDataUrl ? (
                  <Loader2 className={cn('w-10 h-10 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
                ) : (
                  <img src={qrDataUrl} alt='QR code linking to your career card' className='w-52 h-52 rounded-lg' />
                )}
              </div>
              {displayName ? (
                <p className={cn('mt-3 text-sm font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  {displayName}
                </p>
              ) : null}
              <p className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-slate-500')}>
                Scan to open your verified career card
              </p>
            </div>

            <div>
              <p className={cn('text-xs font-medium mb-1.5', isDark ? 'text-gray-400' : 'text-slate-600')}>
                Copy link
              </p>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2',
                  isDark ? 'border-gray-600 bg-gray-800/50' : 'border-slate-200 bg-slate-50',
                )}
              >
                <input
                  type='text'
                  readOnly
                  value={fullUrl}
                  className={cn(
                    'flex-1 min-w-0 bg-transparent text-sm truncate',
                    isDark ? 'text-gray-200' : 'text-slate-800',
                  )}
                />
                <Button
                  variant='secondary'
                  size='sm'
                  className='shrink-0'
                  onClick={copyLink}
                  aria-label={copied ? 'Copied' : 'Copy link'}
                >
                  {copied ? <Check className='w-4 h-4 text-green-500' /> : <Copy className='w-4 h-4' />}
                </Button>
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                variant='secondary'
                size='sm'
                onClick={downloadQr}
                disabled={!qrDataUrl || qrWorking}
                className='flex-1 min-w-[7rem]'
              >
                <Download className='w-4 h-4' />
                Save QR
              </Button>
              <a
                href={fullUrl}
                target='_blank'
                rel='noopener noreferrer'
                className={cn(
                  'inline-flex flex-1 min-w-[7rem] items-center justify-center gap-2 font-semibold transition-all duration-200',
                  'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white',
                  'border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm rounded-md',
                )}
              >
                <ExternalLink className='w-4 h-4' />
                Preview
              </a>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => void generateToken(true)}
                isLoading={generating}
                className='flex-1 min-w-[7rem]'
                title='Invalidates the old link and QR'
              >
                <RefreshCw className='w-4 h-4' />
                New link
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
