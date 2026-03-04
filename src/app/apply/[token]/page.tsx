'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LoadingScreen from '@/components/LoadingScreen'
import {
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  Shield,
  Briefcase,
  MapPin,
  Car,
  Code,
  Users,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type InviteType = 'driver_dot' | 'developer_card' | 'general'

interface InviteData {
  valid: boolean
  invite: {
    id: string
    status: string
    type: InviteType
    candidateEmail: string | null
    candidateName: string | null
    welcomeMessage: string | null
    expiresAt: string | null
  }
  company: { id: string; name: string } | null
  job: { id: string; title: string; description: string | null; location: string | null } | null
  invalidReason: 'expired' | 'completed' | 'cancelled' | null
}

// ─── Per-type content config ─────────────────────────────────────────────────

const TYPE_CONFIG = {
  driver_dot: {
    accent: 'from-teal-600 to-teal-700',
    accentLight: 'bg-teal-500/10 border-teal-500/30',
    accentText: 'text-teal-400',
    badge: 'bg-teal-500/20 text-teal-300',
    icon: <Car className="w-8 h-8 text-white" />,
    label: 'DOT Application',
    headline: (company: string) => `${company} wants you on their team`,
    description: (company: string) =>
      `${company} has invited you to complete a DOT application through StormChain — a secure, blockchain-verified platform. Your data is stored safely and only shared with companies you authorize.`,
    checklistTitle: "What you'll need:",
    checklist: [
      "Driver's license / CDL information",
      'Employment history (last 10 years)',
      'Driving record — accidents & violations',
      'Medical certificate information',
    ],
    timeEstimate: '15–25 minutes',
    ctaLabel: 'Start My DOT Application',
    redirectAction: 'dot-application',
  },
  developer_card: {
    accent: 'from-indigo-600 to-violet-700',
    accentLight: 'bg-indigo-500/10 border-indigo-500/30',
    accentText: 'text-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300',
    icon: <Code className="w-8 h-8 text-white" />,
    label: 'Career Card',
    headline: (company: string) => `${company} found your profile`,
    description: (company: string) =>
      `${company} is interested in connecting with you. Set up your StormChain career card — a verified professional profile that showcases your skills, work history, and credentials in one place.`,
    checklistTitle: "What you'll add to your career card:",
    checklist: [
      'Professional summary and skill set',
      'GitHub, LinkedIn, or portfolio links',
      'Work history and experience',
      'Any relevant certifications or achievements',
    ],
    timeEstimate: '10–15 minutes',
    ctaLabel: 'Set Up My Career Card',
    redirectAction: 'developer-profile',
  },
  general: {
    accent: 'from-slate-700 to-slate-800',
    accentLight: 'bg-slate-500/10 border-slate-500/30',
    accentText: 'text-slate-300',
    badge: 'bg-slate-500/20 text-slate-300',
    icon: <Users className="w-8 h-8 text-white" />,
    label: 'Join StormChain',
    headline: (company: string) => `${company} invited you to StormChain`,
    description: (company: string) =>
      `StormChain is a blockchain-verified credential platform for drivers and developers. ${company} is using it to find and verify top talent. Joining only takes a few minutes.`,
    checklistTitle: "What you'll do:",
    checklist: [
      'Create your free StormChain account',
      'Choose your role — driver or developer',
      'Build your verified professional profile',
      'Connect directly with companies like ' + '',
    ],
    timeEstimate: '5–10 minutes',
    ctaLabel: 'Join StormChain',
    redirectAction: 'onboarding',
  },
} as const

// ─── Error / state screens ────────────────────────────────────────────────────

function StandaloneCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 text-center">
        {children}
      </div>
    </div>
  )
}

