/**
 * Journey Progress Calculator
 * 
 * Consolidates all progress tracking into one source of truth.
 * Used by the AvA Journey Guide to show accurate completion status.
 */

import type { PageType, UserRole, DriverHubStats } from '@/stores/types'

// ===== TYPES =====

export type StepStatus = 'complete' | 'in_progress' | 'pending' | 'skipped'

export interface JourneyStep {
  id: string
  label: string
  description: string
  status: StepStatus
  completedAt?: string
  progress?: number // 0-100 for partial completion (e.g., profile 60%)
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
  overallProgress: number // 0-100
  completedSteps: number
  totalSteps: number
  steps: JourneyStep[]
  currentStep: JourneyStep | null
  nextActions: NextAction[]
  greeting: string
}

// ===== DATA INTERFACES (what we need from stores) =====

export interface DriverProgressData {
  isWalletConnected: boolean
  hasResume: boolean
  resumeCount: number
  hasDotApplication: boolean
  dotAppComplete: boolean
  dotAppInProgress: boolean
  hasMvrRecord: boolean
  mvrRecordCount: number
  profileCompleteness: number
  hasAppliedToJobs: boolean
  jobApplicationCount: number
}

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

export interface DeveloperProgressData {
  isWalletConnected: boolean
  hasPortfolioProjects: boolean
  portfolioProjectCount: number
  hasResume: boolean
  hasConnectedGithub: boolean
  hasCareerScore: boolean
  careerScore: number
  hasAppliedToJobs: boolean
  jobApplicationCount: number
}

// ===== DRIVER JOURNEY =====

export function calculateDriverProgress(data: DriverProgressData): JourneyProgress {
  const steps: JourneyStep[] = [
    {
      id: 'wallet',
      label: 'Connect Wallet',
      description: 'Sign in with your wallet to get started',
      status: data.isWalletConnected ? 'complete' : 'pending',
      completedAt: data.isWalletConnected ? new Date().toISOString() : undefined,
      action: !data.isWalletConnected ? { label: 'Sign In', target: 'signin' } : undefined,
    },
    {
      id: 'resume',
      label: 'Create Resume',
      description: 'Upload or build your professional driver resume',
      status: data.hasResume ? 'complete' : 'pending',
      action: !data.hasResume ? { label: 'Create Resume', target: 'resume' } : undefined,
    },
    {
      id: 'dotapp',
      label: 'DOT Application',
      description: 'Complete your DOT compliance application',
      status: data.dotAppComplete ? 'complete' : data.dotAppInProgress ? 'in_progress' : 'pending',
      action: !data.dotAppComplete ? { label: data.dotAppInProgress ? 'Continue Application' : 'Start Application', target: 'dotapp' } : undefined,
    },
    {
      id: 'profile',
      label: 'Complete Profile',
      description: 'Reach 80% profile completeness for better visibility',
      status: data.profileCompleteness >= 80 ? 'complete' : data.profileCompleteness > 0 ? 'in_progress' : 'pending',
      progress: data.profileCompleteness,
      // null = navigate to hub (shells show hub when currentPage is null)
      action: data.profileCompleteness < 80 ? { label: 'View Profile', target: null } : undefined,
    },
    {
      id: 'mvr',
      label: 'MVR Record',
      description: 'Order your Motor Vehicle Record for verification',
      status: data.hasMvrRecord ? 'complete' : 'pending',
      action: !data.hasMvrRecord ? { label: 'Order MVR', target: 'mvr' } : undefined,
      isOptional: true,
    },
    {
      id: 'apply',
      label: 'Apply to Jobs',
      description: 'Browse and apply to driver positions',
      status: data.hasAppliedToJobs ? 'complete' : 'pending',
      action: !data.hasAppliedToJobs ? { label: 'Browse Jobs', target: 'jobs' } : undefined,
    },
  ]

  const completedSteps = steps.filter(s => s.status === 'complete').length
  const totalSteps = steps.filter(s => !s.isOptional).length
  const overallProgress = Math.round((completedSteps / steps.length) * 100)

  // Find current step (first non-complete step)
  const currentStep = steps.find(s => s.status !== 'complete') || null

  // Generate next actions based on current state
  const nextActions: NextAction[] = []
  
  if (!data.isWalletConnected) {
    nextActions.push({
      label: 'Sign In',
      description: 'Connect your wallet to start your journey',
      target: 'signin',
      priority: 'high',
    })
  } else if (!data.hasResume && !data.dotAppInProgress) {
    nextActions.push({
      label: 'Create Your Resume',
      description: 'Build a professional resume to stand out to employers',
      target: 'resume',
      priority: 'high',
    })
  } else if (!data.dotAppComplete) {
    nextActions.push({
      label: data.dotAppInProgress ? 'Finish DOT Application' : 'Start DOT Application',
      description: 'Complete your DOT compliance application',
      target: 'dotapp',
      priority: 'high',
    })
  } else if (!data.hasAppliedToJobs) {
    nextActions.push({
      label: 'Browse Jobs',
      description: 'Find driving positions that match your experience',
      target: 'jobs',
      priority: 'high',
    })
  }

  // Add secondary suggestions
  if (data.isWalletConnected && !data.hasMvrRecord && data.dotAppComplete) {
    nextActions.push({
      label: 'Order MVR',
      description: 'Add your driving record to boost your profile',
      target: 'mvr',
      priority: 'medium',
    })
  }

  if (data.profileCompleteness < 80 && data.isWalletConnected) {
    nextActions.push({
      label: 'Complete Profile',
      description: `Your profile is ${data.profileCompleteness}% complete`,
      target: null, // null = hub
      priority: 'low',
    })
  }

  // Generate greeting based on progress
  let greeting: string
  if (!data.isWalletConnected) {
    greeting = "Welcome! Let's get you started on your driver journey."
  } else if (overallProgress < 30) {
    greeting = "Great start! Let's build your driver profile."
  } else if (overallProgress < 60) {
    greeting = "You're making progress! Keep going."
  } else if (overallProgress < 90) {
    greeting = "Almost there! Just a few more steps."
  } else {
    greeting = "Excellent! Your profile is looking great."
  }

  return {
    role: 'driver',
    overallProgress,
    completedSteps,
    totalSteps,
    steps,
    currentStep,
    nextActions: nextActions.slice(0, 2), // Max 2 actions
    greeting,
  }
}

