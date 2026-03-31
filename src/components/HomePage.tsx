'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  ArrowRight,
  CreditCard,
  Shield,
  Zap,
  Sparkles,
  Truck,
  Code2,
  Wrench,
  FileText,
  ClipboardList,
  Car,
  Globe,
  Github,
  Search,
  FileCheck,
  Building2,
  Coins,
  BookOpen,
  TrendingUp,
  Gift,
  Briefcase,
  QrCode,
  CheckCircle,
  Mail,
  MapPin,
  Bot,
  Radar,
  BellRing,
  Layers,
  Link2,
  IdCard,
  UserCheck,
  MousePointerClick,
  Handshake,
  UserPlus,
} from 'lucide-react'
import StormChainView from '@/components/StormChainView'
import { VaultShowcase } from '@/components/hub/HubBlockVault'
import Button from '@/components/ui/Button'

interface HomePageProps {
  isAuthenticated: boolean
  onGetStarted: () => void
  /** Guest: open public job browse (no wallet) */
  onBrowseJobs?: () => void
}

// ── Vault showcase blocks — hero + section 3 (same topology as in-app hub) ───
const HIVE_BLOCKS = [
  { id: 'driver-dot-application', icon: ClipboardList, label: 'DOT App' },
  { id: 'driver-resume', icon: FileText, label: 'Resume' },
  { id: 'driver-mvr', icon: Car, label: 'MVR' },
  { id: 'general-resume', icon: FileText, label: 'Pro Resume' },
  { id: 'developer-portfolio', icon: Globe, label: 'Portfolio' },
  { id: 'developer-github', icon: Github, label: 'GitHub' },
  { id: 'driver-cdl-credentials', icon: IdCard, label: 'CDL' },
]

// ── Scroll-reveal hook ───────────────────────────────────────────────────────
// Elements with data-reveal fade+slide in when they enter the viewport.
// Accepts a `reattachKey` — when it changes (e.g. returning from whitepaper),
// the effect re-runs and observes the fresh DOM nodes.
function useScrollReveal(reattachKey: unknown) {
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
      { threshold: 0.15 }
    )

    container.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [reattachKey])

  return containerRef
}

// ── Glass card wrapper ───────────────────────────────────────────────────────
function GlassCard({ children, className = '', isDark }: {
  children: React.ReactNode
  className?: string
  isDark: boolean
}) {
  return (
    <div className={`rounded-2xl border backdrop-blur-md transition-all duration-300 ${
      isDark
        ? 'bg-white/[0.04] border-white/[0.08]'
        : 'bg-white/60 border-white/40'
    } ${className}`}>
      {children}
    </div>
  )
}

