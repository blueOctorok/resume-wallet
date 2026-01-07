'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Loader2 } from 'lucide-react'

interface TLoadingModalProps {
  isVisible: boolean
  message?: string
}

export default function TLoadingModal({ isVisible, message = 'AvA is thinking...' }: TLoadingModalProps) {
  const { theme } = useTheme()

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
      {/* Subtle backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

      {/* Clean modal */}
      <div
        className={`relative rounded-2xl px-8 py-6 mx-4 shadow-xl pointer-events-auto ${
          theme === 'dark'
            ? 'bg-gray-800/95 border border-brand-mint/30'
            : 'bg-white/95 border border-brand-sage/20'
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Simple spinning loader */}
          <div
            className={`${
              theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
            }`}
          >
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>

          {/* Message */}
          <p
            className={`text-base font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

