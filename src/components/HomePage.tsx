'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle,
  Compass,
  Eye,
  Layers,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import StormChainWordmark from '@/components/ui/StormChainWordmark'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface HomePageProps {
  isAuthenticated: boolean
  onGetStarted: () => void
  /** Guest: open public Guided Mode (no wallet required to browse) */
  onBrowseJobs?: () => void
}


/**
 * Scroll-reveal hook — adds a `revealed` class when an element enters the viewport.
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

// ─────────────────────────────────────────────────────────────────────────────
// Apply Mode mock — visually echoes the in-app SimpleModeShell split view.
// Left card = the job. Right card = the career card growing in real time.
// Static visual; the homepage doesn't drive real fit logic.
// ─────────────────────────────────────────────────────────────────────────────

function BuildModeMockup({ isDark }: { isDark: boolean }) {
  const surface = isDark
    ? 'bg-gray-900/70 border-white/[0.08] text-white'
    : 'bg-white/85 border-slate-200 text-slate-900'
  const subtle = isDark ? 'bg-white/[0.04] text-gray-400' : 'bg-slate-50 text-slate-600'
  const muted = isDark ? 'text-gray-400' : 'text-slate-600'

  return (
    <div className='relative grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'>
      {/* Left: job card */}
      <div className={cn('rounded-2xl border p-4 backdrop-blur-md shadow-md', surface)}>
        <div className='mb-3 flex items-center gap-2'>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
              isDark
                ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/30'
                : 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
            )}
          >
            <Zap className='h-2.5 w-2.5' /> Storm
          </span>
          <span className={cn('text-[10px] uppercase tracking-wider', muted)}>Job</span>
        </div>
        <h4 className='text-sm font-semibold leading-snug'>CDL-A regional driver</h4>
        <p className={cn('mt-0.5 text-xs', muted)}>Werner Enterprises · Dallas, TX</p>
        <div className={cn('mt-3 rounded-lg p-2.5 text-[11px] leading-relaxed', subtle)}>
          <p className='mb-1 font-semibold'>What this role asks for</p>
          <ul className='space-y-0.5'>
            <li>• Class A CDL with hazmat</li>
            <li>• 2+ years OTR experience</li>
            <li>• Clean MVR, current DOT app</li>
          </ul>
        </div>
      </div>

      {/* Right: career card */}
      <div className={cn('rounded-2xl border p-4 backdrop-blur-md shadow-md', surface)}>
        <div className='mb-3 flex items-center gap-2'>
          <div className='flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-[10px] font-bold text-white'>
            JD
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs font-semibold'>Jane Doe</p>
            <p className={cn('text-[10px]', muted)}>CDL-A · 8 yrs</p>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
              isDark ? 'text-emerald-300' : 'text-emerald-700',
            )}
          >
            <ShieldCheck className='h-2.5 w-2.5' /> Verified
          </span>
        </div>

        <div className={cn('mb-2 rounded-lg p-2', subtle)}>
          <div className='mb-1 flex items-center justify-between text-[10px]'>
            <span className='font-medium'>Coverage for this role</span>
            <span className={cn('font-bold', isDark ? 'text-teal-300' : 'text-teal-700')}>78%</span>
          </div>
          <div className={cn('h-1 rounded-full', isDark ? 'bg-gray-700' : 'bg-slate-200')}>
            <div className='h-full w-[78%] rounded-full bg-gradient-to-r from-teal-400 to-emerald-400' />
          </div>
        </div>

        <div className='space-y-1.5'>
          {[
            { label: 'CDL credentials', done: true },
            { label: 'DOT application', done: true },
            { label: 'MVR', done: true },
            { label: 'Hazmat endorsement', done: false },
          ].map((row) => (
            <div
              key={row.label}
              className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]', subtle)}
            >
              {row.done ? (
                <CheckCircle className='h-3 w-3 shrink-0 text-emerald-400' />
              ) : (
                <Plus className={cn('h-3 w-3 shrink-0', isDark ? 'text-amber-300' : 'text-amber-600')} />
              )}
              <span className={row.done ? '' : muted}>{row.label}</span>
              {!row.done && (
                <span className={cn('ml-auto text-[9px] font-semibold', isDark ? 'text-amber-300' : 'text-amber-700')}>
                  Add
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero career card mockup — replaces the old block-tile showcase. Shows the
// finished career card so visitors immediately understand the product output.
// ─────────────────────────────────────────────────────────────────────────────

function HeroCareerCardMockup({ isDark }: { isDark: boolean }) {
  const surface = isDark
    ? 'border-white/[0.08]'
    : 'border-slate-200'
  const muted = isDark ? 'text-gray-400' : 'text-slate-500'
  const subtle = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'

  const blocks = [
    { label: 'CDL-A with hazmat', verified: true },
    { label: 'DOT application', verified: true },
    { label: 'MVR — clean record', verified: true },
    { label: 'Employment history', verified: true },
    { label: 'STORM Resume', verified: false },
  ]

  return (
    <VaultHorizontalVaultShell isDark={isDark} layout='panel' contentClassName='p-5 sm:p-6'>
      <div className='flex flex-col gap-4'>
        {/* Header — avatar + name + verified badge */}
        <div className='flex items-start gap-3'>
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              'bg-gradient-to-br from-teal-400 to-teal-600 text-white ring-2',
              isDark ? 'ring-teal-400/25' : 'ring-teal-500/20',
            )}
          >
            BB
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <h4 className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                Barry Burton
              </h4>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  isDark
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
                )}
              >
                <ShieldCheck className='h-3 w-3' /> Verified
              </span>
            </div>
            <p className={cn('text-xs', muted)}>CDL-A driver · 8 years experience</p>
            <p className={cn('text-[10px]', muted)}>Dallas, TX · Member since Jan 2026</p>
          </div>
        </div>

        {/* Card strength bar */}
        <div className={cn('rounded-lg p-3', subtle)}>
          <div className='flex items-center justify-between text-[11px]'>
            <span className={cn('font-medium', isDark ? 'text-gray-300' : 'text-slate-700')}>Card strength</span>
            <span className={cn('font-bold', isDark ? 'text-teal-300' : 'text-teal-700')}>Strong</span>
          </div>
          <div className={cn('mt-1.5 h-1.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-slate-200')}>
            <div className='h-full w-[85%] rounded-full bg-gradient-to-r from-teal-400 to-emerald-400' />
          </div>
        </div>

        {/* Block list */}
        <div className='space-y-1.5'>
          {blocks.map((b) => (
            <div
              key={b.label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                subtle,
              )}
            >
              {b.verified ? (
                <CheckCircle className='h-3.5 w-3.5 shrink-0 text-emerald-400' />
              ) : (
                <Plus className={cn('h-3.5 w-3.5 shrink-0', isDark ? 'text-gray-500' : 'text-slate-400')} />
              )}
              <span className={isDark ? 'text-gray-200' : 'text-slate-700'}>{b.label}</span>
              {b.verified && (
                <span className={cn('ml-auto text-[9px] font-semibold', isDark ? 'text-emerald-400/70' : 'text-emerald-600/70')}>
                  On-chain
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Bottom label */}
        <p className={cn('text-center text-[10px] font-semibold uppercase tracking-[0.15em]', muted)}>
          Career Card
        </p>
      </div>
    </VaultHorizontalVaultShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stormi card mock — static visual that mirrors the real StormiNextStepCard
// in the app. Lives inside a phone-frame in the Stormi section.
// ─────────────────────────────────────────────────────────────────────────────

function StormiCardMock({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-3 py-2.5',
        isDark
          ? 'border-violet-400/20 bg-violet-500/5'
          : 'border-violet-200/60 bg-violet-50/40 shadow-sm',
      )}
    >
      <div className='flex items-start gap-2'>
        <div
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg',
            isDark
              ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30'
              : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
          )}
        >
          <Plus className='size-3' />
        </div>
        <div className='min-w-0 flex-1'>
          <p
            className={cn(
              'text-[9px] font-bold uppercase tracking-wider',
              isDark ? 'text-violet-300/80' : 'text-violet-600',
            )}
          >
            Do this next
          </p>
          <p className={cn('text-[13px] font-semibold leading-snug', isDark ? 'text-white' : 'text-slate-900')}>
            Add hazmat endorsement
          </p>
          <p className={cn('mt-0.5 text-[11px] leading-relaxed', isDark ? 'text-gray-300' : 'text-slate-600')}>
            Closes the biggest gap for this CDL-A role &mdash; pushes you past the apply line.
          </p>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-1.5 pl-8'>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold',
            isDark ? 'bg-teal-500 text-white' : 'bg-teal-600 text-white',
          )}
        >
          Add hazmat
          <ArrowRight className='size-3' />
        </span>
        <span className={cn('text-[10px]', isDark ? 'text-gray-400' : 'text-slate-500')}>or tailor a lens</span>
      </div>
    </div>
  )
}

