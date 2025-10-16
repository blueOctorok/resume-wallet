'use client'

import { useTheme } from '@/contexts/ThemeContext'

// Theme-aware color utility
export function getThemeColors(theme: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      background: 'bg-brand-cream',
      backgroundLight: 'bg-white/90',
      text: 'text-gray-800',
      textSecondary: 'text-gray-600',
      textTertiary: 'text-gray-500',
      border: 'border-brand-sage/40',
      borderHover: 'border-brand-sage/60',
      button: 'bg-brand-sage',
      buttonHover: 'bg-brand-sage-dark',
      buttonText: 'text-white',
      card: 'bg-white/95',
      cardBorder: 'border-brand-sage/30',
    }
  } else {
    return {
      background: 'bg-brand-sage',
      backgroundLight: 'bg-brand-sage-light/10',
      text: 'text-brand-cream',
      textSecondary: 'text-brand-cream/70',
      textTertiary: 'text-brand-cream/50',
      border: 'border-brand-mint/30',
      borderHover: 'border-brand-mint/50',
      button: 'bg-brand-mint',
      buttonHover: 'bg-brand-sage-light',
      buttonText: 'text-brand-sage',
      card: 'bg-brand-sage-light/20',
      cardBorder: 'border-brand-mint/30',
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
