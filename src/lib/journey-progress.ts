/**
 * Block-Inferred Journey Progress
 *
 * Instead of hardcoded role-based checklists, Stormi builds journey steps
 * dynamically from the blocks the user has installed. A user with only
 * general blocks sees generic guidance; adding a driver-dot-application
 * block automatically surfaces DOT-specific steps.
 *
 * Employer journey remains role-based (separate hub/block system).
 */

import type { PageType, UserRole } from '@/stores/types'

// ===== SHARED TYPES (unchanged — consumed by StormiJourneyGuide) =====

export type StepStatus = 'complete' | 'in_progress' | 'pending' | 'skipped'

export interface JourneyStep {
  id: string
  label: string
  description: string
  status: StepStatus
  completedAt?: string
  progress?: number
  action?: {
    label: string
    target: PageType
  }
  isOptional?: boolean
}

export interface NextAction {
  label: string
  description: string
  target: PageType
  priority: 'high' | 'medium' | 'low'
}

export interface JourneyProgress {
  role: UserRole
  overallProgress: number
  completedSteps: number
  totalSteps: number
  steps: JourneyStep[]
  currentStep: JourneyStep | null
  nextActions: NextAction[]
  greeting: string
}

// ===== BLOCK-AWARE PROGRESS DATA =====

/** Identity fields from user_profiles — what the Profile modal / Build tile track. */
export interface IdentityProfileFields {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
}

/**
 * Profile tile / journey "profile" step = identity only (name + contact + location).
 * Deliberately NOT the hub-wide completeness % (that folds in CDL/resume/DOT/MVR
 * and would keep the tile "In progress" forever after filling out the modal).
 */
export function deriveIdentityProfileStatus(
  identity: IdentityProfileFields | null | undefined,
): StepStatus {
  const first = identity?.firstName?.trim() ?? ''
  const last = identity?.lastName?.trim() ?? ''
  const email = identity?.email?.trim() ?? ''
  const phone = identity?.phone?.trim() ?? ''
  const city = identity?.city?.trim() ?? ''
  const state = identity?.state?.trim() ?? ''

  const hasName = Boolean(first && last)
  const hasContact = Boolean(email || phone)
  const hasLocation = Boolean(city || state)

  if (hasName && hasContact && hasLocation) return 'complete'
  if (hasName || hasContact || hasLocation) return 'in_progress'
  return 'pending'
}

/**
 * Flat bag of completion signals that the journey store assembles
 * from various stores. Each block's step resolver picks what it needs.
 */
export interface BlockProgressData {
  isWalletConnected: boolean
  /** Hub-wide weighted score (Stormi / legacy UI). Not used for the Profile step. */
  profileCompleteness: number
  /** Identity fields for the Profile journey step + Build board tile. */
  identityProfile: IdentityProfileFields | null
  /** Any resume (driver, developer, or general) */
  hasResume: boolean
  hasDriverResume: boolean
  hasDeveloperResume: boolean
  hasGeneralResume: boolean
  resumeCount: number
  dotAppComplete: boolean
  dotAppVerified: boolean
  dotAppInProgress: boolean
  /** MVR order finished (result ready / review) */
  mvrComplete: boolean
  /** User placed an MVR order (may still be processing) */
  hasMvrOrder: boolean
  /** PSP order finished (result stored / review) */
  pspComplete: boolean
  hasPspOrder: boolean
  hasAppliedToJobs: boolean
  jobApplicationCount: number
  /** Portfolio URL set (block_dev_portfolio.portfolio_url) — drives journey step completion */
  hasPortfolioUrl: boolean
  hasPortfolioProjects: boolean
  portfolioProjectCount: number
  hasConnectedGithub: boolean
  /** Full screening consent package on file (any employer) — drives driver-screening-consent journey */
  hasScreeningConsentBundle?: boolean
  /** Candidate has at least one Verified by Storm attestation issued */
  hasVerifiedAttestation?: boolean
}

// ===== BLOCK → JOURNEY STEP MAP =====

/**
 * Each block type declares the journey steps it contributes.
 * `resolve` receives the shared progress data and returns fully-hydrated steps.
 * This is the only place you need to touch when adding a new block type.
 */
