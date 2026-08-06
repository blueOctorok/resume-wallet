'use client'

/**
 * Provven marketing landing page — composition only.
 *
 * Story: Hero (promise + product demo) → Problem → Career Card →
 * Selective Disclosure (money shot) → How It Works → Employers →
 * Built for Trust → Final CTA. Each section owns one job; see README.md.
 *
 * Replaces the old HomePage.tsx. Keeps the same props contract so
 * DriverShell wires it identically.
 */

import { useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import HeroSection from './HeroSection'
import ProblemSection from './ProblemSection'
import CareerCardSection from './CareerCardSection'
import DisclosureSection from './DisclosureSection'
import HowItWorksSection from './HowItWorksSection'
import EmployersSection from './EmployersSection'
import TrustSection from './TrustSection'
import FinalCtaSection from './FinalCtaSection'

interface LandingPageProps {
  isAuthenticated: boolean
  /** Primary CTA — sign-in / hub */
  onGetStarted: () => void
  /** Guest: open public Guided Mode (no account required to browse) */
  onBrowseJobs?: () => void
}

/**
 * Scroll-reveal: containers marked `data-reveal` get a `revealed` class when
 * they enter the viewport; children with `.reveal-item` transition in
 * (staggered via inline transition-delay). Reduced motion shows instantly.
 */
function useScrollReveal() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 },
    )

    container.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return containerRef
}

export default function LandingPage({ isAuthenticated, onGetStarted, onBrowseJobs }: LandingPageProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const revealRef = useScrollReveal()

  const scrollToEmployers = () => {
    document.getElementById('employers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={revealRef} className='relative z-10'>
      <HeroSection
        isAuthenticated={isAuthenticated}
        onGetStarted={onGetStarted}
        onForEmployers={scrollToEmployers}
        onBrowseJobs={onBrowseJobs}
      />
      <ProblemSection isDark={isDark} />
      <CareerCardSection isDark={isDark} />
      <DisclosureSection />
      <HowItWorksSection isDark={isDark} />
      <EmployersSection isDark={isDark} onGetStarted={onGetStarted} />
      <TrustSection />
      <FinalCtaSection
        isDark={isDark}
        isAuthenticated={isAuthenticated}
        onGetStarted={onGetStarted}
        onForEmployers={scrollToEmployers}
      />

      {/* Motion: hero entrance + scroll reveals. Both honor prefers-reduced-motion. */}
      <style jsx global>{`
        @keyframes lpRise {
          from {
            opacity: 0;
            transform: translateY(28px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .lp-rise {
          animation: lpRise 0.85s cubic-bezier(0.2, 0.7, 0.3, 1) both;
        }
        .reveal-item {
          opacity: 0;
          transform: translateY(24px);
          transition:
            opacity 0.7s ease,
            transform 0.7s ease;
        }
        .revealed .reveal-item,
        .reveal-item.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-rise {
            animation: none;
          }
          .reveal-item {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