function InvalidScreen({
  reason,
  companyName,
  onGoHome,
}: {
  reason: 'expired' | 'completed' | 'cancelled' | 'notfound'
  companyName?: string
  onGoHome: () => void
}) {
  const config = {
    expired: { icon: <Clock className="w-14 h-14 text-amber-400 mx-auto mb-4" />, title: 'Invite Expired', msg: 'This invite has expired. Contact the company for a new link.' },
    completed: { icon: <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />, title: 'Already Completed', msg: 'You have already completed this invitation. Thank you!' },
    cancelled: { icon: <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />, title: 'Invite Cancelled', msg: 'This invite has been cancelled by the company.' },
    notfound: { icon: <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />, title: 'Invite Not Found', msg: 'This link is not valid or has been removed.' },
  }[reason]

  return (
    <StandaloneCard>
      {config.icon}
      <h1 className="text-2xl font-bold text-white mb-2">{config.title}</h1>
      <p className="text-gray-400 mb-1">{config.msg}</p>
      {companyName && <p className="text-gray-500 text-sm mt-2">Company: {companyName}</p>}
      <button
        onClick={onGoHome}
        className="mt-6 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors"
      >
        Go to StormChain
      </button>
    </StandaloneCard>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (token) fetchInvite()
  }, [token])

  const fetchInvite = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/invite/${token}`)
      if (!res.ok) { setFetchError(true); return }
      const data = await res.json()
      setInviteData(data)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = useCallback(() => {
    if (starting) return
    setStarting(true)
    // Navigate to dedicated onboard flow with inline login
    router.push(`/onboard/${token}`)
  }, [token, router, starting])

  // ── Loading ──
  if (loading) return <LoadingScreen message="Loading your invite..." />

  // ── Not found ──
  if (fetchError || !inviteData) {
    return <InvalidScreen reason="notfound" onGoHome={() => router.push('/')} />
  }

  // ── Invalid invite ──
  if (!inviteData.valid) {
    return (
      <InvalidScreen
        reason={inviteData.invalidReason || 'notfound'}
        companyName={inviteData.company?.name}
        onGoHome={() => router.push('/')}
      />
    )
  }

  // ── Valid invite — render type-specific branded screen ──
  const type = inviteData.invite.type || 'driver_dot'
  const cfg = TYPE_CONFIG[type]
  const company = inviteData.company
  const job = inviteData.job
  const invite = inviteData.invite

  // For "general" type we need the company name in the checklist
  const checklist =
    type === 'general'
      ? [...cfg.checklist.slice(0, 3), `Connect directly with ${company?.name || 'top companies'}`]
      : cfg.checklist

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Minimal top bar */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-white tracking-tight">StormChain</span>
          </div>
          <span className="text-xs text-gray-500">Blockchain-Verified Credentials</span>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Main card */}
        <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">

          {/* Hero gradient header */}
          <div className={`bg-gradient-to-br ${cfg.accent} px-8 py-10`}>
            {/* Company name */}
            <p className="text-white/60 text-sm font-semibold tracking-widest uppercase mb-2">
              {company?.name || 'Company'}
            </p>

            {/* Type badge */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                {cfg.icon}
              </div>
              <span className="text-white/80 text-sm font-medium">{cfg.label}</span>
            </div>

            {/* Main headline */}
            <h1 className="text-3xl font-bold text-white leading-tight">
              {cfg.headline(company?.name || 'A Company')}
            </h1>

            {/* Job pill if present */}
            {job && (
              <div className="mt-4 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
                <Briefcase className="w-4 h-4 text-white/70" />
                <span className="text-white font-medium text-sm">{job.title}</span>
                {job.location && (
                  <>
                    <span className="text-white/40">·</span>
                    <MapPin className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-white/70 text-sm">{job.location}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="bg-gray-900 px-8 py-8">
            {/* Custom welcome message */}
            {invite.welcomeMessage && (
              <div className={`border rounded-xl p-4 mb-6 ${cfg.accentLight}`}>
                <p className="text-gray-300 text-sm italic">"{invite.welcomeMessage}"</p>
                <p className={`text-xs mt-2 ${cfg.accentText}`}>— {company?.name}</p>
              </div>
            )}

            {/* Description */}
            <p className="text-gray-300 text-base leading-relaxed mb-6">
              {cfg.description(company?.name || 'This company')}
            </p>

            {/* Checklist */}
            <div className="bg-gray-800/60 rounded-xl p-5 mb-6 border border-gray-700/50">
              <p className="text-white font-semibold text-sm mb-3">{cfg.checklistTitle}</p>
              <ul className="space-y-2.5">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700/50">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500">Estimated time: {cfg.timeEstimate}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleStart}
              disabled={starting}
              className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-bold text-lg text-white transition-all ${
                starting
                  ? 'bg-gray-700 cursor-wait'
                  : 'bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-900/30 active:scale-[0.99]'
              }`}
            >
              {starting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  {cfg.ctaLabel}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Trust line */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Shield className="w-3.5 h-3.5 text-teal-500" />
              <span>Blockchain-verified · Only {company?.name || 'this company'} sees your data</span>
            </div>
          </div>
        </div>

        {/* Expiry notice */}
        {invite.expiresAt && (
          <p className="text-center text-xs text-gray-600 mt-4">
            This invite expires on {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </main>
    </div>
  )
}
