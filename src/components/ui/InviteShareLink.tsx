'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/**
 * Shareable invite URL + labeled Copy. Icon-only copy next to a long URL
 * gets clipped — this stacks the field and keeps the button visible.
 */
export default function InviteShareLink({
  url,
  isDark,
  className,
}: {
  url: string
  isDark: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <code
        className={cn(
          'min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-xs',
          isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-slate-800',
        )}
        title={url}
      >
        {url}
      </code>
      <Button type='button' variant='secondary' size='sm' className='shrink-0' onClick={() => void handleCopy()}>
        {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  )
}
