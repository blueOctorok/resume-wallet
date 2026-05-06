'use client'

import { useState } from 'react'
import { FileWarning, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PspData, CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import PspViewModal from '@/components/PspViewModal'
import Button from '@/components/ui/Button'

interface PspSectionProps {
  data: PspData
  mode: CareerCardMode
  isDark: boolean
  onNavigateToOrder?: () => void
  walletAddress?: string | null
}

export default function PspSection({
  data,
  mode,
  isDark,
  onNavigateToOrder,
  walletAddress,
}: PspSectionProps) {
  const [open, setOpen] = useState(false)

  const isComplete = data.orderStatus === 'completed' || data.orderStatus === 'needs_review'

  const handlePrimary = () => {
    if (isComplete) {
      setOpen(true)
      return
    }
    onNavigateToOrder?.()
  }

  const showSelfButton =
    isCareerCardOwnerMode(mode) &&
    (isComplete ? Boolean(walletAddress && data.orderId) : Boolean(onNavigateToOrder))

  return (
    <div
      className={cn('rounded-xl p-4', isDark ? 'bg-gray-700/50' : 'bg-white/60')}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className={cn('h-4 w-4', isDark ? 'text-orange-400' : 'text-orange-600')} />
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            PSP Report
          </h3>
        </div>
        {showSelfButton && (
          <Button type="button" variant={isComplete ? 'secondary' : 'primary'} size="sm" onClick={handlePrimary}>
            {isComplete ? 'View' : 'Order'}
          </Button>
        )}
      </div>

      {isComplete ? (
        <div className="space-y-2">
          <p className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
            {data.resultSummary ? (
              <>
                Report status:{' '}
                <span className="font-medium">{data.resultSummary.resultStatus ?? 'received'}</span>
              </>
            ) : (
              <>
                Report received — details will appear here after we finish parsing the vendor file.
              </>
            )}
          </p>
          <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
            {data.licenseState} · Ordered {new Date(data.orderedAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-500" />
          <div>
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
              PSP {data.orderStatus === 'pending' ? 'pending' : 'ordered'}
            </p>
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {data.licenseState} · Ordered {new Date(data.orderedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {open && walletAddress && (
        <PspViewModal
          isOpen={open}
          onClose={() => setOpen(false)}
          walletAddress={walletAddress}
          orderId={data.orderId}
        />
      )}
    </div>
  )
}
