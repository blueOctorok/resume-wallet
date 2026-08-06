'use client'

/**
 * Simple “Share card” modal — public career card link for people/networks.
 * PDF for job applications lives on the resume preview (Download PDF), not here.
 * Uses GET/POST /api/career-card/share — public view at /card/[token].
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Link2,
  MessageSquareText,
  Shield,
} from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import { cn } from '@/lib/utils'

const SHARE_API = '/api/career-card/share'
const PROFILE_BASE = '/card'

function profileUrlFromToken(token: string): string {
  if (typeof window === 'undefined') return `${PROFILE_BASE}/${token}`
  return `${window.location.origin}${PROFILE_BASE}/${token}`
}

function linkedInCaption(fullUrl: string): string {
  return (
    `I built my Provven Career Card — verified credentials employers can trust, not a PDF dump.\n\n` +
    `${fullUrl}\n\n` +
    `Create yours free at https://provven.com`
  )
}

export interface CareerCardShareModalProps {
  isOpen: boolean
  onClose: () => void
  sessionUserId: string | null
  displayName?: string
  /** After token create — refresh parent share stats if needed */
  onShareUpdated?: () => void
  /** Opens selective-disclosure prefs (stacked above this modal) */
  onManagePrivacy?: () => void
}

export default function CareerCardShareModal({
  isOpen,
  onClose,
  sessionUserId,
  displayName,
  onShareUpdated,
  onManagePrivacy,
}: CareerCardShareModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [shareToken, setShareToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copiedField, setCopiedField] = useState<'link' | 'post' | null>(null)

  const loadToken = useCallback(async () => {
    if (!sessionUserId) return
    setLoading(true)
    try {
      const res = await fetch(SHARE_API)
      if (res.ok) {
        const data = await res.json()
        setShareToken(data.shareToken ?? null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [sessionUserId])

  useEffect(() => {
    if (!isOpen || !sessionUserId) return
    setCopiedField(null)
    void loadToken()
  }, [isOpen, sessionUserId, loadToken])

  const fullUrl = shareToken ? profileUrlFromToken(shareToken) : ''
  const caption = fullUrl ? linkedInCaption(fullUrl) : ''

  const generateToken = async () => {
    if (!sessionUserId) return
    setGenerating(true)
    try {
      const res = await fetch(SHARE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: false }),
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

  const copyText = async (text: string, field: 'link' | 'post') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField(null), 2000)
    } catch {
      /* ignore */
    }
  }

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} maxWidth='max-w-md' zIndex={1100} panelShape='block'>
      <ModalHeader
        title='Share your career card'
        subtitle={
          displayName?.trim()
            ? `Send people to ${displayName.trim()}'s live card on Provven — not a job-board upload.`
            : 'Send people to your live card on Provven — not a job-board upload.'
        }
        onClose={onClose}
        variant='block'
      />

      <div className='space-y-4 px-4 pb-5 pt-1 sm:px-5'>
        {!sessionUserId ? (
          <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
            Sign in to create a share link.
          </p>
        ) : loading ? (
          <div className='flex justify-center py-10'>
            <Loader2
              className={cn('h-7 w-7 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')}
            />
          </div>
        ) : !shareToken ? (
          <div className='space-y-3 text-center py-4'>
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-600')}>
              Create a public link. Anyone with it sees your career card as intended.
            </p>
            <Button
              variant='primary'
              onClick={() => void generateToken()}
              isLoading={generating}
              className='w-full'
            >
              Create share link
            </Button>
          </div>
        ) : (
          <HubSectionPanel isDark={isDark} accent='teal'>
            <BlockCard
              variant='embed'
              icon={Link2}
              title='Public card link'
              description='Text, LinkedIn, Slack — they land on your live card. For job applications, use Download PDF from your resume preview.'
            >
              <div
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm break-all font-mono',
                  isDark
                    ? 'border-gray-700 bg-gray-900/60 text-teal-200'
                    : 'border-slate-200 bg-slate-50 text-slate-800',
                )}
              >
                {fullUrl}
              </div>

              <div className='mt-3 flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant='primary'
                  size='sm'
                  className='gap-1.5'
                  onClick={() => void copyText(fullUrl, 'link')}
                >
                  {copiedField === 'link' ? (
                    <Check className='h-4 w-4' aria-hidden />
                  ) : (
                    <Copy className='h-4 w-4' aria-hidden />
                  )}
                  {copiedField === 'link' ? 'Copied' : 'Copy link'}
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  className='gap-1.5'
                  onClick={() => window.open(fullUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className='h-4 w-4' aria-hidden />
                  Open
                </Button>
              </div>

              <div
                className={cn(
                  'mt-5 border-t pt-4',
                  isDark ? 'border-gray-700/80' : 'border-slate-200',
                )}
              >
                <p
                  className={cn(
                    'mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
                    isDark ? 'text-gray-400' : 'text-slate-500',
                  )}
                >
                  <MessageSquareText className='h-3.5 w-3.5' aria-hidden />
                  LinkedIn / social caption
                </p>
                <p
                  className={cn(
                    'mb-3 whitespace-pre-wrap text-xs leading-relaxed',
                    isDark ? 'text-gray-300' : 'text-slate-600',
                  )}
                >
                  {caption}
                </p>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  className='gap-1.5'
                  onClick={() => void copyText(caption, 'post')}
                >
                  {copiedField === 'post' ? (
                    <Check className='h-4 w-4' aria-hidden />
                  ) : (
                    <Copy className='h-4 w-4' aria-hidden />
                  )}
                  {copiedField === 'post' ? 'Copied' : 'Copy post'}
                </Button>
              </div>

              {onManagePrivacy ? (
                <div
                  className={cn(
                    'mt-4 border-t pt-3',
                    isDark ? 'border-gray-700/80' : 'border-slate-200',
                  )}
                >
                  <button
                    type='button'
                    onClick={onManagePrivacy}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline',
                      isDark ? 'text-gray-400 hover:text-teal-300' : 'text-slate-500 hover:text-teal-700',
                    )}
                  >
                    <Shield className='h-3.5 w-3.5' aria-hidden />
                    Privacy — what verified facts employers see
                  </button>
                </div>
              ) : null}
            </BlockCard>
          </HubSectionPanel>
        )}
      </div>
    </Modal>
  )
}
