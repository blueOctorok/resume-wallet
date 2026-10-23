'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getBlockDefinition, type BlockDefinition } from '@/lib/block-registry'
import LoadingScreen from '@/components/LoadingScreen'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'
import Button from '@/components/ui/Button'
import {
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  Briefcase,
  MapPin,
} from 'lucide-react'

interface InviteData {
  valid: boolean
  invite: {
    id: string
    status: string
    type: string
    targetBlockType: string | null
    candidateEmail: string | null
    candidateName: string | null
    welcomeMessage: string | null
    expiresAt: string | null
  }
  company: { id: string; name: string } | null
  job: { id: string; title: string; description: string | null; location: string | null } | null
  invalidReason: 'expired' | 'completed' | 'cancelled' | null
}

interface LandingContent {
  label: string
  headline: (company: string) => string
  description: (company: string) => string
  checklistTitle: string
  checklist: string[]
  timeEstimate: string
  ctaLabel: string
}

function buildLandingContent(block: BlockDefinition | null): LandingContent {
  if (!block) {
    return {
      label: 'Invitation',
      headline: (company) => `${company} invited you`,
      description: (company) =>
        `${company} invited you to Provven. Create an account and add what they asked for. Only companies you authorize can see it.`,
      checklistTitle: "What you'll do",
      checklist: [
        'Create your Provven account',
        'Set up your profile',
        'Add the documents they asked for',
      ],
      timeEstimate: '5–10 minutes',
      ctaLabel: 'Get started',
    }
  }

  return {
    label: block.label,
    headline: (company) => `${company} wants you on their team`,
    description: (company) =>
      `${company} invited you to complete ${block.label} on Provven. ${block.description} Only companies you authorize can see what you submit.`,
    checklistTitle: "What you'll do",
    checklist: [
      'Create your Provven account',
      `Complete your ${block.label}`,
      'Review and submit your information',
    ],
    timeEstimate: block.complexity === 'complex' ? '15–25 minutes' : block.complexity === 'moderate' ? '10–15 minutes' : '5–10 minutes',
    ctaLabel: 'Get started',
  }
}

function StandaloneCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f5] p-4 text-[#173150]">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex justify-center bg-[#f3f4f5] px-6 py-4">
          <ProvvenWordmark className="text-[15px]" tone="auto" />
        </div>
        <div className="h-[3px] bg-[#f15a2b]" aria-hidden />
        <div className="px-8 py-8 text-center">{children}</div>
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
    expired: { icon: <Clock className="mx-auto mb-4 h-12 w-12 text-[#F28A0F]" />, title: 'Invite expired', msg: 'This invite has expired. Ask the company for a new link.' },
    completed: { icon: <CheckCircle className="mx-auto mb-4 h-12 w-12 text-[#3F8A8C]" />, title: 'Already completed', msg: 'You already finished this invitation.' },
    cancelled: { icon: <XCircle className="mx-auto mb-4 h-12 w-12 text-[#9b2c2c]" />, title: 'Invite cancelled', msg: 'The company cancelled this invite.' },
    notfound: { icon: <AlertCircle className="mx-auto mb-4 h-12 w-12 text-[#9b2c2c]" />, title: 'Invite not found', msg: 'This link is not valid.' },
  }[reason]

  return (
    <StandaloneCard>
      {config.icon}
      <h1 className="mb-2 text-2xl font-bold text-[#173150]">{config.title}</h1>
      <p className="text-[#173150]/80">{config.msg}</p>
      {companyName && <p className="mt-2 text-sm text-[#939598]">{companyName}</p>}
      <Button type="button" variant="primary" className="mt-6" onClick={onGoHome}>
        Go to Provven
      </Button>
    </StandaloneCard>
  )
}

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
    router.push(`/onboard/${token}`)
  }, [token, router, starting])

  if (loading) return <LoadingScreen message="Loading your invite..." />

  if (fetchError || !inviteData) {
    return <InvalidScreen reason="notfound" onGoHome={() => router.push('/')} />
  }

  if (!inviteData.valid) {
    return (
      <InvalidScreen
        reason={inviteData.invalidReason || 'notfound'}
        companyName={inviteData.company?.name}
        onGoHome={() => router.push('/')}
      />
    )
  }

  const blockDef = inviteData.invite.targetBlockType
    ? getBlockDefinition(inviteData.invite.targetBlockType) ?? null
    : null

  const cfg = buildLandingContent(blockDef)
  const company = inviteData.company
  const job = inviteData.job
  const invite = inviteData.invite
  const companyName = company?.name || 'This company'

  const checklist = [
    ...cfg.checklist,
    `Connect directly with ${company?.name || 'the company'}`,
  ]

  return (
    <div className="min-h-screen bg-[#f3f4f5] text-[#173150]">
      <div className="mx-auto flex max-w-xl justify-center px-4 py-5">
        <ProvvenWordmark className="text-[15px]" tone="auto" />
      </div>

      <main className="mx-auto max-w-xl px-4 pb-12">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="bg-[#173150] px-8 pb-6 pt-7 text-[#f4f1ea]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4f1ea]/70">
              {companyName}
            </p>
            <p className="mt-3 text-sm text-[#f4f1ea]/80">{cfg.label}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              {cfg.headline(companyName)}
            </h1>
            {job && (
              <div className="mt-4 inline-flex flex-wrap items-center gap-2 text-sm text-[#f4f1ea]/85">
                <Briefcase className="h-4 w-4" aria-hidden />
                <span className="font-medium">{job.title}</span>
                {job.location && (
                  <>
                    <span aria-hidden>·</span>
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    <span>{job.location}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="h-[3px] bg-[#f15a2b]" aria-hidden />

          <div className="px-8 py-8">
            {invite.welcomeMessage && (
              <blockquote className="mb-6 border-l-[3px] border-[#f15a2b] pl-4">
                <p className="text-sm text-[#173150]">&quot;{invite.welcomeMessage}&quot;</p>
                <p className="mt-2 text-xs text-[#939598]">— {companyName}</p>
              </blockquote>
            )}

            <p className="mb-6 text-base leading-relaxed text-[#173150]/90">
              {cfg.description(companyName)}
            </p>

            <div className="mb-6 rounded-xl bg-[#f3f4f5] p-5">
              <p className="mb-3 text-sm font-semibold text-[#173150]">{cfg.checklistTitle}</p>
              <ul className="space-y-2.5">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-[#173150]">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#f15a2b]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-2 border-t border-[#173150]/10 pt-4">
                <Clock className="h-3.5 w-3.5 text-[#939598]" aria-hidden />
                <span className="text-xs text-[#939598]">Estimated time: {cfg.timeEstimate}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleStart}
              disabled={starting}
              isLoading={starting}
            >
              {cfg.ctaLabel}
              {!starting && <ArrowRight className="h-5 w-5" aria-hidden />}
            </Button>

            <p className="mt-5 text-center text-xs text-[#939598]">
              Only companies you authorize can see what you submit.
            </p>
          </div>
        </div>

        {invite.expiresAt && (
          <p className="mt-4 text-center text-xs text-[#939598]">
            This invite expires on {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </main>
    </div>
  )
}
