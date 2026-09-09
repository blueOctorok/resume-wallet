import type { ReactNode } from 'react'

/** Official § 391.23 paper labels — sentence case with a colon, not UI uppercase. */
export function paperDate(value: string | null | undefined): string {
  if (!value) return ''
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  const ym = value.match(/^(\d{4})-(\d{2})/)
  if (ym) return `${ym[2]}/${ym[1]}`
  return value
}

export function formatDob(value: string): string {
  return paperDate(value)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function OfficialFormFooter() {
  return (
    <p className='mt-6 text-center text-[11px] italic text-[#173150]/45'>
      Form complies with 49 CFR § 391.23 and § 40.25 — Revised 2025 Edition.
    </p>
  )
}

export function PaperLine({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <span className='text-sm font-medium text-[#173150]'>{label}</span>
      <p className='mt-0.5 min-h-8 border-b border-[#173150] pb-0.5 text-sm text-[#173150]'>
        {value || '\u00a0'}
      </p>
    </div>
  )
}

export function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className='inline-flex items-center gap-1.5 text-sm text-[#173150]'>
      <span
        className={`inline-flex h-3.5 w-3.5 items-center justify-center border border-[#173150] text-[9px] ${
          checked ? 'bg-[#173150] text-[#fbf8f1]' : 'bg-white'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </span>
  )
}

export function YesNoLine({
  question,
  answer,
}: {
  question: string
  answer?: 'yes' | 'no' | null
}) {
  return (
    <div className='flex flex-wrap items-start gap-3 text-sm text-[#173150]'>
      <p className='min-w-0 flex-1'>{question}</p>
      <span className='flex shrink-0 gap-3'>
        <Check checked={answer === 'yes'} label='Yes' />
        <Check checked={answer === 'no'} label='No' />
      </span>
    </div>
  )
}

export function OfficialTable({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full min-w-[32rem] border-collapse border border-[#173150] text-left text-xs'>
        <thead>
          <tr className='bg-[#173150]/5'>
            {headers.map((h) => (
              <th key={h} className='border border-[#173150] px-2 py-1.5 font-semibold'>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
