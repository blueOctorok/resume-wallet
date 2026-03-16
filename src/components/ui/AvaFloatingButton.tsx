'use client'

import { useEffect, useState } from 'react'
import { Bot, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJourneyStore, useJourneyProgress } from '@/stores'

/**
 * Floating button to summon the AvA Journey Guide
 * 
 * - Shows in bottom-right corner (offset left to avoid scroll-to-top button)
 * - Displays progress percentage badge
 * - Pulses when there are pending actions
 * - Keyboard shortcut: ? or Cmd+/
 */

export default function AvaFloatingButton() {
  const { isGuideOpen, toggleGuide, hasSeenWelcome, setHasSeenWelcome, openGuide } = useJourneyStore()
  const progress = useJourneyProgress()
  const [isHovered, setIsHovered] = useState(false)
  
  // Show pulsing animation when there are high-priority next actions
  const hasHighPriorityAction = progress.nextActions.some(a => a.priority === 'high')
  const shouldPulse = hasHighPriorityAction && !isGuideOpen
  
  // Auto-open on first visit (after a short delay for page load)
  const hasSteps = progress.steps.length > 0
  useEffect(() => {
    if (!hasSeenWelcome && hasSteps) {
      const timer = setTimeout(() => {
        openGuide()
        setHasSeenWelcome(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [hasSeenWelcome, hasSteps, openGuide, setHasSeenWelcome])
  
  // Keyboard shortcut: Cmd+/ or Ctrl+/ only
  // The `?` shortcut was removed because it conflicts with typing in the chat input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleGuide()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleGuide])
  
  // Don't show button if guide is already open
  if (isGuideOpen) return null
  
  return (
    <button
      onClick={toggleGuide}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'fixed z-50',
        // Mobile: above the scroll button | Desktop: left of the scroll button
        'bottom-20 right-6 sm:bottom-6 sm:right-24',
        'w-14 h-14 rounded-full',
        'bg-gradient-to-br from-brand-mint to-brand-mint/80',
        'dark:from-brand-mint dark:to-brand-mint/70',
        'shadow-lg shadow-brand-mint/25',
        'flex items-center justify-center',
        'transition-all duration-300 ease-out',
        'hover:scale-110 hover:shadow-xl hover:shadow-brand-mint/40',
        'active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-brand-mint/50 focus:ring-offset-2',
        'dark:focus:ring-offset-gray-900'
      )}
      aria-label="Open AvA Journey Guide"
    >
      {/* Pulse ring animation */}
      {shouldPulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full',
            'bg-brand-mint/50',
            'animate-ping'
          )}
          style={{ animationDuration: '2s' }}
        />
      )}
      
      {/* Icon */}
      <div className="relative">
        {isHovered ? (
          <Sparkles className="w-7 h-7 text-white" />
        ) : (
          <Bot className="w-7 h-7 text-white" />
        )}
      </div>
      
      {/* Progress badge */}
      {progress.overallProgress > 0 && progress.overallProgress < 100 && (
        <span
          className={cn(
            'absolute -top-1 -right-1',
            'min-w-[24px] h-6 px-1.5',
            'bg-white dark:bg-gray-800',
            'text-xs font-bold',
            'text-brand-mint',
            'rounded-full',
            'flex items-center justify-center',
            'shadow-md',
            'border-2 border-brand-mint/20'
          )}
        >
          {progress.overallProgress}%
        </span>
      )}
      
      {/* Completion checkmark */}
      {progress.overallProgress === 100 && (
        <span
          className={cn(
            'absolute -top-1 -right-1',
            'w-6 h-6',
            'bg-green-500',
            'rounded-full',
            'flex items-center justify-center',
            'shadow-md'
          )}
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </button>
  )
}
