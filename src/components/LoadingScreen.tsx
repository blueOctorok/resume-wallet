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
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-gray-900" />
      )}

      {/* Loading card - matches new hub styling */}
      <div
        className={`relative rounded-2xl p-8 shadow-2xl border-t-4 ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-xl border-indigo-500'
            : 'bg-white/80 backdrop-blur-xl border-indigo-600'
        }`}
      >
        <div className="flex flex-col items-center gap-6">
          {/* Animated logo/spinner */}
          <div className="relative">
            {/* Outer rotating ring */}
            <div
              className={`w-20 h-20 rounded-full border-4 border-transparent animate-spin ${
                theme === 'dark'
                  ? 'border-t-indigo-400 border-r-indigo-400/50'
                  : 'border-t-indigo-600 border-r-indigo-600/50'
              }`}
              style={{ animationDuration: '1s' }}
            />
            
            {/* Inner pulsing circle */}
            <div
              className={`absolute inset-0 m-auto w-12 h-12 rounded-full animate-pulse ${
                theme === 'dark'
                  ? 'bg-indigo-500/30'
                  : 'bg-indigo-500/20'
              }`}
              style={{ animationDuration: '1.5s' }}
            />
            
            {/* Center "S" for StormChain */}
            <div
              className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-indigo-600'
              }`}
            >
              S
            </div>
          </div>

          {/* Loading message */}
          <div className="text-center">
            <p
              className={`text-lg font-semibold mb-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-800'
              }`}
            >
              {message}
            </p>
            
            {/* Animated dots */}
            <div className="flex justify-center gap-1">
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${
                  theme === 'dark' ? 'bg-indigo-400' : 'bg-indigo-600'
                }`}
                style={{ animationDelay: '0ms', animationDuration: '1s' }}
              />
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${
                  theme === 'dark' ? 'bg-indigo-400' : 'bg-indigo-600'
                }`}
                style={{ animationDelay: '150ms', animationDuration: '1s' }}
              />
              <span
                className={`w-2 h-2 rounded-full animate-bounce ${
                  theme === 'dark' ? 'bg-indigo-400' : 'bg-indigo-600'
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

