'use client'

import { useState } from 'react'
import WalletCard from './WalletCard'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'

interface NavigationProps {
  isAuthenticated?: boolean
  user?: {
    address: string
    message?: string
    signature?: string
    method?: string
  } | null
  onStatusClick?: () => void
  onWalletClick?: () => void
  onNavigate?: (page: 'signin' | 'resume' | 'dotapp' | 'home') => void
  tHasUnread?: boolean
  onTClick?: () => void
}

export default function Navigation({
  isAuthenticated = false,
  user,
  onStatusClick,
  onWalletClick,
  onNavigate,
  tHasUnread = false,
  onTClick,
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { theme } = useTheme()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleNavigation = (page: 'signin' | 'resume' | 'dotapp' | 'home') => {
    console.log(`🔗 [NAVIGATION] handleNavigation called with page:`, page)
    setIsMenuOpen(false)
    onNavigate?.(page)
  }

  // Theme-aware classes
  const navClasses =
    theme === 'light'
      ? 'max-w-2xl mx-auto bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-sage/40 relative'
      : 'max-w-2xl mx-auto bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 relative'

  const innerShadowClasses =
    theme === 'light'
      ? 'absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.1)] pointer-events-none'
      : 'absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none'

  const glowClasses =
    theme === 'light'
      ? 'absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-sage/20 to-transparent opacity-50 blur-sm -z-10'
      : 'absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10'

  return (
    <header className='sticky top-4 z-50 px-4 sm:px-6'>
      <nav className={navClasses}>
        {/* Extra depth layer - inner shadow */}
        <div className={innerShadowClasses} />

        {/* Outer glow effect */}
        <div className={glowClasses} />

        <div className='relative px-6 sm:px-8 py-5 sm:py-6'>
          <div className='flex flex-col gap-4'>
            {/* Top Row: Logo and Status */}
            <div className='flex items-center justify-between gap-4'>
              {/* User Status Indicator or Sign In Button - Left (always takes space to center logo) */}
              <div className='flex-shrink-0 w-24 flex justify-start'>
                {isAuthenticated ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onStatusClick?.()
                    }}
                    className='relative group flex flex-col items-center space-y-1.5 p-2.5 rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl border border-transparent'
                    aria-label='View account status'
                  >
                    {/* Blinking green dot */}
                    <div className='w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50' />

                    {/* "Logged in" text */}
                    <span className='text-xs text-brand-cream/90 font-medium'>
                      Logged in
                    </span>

                    {/* Tooltip */}
                    <div className='absolute left-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                      Click to view account
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => handleNavigation('signin')}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 ${
                      theme === 'light'
                        ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark'
                        : 'text-brand-cream bg-brand-mint/20 hover:bg-brand-mint/30 border-brand-mint/40 hover:border-brand-mint/60'
                    }`}
                  >
                    Sign In
                  </button>
                )}
              </div>

              {/* Logo - Center */}
              <div className='flex-1 flex justify-center min-w-0'>
                <h1
                  className={`text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-wide ${
                    theme === 'light'
                      ? 'text-gray-800 drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                      : 'text-brand-cream drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                  }`}
                >
                  Veree
                </h1>
              </div>

              {/* T Assistant Indicator (Dynamic Island) and Theme Toggle - Right */}
              <div className='flex-shrink-0 flex justify-end items-center gap-2'>
                {/* T Assistant Dynamic Island */}
                {isAuthenticated && onTClick && (
                  <button
                    onClick={onTClick}
                    className={`hidden md:flex relative group items-center justify-center p-2 rounded-full transition-all duration-300 ${
                      theme === 'light'
                        ? 'bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 border border-brand-sage/40'
                        : 'bg-brand-sage-light/20 backdrop-blur-sm hover:bg-brand-sage-light/30 border border-brand-mint/30'
                    } ${tHasUnread ? 'animate-pulse' : ''}`}
                    aria-label='Open T Assistant'
                  >
                    <span className={`text-lg ${theme === 'light' ? 'text-white' : 'text-brand-mint'}`}>
                      T
                    </span>
                    {tHasUnread && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white" />
                    )}
                    {/* Tooltip */}
                    <div className='absolute right-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                      {tHasUnread ? 'T has a new message' : 'Open T Assistant'}
                    </div>
                  </button>
                )}
                <div className='hidden md:flex'>
                  <ThemeToggle />
                </div>
                <button
                  onClick={toggleMenu}
                  className='md:hidden p-2.5 rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl'
                  aria-label='Toggle menu'
                >
                  <div className='w-5 h-5 flex flex-col justify-center items-center gap-1'>
                    <div
                      className={`w-full h-0.5 bg-white transition-all duration-300 ${
                        isMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                      }`}
                    />
                    <div
                      className={`w-full h-0.5 bg-white transition-all duration-300 ${
                        isMenuOpen ? 'opacity-0' : ''
                      }`}
                    />
                    <div
                      className={`w-full h-0.5 bg-white transition-all duration-300 ${
                        isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Row: Navigation Links (Desktop - always visible, Mobile - toggle) */}
            <div
              className={`${
                isMenuOpen ? 'flex' : 'hidden'
              } md:flex flex-col md:flex-row flex-wrap md:flex-nowrap justify-center items-center gap-4 md:gap-3 pt-4 border-t border-brand-mint/30`}
            >
              {/* Mobile Wallet Button - Leftmost position */}
              {isAuthenticated && user && (
                <WalletCard
                  user={user}
                  onClick={onWalletClick}
                  isMobile={true}
                />
              )}
              {/* Mobile-only T Assistant access */}
              {isAuthenticated && onTClick && (
                <button
                  onClick={() => {
                    onTClick()
                    setIsMenuOpen(false) // Close menu after clicking
                  }}
                  className={`md:hidden w-full px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 flex items-center justify-center gap-2 ${
                    theme === 'light'
                      ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105'
                      : 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105'
                  }`}
                >
                  <span className='text-base'>🤖</span>
                  <span>{tHasUnread ? 'T has updates' : 'Chat with T'}</span>
                  {tHasUnread && (
                    <span className='ml-1 w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                  )}
                </button>
              )}
              {/* Home Button - Always visible */}
              <button
                onClick={() => handleNavigation('home')}
                className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
                  theme === 'light'
                    ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105'
                    : 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105'
                }`}
              >
                🏠 Home
              </button>
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    handleNavigation('resume')
                  }
                }}
                disabled={!isAuthenticated}
                className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
                  isAuthenticated
                    ? theme === 'light'
                      ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
                      : 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
                    : theme === 'light'
                      ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
                      : 'text-brand-cream/40 bg-brand-sage-light/10 border-brand-cream/20 cursor-not-allowed'
                }`}
              >
                Resume
              </button>
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    handleNavigation('dotapp')
                  }
                }}
                disabled={!isAuthenticated}
                className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
                  isAuthenticated
                    ? theme === 'light'
                      ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
                      : 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
                    : theme === 'light'
                      ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
                      : 'text-brand-cream/40 bg-brand-sage-light/10 border-brand-cream/20 cursor-not-allowed'
                }`}
              >
                DOT App
              </button>
              {/* Mobile Theme Toggle */}
              <div className='w-full md:hidden flex justify-center'>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
