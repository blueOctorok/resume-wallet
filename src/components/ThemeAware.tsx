'use client'

import { useTheme } from '@/contexts/ThemeContext'

// Theme-aware color utility
export function getThemeColors(theme: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      background: 'bg-gray-50',
      backgroundLight: 'bg-white/90',
      text: 'text-gray-800',
      textSecondary: 'text-gray-600',
      textTertiary: 'text-gray-500',
      border: 'border-gray-300',
      borderHover: 'border-gray-400',
      button: 'bg-teal-600',
      buttonHover: 'bg-teal-700',
      buttonText: 'text-white',
      card: 'bg-white/95',
      cardBorder: 'border-gray-200',
    }
  } else {
    return {
      background: 'bg-gray-900',
      backgroundLight: 'bg-gray-800/50',
      text: 'text-white',
      textSecondary: 'text-gray-300',
      textTertiary: 'text-gray-400',
      border: 'border-gray-700',
      borderHover: 'border-gray-600',
      button: 'bg-teal-500',
      buttonHover: 'bg-teal-400',
      buttonText: 'text-gray-900',
      card: 'bg-gray-800/80',
      cardBorder: 'border-gray-700',
    }
  }
}

// Hook to get current theme colors
export function useThemeColors() {
  const { theme } = useTheme()
  return getThemeColors(theme)
}

// Theme-aware component wrapper
interface ThemeAwareProps {
  children: (colors: ReturnType<typeof getThemeColors>) => React.ReactNode
}

export function ThemeAware({ children }: ThemeAwareProps) {
  const colors = useThemeColors()
  return <>{children(colors)}</>
}
