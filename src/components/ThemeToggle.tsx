'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { navControlButtonClass } from '@/lib/navigation-styles'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type='button'
      onClick={toggleTheme}
      className={cn('relative group p-2.5 cursor-pointer', navControlButtonClass(isDark))}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className='w-5 h-5 flex items-center justify-center'>
        {theme === 'light' ? (
          <Moon className='w-4 h-4 transition-transform duration-300' />
        ) : (
          <Sun className='w-4 h-4 transition-transform duration-300' />
        )}
      </div>

      {/* Tooltip */}
      <div className='absolute right-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
        Switch to {theme === 'light' ? 'dark' : 'light'} mode
      </div>
    </button>
  )
}