function PhoneFrame({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div
      className={cn(
        'relative mx-auto w-[280px] rounded-[2.5rem] border-[10px] p-2 shadow-2xl',
        isDark ? 'border-gray-800 bg-gray-950' : 'border-slate-300 bg-slate-100',
      )}
    >
      <div
        className={cn(
          'absolute left-1/2 top-1.5 z-10 h-1 w-16 -translate-x-1/2 rounded-full',
          isDark ? 'bg-gray-800' : 'bg-slate-300',
        )}
      />
      <div className={cn('rounded-[2rem] p-3', isDark ? 'bg-gray-900' : 'bg-white')}>
        <p className={cn('mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest', isDark ? 'text-gray-500' : 'text-slate-500')}>
          Apply Mode
        </p>
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HomePage
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage({ isAuthenticated, onGetStarted, onBrowseJobs }: HomePageProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const revealRef = useScrollReveal()

  // The connect/dashboard CTA label flips for signed-in users.
  const primaryLabel = isAuthenticated ? 'Go to dashboard' : 'Connect a wallet'

  return (
    <>
      {/*
        Iridescent background film — sits above StormBackground (z-[-3]) but below
        page content (z-10). Slow-spinning conic gradient reads as shifting teal /
        indigo / violet without competing with copy. Reduced motion: static.
      */}
      <div
        aria-hidden
        className='pointer-events-none fixed inset-0 z-[5] overflow-hidden mix-blend-soft-light dark:mix-blend-soft-light'
      >
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
        <div className='absolute inset-0 bg-gradient-to-b from-white/[0.12] via-transparent to-indigo-950/[0.18] dark:from-gray-950/45 dark:via-transparent dark:to-slate-950/55 mix-blend-normal opacity-95' />
      </div>

      <div ref={revealRef} className='relative z-10 mx-auto max-w-7xl overflow-hidden px-4 sm:px-6 lg:px-8'>
        {/*
         ═══════════════════════════════════════════════════════════════════════
         SECTION 1 — Hero
         Positioning + two CTAs. The career card mockup does the
         "what is this thing?" work without copy.
         ═══════════════════════════════════════════════════════════════════════
        */}
        <section className='relative isolate scroll-mt-24 pt-10 pb-16 sm:pt-14 sm:pb-24'>
          <div className='mb-8 flex justify-center px-2' data-reveal>
            <StormChainWordmark size='display' />
          </div>

          <div className='grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16'>
            <div className='text-center lg:text-left' data-reveal>
              <p
                className={cn(
                  'mb-4 text-[11px] font-semibold uppercase tracking-[0.18em]',
                  isDark ? 'text-teal-300/90' : 'text-teal-700',
                )}
              >
                verified on-chain &middot; candidate-owned &middot; tailored per job
              </p>
              <h1
                className={cn(
                  'text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                The career identity{' '}
                <span className='bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent'>
                  employers can actually trust.
                </span>
              </h1>
              <p
                className={cn(
                  'mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg lg:mx-0',
                  isDark ? 'text-gray-400' : 'text-slate-600',
                )}
              >
                Browse real jobs, build a verified career card block by block with Stormi as your coach, and apply with proof, not promises.
              </p>

              <div className='mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start'>
                {onBrowseJobs && (
                  <Button
                    variant='primary'
                    size='lg'
                    onClick={onBrowseJobs}
                    className='group h-auto rounded-xl px-8 py-4 text-base shadow-lg shadow-teal-900/20 dark:shadow-black/40'
                  >
                    <Search className='h-5 w-5' />
                    <span>Browse jobs &mdash; no login</span>
                    <ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
                  </Button>
                )}
                <Button
                  variant='secondary'
                  size='lg'
                  onClick={onGetStarted}
                  className='h-auto rounded-xl border-2 px-8 py-4 text-base'
                >
                  {primaryLabel}
                </Button>
              </div>
            </div>

            {/* Career card mockup — shows the finished product, not building blocks */}
            <div data-reveal className='reveal-item'>
              <HeroCareerCardMockup isDark={isDark} />
            </div>
          </div>
        </section>

        {/*
         ═══════════════════════════════════════════════════════════════════════
         SECTION 2 — Apply Mode (the main attraction)
         Anchor section. The split-view mockup is the page's primary product
         visual; the three pillars carry the story. Most users will live here
         inside the app, so the homepage spends real estate on it.
         ═══════════════════════════════════════════════════════════════════════
        */}
        <section id='apply-mode' className='scroll-mt-24 py-16 sm:py-24'>
          <HubSectionPanel isDark={isDark} accent='teal' contentClassName='p-6 sm:p-8 lg:p-10'>
            <BlockCard
              variant='embed'
              icon={Briefcase}
              title='Apply Mode'
              description='Pick the job. Watch your career card take shape.'
            >
              <div className='grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14'>
                <div data-reveal className='reveal-item'>
                  <BuildModeMockup isDark={isDark} />
                </div>

                <div data-reveal className='reveal-item'>
                  <p className={cn('text-base leading-relaxed sm:text-lg', isDark ? 'text-gray-300' : 'text-slate-700')}>
                    Storm starts with the role you actually want, then guides you to build only what that job needs. Your verified career card grows in real time on the right while the job stays anchored on the left, and you graduate when you&rsquo;re ready to apply.
                  </p>

                  <ol className='mt-8 space-y-6'>
                    {[
                      {
                        n: '1',
                        title: 'The job goes on the left.',
                        body: (
                          <>
                            Pick any open role from a blended feed &mdash; Storm employers first, aggregated listings underneath. Storm reads the requirements and reverse-engineers exactly what you&rsquo;ll need to stand out.
                          </>
                        ),
                      },
                      {
                        n: '2',
                        title: 'Your card grows on the right.',
                        body: (
                          <>
                            CDL, employment history, GitHub, MVR, portfolio &mdash; drop in only what this job needs. Each block is verified independently and updates everywhere it&rsquo;s used.
                          </>
                        ),
                      },
                      {
                        n: '3',
                        title: 'Apply with a tailored lens.',
                        body: (
                          <>
                            Stormi drafts a focused view of your card &mdash; a <em>lens</em> &mdash; for every application. One verified profile, every angle. Employers see exactly what you chose to share.
                          </>
                        ),
                      },
                    ].map((item) => (
                      <li key={item.n} className='flex gap-4'>
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1',
                            isDark
                              ? 'bg-teal-500/15 text-teal-200 ring-teal-400/30'
                              : 'bg-teal-50 text-teal-700 ring-teal-200',
                          )}
                        >
                          {item.n}
                        </span>
                        <div className='min-w-0'>
                          <h3 className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                            {item.title}
                          </h3>
                          <p className={cn('mt-1 text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-slate-600')}>
                            {item.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  {onBrowseJobs && (
                    <div className='mt-8'>
                      <Button variant='primary' size='lg' onClick={onBrowseJobs} className='h-auto rounded-xl px-7 py-3.5'>
                        <Search className='h-5 w-5' />
                        Try Apply Mode &mdash; no login
                        <ArrowRight className='h-5 w-5' />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </BlockCard>
          </HubSectionPanel>
        </section>

        {/*
         ═══════════════════════════════════════════════════════════════════════
         SECTION 3 — Stormi
         The coach moat. A static mock of the real StormiNextStepCard sits in
         a phone frame so visitors see exactly what coaching looks like.
         ═══════════════════════════════════════════════════════════════════════
        */}
        <section id='stormi' className='scroll-mt-24 py-16 sm:py-24'>
          <HubSectionPanel isDark={isDark} accent='violet' contentClassName='p-6 sm:p-8 lg:p-10'>
            <BlockCard
              variant='embed'
              icon={Sparkles}
              title='Meet Stormi'
              description='A coach who knows your career.'
            >
              <div className='grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14'>
                <div data-reveal className='reveal-item'>
                  <p className={cn('text-base leading-relaxed sm:text-lg', isDark ? 'text-gray-300' : 'text-slate-700')}>
                    Stormi watches what you&rsquo;ve built, sees the job you&rsquo;re chasing, and tells you exactly what to do next. Every conversation builds on the last.
                  </p>

                  <ul className='mt-6 space-y-4'>
                    {[
                      {
                        icon: Eye,
                        text: 'Spots the gaps employers care about and shows you which to close first.',
                      },
                      {
                        icon: Layers,
                        text: 'Drafts a tailored lens for every job so one career card fits every application.',
                      },
                      {
                        icon: Compass,
                        text: 'Tracks your progress, celebrates each verified credential, and re-engages you when life gets in the way.',
                      },
                    ].map((row) => {
                      const Icon = row.icon
                      return (
                        <li key={row.text} className='flex gap-3'>
                          <span
                            className={cn(
                              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
                              isDark
                                ? 'bg-violet-500/15 text-violet-200 ring-violet-400/30'
                                : 'bg-violet-50 text-violet-700 ring-violet-200',
                            )}
                          >
                            <Icon className='h-3.5 w-3.5' />
                          </span>
                          <p
                            className={cn(
                              'text-sm leading-relaxed sm:text-base',
                              isDark ? 'text-gray-300' : 'text-slate-700',
                            )}
                          >
                            {row.text}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div data-reveal className='reveal-item flex justify-center'>
                  <PhoneFrame isDark={isDark}>
                    <StormiCardMock isDark={isDark} />
                  </PhoneFrame>
                </div>
              </div>
            </BlockCard>
          </HubSectionPanel>
        </section>

        {/*
         ═══════════════════════════════════════════════════════════════════════
         SECTION 4 — The Hub (graduation path)
         For users who get hooked and want full ownership of their career.
         ═══════════════════════════════════════════════════════════════════════
        */}
        <section id='hub' className='scroll-mt-24 py-16 sm:py-24'>
          <HubSectionPanel isDark={isDark} accent='indigo' contentClassName='p-6 sm:p-8 lg:p-10'>
            <BlockCard
              variant='embed'
              icon={Building2}
              title='Construct Mode'
              description='The full hub — every block, every credential, on your terms.'
            >
              <p
                className={cn(
                  'max-w-3xl text-base leading-relaxed sm:text-lg',
                  isDark ? 'text-gray-300' : 'text-slate-700',
                )}
              >
                Most users get what they need from Apply Mode and that&rsquo;s fine. When you want full ownership of your career, switch to Construct Mode &mdash; every block category, open chat with Stormi, verified credentials, and tools to maintain your professional identity over time.
              </p>

              <div className='mt-8 grid gap-4 lg:grid-cols-3'>
                {[
                  {
                    icon: Layers,
                    title: 'The full block library.',
                    body: (
                      <>
                        Every category, even the ones your current target doesn&rsquo;t need. Build the career you want, not just the one a job is asking for.
                      </>
                    ),
                    accent: isDark ? 'text-teal-300' : 'text-teal-700',
                    ring: isDark ? 'ring-teal-400/30 bg-teal-500/15' : 'ring-teal-200 bg-teal-50',
                  },
                  {
                    icon: Sparkles,
                    title: 'Stormi on your terms.',
                    body: (
                      <>
                        Open chat for career questions, deep-dives, and what-ifs that go beyond the job in front of you.
                      </>
                    ),
                    accent: isDark ? 'text-violet-300' : 'text-violet-700',
                    ring: isDark ? 'ring-violet-400/30 bg-violet-500/15' : 'ring-violet-200 bg-violet-50',
                  },
                  {
                    icon: Link2,
                    title: 'Verified credentials.',
                    body: (
                      <>
                        Selective disclosure of third-party-verified facts &mdash; built for carriers who need trust without the PDF mess.
                      </>
                    ),
                    accent: isDark ? 'text-cyan-300' : 'text-cyan-700',
                    ring: isDark ? 'ring-cyan-400/30 bg-cyan-500/15' : 'ring-cyan-200 bg-cyan-50',
                  },
                ].map((cell) => {
                  const Icon = cell.icon
                  return (
                    <div
                      key={cell.title}
                      data-reveal
                      className={cn(
                        'reveal-item rounded-xl border p-5',
                        isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white/70',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-3 flex h-9 w-9 items-center justify-center rounded-lg ring-1',
                          cell.ring,
                          cell.accent,
                        )}
                      >
                        <Icon className='h-4 w-4' />
                      </div>
                      <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                        {cell.title}
                      </h3>
                      <p className={cn('mt-1 text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-slate-600')}>
                        {cell.body}
                      </p>
                    </div>
                  )
                })}
              </div>
            </BlockCard>
          </HubSectionPanel>
        </section>

        {/*
         ═══════════════════════════════════════════════════════════════════════
         SECTION 5 — For employers + Bottom CTA (combined)
         Brief employer pitch (3 short lines, no card grid), then the final
         invite. Employers come last because they're a smaller audience and
         their value is downstream of having verified candidates here first.
         ═══════════════════════════════════════════════════════════════════════
        */}
        <section id='for-employers' className='scroll-mt-24 py-16 sm:py-24'>
          <div className='mx-auto max-w-3xl'>
            {/* 5a — For employers */}
            <div data-reveal className='reveal-item text-center'>
              <p
                className={cn(
                  'mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]',
                  isDark ? 'text-cyan-300/90' : 'text-cyan-700',
                )}
              >
                For employers
              </p>
              <h2 className={cn('text-2xl font-bold sm:text-3xl', isDark ? 'text-white' : 'text-gray-900')}>
                Verified candidates, curated framings, real signal.
              </h2>
              <ul
                className={cn(
                  'mx-auto mt-6 max-w-2xl space-y-3 text-left text-sm leading-relaxed sm:text-base',
                  isDark ? 'text-gray-300' : 'text-slate-700',
                )}
              >
                {[
                  'On-chain verified credentials let you trust a candidate at a glance.',
                  'Structured blocks let you compare candidates fairly across one consistent shape.',
                  'Lens framings show exactly what each candidate chose to highlight for your role.',
                ].map((line) => (
                  <li key={line} className='flex gap-3'>
                    <CheckCircle
                      className={cn('mt-1 h-4 w-4 shrink-0', isDark ? 'text-cyan-300' : 'text-cyan-700')}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant='secondary'
                size='md'
                onClick={onGetStarted}
                className='mt-8 h-auto rounded-xl px-6 py-3'
              >
                <Building2 className='h-4 w-4' />
                See employer pricing
              </Button>
            </div>

            {/* 5b — Bottom CTA */}
            <div
              data-reveal
              className={cn(
                'reveal-item mt-16 border-t pt-12 text-center sm:mt-20 sm:pt-16',
                isDark ? 'border-gray-800' : 'border-slate-200',
              )}
            >
              <h2 className={cn('text-3xl font-bold sm:text-4xl md:text-5xl', isDark ? 'text-white' : 'text-gray-900')}>
                Ready when you are.
              </h2>
              <p
                className={cn(
                  'mx-auto mt-4 max-w-xl text-base leading-relaxed sm:text-lg',
                  isDark ? 'text-gray-400' : 'text-slate-600',
                )}
              >
                Browse without an account. Connect when you&rsquo;re ready to apply.
              </p>

              <div className='mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center'>
                {onBrowseJobs && (
                  <Button
                    variant='primary'
                    size='lg'
                    onClick={onBrowseJobs}
                    className='group h-auto rounded-xl px-8 py-4 text-base shadow-xl'
                  >
                    <Search className='h-5 w-5' />
                    Browse jobs
                    <ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
                  </Button>
                )}
                <Button
                  variant='secondary'
                  size='lg'
                  onClick={onGetStarted}
                  className='h-auto rounded-xl px-8 py-4 text-base'
                >
                  {primaryLabel}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Reveal animation */}
        <style jsx>{`
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
        `}</style>
      </div>
    </>
  )
}
