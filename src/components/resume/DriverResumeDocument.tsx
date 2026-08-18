'use client'

/**
 * Premium DOT-packet resume document — visual match for docs/midnight/example_resume.png.
 * Always light “paper” (ignore app dark mode).
 *
 * Link is the primary digital CTA (desktop). QR is secondary — useful on printed PDFs /
 * phone-to-phone; always paired with the same public card URL.
 */

import { useEffect, useState } from 'react'
import type { QRCodeToDataURLOptions } from 'qrcode'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DriverResumePacket } from '@/lib/driver-resume-packet'

const QR_OPTS: QRCodeToDataURLOptions = {
  width: 128,
  margin: 1,
  color: { dark: '#111111', light: '#ffffff' },
  errorCorrectionLevel: 'M',
}

function SectionRule({ title }: { title: string }) {
  return (
    <div className='mb-3 mt-7'>
      <h3 className='text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500'>
        {title}
      </h3>
      <div className='mt-1.5 h-px w-full bg-stone-300' />
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
        className={`${sizeClass} flex items-center justify-center border border-stone-900 bg-white p-0.5`}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
          <img src={dataUrl} alt='' className='h-full w-full' />
        ) : (
          <span className='text-sm font-bold text-emerald-600'>ZK</span>
        )}
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

export default function DriverResumeDocument({ packet }: { packet: DriverResumePacket }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const url = await QRCode.toDataURL(packet.verifyUrl, QR_OPTS)
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
      className='resume-packet-paper mx-auto max-w-[640px] bg-white px-8 py-9 text-stone-900 shadow-sm ring-1 ring-stone-200 sm:px-10'
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        // Inline lock: Quiet Ink remaps Tailwind `.bg-white` → zinc via globals.css
        backgroundColor: '#ffffff',
        color: '#1c1917',
      }}
    >
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

      {packet.proofChips.length > 0 ? (
        <div className='mt-5 flex flex-wrap gap-1.5'>
          {packet.proofChips.map((chip) => (
            <span
              key={chip.id}
              className='inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-700'
            >
              <span
                className={cn(
                  'h-1 w-1 shrink-0 rounded-full',
                  chip.attested ? 'bg-teal-600' : 'bg-stone-400',
                )}
                aria-hidden
              />
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* Verification metadata + primary link */}
      <div className='mt-3 border-t border-stone-200 pt-2'>
        <p className='text-[11px] leading-relaxed text-stone-500'>
          {packet.hasVerifiedClaims
            ? `Provven-verified • as of ${packet.asOfLabel} • expires ${packet.expiresLabel}`
            : 'Candidate packet'}
        </p>
        <div className='mt-1.5'>
          <CardLinkRow href={packet.verifyUrl} displayPath={packet.verifyDisplayPath} compact />
        </div>
      </div>

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
                    <p className='shrink-0 text-[12px] text-stone-500'>{row.dateRange}</p>
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
      <footer className='mt-10 flex items-start gap-4 border-t border-stone-200 pt-6'>
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
      </footer>
    </article>
  )
}
