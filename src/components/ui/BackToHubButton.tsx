'use client'

import { ArrowLeft } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface BackToHubButtonProps {
  onClick: () => void
  label?: string
  className?: string
}

/**
 * Consistent "Back to Hub" button used throughout the employer/driver/developer shells.
 * Outlined style with no fill, arrow on the left.
 */
export default function BackToHubButton({
  onClick,
  label = 'Back to Hub',
  className = '',
}: BackToHubButtonProps) {
  const { theme } = useTheme()

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg
        text-sm font-medium transition-colors
        border
        ${theme === 'dark'
          ? 'border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white hover:bg-gray-800/50'
          : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50'
        }
        ${className}
      `}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  )
}
