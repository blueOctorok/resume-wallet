'use client'

import React, { useState, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface SaveProgressButtonProps {
  /** Centralized save function from parent - saves ALL forms */
  onSaveProgress?: () => Promise<boolean | undefined>
  /** User's wallet address for API auth */
  walletAddress?: string
  /** Whether to show as compact button */
  compact?: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Save Progress Button for DOT Application Forms
 * 
 * Calls the parent's centralized save function which saves ALL form data
 * to the unified driver profile (single source of truth).
 * Shows visual feedback for save state (saving spinner, success checkmark, error).
 */
export default function SaveProgressButton({
  onSaveProgress,
  walletAddress,
  compact = false,
}: SaveProgressButtonProps) {
  const { theme } = useTheme()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const handleSave = useCallback(async () => {
    if (!walletAddress) {
      console.warn('⚠️ [SAVE] No wallet address, cannot save')
      return
    }

    if (!onSaveProgress) {
      console.warn('⚠️ [SAVE] No save function provided')
      return
    }

    setSaveState('saving')

    try {
      console.log('💾 [SAVE] Saving all forms to driver profile...')
      
      // Call the parent's centralized save function (saves ALL forms)
      const success = await onSaveProgress()

      if (success === false) {
        throw new Error('Save failed')
      }

      console.log('✅ [SAVE] All forms saved successfully')
      setSaveState('saved')
      setLastSaved(new Date())

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveState('idle')
      }, 3000)

    } catch (error) {
      console.error('❌ [SAVE] Save failed:', error)
      setSaveState('error')

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveState('idle')
      }, 3000)
    }
  }, [walletAddress, onSaveProgress])

  // Render the appropriate icon based on state
  const renderIcon = () => {
    switch (saveState) {
      case 'saving':
        return (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )
      case 'saved':
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      default:
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        )
    }
  }

  // Get button text based on state
  const getButtonText = () => {
    switch (saveState) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return 'Saved!'
      case 'error':
        return 'Error'
      default:
        return 'Save Progress'
    }
  }

  // Get button styles based on state and theme - uses brand colors
  const getButtonStyles = () => {
    const baseStyles = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50'
    const sizeStyles = compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'
    
    let colorStyles = ''
    if (saveState === 'saved') {
      colorStyles = theme === 'dark'
        ? 'bg-green-600 text-white hover:bg-green-700'
        : 'bg-green-500 text-white hover:bg-green-600'
    } else if (saveState === 'error') {
      colorStyles = theme === 'dark'
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-red-500 text-white hover:bg-red-600'
    } else {
      // Teal colors for both themes
      colorStyles = theme === 'dark'
        ? 'bg-teal-500 text-gray-900 hover:bg-teal-400 shadow-md hover:shadow-lg'
        : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md hover:shadow-lg'
    }
    
    return `${baseStyles} ${sizeStyles} ${colorStyles}`
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleSave}
        disabled={saveState === 'saving' || !walletAddress || !onSaveProgress}
        className={getButtonStyles()}
        title={!walletAddress ? 'Sign in to save' : !onSaveProgress ? 'Save not available' : 'Save all forms to your profile'}
      >
        {renderIcon()}
        <span>{getButtonText()}</span>
      </button>
      
      {lastSaved && saveState === 'idle' && (
        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Last saved: {lastSaved.toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}
