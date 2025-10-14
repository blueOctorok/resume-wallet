'use client'

import { useState } from 'react'

interface NavigationProps {
  isAuthenticated?: boolean
  onStatusClick?: () => void
  onNavigate?: (page: 'signin' | 'resume' | 'dotapp') => void
}

export default function Navigation({
  isAuthenticated = false,
  onStatusClick,
  onNavigate,
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleNavigation = (page: 'signin' | 'resume' | 'dotapp') => {
    setIsMenuOpen(false)
    onNavigate?.(page)
  }

  return (
    <header className='sticky top-4 z-50 px-4 sm:px-6'>
      <nav className='max-w-2xl mx-auto bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 relative'>
        {/* Extra depth layer - inner shadow */}
        <div className='absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none' />

        {/* Outer glow effect */}
        <div className='absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10' />

        <div className='relative px-6 sm:px-8 py-5 sm:py-6'>
          <div className='flex flex-col gap-4'>
            {/* Top Row: Logo and Status */}
            <div className='flex items-center justify-between'>
              {/* User Status Indicator - Left (always takes space to center logo) */}
              <div className='w-20 flex justify-start'>
                {isAuthenticated && (
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
                )}
              </div>

              {/* Logo - Center */}
              <div className='flex-1 flex justify-center'>
                <h1 className='text-3xl sm:text-4xl lg:text-5xl font-extralight text-brand-cream drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] tracking-wide'>
                  Veree
                </h1>
              </div>

              {/* Mobile Menu Button - Right (always takes space to center logo) */}
              <div className='w-20 flex justify-end'>
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
              } md:flex flex-col md:flex-row justify-center items-center gap-3 pt-4 border-t border-brand-mint/30`}
            >
              {!isAuthenticated && (
                <button
                  onClick={() => handleNavigation('signin')}
                  className='w-full md:w-auto px-6 py-2.5 text-sm font-semibold text-brand-cream bg-brand-mint/20 hover:bg-brand-mint/30 rounded-xl border border-brand-mint/40 hover:border-brand-mint/60 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105'
                >
                  Sign In
                </button>
              )}
              <button
                onClick={() => isAuthenticated && handleNavigation('resume')}
                disabled={!isAuthenticated}
                className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
                  isAuthenticated
                    ? 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
                    : 'text-brand-cream/40 bg-brand-sage-light/10 border-brand-cream/20 cursor-not-allowed'
                }`}
              >
                Resume
              </button>
              <button
                onClick={() => isAuthenticated && handleNavigation('dotapp')}
                disabled={!isAuthenticated}
                className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
                  isAuthenticated
                    ? 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
                    : 'text-brand-cream/40 bg-brand-sage-light/10 border-brand-cream/20 cursor-not-allowed'
                }`}
              >
                DOT App
              </button>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
