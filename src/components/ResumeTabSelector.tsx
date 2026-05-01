'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Upload, FileEdit } from 'lucide-react'

interface ResumeTabSelectorProps {
  activeTab: 'upload' | 'create'
  onTabChange: (tab: 'upload' | 'create') => void
  theme?: string
}

export default function ResumeTabSelector({
  activeTab,
  onTabChange,
  theme: themeProp,
}: ResumeTabSelectorProps) {
  const { theme: themeFromContext } = useTheme()
  const theme = themeProp || themeFromContext
  const isDark = isDarkTheme(theme)
  
  return (
    <div className={`flex gap-1 sm:gap-2 p-0.5 sm:p-1 rounded-xl border ${
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <button
        onClick={() => onTabChange('upload')}
        className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm md:text-base font-medium transition-all ${
          activeTab === 'upload'
            ? 'bg-teal-600 text-white shadow-lg'
            : isDark
              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Upload className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
        <span className='hidden xs:inline'>Upload Resume</span>
        <span className='xs:hidden'>Upload</span>
      </button>
      <button
        onClick={() => onTabChange('create')}
        className={`flex items-center justify-center gap-1.5 sm:gap-2 flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm md:text-base font-medium transition-all ${
          activeTab === 'create'
            ? 'bg-teal-600 text-white shadow-lg'
            : isDark
              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <FileEdit className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
        <span className='hidden xs:inline'>Create Resume</span>
        <span className='xs:hidden'>Create</span>
      </button>
    </div>
  )
}
