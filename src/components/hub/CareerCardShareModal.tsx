'use client'

/**
 * Shareable public career card: Share tab (link, downloads, caption; QR via overlay) + Embed tab (iframe, email sig, badge).
 * Uses GET/POST /api/career-card/share — public view at /card/[token].
 */

import { useState, useEffect, useCallback } from 'react'
import type { QRCodeToDataURLOptions } from 'qrcode'
import {
  Copy,
  Check,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Code2,
  FileDown,
  Share2,
  Info,
  QrCode,
  ArrowLeft,
  Clipboard,
  Link2,
  Sparkles,
  Mail,
  Award,
} from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { useTheme } from '@/contexts/ThemeContext'
import Button from '@/components/ui/Button'
import BlockCard from '@/components/ui/BlockCard'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import { cn } from '@/lib/utils'

const SHARE_API = '/api/career-card/share'
const PROFILE_BASE = '/card'

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

type SharePanel = 'share' | 'embed'

/** Expandable help — why each option exists and when to use it. */
const SHARE_INFO = {
  social:
    'Post this image with the caption below to LinkedIn, X, or Instagram. People see your verified career card in their feed — no click required. The caption includes your link and a call-to-action so viewers can create their own.',
  link: 'Paste this URL into Slack, iMessage, WhatsApp, or email. Most apps show a rich preview with your name, score, and verification automatically.',
  pdf: "A two-page document: visual career card on page 1, ATS-parseable text on page 2. Upload this anywhere you'd upload a resume — Indeed, Greenhouse, Lever, Workday, or email it to a recruiter.",
  qr: 'For in-person networking: career fairs, conferences, interviews, or printed materials. Anyone with a phone camera can scan to instantly view your verified career card.',
  iframe: 'Drop a live, always-up-to-date version of your career card into your personal site, portfolio, Notion page, or blog. Visitors see your latest score and verifications without you updating anything.',
  signature: 'Add a branded career card strip to every email you send. Recruiters and hiring managers see your verified credentials at a glance — paste the HTML into Gmail or Outlook signature settings.',
  badge: 'Show proof of your verified career score right on your GitHub profile or project README. Anyone reviewing your code can click through to your full card.',
} as const

type ShareInfoId = keyof typeof SHARE_INFO

function profileUrlFromToken(token: string): string {
  if (typeof window === 'undefined') return `${PROFILE_BASE}/${token}`
  return `${window.location.origin}${PROFILE_BASE}/${token}`
}

