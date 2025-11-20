'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Sparkles } from 'lucide-react'

interface TLoadingModalProps {
  isVisible: boolean
  message?: string
}

// Get contextual help message based on what AvA is doing
function getContextMessage(message: string): string {
  if (message.includes('Analyzing') || message.includes('resume')) {
    return 'I\'m reading your resume and extracting your info to save you time filling out forms. Usually takes 15-20 seconds.'
  } else if (message.includes('Processing') || message.includes('request')) {
    return 'Looking up the best answer for you. This typically takes 10-15 seconds.'
  } else {
    return 'Working on your request...'
  }
}

export default function TLoadingModal({ isVisible, message = 'AvA is thinking...' }: TLoadingModalProps) {
  const { theme } = useTheme()

  if (!isVisible) return null

  const contextMessage = getContextMessage(message)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Modal content */}
      <div
        className={`relative rounded-3xl p-8 sm:p-10 mx-4 shadow-2xl border-2 pointer-events-auto max-w-md ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-brand-sage-light/30 to-brand-mint/20 backdrop-blur-xl border-brand-mint/40'
            : 'bg-gradient-to-br from-white to-gray-50/90 backdrop-blur-xl border-brand-sage/30'
        }`}
      >
        {/* Animated icon */}
        <div className="flex flex-col items-center space-y-6">
          {/* Brain animation */}
          <div className="relative">
            {/* Outer pulsing rings - multiple layers for depth */}
            <div
              className={`absolute inset-0 rounded-full animate-ping ${
                theme === 'dark' ? 'bg-brand-mint/40' : 'bg-brand-sage/40'
              }`}
              style={{ animationDuration: '2s' }}
            />
            <div
              className={`absolute inset-0 rounded-full animate-ping ${
                theme === 'dark' ? 'bg-brand-mint/20' : 'bg-brand-sage/20'
              }`}
              style={{ animationDuration: '3s', animationDelay: '0.5s' }}
            />
            
            {/* Main icon container with gradient */}
            <div
              className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl ${
                theme === 'dark'
                  ? 'bg-gradient-to-br from-brand-mint to-brand-mint/80 text-gray-900'
                  : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark text-white'
              }`}
            >
              {/* Animated "AvA" with sparkle */}
              <div className="relative">
                <span className="text-2xl font-bold animate-pulse">AvA</span>
                <Sparkles 
                  className="absolute -top-2 -right-2 w-5 h-5 animate-spin" 
                  style={{ animationDuration: '3s' }}
                />
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="text-center max-w-sm space-y-3">
            <p
              className={`text-lg sm:text-xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {message}
            </p>
            
            {/* Context-specific helpful message */}
            <div className={`text-sm sm:text-base leading-relaxed ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <p>{contextMessage}</p>
            </div>

            {/* Progress indicator */}
            <div className="pt-2">
              <div className={`h-1 w-full rounded-full overflow-hidden ${
                theme === 'dark' ? 'bg-brand-sage-light/20' : 'bg-gray-200'
              }`}>
                <div
                  className={`h-full rounded-full ${
                    theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
                  }`}
                  style={{
                    animation: 'progress 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 40%;
            margin-left: 30%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  )
}

