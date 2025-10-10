'use client'

import { useState } from 'react'

interface NavigationProps {
  isAuthenticated?: boolean
  onStatusClick?: () => void
}

export default function Navigation({
  isAuthenticated = false,
  onStatusClick,
}: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <header className='sticky top-4 z-50 px-4 sm:px-6'>
      <nav className='max-w-2xl mx-auto bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 relative'>
        {/* Extra depth layer - inner shadow */}
        <div className='absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none' />

        {/* Outer glow effect */}
        <div className='absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10' />

        <div className='relative px-6 sm:px-8 py-5 sm:py-6'>
          <div className='flex items-center justify-between'>
            {/* User Status Indicator - Left */}
            <div className='w-20'>
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
            <div className='flex-1 flex justify-center md:justify-center'>
              <h1 className='text-3xl sm:text-4xl lg:text-5xl font-extralight text-brand-cream drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] tracking-wide'>
                Veree
              </h1>
            </div>

            {/* Mobile Menu Button - Right */}
            <button
              onClick={toggleMobileMenu}
              className='md:hidden p-2.5 rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl'
              aria-label='Toggle mobile menu'
            >
              <div className='w-5 h-5 flex flex-col justify-center items-center gap-1'>
                <div
                  className={`w-full h-0.5 bg-white transition-all duration-300 ${
                    isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                  }`}
                />
                <div
                  className={`w-full h-0.5 bg-white transition-all duration-300 ${
                    isMobileMenuOpen ? 'opacity-0' : ''
                  }`}
                />
                <div
                  className={`w-full h-0.5 bg-white transition-all duration-300 ${
                    isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className='md:hidden mt-6 pt-6 border-t border-brand-mint/30'>
              <div className='space-y-2'>
                <p className='text-brand-cream/70 text-sm text-center py-2'>
                  Menu items coming soon
                </p>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
