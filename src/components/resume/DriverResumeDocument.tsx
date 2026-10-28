'use client'

/**
 * Premium DOT-packet resume document — visual match for docs/midnight/example_resume.png.
 * Always light “paper” (ignore app dark mode).
 *
 * Link is the primary digital CTA (desktop). QR is secondary — useful on printed PDFs /
 * phone-to-phone; always paired with the same public card URL.
 */

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DriverResumePacket, DriverResumeProofChip } from '@/lib/driver-resume-packet'
import { PROVVEN_QR_OPTS } from '@/lib/provven-qr'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'

/** Fallback under the cotton tile. Matches the texture's average so a slow load doesn't flash ivory. */
const RESUME_PAPER = '#f6f6f6'

function DiamondRule({ ink = '#a8a29e', className }: { ink?: string; className?: string }) {
  return (
    <div className={cn('flex items-center', className)} aria-hidden>
      <span
        className='h-px flex-1'
        style={{ backgroundImage: `linear-gradient(to right, transparent, ${ink})` }}
      />
      <span className='mx-3 h-1.5 w-1.5 shrink-0 rotate-45' style={{ backgroundColor: ink }} />
      <span
        className='h-px flex-1'
        style={{ backgroundImage: `linear-gradient(to left, transparent, ${ink})` }}
      />
    </div>
  )
}

function SectionRule({ title }: { title: string }) {
  return (
    <div className='mb-3 mt-7'>
      <h3 className='text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500'>
        {title}
      </h3>
      <DiamondRule className='mt-1.5' />
    </div>
  )
}

function QrBlock({
  dataUrl,
  label,
  sizeClass = 'h-[72px] w-[72px]',
}: {
  dataUrl: string | null
  label?: string
  sizeClass?: string
}) {
  return (
    <div className='flex flex-col items-center gap-1'>
      <div
        className={`relative ${sizeClass} flex items-center justify-center border border-stone-900 p-0.5`}
        style={{ backgroundColor: '#ffffff' }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
          <img src={dataUrl} alt='' className='h-full w-full' />
        ) : (
          <span className='text-sm font-bold text-emerald-600'>ZK</span>
        )}
        {dataUrl ? (
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
            <div className='flex h-[32%] w-[32%] items-center justify-center rounded-sm' style={{ backgroundColor: '#ffffff' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- brand mark over QR */}
              <img src='/brand/provven-mark.svg' alt='' className='h-[78%] w-[78%]' />
            </div>
          </div>
        ) : null}
      </div>
      {label ? (
        <p className='max-w-[88px] text-center text-[9px] leading-tight text-stone-500'>{label}</p>
      ) : null}
    </div>
  )
}