interface BlockJourneyEntry {
  resolve: (data: BlockProgressData) => JourneyStep[]
  /** Optional next-action when the block's work isn't done yet */
  nextAction?: (data: BlockProgressData) => NextAction | null
}

const BLOCK_JOURNEY_MAP: Record<string, BlockJourneyEntry> = {
  'storm-resume': {
    resolve: (d) => [{
      id: 'storm-resume',
      label: 'Provven Resume',
      description: 'Generated from your DOT application (or upload) — optional career card artifact',
      status: d.hasResume ? 'complete' : 'pending',
      isOptional: true,
      action: !d.hasResume ? { label: 'Open DOT to prefill', target: 'dotapp' } : undefined,
    }],
    // DOT is the spine — don't nudge resume as the primary next action
    nextAction: () => null,
  },

  'driver-resume': {
    resolve: (d) => [{
      id: 'driver-resume',
      label: 'Upload Your Resume',
      description: 'Build or upload a professional resume',
      status: d.hasDriverResume ? 'complete' : 'pending',
      action: !d.hasDriverResume ? { label: 'Create Resume', target: 'resume' } : undefined,
    }],
    nextAction: (d) => !d.hasDriverResume ? {
      label: 'Create Your Resume',
      description: 'Stand out to employers with a professional resume',
      target: 'resume',
      priority: 'high',
    } : null,
  },

  'developer-resume': {
    resolve: (d) => [{
      id: 'developer-resume',
      label: 'Build Your Resume',
      description: 'Create a developer-focused resume',
      status: d.hasDeveloperResume ? 'complete' : 'pending',
      action: !d.hasDeveloperResume ? { label: 'Build Resume', target: 'developer-resume' } : undefined,
    }],
    nextAction: (d) => !d.hasDeveloperResume ? {
      label: 'Build Your Resume',
      description: 'Showcase your experience to hiring managers',
      target: 'developer-resume',
      priority: 'high',
    } : null,
  },

  'general-resume': {
    resolve: (d) => [{
      id: 'general-resume',
      label: 'Build Your Resume',
      description: 'Create a professional resume for any industry',
      status: d.hasGeneralResume ? 'complete' : 'pending',
      action: !d.hasGeneralResume ? { label: 'Build Resume', target: 'general-resume' } : undefined,
    }],
    nextAction: (d) => !d.hasGeneralResume ? {
      label: 'Build Your Resume',
      description: 'Your career card starts with a strong resume',
      target: 'general-resume',
      priority: 'high',
    } : null,
  },

  'general-employment-verification': {
    resolve: () => [
      {
        id: 'general-employment-verification',
        label: 'Employment date verification',
        description:
          'Optional: invite past employers to confirm your work dates by email (voluntary for them)',
        status: 'pending',
        isOptional: true,
        action: { label: 'Manage', target: 'employment-verification' },
      },
    ],
  },

  'driver-screening-consent': {
    resolve: (d) => [
      {
        id: 'driver-screening-consent',
        label: 'Employer screening consent',
        description: 'FCRA disclosure, FMCSA PSP authorization, and CDLIS written consent',
        status: d.hasScreeningConsentBundle ? 'complete' : 'pending',
        action: !d.hasScreeningConsentBundle
          ? { label: 'Complete consent package', target: 'screening-consent' }
          : undefined,
      },
    ],
    nextAction: (d) =>
      d.hasScreeningConsentBundle
        ? null
        : {
            label: 'Finish screening consent',
            description: 'Your employer needs this package before they can order MVR or PSP for you',
            target: 'screening-consent',
            priority: 'high',
          },
  },

  'driver-dot-application': {
    resolve: (d) => {
      // DEC-2026-07-001: complete = form submitted. Issuer coverage is separate (verified-% meter).
      // Never nudge "Verify on Blockchain" for a self-reported DOT app.
      const done = d.dotAppComplete
      return [{
        id: 'driver-dot-application',
        label: 'DOT Application',
        description: 'Build your federal driver qualification file — the hub spine for screening',
        status: done ? 'complete' : d.dotAppInProgress ? 'in_progress' : 'pending',
        action: !done
          ? {
              label: d.dotAppInProgress ? 'Continue Application' : 'Start Application',
              target: 'dotapp',
            }
          : undefined,
      }]
    },
    nextAction: (d) => {
      if (d.dotAppComplete) return null
      return {
        label: d.dotAppInProgress ? 'Finish DOT Application' : 'Start DOT Application',
        description: 'Your DQ file is the first thing to complete on your hub',
        target: 'dotapp',
        priority: 'high',
      }
    },
  },

  'driver-mvr': {
    resolve: (d) => [{
      id: 'driver-mvr',
      label: 'Motor Vehicle Record',
      description: 'Order your MVR for employer verification',
      status: d.mvrComplete ? 'complete' : d.hasMvrOrder ? 'in_progress' : 'pending',
      action: !d.mvrComplete
        ? { label: d.hasMvrOrder ? 'View MVR status' : 'Order MVR', target: 'mvr' }
        : undefined,
      isOptional: true,
    }],
    nextAction: (d) => {
      if (d.mvrComplete || d.hasMvrOrder) return null
      return {
        label: 'Order MVR',
        description: 'Add your driving record to boost your profile',
        target: 'mvr',
        priority: 'medium',
      }
    },
  },

  'driver-psp': {
    resolve: (d) => [{
      id: 'driver-psp',
      label: 'PSP Report',
      description: 'Order your FMCSA crash and inspection history',
      status: d.pspComplete ? 'complete' : d.hasPspOrder ? 'in_progress' : 'pending',
      action: !d.pspComplete
        ? { label: d.hasPspOrder ? 'View PSP status' : 'Order PSP', target: 'psp' }
        : undefined,
      isOptional: true,
    }],
    nextAction: (d) => {
      if (d.pspComplete || d.hasPspOrder) return null
      return {
        label: 'Order PSP',
        description: 'Add federal safety history for carriers that require it',
        target: 'psp',
        priority: 'medium',
      }
    },
  },

  'driver-cdl-credentials': {
    // No active journey step — CDL credentials are informational
    resolve: () => [],
  },

  'developer-portfolio': {
    resolve: (d) => [{
      id: 'developer-portfolio',
      label: 'Link Your Portfolio',
      description: 'Add your portfolio URL for a live preview on your career card',
      status: d.hasPortfolioUrl ? 'complete' : 'pending',
      action: !d.hasPortfolioUrl ? { label: 'Add Portfolio URL', target: 'portfolio' } : undefined,
    }],
    nextAction: (d) => !d.hasPortfolioUrl ? {
      label: 'Link Your Portfolio',
      description: 'Add your portfolio URL so employers see a live preview',
      target: 'portfolio',
      priority: 'high',
    } : null,
  },

  'developer-github': {
    resolve: (d) => [{
      id: 'developer-github',
      label: 'Connect GitHub',
      description: 'Link your GitHub to show contributions and repo stats on your career card',
      status: d.hasConnectedGithub ? 'complete' : 'pending',
      action: !d.hasConnectedGithub ? { label: 'Connect GitHub', target: 'github' } : undefined,
    }],
    nextAction: (d) => !d.hasConnectedGithub ? {
      label: 'Connect GitHub',
      description: 'Show employers your open-source contributions',
      target: 'github',
      priority: 'medium',
    } : null,
  },

  'developer-projects': {
    // Covered by developer-portfolio; no separate step
    resolve: () => [],
  },

}

