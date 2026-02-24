'use client'

import { useCallback, useEffect } from 'react'
import { X, CheckCircle, FileText, Briefcase, Truck, FileCheck, Send, Building, Users, Code, Github, Star, Search } from 'lucide-react'
import { useUIStore, usePreferencesStore } from '@/stores'
import { getJourneyStep, type JourneyStep, type JourneyAction } from '@/lib/journey-config'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

const ICONS = {
  CheckCircle,
  FileText,
  Briefcase,
  Truck,
  FileCheck,
  Send,
  Building,
  Users,
  Code,
  Github,
  Star,
  Search,
}

/**
 * JourneyModal - Shows guided "what's next" prompts after key actions.
 * 
 * Renders when `showJourneyModal` is true in UI store.
 * Checks preferences to respect user's toggle setting.
 */
export default function JourneyModal() {
  const { theme } = useTheme()
  const { 
    activeJourneyStep, 
    showJourneyModal, 
    dismissJourneyModal,
    setCurrentPage,
  } = useUIStore()
  
  const { 
    showJourneyModals, 
    setShowJourneyModals,
    hasCompletedJourneyStep,
    markJourneyStepComplete,
  } = usePreferencesStore()

  // Get the step config
  const step = activeJourneyStep ? getJourneyStep(activeJourneyStep) : null

  // Check if this step should show
  const shouldShow = useCallback(() => {
    if (!showJourneyModal || !step || !showJourneyModals) return false
    
    // If it's a "show once" step, check if already completed
    if (step.showOnce && hasCompletedJourneyStep(step.id)) {
      return false
    }
    
    return true
  }, [showJourneyModal, step, showJourneyModals, hasCompletedJourneyStep])

  // Auto-dismiss if preferences say don't show
  useEffect(() => {
    if (showJourneyModal && !shouldShow()) {
      dismissJourneyModal()
    }
  }, [showJourneyModal, shouldShow, dismissJourneyModal])

  // Handle next step action
  const handleNextStep = useCallback(() => {
    if (!step?.nextStep) return
    
    const action = step.nextStep.action
    
    // Mark as completed if it's a show-once step
    if (step.showOnce) {
      markJourneyStepComplete(step.id)
    }
    
    // Execute the action
    if (action.type === 'navigate' && action.target) {
      setCurrentPage(action.target)
    }
    
    dismissJourneyModal()
  }, [step, markJourneyStepComplete, setCurrentPage, dismissJourneyModal])

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    if (step?.showOnce) {
      markJourneyStepComplete(step.id)
    }
    dismissJourneyModal()
  }, [step, markJourneyStepComplete, dismissJourneyModal])

  // Handle "don't show again"
  const handleDisableJourneyModals = useCallback(() => {
    setShowJourneyModals(false)
    dismissJourneyModal()
  }, [setShowJourneyModals, dismissJourneyModal])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showJourneyModal) {
        handleDismiss()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showJourneyModal, handleDismiss])

  if (!shouldShow() || !step) return null

  const IconComponent = ICONS[step.icon] || CheckCircle

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      
      {/* Modal */}
      <div 
        className={cn(
          'relative w-full max-w-md rounded-2xl shadow-2xl',
          'transform transition-all duration-300 ease-out',
          'animate-in fade-in zoom-in-95',
          theme === 'dark' 
            ? 'bg-gray-800 border border-gray-700' 
            : 'bg-white border border-gray-200'
        )}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className={cn(
            'absolute top-4 right-4 p-1 rounded-full transition-colors',
            theme === 'dark'
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          )}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Icon */}
          <div className={cn(
            'mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4',
            'bg-gradient-to-br from-brand-mint/20 to-indigo-500/20',
            'border-2 border-brand-mint/30'
          )}>
            <IconComponent className="w-8 h-8 text-brand-mint" />
          </div>

          {/* Title */}
          <h2 className={cn(
            'text-xl font-bold mb-2',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {step.title}
          </h2>

          {/* Message */}
          <p className={cn(
            'text-sm mb-6',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          )}>
            {step.message}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {step.nextStep && (
              <button
                onClick={handleNextStep}
                className={cn(
                  'w-full px-6 py-3 rounded-xl font-semibold transition-all duration-200',
                  'bg-brand-mint hover:bg-brand-mint/90 text-gray-900',
                  'shadow-lg hover:shadow-xl hover:scale-[1.02]'
                )}
              >
                {step.nextStep.label}
              </button>
            )}

            <button
              onClick={handleDismiss}
              className={cn(
                'w-full px-6 py-3 rounded-xl font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              )}
            >
              Got it
            </button>
          </div>

          {/* Don't show again link */}
          <button
            onClick={handleDisableJourneyModals}
            className={cn(
              'mt-4 text-xs transition-colors',
              theme === 'dark' 
                ? 'text-gray-500 hover:text-gray-400' 
                : 'text-gray-400 hover:text-gray-500'
            )}
          >
            Don&apos;t show these tips again
          </button>
        </div>
      </div>
    </div>
  )
}
