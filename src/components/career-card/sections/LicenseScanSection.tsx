'use client'

import { IdCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { isCareerCardOwnerMode, type CareerCardMode } from '@/types/career-card'
import type { LicenseScanCardData } from '@/types/career-card'

interface LicenseScanSectionProps {
  data: LicenseScanCardData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
}

export default function LicenseScanSection({
  data,
  mode,
  isDark,
  onAction,
}: LicenseScanSectionProps) {
  if (data.confirmed) {
    return (
      <div
        className={cn(
          'rounded-xl border p-4',
          isDark
            ? 'border-gray-600/55 bg-gray-800/45'
            : 'border-gray-200/90 bg-white/85',
        )}
      >
        <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          License on file
        </p>
        <p className={cn('mt-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
          The barcode read is saved. Empty license fields on your DOT application can use it.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed p-6 text-center',
        isDark ? 'border-teal-400/25 bg-teal-500/[0.06]' : 'border-teal-300/60 bg-teal-50/50',
      )}
    >
      <IdCard className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-teal-300' : 'text-teal-600')} />
      <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
        Scan your license
      </p>
      <p className={cn('mt-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
        {data.barcodeRead
          ? 'The barcode was read. Confirm it so empty DOT fields can use it.'
          : 'A phone scan of the barcode fills empty license fields on your DOT application. The picture is not saved.'}
      </p>
      {isCareerCardOwnerMode(mode) && onAction ? (
        <Button type='button' variant='primary' size='sm' className='mt-4' onClick={onAction}>
          {data.barcodeRead ? 'Confirm scan' : 'Scan license'}
        </Button>
      ) : null}
    </div>
  )
}