// ===== CANDIDATE / BLOCK-BASED JOURNEY =====

export function calculateBlockJourney(
  installedBlockTypes: string[],
  data: BlockProgressData,
): JourneyProgress {
  // 1. Wallet step — always first
  const walletStep: JourneyStep = {
    id: 'wallet',
    label: 'Connect Wallet',
    description: 'Sign in with your wallet to get started',
    status: data.isWalletConnected ? 'complete' : 'pending',
    action: !data.isWalletConnected ? { label: 'Sign In', target: 'signin' } : undefined,
  }

  // 2. Block-contributed steps
  const blockSteps: JourneyStep[] = []
  const blockActions: NextAction[] = []

  const legacyResumeBlocks = new Set(['driver-resume', 'developer-resume', 'general-resume'])
  const useStormResumeJourney = installedBlockTypes.includes('storm-resume')

  for (const blockType of installedBlockTypes) {
    if (useStormResumeJourney && legacyResumeBlocks.has(blockType)) continue
    const entry = BLOCK_JOURNEY_MAP[blockType]
    if (!entry) continue
    blockSteps.push(...entry.resolve(data))
    if (entry.nextAction) {
      const action = entry.nextAction(data)
      if (action) blockActions.push(action)
    }
  }

  // 3. Profile step — identity only (name / contact / location). The old
  //    profileCompleteness >= 80 gate wrongly required CDL + resume + DOT.
  const identityStatus = deriveIdentityProfileStatus(data.identityProfile)
  const profileStep: JourneyStep = {
    id: 'profile',
    label: 'Complete Your Profile',
    description: 'Name, contact, and location',
    status: identityStatus,
    action: identityStatus !== 'complete' ? { label: 'View Profile', target: null } : undefined,
  }

  const verifiedFactsStep: JourneyStep | null =
    data.mvrComplete || data.pspComplete || data.hasScreeningConsentBundle
      ? {
          id: 'verified-attestation',
          label: 'Share a verified fact',
          description:
            'Issue a Verified by Provven credential from your screening data and choose which employers see it',
          status: data.hasVerifiedAttestation ? 'complete' : 'pending',
          isOptional: true,
        }
      : null

  // "Find Jobs" is a permanent hub feature — always the last journey step.
  const jobStep: JourneyStep = {
    id: 'find-jobs',
    label: 'Browse & Apply to Jobs',
    description: 'Search Provven and external job listings',
    status: data.hasAppliedToJobs ? 'complete' : 'pending',
    action: !data.hasAppliedToJobs ? { label: 'Find Jobs', target: 'jobs' } : undefined,
  }

  // Referral step — appears once the user has at least one block installed
  const referralStep: JourneyStep | null = installedBlockTypes.length > 0
    ? {
        id: 'referral',
        label: 'Share Your Referral Link',
        description: 'Invite a friend — share your referral link from the hub',
        status: 'pending', // stays pending — it's a perpetual nudge, not a gate
        isOptional: true,
      }
    : null

  const steps = [
    walletStep,
    ...blockSteps,
    profileStep,
    ...(verifiedFactsStep ? [verifiedFactsStep] : []),
    jobStep,
    ...(referralStep ? [referralStep] : []),
  ]

  // 4. Calculate progress
  const requiredSteps = steps.filter((s) => !s.isOptional)
  const completedSteps = steps.filter((s) => s.status === 'complete').length
  const totalSteps = requiredSteps.length
  const overallProgress = steps.length > 0
    ? Math.round((completedSteps / steps.length) * 100)
    : 0

  const currentStep = steps.find((s) => s.status !== 'complete') || null

  // 5. Build next actions — block-specific first, then generic fallbacks
  const nextActions: NextAction[] = []

  if (!data.isWalletConnected) {
    nextActions.push({
      label: 'Sign In',
      description: 'Connect your wallet to get started',
      target: 'signin',
      priority: 'high',
    })
  } else if (installedBlockTypes.length === 0) {
    // Zero blocks — the most important action is discovering the Block Store
    nextActions.push({
      label: 'Explore the Block Store',
      description: 'Browse blocks to build your professional profile',
      target: 'block-store',
      priority: 'high',
    })
    if (identityStatus !== 'complete') {
      nextActions.push({
        label: 'Complete Profile',
        description: 'Add your name, contact, and location',
        target: null,
        priority: 'medium',
      })
    }
  } else {
    // Has blocks — show block-specific actions first
    nextActions.push(...blockActions)

    if (identityStatus !== 'complete') {
      nextActions.push({
        label: 'Complete Profile',
        description: 'Add your name, contact, and location',
        target: null,
        priority: 'low',
      })
    }
    if (!data.hasAppliedToJobs) {
      nextActions.push({
        label: 'Find Jobs',
        description: 'Search Provven and external job listings',
        target: 'jobs',
        priority: 'low',
      })
    }
  }

  // 6. Greeting
  let greeting: string
  if (!data.isWalletConnected) {
    greeting = "Welcome to Provven! Let's get you started."
  } else if (installedBlockTypes.length === 0) {
    greeting = 'Add blocks to your hub — each one is proof employers see on your Career Card.'
  } else if (overallProgress < 30) {
    greeting = 'Great start — keep going so your card is credible when you apply.'
  } else if (overallProgress < 60) {
    greeting = "You're making solid progress!"
  } else if (overallProgress < 90) {
    greeting = 'Almost there — a few more steps and you are apply-ready.'
  } else {
    greeting = 'Looking great — your Career Card is in strong shape for applications.'
  }

  return {
    role: null,
    overallProgress,
    completedSteps,
    totalSteps,
    steps,
    currentStep,
    nextActions: nextActions.slice(0, 3),
    greeting,
  }
}

