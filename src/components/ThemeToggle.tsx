'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Monitor } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <div className='flex items-center space-x-1 bg-brand-cream dark:bg-brand-sage/20 rounded-lg p-1 border border-brand-mint/20 dark:border-brand-mint/10'>
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'light'
            ? 'bg-brand-mint text-white'
            : 'text-brand-sage-light hover:bg-brand-mint/20'
        }`}
        title='Light mode'
      >
        <Sun size={16} />
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'dark'
            ? 'bg-brand-mint text-white'
            : 'text-brand-sage-light hover:bg-brand-mint/20'
        }`}
        title='Dark mode'
      >
        <Moon size={16} />
      </button>

      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'system'
            ? 'bg-brand-mint text-white'
            : 'text-brand-sage-light hover:bg-brand-mint/20'
        }`}
        title='System preference'
      >
        <Monitor size={16} />
      </button>
    </div>
  )
}
