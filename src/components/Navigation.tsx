'use client'

import { useState } from 'react'
import { LayoutDashboard, Coins } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import MvrStatusBadge from './MvrStatusBadge'

// Define the navigation page type
type NavPage =
  | 'signin'
  | 'resume'
  | 'dotapp'
  | 'jobs'
  | 'applications'
  | 'home'
  | 'hub'
  | 'veree'

interface NavigationProps {
  isAuthenticated?: boolean
  userRole?: 'driver' | 'developer' | 'employer' | null
  onStatusClick?: () => void
  onNavigate?: (page: NavPage) => void
  mvrWalletAddress?: string | null
  tHasUnread?: boolean
  onTClick?: () => void
  /** StormChain token balance for drivers - shown in nav */
  stormTokens?: number
}

export default function Navigation({
  isAuthenticated = false,
  userRole,
  onStatusClick,
  onNavigate,
  mvrWalletAddress,
  tHasUnread = false,
  onTClick,
  stormTokens = 0,
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { theme } = useTheme()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleNavigation = (page: NavPage) => {
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
    <header
      className='sticky top-4 z-50 px-4 sm:px-6 pointer-events-none'
      style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
    >
      <nav className={`${navClasses} pointer-events-auto`}>
        {/* Extra depth layer - inner shadow */}
        <div className={innerShadowClasses} />

        {/* Outer glow effect */}
        <div className={glowClasses} />

        <div className='relative px-4 sm:px-8 py-4 sm:py-6'>
          <div className='flex flex-col gap-3 sm:gap-4'>
            {/* Top Row: Logo and Status */}
            <div className='flex items-center justify-between gap-2 sm:gap-4'>
              {/* User Status Indicator and Home Button - Left */}
              <div className='flex-shrink-0 flex items-center gap-1.5 sm:gap-2'>
                {isAuthenticated ? (
                  <>
                    {/* Logged In Status Button with Elevated Glowing Effect */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onStatusClick?.()
                      }}
                      className='relative group flex flex-col items-center space-y-1 sm:space-y-1.5 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-brand-sage/90 backdrop-blur-sm hover:bg-brand-sage/95 hover:border-brand-mint/70 transition-all duration-300 border-2 border-white/30 cursor-pointer'
                      aria-label='View account status'
                      style={{
                        boxShadow:
                          '0 0 20px rgba(255, 255, 255, 0.25), 0 0 40px rgba(255, 255, 255, 0.15), 0 0 60px rgba(255, 255, 255, 0.05), inset 0 0 15px rgba(255, 255, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      {/* Green dot */}
                      <div className='w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50' />

                      {/* "Wallet" text */}
                      <span className='text-[10px] sm:text-xs text-brand-cream/90 font-medium'>
                        Wallet
                      </span>

                      {/* Tooltip */}
                      <div className='absolute left-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none'>
                        Click to view wallet
                      </div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleNavigation('signin')}
                    className={`px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer ${
                      theme === 'light'
                        ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark'
                        : 'text-brand-cream bg-brand-mint/20 hover:bg-brand-mint/30 border-brand-mint/40 hover:border-brand-mint/60'
                    }`}
                  >
                    Sign In
                  </button>
                )}
              </div>

              {/* Logo - Slightly Left of Center */}
              <div className='flex-1 flex justify-center min-w-0 -ml-0 sm:-ml-12'>
                <h1
                  className={`text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-wide ${
                    theme === 'light'
                      ? 'text-gray-800 drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                      : 'text-brand-cream drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
                  }`}
                >
                  StormChain
                </h1>
              </div>

              {/* AvA Assistant Indicator (Dynamic Island) and Theme Toggle - Right */}
              <div className='flex-shrink-0 flex justify-end items-center gap-2'>
                {/* AvA Assistant Dynamic Island */}
                {isAuthenticated && onTClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      if (onTClick) {
                        onTClick()
                      }
                    }}
                    className={`hidden md:flex relative group items-center justify-center px-4 py-2.5 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 cursor-pointer ${
                      theme === 'light'
                        ? 'bg-gradient-to-br from-brand-sage to-brand-sage-dark backdrop-blur-sm hover:from-brand-sage-dark hover:to-brand-sage border-brand-sage/60 shadow-lg shadow-brand-sage/30'
                        : 'bg-gradient-to-br from-brand-mint/30 to-brand-sage-light/20 backdrop-blur-sm hover:from-brand-mint/40 hover:to-brand-sage-light/30 border-brand-mint/50 shadow-lg shadow-brand-mint/20'
                    } ${tHasUnread ? 'animate-pulse' : ''}`}
                    aria-label='Open AvA Assistant'
                    type='button'
                    style={{
                      boxShadow:
                        theme === 'light'
                          ? '0 0 25px rgba(107, 142, 35, 0.4), 0 8px 24px rgba(0, 0, 0, 0.2)'
                          : '0 0 25px rgba(20, 184, 166, 0.3), 0 8px 24px rgba(0, 0, 0, 0.3)',
                      pointerEvents: 'auto',
                      zIndex: 9999,
                    }}
                  >
                    <span
                      className={`text-sm font-bold tracking-wide ${
                        theme === 'light'
                          ? 'text-white drop-shadow-md'
                          : 'text-brand-cream drop-shadow-md'
                      }`}
                    >
                      AvA
                    </span>
                    {tHasUnread && (
                      <span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-lg' />
                    )}
                    {/* Tooltip */}
                    <div className='absolute right-0 top-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50'>
                      {tHasUnread
                        ? 'AvA has a new message'
                        : 'Open AvA Assistant'}
                    </div>
                  </button>
                )}
                <button
                  onClick={toggleMenu}
                  className='md:hidden p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-brand-sage/60 backdrop-blur-sm hover:bg-brand-sage/80 hover:border-brand-mint/70 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer'
                  aria-label='Toggle menu'
                >
                  <div className='w-4 h-4 sm:w-5 sm:h-5 flex flex-col justify-center items-center gap-1'>
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

            {/* Bottom Row: Navigation Links */}
            <div
              className={`${
                isMenuOpen ? 'flex' : 'hidden'
              } md:flex flex-col md:flex-row items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-brand-mint/30 relative`}
            >
              {/* MVR Status Badge - Shows status without being a button */}
              {isAuthenticated && userRole === 'driver' && mvrWalletAddress && (
                <div className='w-full md:w-auto flex justify-center md:justify-start'>
                  <MvrStatusBadge walletAddress={mvrWalletAddress} />
                </div>
              )}

              {/* Mobile-only T Assistant access - Second on mobile */}
              {isAuthenticated && onTClick && (
                <button
                  onClick={() => {
                    onTClick()
                    setIsMenuOpen(false)
                  }}
                  className={`md:hidden w-full px-4 py-2 text-xs font-medium rounded-lg border transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                    theme === 'light'
                      ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105'
                      : 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105'
                  }`}
                >
                  <span className='text-sm'>🤖</span>
                  <span>
                    {tHasUnread ? 'AvA has updates' : 'Chat with AvA'}
                  </span>
                  {tHasUnread && (
                    <span className='ml-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse' />
                  )}
                </button>
              )}

              {/* Driver Hub Button - Center position with gold rotating border */}
              {userRole === 'driver' && isAuthenticated && (
                <div className='relative md:absolute md:left-1/2 md:-translate-x-1/2 w-full md:w-auto'>
                  <div className='rotating-gold-border w-full md:w-auto'>
                    <button
                      onClick={() => {
                        handleNavigation('hub')
                        setIsMenuOpen(false)
                      }}
                      className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-[10px] flex items-center justify-center gap-2 relative z-10 cursor-pointer ${
                        theme === 'dark'
                          ? 'text-brand-cream bg-brand-sage-light/20'
                          : 'text-white bg-brand-sage shadow-lg'
                      }`}
                    >
                      <LayoutDashboard className='w-4 h-4' />
                      Driver Hub
                    </button>
                  </div>
                </div>
              )}

              {/* Employer Hub Button - Center position with gold rotating border */}
              {userRole === 'employer' && isAuthenticated && (
                <div className='relative md:absolute md:left-1/2 md:-translate-x-1/2 w-full md:w-auto'>
                  <div className='rotating-gold-border w-full md:w-auto'>
                    <button
                      onClick={() => {
                        handleNavigation('hub')
                        setIsMenuOpen(false)
                      }}
                      className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-[10px] flex items-center justify-center gap-2 relative z-10 cursor-pointer ${
                        theme === 'dark'
                          ? 'text-brand-cream bg-brand-sage-light/20'
                          : 'text-white bg-brand-sage shadow-lg'
                      }`}
                    >
                      <LayoutDashboard className='w-4 h-4' />
                      Employer Hub
                    </button>
                  </div>
                </div>
              )}

              {/* Developer Hub Button - Center position with purple/indigo border */}
              {userRole === 'developer' && isAuthenticated && (
                <div className='relative md:absolute md:left-1/2 md:-translate-x-1/2 w-full md:w-auto'>
                  <div className='rotating-gold-border w-full md:w-auto'>
                    <button
                      onClick={() => {
                        handleNavigation('hub')
                        setIsMenuOpen(false)
                      }}
                      className={`w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-[10px] flex items-center justify-center gap-2 relative z-10 cursor-pointer ${
                        theme === 'dark'
                          ? 'text-brand-cream bg-indigo-600/30'
                          : 'text-white bg-indigo-600 shadow-lg'
                      }`}
                    >
                      <LayoutDashboard className='w-4 h-4' />
                      Developer Hub
                    </button>
                  </div>
                </div>
              )}

              {/* StormChain Token Counter & Theme Toggle - Bottom Right */}
              <div className='w-full md:w-auto flex items-center justify-end gap-3 md:ml-auto'>
                {/* Show Token counter for drivers and developers - employers don't earn tokens */}
                {(userRole === 'driver' || userRole === 'developer') && (
                  <button
                    onClick={() => handleNavigation('veree')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 cursor-pointer ${
                      theme === 'light'
                        ? 'text-brand-sage bg-brand-sage/10 hover:bg-brand-sage/20 border border-brand-sage/20'
                        : 'text-brand-mint bg-brand-mint/10 hover:bg-brand-mint/20 border border-brand-mint/30'
                    }`}
                    title='View StormChain tokens'
                  >
                    <Coins className='w-3.5 h-3.5' />
                    <span className='font-mono'>
                      {stormTokens.toLocaleString()}
                    </span>
                    <span className='hidden sm:inline text-[10px] opacity-70'>
                      STORM
                    </span>
                  </button>
                )}
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
