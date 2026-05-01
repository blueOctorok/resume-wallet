import { isDarkTheme } from '@/lib/theme-storage'
export function getCardClass(theme: 'light' | 'dark') {
  return `rounded-xl border ${
    isDarkTheme(theme)
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white border-gray-200'
  }`
}

export function getTableHeaderClass(theme: 'light' | 'dark') {
  return `text-left text-xs font-semibold uppercase tracking-wider ${
    isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
  }`
}

export function getTableCellClass(theme: 'light' | 'dark') {
  return `px-4 py-3 text-sm ${
    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
  }`
}
