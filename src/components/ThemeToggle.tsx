'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className='relative group p-2.5 rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl border border-transparent'
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className='w-5 h-5 flex items-center justify-center'>
        {theme === 'light' ? (
          <Moon className='w-4 h-4 text-brand-cream transition-transform duration-300' />
        ) : (
          <Sun className='w-4 h-4 text-brand-cream transition-transform duration-300' />
        )}
      </div>

      {/* Tooltip */}
      <div className='absolute right-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
        Switch to {theme === 'light' ? 'dark' : 'light'} mode
      </div>
    </button>
  )
}