// ── Career Card mockup ───────────────────────────────────────────────────────
// Pure visual showing what a completed Career Card looks like.
function CareerCardMockup({ isDark }: { isDark: boolean }) {
  const cardBg = isDark ? 'bg-gray-900/80 border-white/[0.08]' : 'bg-white/80 border-gray-200'
  const subtleBg = isDark ? 'bg-gray-800/60' : 'bg-gray-100/80'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500'

  return (
    <div
      className={`relative w-[300px] sm:w-[360px] rounded-2xl border backdrop-blur-md p-5 sm:p-6 shadow-2xl ${cardBg}`}
      style={{ animation: 'card-float 6s ease-in-out infinite alternate' }}
    >
      <div className='absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-teal-400/20 via-transparent to-cyan-400/20 -z-10 blur-sm' />

      {/* Header */}
      <div className='flex items-center gap-3 mb-4'>
        <div className='w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg'>
          JD
        </div>
        <div>
          <p className={`font-bold text-sm ${textPrimary}`}>Jane Doe</p>
          <p className={`text-xs ${textMuted}`}>CDL-A Driver · 8 years exp.</p>
        </div>
        <div className='ml-auto'>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${subtleBg}`}>
            <QrCode className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className={`rounded-lg p-2.5 mb-4 ${subtleBg}`}>
        <div className='flex items-center justify-between mb-1.5'>
          <span className={`text-xs font-medium ${textPrimary}`}>Profile Completeness</span>
          <span className='text-xs font-bold text-green-400'>92%</span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div className='h-full w-[92%] rounded-full bg-gradient-to-r from-teal-400 to-green-400' />
        </div>
      </div>

      {/* Credential badges */}
      <div className='flex flex-wrap gap-1.5 mb-4'>
        {['Resume', 'DOT App', 'MVR', 'Skills'].map((label) => (
          <span key={label} className='flex items-center gap-1 px-2 py-0.5 rounded-full'>
            <CheckCircle className='w-3 h-3 text-green-400' />
            <span className={`text-[10px] font-semibold ${textPrimary}`}>{label}</span>
          </span>
        ))}
      </div>

      {/* Mock sections */}
      <div className='space-y-2.5'>
        <div className={`rounded-lg p-2.5 ${subtleBg}`}>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-1.5'>
              <Mail className={`w-3 h-3 ${textMuted}`} />
              <span className={`text-[10px] ${textMuted}`}>jane@email.com</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <MapPin className={`w-3 h-3 ${textMuted}`} />
              <span className={`text-[10px] ${textMuted}`}>Dallas, TX</span>
            </div>
          </div>
        </div>

        <div className={`rounded-lg p-2.5 ${subtleBg}`}>
          <p className={`text-[10px] font-semibold mb-1 ${textPrimary}`}>Work History</p>
          <div className='flex items-center gap-2'>
            <Briefcase className={`w-3 h-3 ${textMuted}`} />
            <span className={`text-[10px] ${textMuted}`}>Werner Enterprises · 2019 – Present</span>
            <CheckCircle className='w-3 h-3 text-green-400 ml-auto' />
          </div>
        </div>

        <div className='flex items-center justify-center gap-1.5 pt-1'>
          <Shield className={`w-3 h-3 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <span className={`text-[10px] font-medium ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
            Verified on Storm
          </span>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── HomePage ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export default function HomePage({ isAuthenticated, onGetStarted, onBrowseJobs }: HomePageProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [showWhitepaper, setShowWhitepaper] = useState(false)
  const revealRef = useScrollReveal(showWhitepaper)

  const openWhitepaper = () => {
    setShowWhitepaper(true)
    window.scrollTo({ top: 0 })
  }
  const closeWhitepaper = () => {
    setShowWhitepaper(false)
    window.scrollTo({ top: 0 })
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  if (showWhitepaper) {
    return <StormChainView onBack={closeWhitepaper} backLabel='Back to Home' />
  }

  return (
    <>
      {/*
        Iridescent film — sits above StormBackground vault canvas (z-[-3]) + bubbles (z-[-1]) but below
        this page’s content (z-10). Light mode has bubbles only (no cloud). Slow spin reads as
        shifting teal / indigo / violet without competing with readability. prefers-reduced-motion: static wash, no spin.
      */}
      <div
        aria-hidden
        className='pointer-events-none fixed inset-0 z-[5] overflow-hidden mix-blend-soft-light dark:mix-blend-soft-light'
      >
        {/* Muted iridescence: low layer opacity + softer stops + extra blur so color stays a whisper */}
        <div className='absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2'>
          <div
            className='h-[min(200vmin,120rem)] w-[min(200vmin,120rem)] blur-[110px] sm:blur-[150px] opacity-[0.2] dark:opacity-[0.16] motion-reduce:animate-none animate-spin [animation-duration:100s]'
            style={{
              background: `conic-gradient(from 45deg at 50% 50%,
                rgba(45,212,191,0.42) 0deg,
                rgba(56,189,248,0.36) 50deg,
                rgba(99,102,241,0.4) 110deg,
                rgba(167,139,250,0.38) 170deg,
                rgba(20,184,166,0.4) 230deg,
                rgba(79,70,229,0.34) 290deg,
                rgba(45,212,191,0.42) 360deg)`,
            }}
          />
        </div>
        <div className='absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2'>
          <div
            className='h-[min(160vmin,90rem)] w-[min(160vmin,90rem)] blur-[130px] sm:blur-[170px] opacity-[0.12] dark:opacity-[0.1] motion-reduce:animate-none animate-spin [animation-duration:160s] [animation-direction:reverse]'
            style={{
              background: `conic-gradient(from 200deg at 50% 50%,
                rgba(129,140,248,0.38) 0deg,
                rgba(34,211,238,0.32) 90deg,
                rgba(16,185,129,0.36) 180deg,
                rgba(99,102,241,0.32) 270deg,
                rgba(129,140,248,0.38) 360deg)`,
            }}
          />
        </div>
        <div className='absolute inset-0 bg-gradient-to-b from-white/[0.12] via-transparent to-indigo-950/[0.18] dark:from-gray-950/45 dark:via-transparent dark:to-slate-950/55 mix-blend-normal opacity-95' />
        <div
          className='absolute inset-0 mix-blend-normal pointer-events-none'
          style={{
            background:
              'radial-gradient(ellipse 100% 85% at 50% 35%, transparent 0%, transparent 38%, rgba(15,23,42,0.22) 100%)',
          }}
        />
        <div
          className='absolute inset-0 mix-blend-normal dark:hidden opacity-90'
          style={{
            background:
              'radial-gradient(ellipse 90% 80% at 50% 40%, transparent 0%, transparent 45%, rgba(255,255,255,0.48) 100%)',
          }}
        />
      </div>

      <div ref={revealRef} className='relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden'>

      {/* ═══════════════════════════════════════════════════════════════════════
          GATEWAY — two audiences (candidates vs employers)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id='home-gateway'
        className='relative isolate pt-10 sm:pt-14 pb-10 sm:pb-12 text-center max-w-4xl mx-auto scroll-mt-24'
      >
        <p
          className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm sm:text-base font-medium mb-4 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          <Handshake
            className={`w-4 h-4 shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}
            aria-hidden
          />
          <span>
            Candidates and employers both belong on Storm — same network, different jobs to be done.
          </span>
        </p>
        <h1
          className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight tracking-tight ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Verified Career Cards for talent.
          <br />
          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Hiring tools teams keep coming back to.</span>
        </h1>
        <p className={`text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          We skipped the &ldquo;AI apply to 500 jobs&rdquo; bucket on purpose: high-signal cards for candidates, and
          repeatable employer workflows — search, requests, compliance orders, pipeline — that are worth paying for every
          hire cycle.
        </p>
        <div className='flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-stretch sm:items-center'>
          <Button
            variant='primary'
            size='lg'
            type='button'
            onClick={() => scrollToSection('for-candidates')}
            className='text-base px-8 py-4 h-auto rounded-xl'
          >
            I&apos;m looking for my next role
            <ArrowRight className='w-5 h-5' />
          </Button>
          <Button
            variant='secondary'
            size='lg'
            type='button'
            onClick={() => scrollToSection('for-employers')}
            className='text-base px-8 py-4 h-auto rounded-xl border-2'
          >
            <Building2 className='w-5 h-5' />
            I&apos;m hiring
          </Button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — Candidates: Hero + Career Card story
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id='for-candidates'
        className='relative isolate scroll-mt-24 pt-4 sm:pt-6 pb-12 sm:pb-20 overflow-x-hidden overflow-y-visible border-t border-gray-200 dark:border-gray-700'
      >
        {/*
          Large blurred blooms + radial mask so color never ends in a sharp rectangle
          against StormBackground — avoids the obvious “overlay box” edge.
        */}
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 -z-10 flex items-start justify-center pt-0 overflow-hidden'
        >
          <div
            className='relative w-[min(135vw,85rem)] h-[min(85vh,44rem)] shrink-0 -translate-y-[8%] opacity-80 dark:opacity-[0.65] [mask-image:radial-gradient(ellipse_72%_68%_at_50%_42%,#000_0%,transparent_78%)] [-webkit-mask-image:radial-gradient(ellipse_72%_68%_at_50%_42%,#000_0%,transparent_78%)]'
          >
            <div className='absolute left-1/2 top-[18%] h-[min(75vw,48rem)] w-[min(75vw,48rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-400/35 blur-[100px] dark:bg-teal-400/18 dark:blur-[128px]' />
            <div className='absolute right-[-8%] top-[8%] h-[min(55vw,28rem)] w-[min(55vw,28rem)] rounded-full bg-cyan-400/25 blur-[88px] dark:bg-violet-500/20 dark:blur-[104px]' />
            <div className='absolute left-[-5%] bottom-[-5%] h-[min(50vw,26rem)] w-[min(50vw,26rem)] rounded-full bg-teal-500/20 blur-[96px] dark:bg-cyan-500/12 dark:blur-[112px]' />
          </div>
        </div>

        <div className='text-center relative'>
          <p
            className={`text-xs sm:text-sm font-bold uppercase tracking-widest mb-6 ${
              isDark ? 'text-teal-400' : 'text-teal-700'
            }`}
          >
            For candidates
          </p>
          <div className='mb-5 flex flex-wrap justify-center gap-2'>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                isDark
                  ? 'bg-teal-500/15 text-teal-300 border-teal-500/35'
                  : 'bg-teal-50 text-teal-800 border-teal-200'
              }`}
            >
              <Layers className='w-3.5 h-3.5' />
              Industry blocks
            </span>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                isDark
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                  : 'bg-cyan-50 text-cyan-900 border-cyan-200'
              }`}
            >
              <CreditCard className='w-3.5 h-3.5' />
              Career Card
            </span>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                isDark
                  ? 'bg-white/[0.06] text-gray-300 border-white/[0.12]'
                  : 'bg-gray-100 text-gray-800 border-gray-200'
              }`}
            >
              <Link2 className='w-3.5 h-3.5' />
              Verify on-chain
            </span>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                isDark
                  ? 'bg-violet-500/15 text-violet-300 border-violet-500/35'
                  : 'bg-violet-50 text-violet-800 border-violet-200'
              }`}
            >
              <Bot className='w-3.5 h-3.5' />
              Stormi helps
            </span>
          </div>

          <h2
            className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 leading-[1.08] tracking-tight max-w-5xl mx-auto ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            <span className='block'>Build the Career Card —</span>
            <span className='bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent'>
              the jobs will come
            </span>
            <span
              className={`block mt-3 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold leading-snug tracking-tight max-w-4xl mx-auto ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Career-specific blocks, then permanent verification, then AI so you&apos;re never stuck — in that order.
            </span>
          </h2>

          <p
            className={`text-base sm:text-lg md:text-xl mb-4 max-w-3xl mx-auto leading-relaxed ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>1 — Blocks:</strong> stack the workflows your
            trade actually needs (DOT, MVR, CDL, portfolio, résumé — the tedious forms) so you do the heavy lifting{' '}
            <em>once</em> and it all feeds one shareable{' '}
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>Career Card</strong>.{' '}
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>2 — Verify:</strong> on-chain permanence makes
            what&apos;s on that card clear and durable — not another PDF lost in an inbox.{' '}
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>3 — Stormi:</strong> answers, nudges, job match,
            optional drafts — so you never freeze in front of a blank screen. Nothing like this has existed as one product;
            we&apos;re not leading with buzzwords — we&apos;re leading with the card you build.
          </p>
          <p
            className={`text-sm sm:text-base mb-8 max-w-2xl mx-auto leading-relaxed ${
              isDark ? 'text-gray-500' : 'text-gray-600'
            }`}
          >
            We are <strong className={isDark ? 'text-gray-300' : 'text-gray-800'}>not</strong> a “mass auto-apply”
            product. Storm never blasts employers with applications on your behalf —{' '}
            <strong className={isDark ? 'text-gray-300' : 'text-gray-800'}>high signal for you and for hiring teams.</strong>
          </p>

          <div className='flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-stretch sm:items-center mb-10 max-w-xl mx-auto sm:max-w-none'>
            <Button
              variant='primary'
              size='lg'
              onClick={onGetStarted}
              className='group text-base px-8 py-4 h-auto rounded-xl shadow-lg shadow-teal-900/20 dark:shadow-black/40'
            >
              <span>{isAuthenticated ? 'Go to dashboard' : 'Connect wallet'}</span>
              <ArrowRight className='w-5 h-5 group-hover:translate-x-1 transition-transform' />
            </Button>
            {onBrowseJobs && (
              <Button
                variant='secondary'
                size='lg'
                onClick={onBrowseJobs}
                className='text-base px-8 py-4 h-auto rounded-xl border-2'
              >
                <Search className='w-5 h-5' />
                Browse jobs — no login
              </Button>
            )}
          </div>
          <div className='flex flex-wrap justify-center gap-x-4 gap-y-2 mb-10'>
            <a
              href='#composable-blocks'
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('composable-blocks')
              }}
              className={`inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold rounded-xl transition-colors ${
                isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-700 hover:text-cyan-800'
              }`}
            >
              Industry blocks ↓
            </a>
            <a
              href='#signal-not-spam'
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('signal-not-spam')
              }}
              className={`inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold rounded-xl transition-colors ${
                isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-800'
              }`}
            >
              Signal, not spam ↓
            </a>
            <a
              href='#ava-intelligence'
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('ava-intelligence')
              }}
              className={`inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold rounded-xl transition-colors ${
                isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Meet Stormi ↓
            </a>
            <button
              type='button'
              onClick={() => scrollToSection('for-employers')}
              className={`inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold rounded-xl transition-colors ${
                isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-700 hover:text-cyan-800'
              }`}
            >
              For employers ↓
            </button>
          </div>
        </div>

        <div className='flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 mb-12'>
          <CareerCardMockup isDark={isDark} />
          <div className={`max-w-md text-left space-y-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <p className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
              The order that matters
            </p>
            <ul className='space-y-3 text-sm sm:text-base'>
              <li className='flex gap-3'>
                <Layers className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                <span>
                  <strong className={isDark ? 'text-gray-200' : 'text-gray-900'}>1 · Build with blocks:</strong>{' '}
                  career-specific workflows fill out your Career Card — not generic profile fields. Most hiring products
                  skip this entirely.
                </span>
              </li>
              <li className='flex gap-3'>
                <Link2 className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                <span>
                  <strong className={isDark ? 'text-gray-200' : 'text-gray-900'}>2 · Verify permanently:</strong>{' '}
                  blockchain-backed clarity for what&apos;s on your card — proof that outlasts a one-off upload.
                </span>
              </li>
              <li className='flex gap-3'>
                <Bot className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                <span>
                  <strong className={isDark ? 'text-gray-200' : 'text-gray-900'}>3 · Stormi helps:</strong>{' '}
                  third, not first — guidance, matches, and optional copy so you&apos;re never stuck. AI supports the card
                  you built; it doesn&apos;t replace it.
                </span>
              </li>
              <li className='flex gap-3'>
                <MousePointerClick className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <span>
                  <strong className={isDark ? 'text-gray-200' : 'text-gray-900'}>You send every application:</strong>{' '}
                  build the card first; opportunities find you — still no mass auto-apply behind your back.
                </span>
              </li>
              <li className='flex gap-3'>
                <Zap className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <span>
                  <strong className={isDark ? 'text-gray-200' : 'text-gray-900'}>Wallet-native:</strong> your address
                  is your anchor; STORM rewards real progress. No duplicate accounts — the chain of record is you.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className='flex flex-wrap justify-center gap-x-8 gap-y-3 sm:gap-x-12'>
          {[
            { icon: Layers, text: '1 · Blocks' },
            { icon: CreditCard, text: 'Career Card' },
            { icon: Link2, text: '2 · Verify on-chain' },
            { icon: Bot, text: '3 · Stormi helps' },
            { icon: Zap, text: 'STORM on Base' },
          ].map((item) => (
            <div key={item.text} className='flex items-center gap-2'>
              <item.icon className={`w-4 h-4 ${isDark ? 'text-teal-400/80' : 'text-teal-600/80'}`} />
              <span className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Trust: contrast with mass auto-apply / AI job-spam tools (reduces “you’ll spam employers” fear) */}
      <section id='signal-not-spam' className='py-14 sm:py-20 scroll-mt-24 border-t border-gray-200 dark:border-gray-700'>
        <div data-reveal className='reveal-item text-center mb-10 max-w-3xl mx-auto px-1'>
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            High signal for everyone on the hire
          </h2>
          <p className={`text-base sm:text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            A lot of “AI job” products optimize for <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>sheer volume</strong>{' '}
            (auto-applying to hundreds of postings). That trains recruiters to distrust AI — and it isn&apos;t how we work.
            Storm is the <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>opposite</strong>: invest in a
            verified Career Card, then apply only when <em>you</em> decide — so candidates look serious and employers get
            fewer junk applications. Same product, no favorites.
          </p>
          <p className={`text-sm sm:text-base mt-4 max-w-2xl mx-auto ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
            The sequence is deliberate:{' '}
            <strong className={isDark ? 'text-gray-300' : 'text-gray-800'}>blocks → permanent verification → Stormi</strong>.
            Build a real card first; credibility follows; AI keeps you moving — not the other way around. No buzzword stack,
            no slop.
          </p>
        </div>

        <div className='grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto'>
          {[
            {
              icon: UserCheck,
              title: 'No mass auto-apply',
              body: 'We do not fire off applications in the background. Each submit is yours — employers see intent, not bot spray.',
              accent: isDark ? 'from-teal-500/20 to-emerald-500/10' : 'from-teal-50 to-emerald-50',
            },
            {
              icon: Shield,
              title: 'Proof beats puffery',
              body: "Those blocks are the tedious, real-world forms and records for your trade — done once, then projected on your card. AI helps you work through them; it doesn't replace them.",
              accent: isDark ? 'from-violet-500/20 to-indigo-500/10' : 'from-violet-50 to-indigo-50',
            },
            {
              icon: Handshake,
              title: 'Two-sided by design',
              body: "Job seekers and hiring teams use the same network. We don't optimize for one side at the expense of the other — better verification helps both.",
              accent: isDark ? 'from-slate-500/20 to-gray-500/10' : 'from-slate-50 to-gray-50',
            },
          ].map((cell) => (
            <div key={cell.title} data-reveal className='reveal-item'>
              <GlassCard
                isDark={isDark}
                className={`p-6 sm:p-7 h-full text-left bg-gradient-to-br ${cell.accent}`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
                    isDark ? 'bg-gray-900/60 text-teal-300' : 'bg-white/90 text-teal-700 shadow-sm'
                  }`}
                >
                  <cell.icon className='w-5 h-5' />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{cell.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{cell.body}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </section>

      {/* Stormi — product depth (was missing when homepage shipped) */}
      <section id='ava-intelligence' className='py-16 sm:py-24 scroll-mt-24'>
        <div data-reveal className='reveal-item text-center mb-12 max-w-3xl mx-auto'>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Meet{' '}
            <span className='bg-gradient-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent'>Stormi</span>
          </h2>
          <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>Anyone</strong> can build a Career Card and use prep
            here — that is the front door. Storm just{' '}
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>doubles down</strong> on job search, applications,
            and what employers see, instead of trying to be a full-life career coach. Stormi comes{' '}
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>after</strong> blocks and verification so you&apos;re{' '}
            <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>never stuck</strong> on a match, a form, or what to
            say when you apply. It never replaces your call on <em>whether</em> to apply — or <em>when</em> you are ready to
            search.
          </p>
        </div>

        <div className='grid sm:grid-cols-2 gap-4 lg:gap-5 max-w-5xl mx-auto'>
          {[
            {
              icon: Radar,
              title: 'Ranked job matches',
              body: 'Stormi pulls real listings and scores them against your headline, skills, and blocks — so you spend time on roles worth applying to, not infinite scroll.',
              accent: isDark ? 'from-teal-500/20 to-cyan-500/10' : 'from-teal-100 to-cyan-50',
            },
            {
              icon: FileText,
              title: 'Easy Apply + cover letters',
              body: 'When you choose to apply, one guided flow ships your verified career card. Stormi can draft optional cover copy — you review and send; nothing goes out in bulk.',
              accent: isDark ? 'from-violet-500/20 to-indigo-500/10' : 'from-violet-100 to-indigo-50',
            },
            {
              icon: BellRing,
              title: 'AI job alerts',
              body: 'Save what you care about — keywords, location, salary floor. We scan, match, and notify when strong listings land. Alerts inform you; they do not auto-submit applications.',
              accent: isDark ? 'from-amber-500/15 to-orange-500/10' : 'from-amber-50 to-orange-50',
            },
            {
              icon: Sparkles,
              title: 'Journey guide',
              body: 'Stormi tracks which blocks employers see and what is still empty — nudges tied to your card, whether you are applying this week or still assembling proof.',
              accent: isDark ? 'from-emerald-500/20 to-teal-500/10' : 'from-emerald-50 to-teal-50',
            },
          ].map((cell) => (
            <div key={cell.title} data-reveal className='reveal-item'>
              <GlassCard
                isDark={isDark}
                className={`p-6 sm:p-7 h-full text-left bg-gradient-to-br ${cell.accent} hover:scale-[1.02] transition-transform duration-300`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
                    isDark ? 'bg-gray-900/60 text-teal-300' : 'bg-white/90 text-teal-700 shadow-sm'
                  }`}
                >
                  <cell.icon className='w-5 h-5' />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{cell.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{cell.body}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </section>

      {/* Public job browse CTA — Indeed-style discovery before wallet */}
      {onBrowseJobs && (
        <section className='py-14 sm:py-20'>
          <div
            data-reveal
            className={`reveal-item relative overflow-hidden rounded-3xl border px-6 py-10 sm:px-12 sm:py-14 max-w-5xl mx-auto ${
              isDark
                ? 'border-gray-700 bg-gradient-to-br from-gray-900 via-gray-900 to-teal-950/40'
                : 'border-gray-200 bg-gradient-to-br from-white via-teal-50/40 to-cyan-50/30'
            }`}
          >
            <div
              className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
                isDark ? 'bg-teal-500/20' : 'bg-teal-400/25'
              }`}
            />
            <div className='relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 text-center lg:text-left'>
              <div className='max-w-xl mx-auto lg:mx-0'>
                <Briefcase className={`w-10 h-10 mx-auto lg:mx-0 mb-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Search real jobs before you connect
                </h2>
                <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Storm postings plus aggregated boards — same search experience as logged-in users. Applying,
                  Stormi match scores, and alerts stay tied to your wallet so we never mint empty profiles.
                </p>
              </div>
              <div className='flex flex-col sm:flex-row gap-3 justify-center lg:justify-end shrink-0'>
                <Button variant='primary' size='lg' onClick={onBrowseJobs} className='h-auto py-4 px-8 rounded-xl'>
                  <Search className='w-5 h-5' />
                  Open job search
                </Button>
                <Button variant='secondary' size='lg' onClick={onGetStarted} className='h-auto py-4 px-8 rounded-xl'>
                  Connect to apply
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — The Problem
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className='py-16 sm:py-24 max-w-4xl mx-auto'>
        <h2
          data-reveal
          className={`reveal-item text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Credentials shouldn&apos;t be this hard
        </h2>

        <div className='space-y-8'>
          {[
            'The same complex forms, filled out again and again. Every new job, start from scratch.',
            'Verified records scattered across systems. Employers can\'t find proof, even when it exists.',
            'Compliance paperwork that nobody wants to digitize — so you\'re stuck with paper and fax machines.',
          ].map((line, i) => (
            <p
              key={i}
              data-reveal
              className={`reveal-item text-xl sm:text-2xl md:text-3xl font-light text-center leading-relaxed ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — The Solution: Composable Blocks
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id='composable-blocks' className='py-16 sm:py-24 scroll-mt-24'>
        <div data-reveal className='reveal-item text-center mb-12'>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Your hire story, assembled
            <br />
            <span className='bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent'>
              from blocks
            </span>
          </h2>
          <p className={`text-lg sm:text-xl max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Install the blocks your trade needs for <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>applications and employers</strong>{' '}
            — DOT, CDL, portfolio, resume, skills — without refilling the same story for every posting. One verified Career
            Card you bring to each hire.
          </p>
        </div>

        {/* Hive — radial mask softens the cluster edge so it doesn’t read as a dark card on clouds */}
        <div
          data-reveal
          className='reveal-item mb-14 flex justify-center px-2 [mask-image:radial-gradient(ellipse_78%_72%_at_50%_50%,#000_52%,transparent_96%)] [-webkit-mask-image:radial-gradient(ellipse_78%_72%_at_50%_50%,#000_52%,transparent_96%)]'
        >
          <VaultShowcase blocks={HIVE_BLOCKS} isDark={isDark} />
        </div>

        {/* Profession callouts */}
        <div className='grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto'>
          {[
            {
              icon: Truck,
              title: 'Drivers',
              desc: 'DOT applications, MVR records, CDL credentials',
              accent: isDark ? 'text-blue-400' : 'text-blue-600',
            },
            {
              icon: Code2,
              title: 'Developers',
              desc: 'Portfolio, GitHub activity, project showcase',
              accent: isDark ? 'text-cyan-400' : 'text-cyan-600',
            },
            {
              icon: Wrench,
              title: 'Everyone',
              desc: 'Skills, work history — and more blocks coming',
              accent: isDark ? 'text-teal-400' : 'text-teal-600',
            },
          ].map((item) => (
            <GlassCard key={item.title} isDark={isDark} className='p-5 text-center'>
              <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.accent}`} />
              <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {item.title}
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {item.desc}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — How It Works
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id='how-it-works' className='py-16 sm:py-24'>
        <h2
          data-reveal
          className={`reveal-item text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-14 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          How It Works
        </h2>

        <div className='grid md:grid-cols-3 gap-6 max-w-5xl mx-auto'>
          {[
            {
              step: '1',
              title: 'Connect & stack blocks',
              desc: 'Wallet or email, then install the industry blocks that fill your Career Card — the tedious trade work, done once.',
              icon: Layers,
            },
            {
              step: '2',
              title: 'Verify on-chain',
              desc: "Permanent verification for what's on your card — portable proof, not another lost PDF.",
              icon: Link2,
            },
            {
              step: '3',
              title: 'Stormi helps · share the card',
              desc: 'AI keeps you unstuck on forms and matches; then one link or QR. Build the card — strong jobs and employers find you there.',
              icon: Bot,
            },
          ].map((item, i) => (
            <div key={item.step} data-reveal className='reveal-item' style={{ transitionDelay: `${i * 120}ms` }}>
              <GlassCard isDark={isDark} className='p-6 sm:p-8 text-center h-full hover:scale-[1.03] transition-transform duration-300'>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  isDark ? 'bg-teal-500/20' : 'bg-teal-100'
                }`}>
                  <span className={`text-xl font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
                    {item.step}
                  </span>
                </div>
                <item.icon className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.title}
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {item.desc}
                </p>
              </GlassCard>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION — Employers: recurring hiring stack (not an afterthought)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id='for-employers'
        className='py-16 sm:py-24 scroll-mt-24 border-t-2 border-gray-200 dark:border-gray-600'
      >
        <div data-reveal className='reveal-item text-center mb-12 max-w-3xl mx-auto px-1'>
          <p
            className={`text-xs sm:text-sm font-bold uppercase tracking-widest mb-3 ${
              isDark ? 'text-cyan-400' : 'text-cyan-700'
            }`}
          >
            For employers
          </p>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            The other half of Storm
          </h2>
          <p className={`text-lg sm:text-xl ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Candidates build Career Cards once; you get <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>repeatable</strong>{' '}
            hiring workflows — talent search, block requests, MVR and compliance orders, applicant pipeline — the kind of
            work that runs <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>every hire cycle</strong>. That&apos;s
            why we reject mass AI applications: your inbox isn&apos;t our growth hack; <strong className={isDark ? 'text-gray-200' : 'text-gray-800'}>your trust is.</strong>
          </p>
        </div>

        <div className='grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-14'>
          {[
            {
              step: '1',
              title: 'Find & request',
              desc: 'Search talent, send invites, request the blocks you need — résumé, MVR, DOT, portfolio. Candidates already built the card; you ask for proof.',
              icon: UserPlus,
            },
            {
              step: '2',
              title: 'Review verified signal',
              desc: 'Same block-backed artifacts candidates verified on-chain — not a wall of generic AI cover letters. Less noise before you spend interview time.',
              icon: FileCheck,
            },
            {
              step: '3',
              title: 'Compliance & pipeline',
              desc: 'Order MVR and background checks, move people through stages, repeat next requisition. Tools your team logs back into — not a one-off job post.',
              icon: Briefcase,
            },
          ].map((item, i) => (
            <div key={item.step} data-reveal className='reveal-item' style={{ transitionDelay: `${i * 100}ms` }}>
              <GlassCard isDark={isDark} className='p-6 sm:p-8 h-full text-left'>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 text-sm font-bold ${
                    isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-800'
                  }`}
                >
                  {item.step}
                </div>
                <item.icon className={`w-7 h-7 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.desc}</p>
              </GlassCard>
            </div>
          ))}
        </div>

        <div data-reveal className='reveal-item'>
          <GlassCard isDark={isDark} className='p-8 sm:p-10 max-w-4xl mx-auto'>
            <div className='text-center'>
              <div className='flex flex-wrap justify-center gap-3 mb-6'>
                {[
                  { icon: Search, text: 'Talent search & invites' },
                  { icon: ClipboardList, text: 'Block & credential requests' },
                  { icon: Shield, text: 'MVR & background orders' },
                  { icon: Building2, text: 'Industry-specific blocks' },
                ].map((pill) => (
                  <div
                    key={pill.text}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${
                      isDark
                        ? 'bg-white/[0.04] border-white/[0.08] text-gray-300'
                        : 'bg-white/60 border-white/40 text-gray-700'
                    }`}
                  >
                    <pill.icon className='w-4 h-4' />
                    {pill.text}
                  </div>
                ))}
              </div>
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Large organizations can add company-specific blocks for their own workflows — same composable model as
                candidates.
              </p>
              <Button variant='primary' size='lg' onClick={onGetStarted} className='h-auto py-4 px-8 rounded-xl'>
                <Building2 className='w-5 h-5' />
                <span>{isAuthenticated ? 'Go to dashboard' : 'Connect wallet'}</span>
                <ArrowRight className='w-5 h-5' />
              </Button>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6 — STORM Token
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className='py-16 sm:py-24'>
        <div data-reveal className='reveal-item'>
          <GlassCard isDark={isDark} className='p-8 sm:p-12 max-w-4xl mx-auto overflow-hidden relative'>
            {/* Subtle glow accent */}
            <div className='absolute -top-16 -right-16 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none' />

            <div className='text-center relative z-[1]'>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-teal-500/20' : 'bg-teal-100'
              }`}>
                <Coins className={`w-7 h-7 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
              </div>

              <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Powered by{' '}
                <span className='bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent'>
                  STORM
                </span>
              </h2>

              <p className={`text-lg mb-8 max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Storm runs on its own token economy. Earn STORM for completing your profile,
                installing blocks, and contributing verified credentials. Spend it on premium features.
              </p>

              {/* Token utility pills */}
              <div className='flex flex-wrap justify-center gap-3 mb-10'>
                {[
                  { icon: Gift,       text: 'Earn for contributions' },
                  { icon: TrendingUp, text: 'Unlock premium blocks' },
                  { icon: Shield,     text: 'On-chain transparency' },
                ].map((item) => (
                  <div
                    key={item.text}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${
                      isDark
                        ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                        : 'bg-teal-50 text-teal-700 border-teal-300/50'
                    }`}
                  >
                    <item.icon className='w-4 h-4' />
                    {item.text}
                  </div>
                ))}
              </div>

              {/* Whitepaper CTA */}
              <button
                onClick={openWhitepaper}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 font-semibold transition-all duration-300 hover:scale-105 ${
                  isDark
                    ? 'border-teal-500/40 text-teal-300 hover:bg-teal-500/10'
                    : 'border-teal-500/60 text-teal-700 hover:bg-teal-50'
                }`}
              >
                <BookOpen className='w-5 h-5' />
                Read the STORM Whitepaper
              </button>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 7 — Bottom CTA
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className='text-center py-16 sm:py-24 pb-20 sm:pb-32'>
        <div data-reveal className='reveal-item'>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Ready when you are
          </h2>
          <p className={`text-lg mb-8 max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Candidates:</strong> peek at jobs without an
            account; connect when you&apos;re ready to apply with your Career Card and Stormi.{' '}
            <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Employers:</strong> same login — search,
            request blocks, and run compliance on the people you actually want to talk to.
          </p>

          <div className='flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-center mb-6'>
            <Button
              variant='primary'
              size='lg'
              onClick={onGetStarted}
              className='group text-lg px-10 py-5 h-auto rounded-xl shadow-xl'
            >
              <span>{isAuthenticated ? 'Go to dashboard' : 'Connect wallet'}</span>
              <ArrowRight className='w-6 h-6 group-hover:translate-x-1 transition-transform' />
            </Button>
            {onBrowseJobs && (
              <Button variant='secondary' size='lg' onClick={onBrowseJobs} className='text-lg px-10 py-5 h-auto rounded-xl'>
                <Briefcase className='w-5 h-5' />
                Browse jobs
              </Button>
            )}
            <Button
              variant='secondary'
              size='lg'
              type='button'
              onClick={() => scrollToSection('for-employers')}
              className='text-lg px-10 py-5 h-auto rounded-xl border-2'
            >
              <Building2 className='w-5 h-5' />
              Employer product
            </Button>
          </div>

          <button
            type='button'
            onClick={openWhitepaper}
            className={`text-sm underline underline-offset-4 transition-colors ${
              isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Read the STORM whitepaper
          </button>
        </div>
      </section>

      {/* ── Scroll reveal + animation CSS ─────────────────────────────────── */}
      <style jsx>{`
        .reveal-item {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .revealed .reveal-item,
        .reveal-item.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes card-float {
          0%   { transform: translateY(0) rotate(0deg); }
          50%  { transform: translateY(-6px) rotate(0.5deg); }
          100% { transform: translateY(0) rotate(-0.5deg); }
        }
      `}</style>
      </div>
    </>
  )
}
