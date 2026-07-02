'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { HelpCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useJourneyStore } from '@/stores'
import { cn } from '@/lib/utils'

interface AskStormiButtonProps {
  label?: string
  onClick?: () => void
  className?: string
}

/**
 * Reusable "Ask Stormi" button with the signature rotating silver border.
 *
 * - Default behavior: opens the Stormi Journey Guide
 * - Pass `onClick` to override (e.g. DOT form context-specific help)
 * - `className` applies to the outer wrapper for positioning
 */
export default function AskStormiButton({
  label = 'Ask AI',
  onClick,
  className,
}: AskStormiButtonProps) {
  const { theme } = useTheme()
  const openGuide = useJourneyStore((s) => s.openGuide)

  const handleClick = onClick ?? openGuide

  return (
    <div className={cn('inline-flex', className)}>
      <div className='rotating-silver-border'>
        <button
          type='button'
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors cursor-pointer',
            isDarkTheme(theme)
              ? 'bg-gray-800 text-gray-100 hover:bg-gray-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          )}
        >
          <HelpCircle className='w-4 h-4' strokeWidth={2} />
          <span>{label}</span>
        </button>
      </div>
    </div>
  )
}