function originBase(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
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

  const [panel, setPanel] = useState<SharePanel>('share')
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrWorking, setQrWorking] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [socialBusy, setSocialBusy] = useState(false)
  const [openInfo, setOpenInfo] = useState<ShareInfoId | null>(null)
  const [qrOverlayOpen, setQrOverlayOpen] = useState(false)

  const toggleInfo = (id: ShareInfoId) => {
    setOpenInfo((prev) => (prev === id ? null : id))
  }

  const goPanel = (next: SharePanel) => {
    setQrOverlayOpen(false)
    setOpenInfo(null)
    setPanel(next)
  }

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
    setCopiedField(null)
    setPanel('share')
    setOpenInfo(null)
    setQrOverlayOpen(false)
    void loadToken()
  }, [isOpen, walletAddress, loadToken])

  /** Escape closes QR overlay first so the whole modal does not dismiss mid-scan. */
  useEffect(() => {
    if (!qrOverlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setQrOverlayOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [qrOverlayOpen])

  const fullUrl = shareToken ? profileUrlFromToken(shareToken) : ''
  const o = originBase()
  /** Same as `o` in the browser; falls back to parsing `fullUrl` if needed for embed snippets. */
  const publicOrigin =
    o || (fullUrl.startsWith('http') ? (() => { try { return new URL(fullUrl).origin } catch { return '' } })() : '')

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

  const copyText = (text: string, field: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedField(field)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setCopiedField(null)
    }, 2000)
  }

  const copyLink = () => {
    if (!fullUrl) return
    copyText(fullUrl, 'link')
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

  /** Fetch the social image as a Blob (shared between copy / share / download). */
  const fetchSocialBlob = async (): Promise<Blob> => {
    const res = await fetch(`${publicOrigin}/card/${shareToken}/social-image`)
    if (!res.ok) throw new Error('fetch failed')
    return res.blob()
  }

  /** True when the browser can share a PNG file via navigator.share(). */
  const canNativeShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({
      files: [new File([new Blob([''], { type: 'image/png' })], 'test.png', { type: 'image/png' })],
    })

  /** Native share — sends image + caption + link in one action (mobile share sheets). */
  const nativeShareImage = async () => {
    if (!shareToken || !publicOrigin) return
    setSocialBusy(true)
    try {
      const blob = await fetchSocialBlob()
      const file = new File([blob], `storm-career-card-${shareToken}.png`, { type: 'image/png' })
      await navigator.share({
        text: linkedinCaption,
        files: [file],
      })
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        alert('Could not share image')
      }
    } finally {
      setSocialBusy(false)
    }
  }

  /** Copy the image to the clipboard so the user can paste directly into a post composer. */
  const copyImageToClipboard = async () => {
    if (!shareToken || !publicOrigin) return
    setSocialBusy(true)
    try {
      const blob = await fetchSocialBlob()
      const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
      setCopiedField('image')
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setCopiedField(null)
      }, 2000)
    } catch {
      alert('Could not copy image — try the download button instead')
    } finally {
      setSocialBusy(false)
    }
  }

  /** Fallback download for the social image. */
  const downloadSocialImage = async () => {
    if (!shareToken || !publicOrigin) return
    setSocialBusy(true)
    try {
      const blob = await fetchSocialBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `storm-career-card-${shareToken}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Could not download image')
    } finally {
      setSocialBusy(false)
    }
  }

  const embedSnippet =
    shareToken && publicOrigin
      ? `<iframe src="${publicOrigin}/card/${shareToken}/embed" width="420" height="360" style="border:0;border-radius:12px;max-width:100%;" title="Storm Career Card" loading="lazy"></iframe>`
      : ''

  const linkedinCaption =
    shareToken && fullUrl && displayName
      ? `Check out my verified Career Card on Storm \u2014 ${displayName}\n\nBlockchain-verified credentials, trust score, and professional history \u2014 all in one link.\n\n${fullUrl}\n\nWant your own? Create a free Career Card at https://stormchain.ai\n\n#CareerCard #Blockchain #Storm`
      : shareToken && fullUrl
        ? `Check out my verified Career Card on Storm.\n\nBlockchain-verified credentials, trust score, and professional history \u2014 all in one link.\n\n${fullUrl}\n\nWant your own? Create a free Career Card at https://stormchain.ai\n\n#CareerCard #Blockchain #Storm`
        : ''

  const signatureHtml =
    shareToken && publicOrigin && fullUrl
      ? `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer"><img src="${publicOrigin}/card/${shareToken}/signature" width="600" height="150" alt="Storm Career Card" style="max-width:100%;height:auto;border:0;" /></a>`
      : ''

  const badgeMarkdown =
    shareToken && publicOrigin && fullUrl
      ? `[![Storm Career Card](${publicOrigin}/card/${shareToken}/badge)](${fullUrl})`
      : ''

  const downloadPdf = async () => {
    if (!walletAddress) return
    setPdfLoading(true)
    try {
      const res = await fetch('/api/career-card/pdf', {
        headers: { 'x-wallet-address': walletAddress },
      })
      const isJsonError = res.headers.get('Content-Type')?.includes('application/json')
      if (!res.ok) {
        if (isJsonError) {
          const j = (await res.json()) as { error?: string }
          alert(j.error ?? 'Could not generate PDF')
        } else {
          alert('Could not generate PDF')
        }
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'storm-career-card.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Could not generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  if (!isOpen) return null

  /** Hub-style info control in a BlockCard header row */
  const infoHeaderAction = (id: ShareInfoId, aria: string) => (
    <button
      type='button'
      onClick={() => toggleInfo(id)}
      className={cn(
        'rounded-sm p-1.5 transition-colors ring-1 ring-transparent',
        openInfo === id
          ? isDark
            ? 'bg-teal-500/20 text-teal-300 ring-teal-500/35'
            : 'bg-teal-50 text-teal-800 ring-teal-600/20'
          : isDark
            ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      )}
      aria-expanded={openInfo === id}
      aria-label={aria}
    >
      <Info className='h-4 w-4' />
    </button>
  )

  return (
    <Modal onClose={onClose} maxWidth='max-w-lg' zIndex={1100} panelShape='block'>
      <ModalHeader
        title='Share your career card'
        subtitle='Share your career card image, link, and caption to social. Download a PDF for job applications. Use QR code for in-person scans.'
        onClose={onClose}
        variant='block'
      />

      <div className='space-y-4 px-2 py-3 sm:px-4 sm:py-4'>
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
                'flex gap-1 rounded-lg p-1 ring-1',
                isDark
                  ? 'bg-gray-900/80 ring-gray-700/80 shadow-inner shadow-black/20'
                  : 'bg-slate-100/90 ring-slate-200/90 shadow-sm',
              )}
              role='tablist'
              aria-label='Share or embed'
            >
              <Button
                type='button'
                variant={panel === 'share' ? 'primary' : 'ghost'}
                size='md'
                className={cn('flex-1 rounded-md font-semibold', panel !== 'share' && 'shadow-none')}
                onClick={() => goPanel('share')}
              >
                <Share2 className='mr-1.5 h-4 w-4 shrink-0' />
                Share
              </Button>
              <Button
                type='button'
                variant={panel === 'embed' ? 'primary' : 'ghost'}
                size='md'
                className={cn('flex-1 rounded-md font-semibold', panel !== 'embed' && 'shadow-none')}
                onClick={() => goPanel('embed')}
              >
                <Code2 className='mr-1.5 h-4 w-4 shrink-0' />
                Embed
              </Button>
            </div>

            {panel === 'share' && (
              <div className='min-h-[min(70vh,28rem)]'>
                {qrOverlayOpen ? (
                  <HubSectionPanel isDark={isDark} accent='indigo' contentClassName='p-2.5 sm:p-3'>
                    <BlockCard
                      variant='embed'
                      icon={QrCode}
                      title='QR for in-person'
                      description='Career fairs, interviews, or print — scan opens your public card.'
                      headerActions={
                        <>
                          {infoHeaderAction('qr', 'Why use a QR code?')}
                          <Button type='button' variant='ghost' size='sm' onClick={() => setQrOverlayOpen(false)}>
                            <ArrowLeft className='mr-1 h-4 w-4' />
                            Back
                          </Button>
                        </>
                      }
                    >
                      {openInfo === 'qr' ? (
                        <p className={cn('mb-3 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
                          {SHARE_INFO.qr}
                        </p>
                      ) : null}
                      <div className='flex flex-col items-center gap-4 py-2'>
                        <div
                          className={cn(
                            'flex h-[280px] w-[280px] items-center justify-center rounded-none ring-1',
                            isDark ? 'bg-gray-950/60 ring-gray-700' : 'bg-white ring-slate-200 shadow-md',
                          )}
                        >
                          {qrWorking || !qrDataUrl ? (
                            <Loader2 className={cn('h-10 w-10 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
                          ) : (
                            <img
                              src={qrDataUrl}
                              alt='QR code linking to your career card'
                              className='h-[280px] w-[280px] rounded-none'
                            />
                          )}
                        </div>
                        {displayName ? (
                          <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                            {displayName}
                          </p>
                        ) : null}
                        <p className={cn('text-center text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>
                          Scan to view my verified career card
                        </p>
                        <div className='flex w-full max-w-sm flex-col gap-2 sm:flex-row'>
                          <Button
                            variant='primary'
                            size='md'
                            className='flex-1'
                            onClick={downloadQr}
                            disabled={!qrDataUrl || qrWorking}
                          >
                            <Download className='h-4 w-4' />
                            Download QR
                          </Button>
                          <Button variant='secondary' size='md' className='flex-1' type='button' onClick={() => setQrOverlayOpen(false)}>
                            Done
                          </Button>
                        </div>
                      </div>
                    </BlockCard>
                  </HubSectionPanel>
                ) : (
                  <div className='space-y-4'>
                    <HubSectionPanel isDark={isDark} accent='teal' contentClassName='p-2.5 sm:p-3'>
                      <BlockCard
                        variant='embed'
                        icon={Share2}
                        title='Post to social'
                        description='LinkedIn, X, Instagram — image + caption so people see your card and can join Storm.'
                        headerActions={infoHeaderAction('social', 'How does posting to social work?')}
                      >
                        {openInfo === 'social' ? (
                          <p className={cn('mb-3 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
                            {SHARE_INFO.social}
                          </p>
                        ) : null}
                        <div className='flex flex-col gap-3 sm:flex-row sm:items-stretch'>
                          {canNativeShare ? (
                            <Button
                              variant='primary'
                              size='lg'
                              className='w-full sm:flex-1'
                              isLoading={socialBusy}
                              disabled={!shareToken || !publicOrigin}
                              onClick={() => void nativeShareImage()}
                            >
                              <Share2 className='h-5 w-5' />
                              Share image + caption
                            </Button>
                          ) : (
                            <Button
                              variant='primary'
                              size='lg'
                              className='w-full sm:flex-1'
                              isLoading={socialBusy}
                              disabled={!shareToken || !publicOrigin}
                              onClick={() => void copyImageToClipboard()}
                            >
                              {copied && copiedField === 'image' ? (
                                <Check className='h-5 w-5 text-green-200' />
                              ) : (
                                <Clipboard className='h-5 w-5' />
                              )}
                              {copied && copiedField === 'image' ? 'Image copied!' : 'Copy image to clipboard'}
                            </Button>
                          )}
                          <Button
                            variant='secondary'
                            size='md'
                            className='w-full shrink-0 sm:w-auto sm:min-w-[3rem]'
                            disabled={!shareToken || !publicOrigin || socialBusy}
                            onClick={() => void downloadSocialImage()}
                            title='Save PNG to disk'
                          >
                            <Download className='h-4 w-4' />
                          </Button>
                        </div>
                        {!canNativeShare ? (
                          <p className={cn('mt-2 text-[11px]', isDark ? 'text-gray-500' : 'text-slate-500')}>
                            Paste the image into your post, then paste the caption below.
                          </p>
                        ) : null}

                        {linkedinCaption ? (
                          <div className='mt-4 space-y-2 border-t border-slate-200/80 pt-4 dark:border-gray-700/80'>
                            <p className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-slate-700')}>
                              {canNativeShare ? 'Caption (included when you share)' : 'Caption — copy after the image'}
                            </p>
                            <textarea
                              readOnly
                              rows={4}
                              value={linkedinCaption}
                              className={cn(
                                'scrollbar-none resize-none w-full rounded-lg border px-3 py-2.5 text-xs leading-relaxed shadow-inner',
                                isDark
                                  ? 'border-gray-600 bg-gray-950/50 text-gray-200'
                                  : 'border-slate-200 bg-white text-slate-800',
                              )}
                            />
                            <Button variant='secondary' size='md' onClick={() => copyText(linkedinCaption, 'caption')}>
                              {copied && copiedField === 'caption' ? (
                                <Check className='h-4 w-4 text-green-500' />
                              ) : (
                                <Copy className='h-4 w-4' />
                              )}
                              {copied && copiedField === 'caption' ? 'Caption copied' : 'Copy caption'}
                            </Button>
                          </div>
                        ) : null}
                      </BlockCard>
                    </HubSectionPanel>

                    <HubSectionPanel isDark={isDark} accent='sky' contentClassName='p-2.5 sm:p-3'>
                      <BlockCard
                        variant='embed'
                        icon={Link2}
                        title='Send a link'
                        description='Slack, iMessage, WhatsApp, email — they tap and open your card.'
                        headerActions={infoHeaderAction('link', 'When to send a link')}
                      >
                        {openInfo === 'link' ? (
                          <p className={cn('mb-3 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
                            {SHARE_INFO.link}
                          </p>
                        ) : null}
                        <div
                          className={cn(
                            'flex items-center gap-2 rounded-none border px-3 py-2.5 shadow-inner',
                            isDark ? 'border-gray-600 bg-gray-950/40' : 'border-slate-200 bg-white',
                          )}
                        >
                          <input
                            type='text'
                            readOnly
                            value={fullUrl}
                            className={cn(
                              'min-w-0 flex-1 truncate bg-transparent text-sm',
                              isDark ? 'text-gray-200' : 'text-slate-800',
                            )}
                          />
                          <Button
                            variant='secondary'
                            size='md'
                            className='shrink-0'
                            onClick={copyLink}
                            aria-label={copied && copiedField === 'link' ? 'Copied' : 'Copy link'}
                          >
                            {copied && copiedField === 'link' ? (
                              <Check className='h-4 w-4 text-green-500' />
                            ) : (
                              <Copy className='h-4 w-4' />
                            )}
                            Copy
                          </Button>
                        </div>
                      </BlockCard>
                    </HubSectionPanel>

                    <HubSectionPanel isDark={isDark} accent='violet' contentClassName='p-2.5 sm:p-3'>
                      <BlockCard
                        variant='embed'
                        icon={Sparkles}
                        title='Apply & preview'
                        description='PDF for job portals, QR for events, open your live card.'
                        headerActions={
                          <div className='flex items-center gap-1'>
                            {infoHeaderAction('pdf', 'When to use the PDF')}
                          </div>
                        }
                      >
                        {openInfo === 'pdf' ? (
                          <p className={cn('mb-3 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
                            {SHARE_INFO.pdf}
                          </p>
                        ) : null}
                        <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                          <Button
                            variant='secondary'
                            size='md'
                            isLoading={pdfLoading}
                            onClick={() => void downloadPdf()}
                            className='w-full justify-center'
                          >
                            <FileDown className='h-4 w-4' />
                            PDF
                          </Button>
                          <Button
                            variant='secondary'
                            size='md'
                            type='button'
                            className='w-full justify-center'
                            onClick={() => {
                              setOpenInfo(null)
                              setQrOverlayOpen(true)
                            }}
                            disabled={!qrDataUrl || qrWorking}
                          >
                            <QrCode className='h-4 w-4' />
                            QR
                          </Button>
                          <Button
                            variant='secondary'
                            size='md'
                            className='w-full justify-center'
                            type='button'
                            onClick={() => window.open(fullUrl, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className='h-4 w-4' />
                            Preview
                          </Button>
                        </div>
                        <div className='mt-4 flex justify-end border-t border-slate-200/80 pt-3 dark:border-gray-700/80'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => void generateToken(true)}
                            isLoading={generating}
                            title='Invalidates the old link and QR'
                          >
                            <RefreshCw className='mr-1 h-3.5 w-3.5' />
                            Regenerate link
                          </Button>
                        </div>
                      </BlockCard>
                    </HubSectionPanel>
                  </div>
                )}
              </div>
            )}

            {panel === 'embed' && shareToken && publicOrigin && (
              <div className='scrollbar-none max-h-[min(60vh,28rem)] space-y-4 overflow-y-auto'>
                <HubSectionPanel isDark={isDark} accent='violet' contentClassName='p-2.5 sm:p-3'>
                  <BlockCard
                    variant='embed'
                    icon={Code2}
                    title='Iframe embed'
                    description='Personal site, portfolio, Notion, or blog.'
                    headerActions={infoHeaderAction('iframe', 'When to use an iframe embed')}
                  >
                    {openInfo === 'iframe' ? (
                      <p className={cn('mb-3 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
                        {SHARE_INFO.iframe}
                      </p>
                    ) : null}
                    <textarea
                      readOnly
                      rows={4}
                      value={embedSnippet}
                      className={cn(
                        'scrollbar-none resize-none w-full rounded-lg border px-3 py-2.5 text-xs font-mono shadow-inner',
                        isDark ? 'border-gray-600 bg-gray-950/50 text-gray-200' : 'border-slate-200 bg-white text-slate-800',
                      )}
                    />
                    <Button variant='secondary' size='md' className='mt-2' onClick={() => copyText(embedSnippet, 'embed')}>
                      {copied && copiedField === 'embed' ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
                      Copy embed code
                    </Button>
                    <p className={cn('mt-2 text-[11px]', isDark ? 'text-gray-500' : 'text-slate-500')}>
                      oEmbed:{' '}
                      <span className='font-mono break-all'>
                        {publicOrigin}/api/oembed?url=…
                      </span>{' '}
                      (encode your full card URL)
                    </p>
                  </BlockCard>
                </HubSectionPanel>

                <HubSectionPanel isDark={isDark} accent='sky' contentClassName='p-2.5 sm:p-3'>
                  <BlockCard
                    variant='embed'
                    icon={Mail}
                    title='Email signature'
                    description='Gmail, Outlook — every email shows your card.'
                    headerActions={infoHeaderAction('signature', 'When to use an email signature')}
                  >
                    {openInfo === 'signature' ? (
                      <p className={cn('mb-3 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
                        {SHARE_INFO.signature}
                      </p>
                    ) : null}
                    {fullUrl ? (
                      <div
                        className={cn(
                          'mb-3 rounded-xl border p-2.5',
                          isDark ? 'border-gray-600 bg-gray-950/40' : 'border-slate-200 bg-white',
                        )}
                      >
                        <a href={fullUrl} target='_blank' rel='noopener noreferrer' className='inline-block max-w-full'>
                          <img
                            src={`${publicOrigin}/card/${shareToken}/signature`}
                            width={600}
                            height={150}
                            alt='Email signature preview'
                            className='h-auto max-w-full rounded-none border border-gray-200 dark:border-gray-600'
                          />
                        </a>
                      </div>
                    ) : null}
                    <textarea
                      readOnly
                      rows={4}
                      value={signatureHtml}
                      className={cn(
                        'scrollbar-none resize-none w-full rounded-lg border px-3 py-2.5 text-xs font-mono shadow-inner',
                        isDark ? 'border-gray-600 bg-gray-950/50 text-gray-200' : 'border-slate-200 bg-white text-slate-800',
                      )}
                    />
                    <Button variant='secondary' size='md' className='mt-2' onClick={() => copyText(signatureHtml, 'sig')}>
                      {copied && copiedField === 'sig' ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
                      Copy HTML
                    </Button>
                  </BlockCard>
                </HubSectionPanel>

                <HubSectionPanel isDark={isDark} accent='teal' contentClassName='p-2.5 sm:p-3'>
                  <BlockCard
                    variant='embed'
                    icon={Award}
                    title='README badge'
                    description='GitHub profile or project README.'
                    headerActions={infoHeaderAction('badge', 'When to use a README badge')}
                  >
                    {openInfo === 'badge' ? (
                      <p className={cn('mb-3 text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-600')}>
                        {SHARE_INFO.badge}
                      </p>
                    ) : null}
                    <div className='mb-3 flex items-center gap-2'>
                      <img src={`${publicOrigin}/card/${shareToken}/badge`} alt='Storm badge' className='h-8' />
                    </div>
                    <textarea
                      readOnly
                      rows={2}
                      value={badgeMarkdown}
                      className={cn(
                        'scrollbar-none resize-none w-full rounded-lg border px-3 py-2.5 text-xs font-mono shadow-inner',
                        isDark ? 'border-gray-600 bg-gray-950/50 text-gray-200' : 'border-slate-200 bg-white text-slate-800',
                      )}
                    />
                    <Button variant='secondary' size='md' className='mt-2' onClick={() => copyText(badgeMarkdown, 'badge')}>
                      {copied && copiedField === 'badge' ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
                      Copy Markdown
                    </Button>
                  </BlockCard>
                </HubSectionPanel>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
