'use client'

import { useTheme } from '@/contexts/ThemeContext'

interface LoadingScreenProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingScreen({ 
  message = 'Loading...', 
  fullScreen = true 
}: LoadingScreenProps) {
  const { theme } = useTheme()

  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center'
    : 'flex items-center justify-center py-12'

  return (
    <div className={containerClasses}>
      {/* Backdrop blur for full screen */}
      {fullScreen && (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cream via-white to-brand-mint/20 dark:from-slate-900 dark:via-slate-800 dark:to-brand-sage-dark" />
      )}

      {/* Loading card */}
      <div
        className={`relative rounded-2xl p-8 shadow-2xl border-t-4 ${
          theme === 'dark'
            ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
            : 'bg-white/80 backdrop-blur-xl border-brand-sage'
        }`}
      >
        <div className="flex flex-col items-center gap-6">
          {/* Animated logo/spinner */}
          <div className="relative">
            {/* Outer rotating ring */}
            <div
              className={`w-20 h-20 rounded-full border-4 border-transparent animate-spin ${
                theme === 'dark'
                  ? 'border-t-brand-mint border-r-brand-mint/50'
                  : 'border-t-brand-sage border-r-brand-sage/50'
              }`}
              style={{ animationDuration: '1s' }}
            />
            
            {/* Inner pulsing circle */}
            <div
              className={`absolute inset-0 m-auto w-12 h-12 rounded-full animate-pulse ${
                theme === 'dark'
                  ? 'bg-brand-mint/30'
                  : 'bg-brand-sage/30'
              }`}
              style={{ animationDuration: '1.5s' }}
            />
            
            {/* Center "V" for Veree */}
            <div
              className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-brand-sage'
              }`}
            >
              V
            </div>
          </div>

          {/* Loading message */}
          <div className="text-center">
            <p
              className={`text-lg font-semibold mb-1 ${
                theme === 'dark' ? 'text-white' : 'text-brand-sage'
              }`}
            >
              {message}
            </p>
            
            {/* Animated dots */}
            <div className="flex justify-center gap-1">
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${
                  theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
                }`}
                style={{ animationDelay: '0ms', animationDuration: '1s' }}
              />
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${
                  theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
                }`}
                style={{ animationDelay: '150ms', animationDuration: '1s' }}
              />
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${
                  theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
                }`}
                style={{ animationDelay: '300ms', animationDuration: '1s' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

