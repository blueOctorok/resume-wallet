/**
 * DqFileCard — the hero visual: one driver's DQ file.
 *
 * Two groups, because the page has to keep them apart:
 * - what the driver fills, free (application, license scan)
 * - what happens when an employer asks (consent, the record from a screener)
 *
 * Nothing here is called verified. The application and the license scan are
 * the driver's own entries; the record row names who issues it.
 */

import { ClipboardList, FileSignature, FileText, Gauge, IdCard, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAPER_DOCUMENT } from './landing-shared'

interface FileRow {
  icon: LucideIcon
  label: string
  note: string
  /** Present on rows the driver has already finished. */
  tag?: string
}

const DRIVER_ROWS: FileRow[] = [
  { icon: ClipboardList, label: 'DOT application', note: 'Forms 1–3 · typed once', tag: 'complete' },
  { icon: IdCard, label: 'Driver license', note: 'Barcode scan fills the license fields', tag: 'on file' },
]

const EMPLOYER_ROWS: FileRow[] = [
  { icon: FileSignature, label: 'Screening consent', note: 'You sign it for that employer' },
  { icon: Gauge, label: 'Motor Vehicle Record', note: 'Issued by a licensed screener' },
]

function FileRowItem({ icon: Icon, label, note, tag }: FileRow) {
  const done = Boolean(tag)
  return (
    <li
      className={cn(
        'flex min-h-[3.25rem] items-center gap-2.5 rounded-lg px-3 py-2 ring-1 ring-inset',
        done ? 'bg-[#f15a2b]/[0.06] ring-[#f15a2b]/20' : 'ring-stone-200/80',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', done ? 'text-[#f15a2b]' : 'text-ironside')} aria-hidden />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-[13px] font-medium text-[#173150]'>{label}</p>
        <p className='truncate text-[10px] text-ironside'>{note}</p>
      </div>
      {tag ? (
        <span className='shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#f15a2b]'>
          {tag}
        </span>
      ) : null}
    </li>
  )
}

export default function DqFileCard({ className }: { className?: string }) {
  return (
    <div className={cn(PAPER_DOCUMENT, className)}>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f15a2b]/50 to-transparent'
      />

      <div className='flex items-start gap-3 px-5 pt-5'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#173150] text-sm font-bold text-white ring-2 ring-[#f15a2b]/40'>
          BB
        </div>
        <div className='min-w-0 flex-1'>
          <h3 className='text-[15px] font-semibold text-[#173150]'>Barry Burton</h3>
          <p className='mt-0.5 text-xs text-ironside'>Driver qualification file · Raccoon City</p>
        </div>
      </div>

      <div className='mx-5 mt-4 rounded-lg bg-[#f3f4f5] px-3 py-2'>
        <p className='font-mono text-[10px] tracking-wide text-ironside'>
          <span className='text-[#f15a2b]'>shared with Pace Drivers</span> · same file · nothing retyped
        </p>
      </div>

      <ul className='space-y-1.5 px-5 pt-4'>
        {DRIVER_ROWS.map((row) => (
          <FileRowItem key={row.label} {...row} />
        ))}
      </ul>

      <div className='my-4 flex items-center gap-3 px-5' aria-hidden>
        <span className='h-px flex-1 bg-gradient-to-r from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55' />
        <span className='font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-[#f15a2b]'>
          when an employer asks
        </span>
        <span className='h-px flex-1 bg-gradient-to-l from-transparent via-[#f15a2b]/55 to-[#f15a2b]/55' />
      </div>

      <ul className='space-y-1.5 px-5'>
        {EMPLOYER_ROWS.map((row) => (
          <FileRowItem key={row.label} {...row} />
        ))}
      </ul>

      <div className='mx-5 mb-5 mt-4 flex items-center gap-2.5 rounded-lg bg-[#f3f4f5] px-3 py-2.5'>
        <FileText className='h-4 w-4 shrink-0 text-[#173150]' aria-hidden />
        <p className='min-w-0 flex-1 text-[11px] text-[#173150]'>
          <span className='font-semibold'>Resume</span> · prints from this file
        </p>
        <span className='shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-ironside'>
          pdf
        </span>
      </div>
    </div>
  )
}
