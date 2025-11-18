'use client'

import { useTheme } from '@/contexts/ThemeContext'

interface TLoadingModalProps {
  isVisible: boolean
  message?: string
}

export default function TLoadingModal({ isVisible, message = 'T is thinking...' }: TLoadingModalProps) {
  const { theme } = useTheme()

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Modal content */}
      <div
        className={`relative rounded-2xl p-8 shadow-2xl border pointer-events-auto ${
          theme === 'dark'
            ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
            : 'bg-white/90 backdrop-blur-xl border-gray-200'
        }`}
      >
        {/* Animated brain/thinking icon */}
        <div className="flex flex-col items-center space-y-4">
          {/* Brain animation */}
          <div className="relative">
            {/* Outer pulsing ring */}
            <div
              className={`absolute inset-0 rounded-full animate-ping ${
                theme === 'dark' ? 'bg-brand-mint/30' : 'bg-brand-sage/30'
              }`}
              style={{ animationDuration: '2s' }}
            />
            
            {/* Main brain container */}
            <div
              className={`relative w-20 h-20 rounded-full flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-brand-mint text-gray-900'
                  : 'bg-brand-sage text-white'
              }`}
            >
              {/* Animated "T" */}
              <span className="text-3xl font-bold animate-pulse">T</span>
            </div>

            {/* Thinking dots */}
            <div className="absolute -bottom-2 -right-2 flex space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
                }`}
                style={{
                  animation: 'bounce 1.4s infinite ease-in-out',
                  animationDelay: '0s',
                }}
              />
              <div
                className={`w-2 h-2 rounded-full ${
                  theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
                }`}
                style={{
                  animation: 'bounce 1.4s infinite ease-in-out',
                  animationDelay: '0.2s',
                }}
              />
              <div
                className={`w-2 h-2 rounded-full ${
                  theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
                }`}
                style={{
                  animation: 'bounce 1.4s infinite ease-in-out',
                  animationDelay: '0.4s',
                }}
              />
            </div>
          </div>

          {/* Message */}
          <div className="text-center">
            <p
              className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {message}
            </p>
            <p
              className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              This may take a moment...
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