function CardLinkRow({
  href,
  displayPath,
  compact = false,
}: {
  href: string
  displayPath: string
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-x-2 gap-y-1' : 'space-y-2'}>
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex max-w-full items-center gap-1 break-all text-[12px] font-medium text-amber-800 underline-offset-2 hover:underline'
      >
        <span className='min-w-0'>{displayPath}</span>
        <ExternalLink className='h-3 w-3 shrink-0 opacity-70' aria-hidden />
      </a>
      <button
        type='button'
        onClick={() => void copy()}
        className='inline-flex items-center gap-1 rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-700 hover:bg-stone-100'
      >
        {copied ? (
          <Check className='h-3 w-3 text-emerald-600' aria-hidden />
        ) : (
          <Copy className='h-3 w-3' aria-hidden />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function ProofMark({
  tone,
  kicker,
  cite,
  facts,
}: {
  tone: 'midnight' | 'license'
  kicker: string
  cite: string
  facts: string
}) {
  const midnight = tone === 'midnight'
  return (
    <span className='inline-flex items-center gap-1.5'>
      {/* eslint-disable-next-line @next/next/no-img-element -- brand mark beside the proof */}
      <img src='/brand/provven-mark.svg' alt='' className='h-4 w-4 shrink-0' />
      <span className='leading-tight'>
        <span
          className='block text-[12px] font-semibold'
          style={{ color: midnight ? '#173150' : '#00608b' }}
        >
          {facts}
        </span>
        <span
          className='block text-[9px] font-bold uppercase tracking-[0.14em]'
          style={{ color: midnight ? '#f15a2b' : '#00608b' }}
        >
          {kicker}
          <span className='ml-1.5 font-medium normal-case tracking-normal text-stone-500'>{cite}</span>
        </span>
      </span>
    </span>
  )
}

function ProofBadges({ chips }: { chips: DriverResumeProofChip[] }) {
  // Midnight first, then the barcode. Each one starts at the left of the next.
  const proofs = [...chips]
    .filter((chip) => chip.tier === 'midnight' || chip.tier === 'license')
    .sort((a, b) => (a.tier === 'midnight' ? 0 : 1) - (b.tier === 'midnight' ? 0 : 1))
  if (proofs.length === 0) return null
  return (
    <div className='mt-4 flex flex-wrap items-center justify-start gap-x-5 gap-y-2'>
      {proofs.map((chip) => (
        <ProofMark
          key={chip.id}
          tone={chip.tier === 'midnight' ? 'midnight' : 'license'}
          kicker={chip.tier === 'midnight' ? 'Midnight proof' : 'License proof'}
          cite={chip.tier === 'midnight' ? 'via Accio' : 'Barcode read'}
          facts={chip.label}
        />
      ))}
    </div>
  )
}

function StatedChips({ chips }: { chips: DriverResumeProofChip[] }) {
  const stated = chips.filter((chip) => chip.tier !== 'midnight' && chip.tier !== 'license')
  if (stated.length === 0) return null
  return (
    <div className='mt-3 flex flex-wrap gap-1.5'>
      {stated.map((chip) => (
        <span
          key={chip.id}
          className='inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-700'
        >
          <span
            className={cn(
              'h-1 w-1 shrink-0 rounded-full',
              chip.id === 'cdl-expired' ? 'bg-[#F28A0F]' : chip.attested ? 'bg-retro-teal' : 'bg-stone-400',
            )}
            aria-hidden
          />
          {chip.label}
        </span>
      ))}
    </div>
  )
}

export default function DriverResumeDocument({ packet }: { packet: DriverResumePacket }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(packet.verifyUrl, { ...PROVVEN_QR_OPTS, width: 256 })
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setQrDataUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [packet.verifyUrl])

  return (
    <article
      className='resume-packet-paper relative mx-auto max-w-[640px] overflow-hidden text-stone-900 shadow-[0_4px_16px_rgba(23,49,80,0.16),0_14px_36px_-6px_rgba(23,49,80,0.32)] ring-1 ring-stone-300'
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        backgroundColor: RESUME_PAPER,
        backgroundImage: 'url(/brand/resume-paper.png?v=2)',
        backgroundRepeat: 'repeat',
        backgroundSize: '740px 493px',
        color: '#1c1917',
      }}
    >
      <div className='h-1 bg-[#173150]' aria-hidden />
      <div className='px-8 py-7 sm:px-10'>
      <ProvvenWordmark tone='auto' className='mb-5 text-[11px]' />
      {/* Header: name + contact | QR (print/phone secondary) */}
      <header className='flex items-start justify-between gap-6'>
        <div className='min-w-0 flex-1'>
          <h1
            className='text-[1.85rem] font-bold leading-tight tracking-tight text-stone-900 sm:text-[2.1rem]'
            style={{ fontFamily: 'Georgia, "Times New Roman", ui-serif, serif' }}
          >
            {packet.fullName}
          </h1>
          {packet.tagline ? (
            <p className='mt-1.5 text-[13px] text-stone-600'>{packet.tagline}</p>
          ) : null}
          {packet.contactLine ? (
            <p className='mt-0.5 text-[13px] text-stone-600'>{packet.contactLine}</p>
          ) : null}
        </div>
        <QrBlock dataUrl={qrDataUrl} label={packet.qrLabelTop} />
      </header>

      {packet.freshnessNote ? (
        <p className='mt-4 rounded-md border border-[#F28A0F]/50 bg-[#F28A0F]/10 px-3 py-2 text-[12.5px] leading-snug text-[#173150]'>
          {packet.freshnessNote}
        </p>
      ) : null}

      {packet.summary ? (
        <p className='mt-4 text-[13px] leading-relaxed text-stone-700'>{packet.summary}</p>
      ) : null}

      <ProofBadges chips={packet.proofChips} />
      <StatedChips chips={packet.proofChips} />

      {packet.thinStateHint ? (
        <p className='mt-6 text-sm italic text-stone-500'>{packet.thinStateHint}</p>
      ) : null}

      {packet.credentials.length > 0 ? (
        <>
          <SectionRule title='Credentials' />
          <ul className='space-y-1.5 text-[13px] leading-snug text-stone-800'>
            {packet.credentials.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}

      {packet.experience.length > 0 ? (
        <>
          <SectionRule title='Experience' />
          <div className='space-y-5'>
            {packet.experience.map((row) => (
              <div key={`${row.titleLine}-${row.dateRange}`}>
                <div className='flex items-baseline justify-between gap-4'>
                  <p className='text-[13px] font-semibold text-stone-900'>{row.titleLine}</p>
                  {row.dateRange ? (
                    <p className='shrink-0 text-[12px] text-stone-600'>{row.dateRange}</p>
                  ) : null}
                </div>
                {row.bullets.length > 0 ? (
                  <ul className='mt-1.5 space-y-0.5 pl-0.5 text-[12.5px] leading-snug text-stone-700'>
                    {row.bullets.map((b) => (
                      <li key={b} className='flex gap-2'>
                        <span className='text-stone-400' aria-hidden>
                          •
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {packet.safetySummary ? (
        <>
          <SectionRule title='Safety summary (driver-stated)' />
          <p className='text-[13px] leading-snug text-stone-800'>{packet.safetySummary}</p>
        </>
      ) : null}

      {/* Footer: link primary, QR secondary (print / phone) */}
      <footer className='mt-10'>
        <DiamondRule className='mb-6' />
        <div className='flex items-start gap-4'>
        <QrBlock dataUrl={qrDataUrl} sizeClass='h-[64px] w-[64px]' label='Scan with phone' />
        <div className='min-w-0 flex-1 pt-0.5'>
          <p className='text-[13px] font-semibold text-stone-900'>{packet.footerTitle}</p>
          <p className='mt-1 text-[11px] leading-relaxed text-stone-500'>{packet.footerBody}</p>
          <div className='mt-2.5'>
            <CardLinkRow href={packet.verifyUrl} displayPath={packet.verifyDisplayPath} />
          </div>
          {packet.hasVerifiedClaims ? (
            <p className='mt-2 text-[11px] text-stone-500'>Proofs expire {packet.expiresLabel}</p>
          ) : null}
        </div>
        </div>
      </footer>
      </div>
    </article>
  )
}
