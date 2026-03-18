/**
 * Block-Inferred Journey Progress
 *
 * Instead of hardcoded role-based checklists, AvA builds journey steps
 * dynamically from the blocks the user has installed. A user with only
 * general blocks sees generic guidance; adding a driver-dot-application
 * block automatically surfaces DOT-specific steps.
 *
 * Employer journey remains role-based (separate hub/block system).
 */

import type { PageType, UserRole } from '@/stores/types'

// ===== SHARED TYPES (unchanged — consumed by AvaJourneyGuide) =====

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

/**
 * Flat bag of completion signals that the journey store assembles
 * from various stores. Each block's step resolver picks what it needs.
 */
export interface BlockProgressData {
  isWalletConnected: boolean
  profileCompleteness: number
  /** Any resume (driver or developer) */
  hasResume: boolean
  hasDriverResume: boolean
  hasDeveloperResume: boolean
  resumeCount: number
  dotAppComplete: boolean
  dotAppVerified: boolean
  dotAppInProgress: boolean
  /** MVR order finished (result ready / review) */
  mvrComplete: boolean
  /** User placed an MVR order (may still be processing) */
  hasMvrOrder: boolean
  hasAppliedToJobs: boolean
  jobApplicationCount: number
  hasPortfolioProjects: boolean
  portfolioProjectCount: number
  hasConnectedGithub: boolean
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
      action: !d.hasDeveloperResume ? { label: 'Build Resume', target: 'resume' } : undefined,
    }],
    nextAction: (d) => !d.hasDeveloperResume ? {
      label: 'Build Your Resume',
      description: 'Showcase your experience to hiring managers',
      target: 'resume',
      priority: 'high',
    } : null,
  },

  'driver-dot-application': {
    resolve: (d) => {
      // Form submitted (DB is_complete) counts as done; on-chain verify is optional follow-up
      const done = d.dotAppComplete || d.dotAppVerified
      return [{
        id: 'driver-dot-application',
        label: 'DOT Application',
        description: 'Complete your DOT compliance application',
        status: done ? 'complete' : d.dotAppInProgress ? 'in_progress' : 'pending',
        action: !done
          ? {
              label: d.dotAppInProgress ? 'Continue Application' : 'Start Application',
              target: 'dotapp',
            }
          : d.dotAppComplete && !d.dotAppVerified
            ? { label: 'Verify on Blockchain (optional)', target: 'dotapp' }
            : undefined,
      }]
    },
    nextAction: (d) => {
      if (d.dotAppComplete || d.dotAppVerified) return null
      return {
        label: d.dotAppInProgress ? 'Finish DOT Application' : 'Start DOT Application',
        description: 'Complete your DOT compliance application',
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

  'driver-cdl-credentials': {
    // No active journey step — CDL credentials are informational
    resolve: () => [],
  },

  'developer-portfolio': {
    resolve: (d) => [{
      id: 'developer-portfolio',
      label: 'Add Portfolio Projects',
      description: 'Showcase your best work to employers',
      status: d.hasPortfolioProjects ? 'complete' : 'pending',
      action: !d.hasPortfolioProjects ? { label: 'Add Project', target: 'portfolio' } : undefined,
    }],
    nextAction: (d) => !d.hasPortfolioProjects ? {
      label: 'Add Your First Project',
      description: 'Showcase your best work',
      target: 'portfolio',
      priority: 'high',
    } : null,
  },

  'developer-github': {
    resolve: (d) => [{
      id: 'developer-github',
      label: 'Connect GitHub',
      description: 'Link your GitHub to show contributions',
      status: d.hasConnectedGithub ? 'complete' : 'pending',
      action: !d.hasConnectedGithub ? { label: 'Connect GitHub', target: null } : undefined,
    }],
    nextAction: (d) => !d.hasConnectedGithub ? {
      label: 'Connect GitHub',
      description: 'Show employers your open-source contributions',
      target: null,
      priority: 'medium',
    } : null,
  },

  'developer-projects': {
    // Covered by developer-portfolio; no separate step
    resolve: () => [],
  },

  'general-skills': {
    // Informational block — no journey step (skills are part of profile completeness)
    resolve: () => [],
  },

  'general-work-history': {
    // Informational block — no journey step (work history is part of profile completeness)
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

  for (const blockType of installedBlockTypes) {
    const entry = BLOCK_JOURNEY_MAP[blockType]
    if (!entry) continue
    blockSteps.push(...entry.resolve(data))
    if (entry.nextAction) {
      const action = entry.nextAction(data)
      if (action) blockActions.push(action)
    }
  }

  // 3. Profile step — after block steps so actionable items come first
  const profileStep: JourneyStep = {
    id: 'profile',
    label: 'Complete Your Profile',
    description: 'Fill out your name, headline, and avatar',
    status: data.profileCompleteness >= 80
      ? 'complete'
      : data.profileCompleteness > 0 ? 'in_progress' : 'pending',
    progress: data.profileCompleteness,
    action: data.profileCompleteness < 80 ? { label: 'View Profile', target: null } : undefined,
  }

  // "Find Jobs" is a permanent hub feature — always the last journey step.
  const jobStep: JourneyStep = {
    id: 'find-jobs',
    label: 'Browse & Apply to Jobs',
    description: 'Search StormChain and external job listings',
    status: data.hasAppliedToJobs ? 'complete' : 'pending',
    action: !data.hasAppliedToJobs ? { label: 'Find Jobs', target: 'jobs' } : undefined,
  }

  // Referral step — appears once the user has at least one block installed
  const referralStep: JourneyStep | null = installedBlockTypes.length > 0
    ? {
        id: 'referral',
        label: 'Share Your Referral Link',
        description: 'Invite a friend — you both earn 2.5 STORM when they take a paid action',
        status: 'pending', // stays pending — it's a perpetual nudge, not a gate
        isOptional: true,
      }
    : null

  const steps = [walletStep, ...blockSteps, profileStep, jobStep, ...(referralStep ? [referralStep] : [])]

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
    if (data.profileCompleteness < 80) {
      nextActions.push({
        label: 'Complete Profile',
        description: `Your profile is ${data.profileCompleteness}% complete`,
        target: null,
        priority: 'medium',
      })
    }
  } else {
    // Has blocks — show block-specific actions first
    nextActions.push(...blockActions)

    if (data.profileCompleteness < 80) {
      nextActions.push({
        label: 'Complete Profile',
        description: `Your profile is ${data.profileCompleteness}% complete`,
        target: null,
        priority: 'low',
      })
    }
    if (!data.hasAppliedToJobs) {
      nextActions.push({
        label: 'Find Jobs',
        description: 'Search StormChain and external job listings',
        target: 'jobs',
        priority: 'low',
      })
    }
  }

  // 6. Greeting
  let greeting: string
  if (!data.isWalletConnected) {
    greeting = "Welcome to StormChain! Let's get you started."
  } else if (installedBlockTypes.length === 0) {
    greeting = "Add blocks to your hub to build your professional profile."
  } else if (overallProgress < 30) {
    greeting = "Great start! Let's keep building your profile."
  } else if (overallProgress < 60) {
    greeting = "You're making solid progress!"
  } else if (overallProgress < 90) {
    greeting = "Almost there — just a few more steps."
  } else {
    greeting = "Looking great! Your profile is ready to impress."
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
      action: !data.companyProfileComplete ? { label: 'Set Up Company', target: null } : undefined,
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
    nextActions.push({ label: 'Complete Company Profile', description: 'Set up your company to attract talent', target: null, priority: 'high' })
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