// ===== EMPLOYER JOURNEY (role-based — separate hub system) =====

export interface EmployerProgressData {
  isWalletConnected: boolean
  hasCompanyProfile: boolean
  companyProfileComplete: boolean
  hasPostedJob: boolean
  jobPostCount: number
  hasReviewedApplicants: boolean
  applicantCount: number
  hasRequestedVerification: boolean
}

export function calculateEmployerProgress(data: EmployerProgressData): JourneyProgress {
  const steps: JourneyStep[] = [
    {
      id: 'wallet',
      label: 'Connect Wallet',
      description: 'Sign in with your wallet to get started',
      status: data.isWalletConnected ? 'complete' : 'pending',
      action: !data.isWalletConnected ? { label: 'Sign In', target: 'signin' } : undefined,
    },
    {
      id: 'company',
      label: 'Company Profile',
      description: 'Set up your company profile to attract talent',
      status: data.companyProfileComplete ? 'complete' : data.hasCompanyProfile ? 'in_progress' : 'pending',
      action: !data.companyProfileComplete ? { label: 'Set Up Company', target: 'company-profile' } : undefined,
    },
    {
      id: 'postjob',
      label: 'Post a Job',
      description: 'Create your first job posting',
      status: data.hasPostedJob ? 'complete' : 'pending',
      action: !data.hasPostedJob ? { label: 'Post Job', target: 'post-job' } : undefined,
    },
    {
      id: 'review',
      label: 'Review Applicants',
      description: 'Review and manage job applications',
      status: data.hasReviewedApplicants ? 'complete' : data.applicantCount > 0 ? 'in_progress' : 'pending',
      action: data.applicantCount > 0 ? { label: 'View Applicants', target: 'applicants' } : undefined,
    },
    {
      id: 'verify',
      label: 'Request Verifications',
      description: 'Verify credentials and employment history',
      status: data.hasRequestedVerification ? 'complete' : 'pending',
      isOptional: true,
    },
  ]

  const completedSteps = steps.filter((s) => s.status === 'complete').length
  const totalSteps = steps.filter((s) => !s.isOptional).length
  const overallProgress = Math.round((completedSteps / steps.length) * 100)
  const currentStep = steps.find((s) => s.status !== 'complete') || null

  const nextActions: NextAction[] = []
  if (!data.isWalletConnected) {
    nextActions.push({ label: 'Sign In', description: 'Connect your wallet to start hiring', target: 'signin', priority: 'high' })
  } else if (!data.companyProfileComplete) {
    nextActions.push({ label: 'Complete Company Profile', description: 'Set up your company to attract talent', target: 'company-profile', priority: 'high' })
  } else if (!data.hasPostedJob) {
    nextActions.push({ label: 'Post Your First Job', description: 'Start receiving applications', target: 'post-job', priority: 'high' })
  } else if (data.applicantCount > 0) {
    nextActions.push({ label: `Review ${data.applicantCount} Applicant${data.applicantCount > 1 ? 's' : ''}`, description: 'Check out who has applied', target: 'applicants', priority: 'high' })
  } else {
    nextActions.push({ label: 'Find Talent', description: 'Search for qualified candidates in our network', target: 'talent-search', priority: 'medium' })
  }

  let greeting: string
  if (!data.isWalletConnected) {
    greeting = "Welcome! Let's get your company set up."
  } else if (!data.companyProfileComplete) {
    greeting = "Let's complete your company profile."
  } else if (!data.hasPostedJob) {
    greeting = "Ready to find great talent? Post a job!"
  } else if (data.applicantCount > 0) {
    greeting = `You have ${data.applicantCount} applicant${data.applicantCount > 1 ? 's' : ''} waiting!`
  } else {
    greeting = "Your hiring pipeline is set up. Keep recruiting!"
  }

  return {
    role: 'employer',
    overallProgress,
    completedSteps,
    totalSteps,
    steps,
    currentStep,
    nextActions: nextActions.slice(0, 2),
    greeting,
  }
}