// ===== EMPLOYER JOURNEY =====

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
      description: 'Set up your company profile to attract drivers',
      status: data.companyProfileComplete ? 'complete' : data.hasCompanyProfile ? 'in_progress' : 'pending',
      // Company profile is managed from the hub; null navigates there
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
      description: 'Verify driver credentials and employment history',
      status: data.hasRequestedVerification ? 'complete' : 'pending',
      isOptional: true,
    },
  ]

  const completedSteps = steps.filter(s => s.status === 'complete').length
  const totalSteps = steps.filter(s => !s.isOptional).length
  const overallProgress = Math.round((completedSteps / steps.length) * 100)

  const currentStep = steps.find(s => s.status !== 'complete') || null

  const nextActions: NextAction[] = []
  
  if (!data.isWalletConnected) {
    nextActions.push({
      label: 'Sign In',
      description: 'Connect your wallet to start hiring',
      target: 'signin',
      priority: 'high',
    })
  } else if (!data.companyProfileComplete) {
    nextActions.push({
      label: 'Complete Company Profile',
      description: 'Set up your company to attract qualified drivers',
      target: null, // company profile is in the hub
      priority: 'high',
    })
  } else if (!data.hasPostedJob) {
    nextActions.push({
      label: 'Post Your First Job',
      description: 'Start receiving applications from drivers',
      target: 'post-job',
      priority: 'high',
    })
  } else if (data.applicantCount > 0) {
    nextActions.push({
      label: `Review ${data.applicantCount} Applicant${data.applicantCount > 1 ? 's' : ''}`,
      description: 'Check out who has applied to your positions',
      target: 'applicants',
      priority: 'high',
    })
  } else {
    nextActions.push({
      label: 'Find Drivers',
      description: 'Search for qualified drivers in our network',
      target: 'find-drivers',
      priority: 'medium',
    })
  }

  let greeting: string
  if (!data.isWalletConnected) {
    greeting = "Welcome! Let's get your company set up."
  } else if (!data.companyProfileComplete) {
    greeting = "Let's complete your company profile."
  } else if (!data.hasPostedJob) {
    greeting = "Ready to find great drivers? Post a job!"
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

// ===== DEVELOPER JOURNEY =====

export function calculateDeveloperProgress(data: DeveloperProgressData): JourneyProgress {
  const steps: JourneyStep[] = [
    {
      id: 'wallet',
      label: 'Connect Wallet',
      description: 'Sign in with your wallet to get started',
      status: data.isWalletConnected ? 'complete' : 'pending',
      action: !data.isWalletConnected ? { label: 'Sign In', target: 'signin' } : undefined,
    },
    {
      id: 'portfolio',
      label: 'Add Projects',
      description: 'Showcase your work with portfolio projects',
      status: data.hasPortfolioProjects ? 'complete' : 'pending',
      action: !data.hasPortfolioProjects ? { label: 'Add Project', target: 'portfolio' } : undefined,
    },
    {
      id: 'resume',
      label: 'Build Resume',
      description: 'Create your developer resume',
      status: data.hasResume ? 'complete' : 'pending',
      action: !data.hasResume ? { label: 'Build Resume', target: 'resume' } : undefined,
    },
    {
      id: 'github',
      label: 'Connect GitHub',
      description: 'Link your GitHub to show your contributions',
      status: data.hasConnectedGithub ? 'complete' : 'pending',
      // GitHub connection is in the hub; null navigates there
      action: !data.hasConnectedGithub ? { label: 'Connect GitHub', target: null } : undefined,
    },
    {
      id: 'score',
      label: 'Career Score',
      description: 'Calculate your Career Score to see where you stand',
      status: data.hasCareerScore ? 'complete' : 'pending',
      progress: data.careerScore > 0 ? data.careerScore : undefined,
      action: !data.hasCareerScore ? { label: 'Calculate Score', target: null } : undefined,
    },
    {
      id: 'apply',
      label: 'Apply to Jobs',
      description: 'Find and apply to developer positions',
      status: data.hasAppliedToJobs ? 'complete' : 'pending',
      action: !data.hasAppliedToJobs ? { label: 'Browse Jobs', target: 'jobs' } : undefined,
    },
  ]

  const completedSteps = steps.filter(s => s.status === 'complete').length
  const totalSteps = steps.length
  const overallProgress = Math.round((completedSteps / totalSteps) * 100)

  const currentStep = steps.find(s => s.status !== 'complete') || null

  const nextActions: NextAction[] = []
  
  if (!data.isWalletConnected) {
    nextActions.push({
      label: 'Sign In',
      description: 'Connect your wallet to start',
      target: 'signin',
      priority: 'high',
    })
  } else if (!data.hasPortfolioProjects) {
    nextActions.push({
      label: 'Add Your First Project',
      description: 'Showcase your best work',
      target: 'portfolio',
      priority: 'high',
    })
  } else if (!data.hasResume) {
    nextActions.push({
      label: 'Build Your Resume',
      description: 'Create a professional developer resume',
      target: 'resume',
      priority: 'high',
    })
  } else if (!data.hasConnectedGithub) {
    nextActions.push({
      label: 'Connect GitHub',
      description: 'Boost your Career Score with your contributions',
      target: null, // github connection lives in the hub
      priority: 'medium',
    })
  } else if (!data.hasAppliedToJobs) {
    nextActions.push({
      label: 'Start Applying',
      description: 'Find positions that match your skills',
      target: 'jobs',
      priority: 'high',
    })
  }

  let greeting: string
  if (!data.isWalletConnected) {
    greeting = "Welcome, developer! Let's build your profile."
  } else if (overallProgress < 30) {
    greeting = "Let's showcase your skills to employers."
  } else if (overallProgress < 60) {
    greeting = "Your profile is shaping up nicely!"
  } else if (overallProgress < 90) {
    greeting = "Almost complete! A few more steps."
  } else {
    greeting = "Your developer profile is ready to shine!"
  }

  return {
    role: 'developer',
    overallProgress,
    completedSteps,
    totalSteps,
    steps,
    currentStep,
    nextActions: nextActions.slice(0, 2),
    greeting,
  }
}

// ===== HELPER TO GET EMPTY PROGRESS =====

export function getEmptyProgress(role: UserRole): JourneyProgress {
  if (role === 'driver') {
    return calculateDriverProgress({
      isWalletConnected: false,
      hasResume: false,
      resumeCount: 0,
      hasDotApplication: false,
      dotAppComplete: false,
      dotAppInProgress: false,
      hasMvrRecord: false,
      mvrRecordCount: 0,
      profileCompleteness: 0,
      hasAppliedToJobs: false,
      jobApplicationCount: 0,
    })
  } else if (role === 'employer') {
    return calculateEmployerProgress({
      isWalletConnected: false,
      hasCompanyProfile: false,
      companyProfileComplete: false,
      hasPostedJob: false,
      jobPostCount: 0,
      hasReviewedApplicants: false,
      applicantCount: 0,
      hasRequestedVerification: false,
    })
  } else if (role === 'developer') {
    return calculateDeveloperProgress({
      isWalletConnected: false,
      hasPortfolioProjects: false,
      portfolioProjectCount: 0,
      hasResume: false,
      hasConnectedGithub: false,
      hasCareerScore: false,
      careerScore: 0,
      hasAppliedToJobs: false,
      jobApplicationCount: 0,
    })
  }
  
  // Default for null role
  return {
    role: null,
    overallProgress: 0,
    completedSteps: 0,
    totalSteps: 0,
    steps: [],
    currentStep: null,
    nextActions: [],
    greeting: "Welcome to StormChain!",
  }
}
