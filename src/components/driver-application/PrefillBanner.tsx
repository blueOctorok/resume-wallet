'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { FileText, Car, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'

interface PrefillBannerProps {
  onPrefillFromResume?: () => Promise<void>
  onPrefillFromMvr?: () => Promise<void>
  hasResume?: boolean
  hasMvr?: boolean
  onDismiss?: () => void
  onNavigate?: (page: 'resume' | 'mvr') => void
}

export default function PrefillBanner({
  onPrefillFromResume,
  onPrefillFromMvr,
  hasResume = false,
  hasMvr = false,
  onDismiss,
  onNavigate,
}: PrefillBannerProps) {
  const { theme } = useTheme()
  const [isResumePrefilling, setIsResumePrefilling] = useState(false)
  const [isMvrPrefilling, setIsMvrPrefilling] = useState(false)
  const [prefillComplete, setPrefillComplete] = useState(false)
  // Note: Banner is always visible when on step 1 - no dismissal needed

  const handleResumePrefill = async () => {
    console.log('🔵 [PREFILL BANNER] Resume button clicked')
    console.log('🔵 [PREFILL BANNER] onPrefillFromResume handler exists?', !!onPrefillFromResume)
    
    if (!onPrefillFromResume) {
      console.error('❌ [PREFILL BANNER] No onPrefillFromResume handler provided!')
      return
    }
    
    console.log('🔵 [PREFILL BANNER] Calling onPrefillFromResume handler...')
    setIsResumePrefilling(true)
    try {
      await onPrefillFromResume()
      console.log('✅ [PREFILL BANNER] onPrefillFromResume completed successfully')
      setPrefillComplete(true)
      setTimeout(() => {
        setPrefillComplete(false)
      }, 3000)
    } catch (error) {
      console.error('❌ [PREFILL BANNER] Resume prefill error:', error)
    } finally {
      setIsResumePrefilling(false)
    }
  }

  const handleMvrPrefill = async () => {
    console.log('🟣 [PREFILL BANNER] MVR button clicked')
    console.log('🟣 [PREFILL BANNER] onPrefillFromMvr handler exists?', !!onPrefillFromMvr)
    
    if (!onPrefillFromMvr) {
      console.error('❌ [PREFILL BANNER] No onPrefillFromMvr handler provided!')
      return
    }
    
    console.log('🟣 [PREFILL BANNER] Calling onPrefillFromMvr handler...')
    setIsMvrPrefilling(true)
    try {
      await onPrefillFromMvr()
      console.log('✅ [PREFILL BANNER] onPrefillFromMvr completed successfully')
      setPrefillComplete(true)
      setTimeout(() => {
        setPrefillComplete(false)
      }, 3000)
    } catch (error) {
      console.error('❌ [PREFILL BANNER] MVR prefill error:', error)
    } finally {
      setIsMvrPrefilling(false)
    }
  }


  return (
    <div
      className={`mb-8 rounded-2xl border-2 p-6 shadow-xl backdrop-blur-sm ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-teal-600/20 via-teal-200/10 to-brand-cream/10 border-teal-500/40'
          : 'bg-gradient-to-br from-teal-700/10 via-brand-cream/20 to-teal-500/10 border-teal-700/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              theme === 'dark'
                ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400'
                : 'bg-teal-700/20 text-teal-800 dark:text-teal-300'
            }`}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3
              className={`text-xl font-bold mb-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              ⚡ Quick Start: Auto-Fill Your Application
            </h3>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Save time by automatically filling your application from your resume or MVR
            </p>
          </div>
        </div>
      </div>

      {/* Prefill Options */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Resume Prefill */}
        <button
          onClick={handleResumePrefill}
          disabled={isResumePrefilling || isMvrPrefilling}
          className={`group relative p-5 rounded-xl border-2 transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-lg cursor-pointer ${
            theme === 'dark'
              ? hasResume
                ? 'bg-teal-200/10 border-teal-500/30 hover:border-teal-500/50'
                : 'bg-gray-800/50 border-gray-700'
              : hasResume
                ? 'bg-white border-teal-700/30 hover:border-teal-700/50'
                : 'bg-gray-100 border-gray-300'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                theme === 'dark'
                  ? hasResume
                    ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400'
                    : 'bg-gray-700 text-gray-500'
                  : hasResume
                    ? 'bg-teal-700/20 text-teal-800 dark:text-teal-300'
                    : 'bg-gray-200 text-gray-400'
              }`}
            >
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h4
                  className={`font-bold text-lg ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  From Resume
                </h4>
                {prefillComplete && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {isResumePrefilling && (
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                )}
              </div>
              <p
                className={`text-sm mb-3 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {hasResume
                  ? 'Extract name, contact info, work history, and education from your uploaded resume'
                  : 'Click to upload a resume and use auto-fill'}
              </p>
              {hasResume && (
                <div
                  className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400'
                      : 'bg-teal-700/20 text-teal-800 dark:text-teal-300'
                  }`}
                >
                  <span>✓ Resume Available</span>
                </div>
              )}
            </div>
          </div>
        </button>

        {/* MVR Prefill */}
        <button
          onClick={handleMvrPrefill}
          disabled={isMvrPrefilling || isResumePrefilling}
          className={`group relative p-5 rounded-xl border-2 transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-lg cursor-pointer ${
            theme === 'dark'
              ? hasMvr
                ? 'bg-teal-200/10 border-teal-500/30 hover:border-teal-500/50'
                : 'bg-gray-800/50 border-gray-700'
              : hasMvr
                ? 'bg-white border-teal-700/30 hover:border-teal-700/50'
                : 'bg-gray-100 border-gray-300'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                theme === 'dark'
                  ? hasMvr
                    ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400'
                    : 'bg-gray-700 text-gray-500'
                  : hasMvr
                    ? 'bg-teal-700/20 text-teal-800 dark:text-teal-300'
                    : 'bg-gray-200 text-gray-400'
              }`}
            >
              <Car className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h4
                  className={`font-bold text-lg ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  From MVR
                </h4>
                {prefillComplete && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {isMvrPrefilling && (
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                )}
              </div>
              <p
                className={`text-sm mb-3 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {hasMvr
                  ? 'Fill license number, state, class, endorsements, and personal info from your verified MVR'
                  : 'Click to order an MVR and use auto-fill'}
              </p>
              {hasMvr && (
                <div
                  className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-teal-600/20 text-teal-600 dark:text-teal-400'
                      : 'bg-teal-700/20 text-teal-800 dark:text-teal-300'
                  }`}
                >
                  <span>✓ MVR Available</span>
                </div>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Info Message */}
      <div
        className={`p-4 rounded-lg ${
          theme === 'dark'
            ? 'bg-teal-600/10 border border-teal-500/20'
            : 'bg-teal-700/10 border border-teal-700/20'
        }`}
      >
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          <strong>💡 Tip:</strong> You can use both options! MVR fills verified license
          information, while resume fills work history and education. You can always edit
          the information after prefilling.
        </p>
      </div>
    </div>
  )
}

