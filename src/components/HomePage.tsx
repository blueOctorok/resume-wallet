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
  Users,
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
} from 'lucide-react'
import { getBlockColor } from '@/lib/block-registry'
import StormChainView from '@/components/StormChainView'

interface HomePageProps {
  isAuthenticated: boolean
  onGetStarted: () => void
}

// ── Hex clip-path (same constant used in the hub) ────────────────────────────
const HEX_CLIP = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'

// ── Hive showcase blocks — used in hero and section 3 ────────────────────────
const HIVE_BLOCKS = [
  { id: 'driver-dot-application', icon: ClipboardList, label: 'DOT App' },      // center (hero)
  { id: 'driver-resume',          icon: FileText,      label: 'Resume' },
  { id: 'driver-mvr',            icon: Car,            label: 'MVR' },
  { id: 'general-resume',        icon: FileText,       label: 'Pro Resume' },
  { id: 'developer-portfolio',   icon: Globe,          label: 'Portfolio' },
  { id: 'developer-github',      icon: Github,         label: 'GitHub' },
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

// ── Decorative hive showcase ─────────────────────────────────────────────────
// Same radial layout as the in-app Block Hive: center hex is larger, 6 ring
// hexes spiral around it. Used in the hero and section 3 of the landing page.

const HIVE_GAP = 8

interface ShowcaseHiveProps {
  blocks: typeof HIVE_BLOCKS
  isDark: boolean
}

// Responsive hive sizes: phone (<400px) vs tablet/desktop
const SHOWCASE_CENTER_XS = { w: 100, h: 115 }
const SHOWCASE_RING_XS   = { w: 75,  h: 86 }
const SHOWCASE_CENTER_LG = { w: 170, h: 195 }
const SHOWCASE_RING_LG   = { w: 130, h: 150 }

function hiveShowcaseOffsets(centerW: number, centerH: number, ringW: number, ringH: number): [number, number][] {
  const dx = centerW / 2 + HIVE_GAP + ringW / 2
  const dy = (centerH / 2 + HIVE_GAP + ringH / 2) * 0.92
  const halfDx = dx * 0.52
  return [
    [0, 0],
    [-halfDx, -dy],
    [halfDx,  -dy],
    [-dx,      0],
    [dx,       0],
    [-halfDx,  dy],
    [halfDx,   dy],
  ]
}

function HiveShowcase({ blocks, isDark }: ShowcaseHiveProps) {
  const [isSmall, setIsSmall] = useState(false)

  useEffect(() => {
    const check = () => setIsSmall(window.innerWidth < 500)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const centerW = isSmall ? SHOWCASE_CENTER_XS.w : SHOWCASE_CENTER_LG.w
  const centerH = isSmall ? SHOWCASE_CENTER_XS.h : SHOWCASE_CENTER_LG.h
  const ringW   = isSmall ? SHOWCASE_RING_XS.w   : SHOWCASE_RING_LG.w
  const ringH   = isSmall ? SHOWCASE_RING_XS.h   : SHOWCASE_RING_LG.h

  const slots = hiveShowcaseOffsets(centerW, centerH, ringW, ringH)
  const dx = centerW / 2 + HIVE_GAP + ringW / 2
  const dy = (centerH / 2 + HIVE_GAP + ringH / 2) * 0.92
  const containerW = 2 * (dx + ringW / 2) + 16
  const containerH = 2 * (dy + ringH / 2) + 16

  return (
    <div className='relative mx-auto' style={{ width: containerW, height: containerH }}>
      {blocks.slice(0, 7).map((block, i) => {
        const isCenter = i === 0
        const w = isCenter ? centerW : ringW
        const h = isCenter ? centerH : ringH
        const [offX, offY] = slots[i]
        const left = containerW / 2 - w / 2 + offX
        const top = containerH / 2 - h / 2 + offY
        const colors = getBlockColor(block.id)
        const delay = i * 0.3

        return (
          <div
            key={block.id}
            className='absolute'
            style={{
              width: w, height: h, left, top,
              animation: `hex-float 4s ease-in-out ${delay}s infinite alternate`,
              zIndex: isCenter ? 2 : 1,
            }}
          >
            <div className='w-full h-full relative' style={{ clipPath: HEX_CLIP }}>
              <div
                className={`absolute inset-0 ${isDark ? 'bg-white/[0.06]' : 'bg-white/40'}`}
                style={{ clipPath: HEX_CLIP }}
              />
              <div
                className={`absolute inset-[2px] backdrop-blur-md ${isDark ? 'bg-gray-900/70' : 'bg-white/70'}`}
                style={{ clipPath: HEX_CLIP }}
              />
              <div className='absolute inset-0 flex flex-col items-center justify-center z-[1] px-[12%]'>
                <block.icon className={`mb-1 ${isCenter ? 'w-7 h-7 sm:w-11 sm:h-11' : 'w-5 h-5 sm:w-8 sm:h-8'} ${
                  isDark ? colors.iconText.dark : colors.iconText.light
                }`} />
                <span className={`font-bold uppercase tracking-wide text-center leading-tight ${
                  isCenter ? 'text-[8px] sm:text-xs' : 'text-[6px] sm:text-[10px]'
                } ${isDark ? colors.iconText.dark : colors.iconText.light}`}>
                  {block.label}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
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
            Verified on StormChain
          </span>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ── HomePage ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export default function HomePage({ isAuthenticated, onGetStarted }: HomePageProps) {
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

  if (showWhitepaper) {
    return <StormChainView onBack={closeWhitepaper} backLabel='Back to Home' />
  }

  return (
    <div ref={revealRef} className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden'>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — Hero
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className='pt-12 sm:pt-20 pb-16 sm:pb-24'>
        <div className='text-center'>
          {/* Badge */}
          <div className='mb-6'>
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${
              isDark
                ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                : 'bg-teal-50 text-teal-700 border-teal-300/50'
            }`}>
              <Sparkles className='w-4 h-4' />
              Composable Career Platform
            </span>
          </div>

          {/* Headline */}
          <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Fill it once.
            <br />
            <span className='bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-500 bg-clip-text text-transparent'>
              Prove it forever.
            </span>
          </h1>

          {/* Subhead */}
          <p className={`text-lg sm:text-xl md:text-2xl mb-10 max-w-3xl mx-auto leading-relaxed ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Complex credentials, compliance paperwork, professional records — done once, verified on-chain,
            <br className='hidden sm:block' />
            and packaged into one beautiful Career Card you can share with a QR code.
          </p>

          {/* CTAs */}
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-center mb-14'>
            <button
              onClick={onGetStarted}
              className='group px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-2 bg-teal-500 text-white hover:bg-teal-400'
            >
              <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started'}</span>
              <ArrowRight className='w-5 h-5 group-hover:translate-x-1 transition-transform' />
            </button>

            <a
              href='#how-it-works'
              className={`px-8 py-4 text-lg font-semibold rounded-xl border-2 transition-all duration-300 hover:scale-105 backdrop-blur-sm ${
                isDark
                  ? 'border-white/20 text-gray-200 hover:bg-white/[0.06]'
                  : 'border-gray-300 text-gray-700 hover:bg-white/50'
              }`}
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Hero visual — Career Card mockup */}
        <div className='flex justify-center mb-12'>
          <CareerCardMockup isDark={isDark} />
        </div>

        {/* Trust bar */}
        <div className='flex flex-wrap justify-center gap-6 sm:gap-10'>
          {[
            { icon: CreditCard, text: 'Career Card' },
            { icon: Shield,     text: 'On-Chain Verified' },
            { icon: Zap,        text: 'STORM Rewards' },
            { icon: Sparkles,   text: 'AI-Powered' },
          ].map((item) => (
            <div key={item.text} className='flex items-center gap-2'>
              <item.icon className={`w-4 h-4 ${isDark ? 'text-teal-400/70' : 'text-teal-600/70'}`} />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

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
      <section className='py-16 sm:py-24'>
        <div data-reveal className='reveal-item text-center mb-12'>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Your career, assembled
            <br />
            <span className='bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent'>
              from blocks
            </span>
          </h2>
          <p className={`text-lg sm:text-xl max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Pick the blocks that fit your profession. Each one adds verified capabilities to your Career Card.
          </p>
        </div>

        {/* Hive showcase grid */}
        <div data-reveal className='reveal-item mb-14'>
          <HiveShowcase blocks={HIVE_BLOCKS} isDark={isDark} />
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
              title: 'Sign up in seconds',
              desc: 'Email or wallet. No passwords to remember.',
              icon: Users,
            },
            {
              step: '2',
              title: 'Install your blocks',
              desc: 'Browse the Block Store. Add what fits your career.',
              icon: Sparkles,
            },
            {
              step: '3',
              title: 'Share your Career Card',
              desc: 'One link. QR code. Employers see verified proof, not promises.',
              icon: CreditCard,
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
          SECTION 5 — For Employers & Companies
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className='py-16 sm:py-24'>
        <div data-reveal className='reveal-item'>
          <GlassCard isDark={isDark} className='p-8 sm:p-12 max-w-4xl mx-auto'>
            <div className='text-center'>
              <Building2 className={`w-10 h-10 mx-auto mb-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
              <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                For those who hire
              </h2>
              <p className={`text-lg mb-8 max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Find verified talent. Request credentials. Order background checks. All from one platform.
              </p>

              {/* Feature pills */}
              <div className='flex flex-wrap justify-center gap-3 mb-8'>
                {[
                  { icon: FileCheck, text: 'Verified Career Cards' },
                  { icon: Search,    text: 'MVR & Background Checks' },
                  { icon: Sparkles,  text: 'Composable for your industry' },
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

              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Large organizations can build company-specific blocks for their workflows.
              </p>
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
                StormChain runs on its own token economy. Earn STORM for completing your profile,
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
            Ready to build your career?
          </h2>
          <p className={`text-lg mb-8 max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            It&apos;s free to start. No credit card. No catch.
          </p>

          <button
            onClick={onGetStarted}
            className='group px-10 py-5 text-xl font-semibold rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 inline-flex items-center gap-3 bg-teal-500 text-white hover:bg-teal-400'
          >
            <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}</span>
            <ArrowRight className='w-6 h-6 group-hover:translate-x-1 transition-transform' />
          </button>

          <div className='mt-6'>
            <button
              onClick={openWhitepaper}
              className={`text-sm underline underline-offset-4 transition-colors ${
                isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Read the Whitepaper
            </button>
          </div>
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
        @keyframes hex-float {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-8px); }
        }
        @keyframes card-float {
          0%   { transform: translateY(0) rotate(0deg); }
          50%  { transform: translateY(-6px) rotate(0.5deg); }
          100% { transform: translateY(0) rotate(-0.5deg); }
        }
      `}</style>
    </div>
  )
}
