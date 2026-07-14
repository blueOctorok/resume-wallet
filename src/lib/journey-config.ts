/**
 * Journey Modal Configuration
 * 
 * Defines all guided journey steps for each user role.
 * Each step shows after a key action, confirming completion and suggesting the next step.
 */

import type { PageType, UserRole } from '@/stores/types'

export type JourneyAction = 
  | { type: 'navigate'; target: PageType }
  | { type: 'dismiss' }
  | { type: 'callback'; id: string }

export interface JourneyStep {
  id: string
  title: string
  message: string
  icon: 'CheckCircle' | 'FileText' | 'Briefcase' | 'Truck' | 'FileCheck' | 'Send' | 'Building' | 'Users' | 'Code' | 'Github' | 'Star' | 'Search'
  nextStep?: {
    label: string
    action: JourneyAction
  }
  /** If true, this is a "first time" step that only shows once ever */
  showOnce?: boolean
}

export interface JourneyConfig {
  driver: Record<string, JourneyStep>
  employer: Record<string, JourneyStep>
  developer: Record<string, JourneyStep>
}

export const JOURNEY_STEPS: JourneyConfig = {
  // ===== DRIVER JOURNEY =====
  driver: {
    firstLogin: {
      id: 'driver.firstLogin',
      title: 'Welcome to ZKnight!',
      message: 'Your driver career starts here. Upload a resume or fill out your DOT application to get started.',
      icon: 'Truck',
      nextStep: {
        label: 'Start DOT Application',
        action: { type: 'navigate', target: 'dotapp' },
      },
      showOnce: true,
    },
    resumeUploaded: {
      id: 'driver.resumeUploaded',
      title: 'Resume Uploaded!',
      message: 'Your resume is ready for employers to see. Complete your DOT application next for full compliance.',
      icon: 'FileText',
      nextStep: {
        label: 'Complete DOT Application',
        action: { type: 'navigate', target: 'dotapp' },
      },
    },
    resumeBuilt: {
      id: 'driver.resumeBuilt',
      title: 'Resume Saved!',
      message: 'Your professional resume is ready. Now complete your DOT application or start applying to jobs.',
      icon: 'FileCheck',
      nextStep: {
        label: 'Browse Jobs',
        action: { type: 'navigate', target: 'jobs' },
      },
    },
    dotAppCompleted: {
      id: 'driver.dotAppCompleted',
      title: 'DOT Application Complete!',
      message: "You're now DOT-compliant. Browse jobs in your area and start applying.",
      icon: 'CheckCircle',
      nextStep: {
        label: 'Browse Jobs',
        action: { type: 'navigate', target: 'jobs' },
      },
    },
    mvrOrdered: {
      id: 'driver.mvrOrdered',
      title: 'MVR Requested!',
      message: 'Your Motor Vehicle Record has been requested. Results typically arrive within 24-48 hours.',
      icon: 'FileCheck',
      nextStep: {
        label: 'Return to Hub',
        action: { type: 'navigate', target: 'hub' },
      },
    },
    jobApplied: {
      id: 'driver.jobApplied',
      title: 'Application Sent!',
      message: 'Your application is on its way to the employer. Track your applications in your Hub.',
      icon: 'Send',
      nextStep: {
        label: 'View My Applications',
        action: { type: 'navigate', target: 'applications' },
      },
    },
    resumeVerified: {
      id: 'driver.resumeVerified',
      title: 'Resume on file!',
      message: 'Your resume is ready on your Career Card. Issuer-backed facts (MVR, PSP, employment) are what carry Verified badges — not the resume PDF itself.',
      icon: 'CheckCircle',
      nextStep: {
        label: 'Return to Hub',
        action: { type: 'navigate', target: 'hub' },
      },
    },
  },

  // ===== EMPLOYER JOURNEY =====
  employer: {
    firstLogin: {
      id: 'employer.firstLogin',
      title: 'Welcome to ZKnight!',
      message: 'Start by setting up your company profile. This helps drivers learn about your company.',
      icon: 'Building',
      nextStep: {
        label: 'Set Up Company Profile',
        action: { type: 'navigate', target: 'company-profile' },
      },
      showOnce: true,
    },
    companyProfileComplete: {
      id: 'employer.companyProfileComplete',
      title: 'Company Profile Complete!',
      message: 'Looking good! Now post your first job to start attracting qualified drivers.',
      icon: 'CheckCircle',
      nextStep: {
        label: 'Post a Job',
        action: { type: 'navigate', target: 'post-job' },
      },
    },
    jobPosted: {
      id: 'employer.jobPosted',
      title: 'Job Posted!',
      message: 'Your job is now live. Share it or search the network for candidates.',
      icon: 'Briefcase',
      nextStep: {
        label: 'Find Talent',
        action: { type: 'navigate', target: 'talent-search' },
      },
    },
    applicantReviewed: {
      id: 'employer.applicantReviewed',
      title: 'Applicant Updated!',
      message: 'Keep reviewing your pipeline or reach out to promising candidates.',
      icon: 'Users',
      nextStep: {
        label: 'View All Applicants',
        action: { type: 'navigate', target: 'applicants' },
      },
    },
    verificationRequested: {
      id: 'employer.verificationRequested',
      title: 'Verification Requested!',
      message: "We're contacting the driver's previous employer. You'll be notified when verification is complete.",
      icon: 'FileCheck',
      nextStep: {
        label: 'Return to Hub',
        action: { type: 'navigate', target: 'hub' },
      },
    },
    mvrOrdered: {
      id: 'employer.mvrOrdered',
      title: 'MVR Ordered!',
      message: "The driver's Motor Vehicle Record has been requested. Results typically arrive within 24-48 hours.",
      icon: 'FileCheck',
      nextStep: {
        label: 'View Applicants',
        action: { type: 'navigate', target: 'applicants' },
      },
    },
  },

  // ===== DEVELOPER JOURNEY =====
  developer: {
    firstLogin: {
      id: 'developer.firstLogin',
      title: 'Welcome to ZKnight!',
      message: 'Showcase your skills by adding portfolio projects or building your tech resume.',
      icon: 'Code',
      nextStep: {
        label: 'Add Portfolio Project',
        action: { type: 'navigate', target: 'portfolio' },
      },
      showOnce: true,
    },
    portfolioAdded: {
      id: 'developer.portfolioAdded',
      title: 'Project Added!',
      message: 'Nice work! Add more projects or calculate your Career Score to see how you stack up.',
      icon: 'Code',
      nextStep: {
        label: 'View Career Score',
        action: { type: 'navigate', target: 'hub' },
      },
    },
    resumeBuilt: {
      id: 'developer.resumeBuilt',
      title: 'Resume Saved!',
      message: 'Your tech resume is ready. Connect your GitHub to boost your Career Score.',
      icon: 'FileCheck',
      nextStep: {
        label: 'Connect GitHub',
        action: { type: 'navigate', target: 'github' },
      },
    },
    githubConnected: {
      id: 'developer.githubConnected',
      title: 'GitHub Connected!',
      message: 'Your repos are now linked. Your Career Score includes contribution stats and project activity.',
      icon: 'Github',
      nextStep: {
        label: 'View Career Score',
        action: { type: 'navigate', target: 'hub' },
      },
    },
    careerScoreCalculated: {
      id: 'developer.careerScoreCalculated',
      title: 'Career Score Ready!',
      message: 'Your score reflects your GitHub activity, portfolio, and profile completeness. Apply to jobs or improve based on suggestions.',
      icon: 'Star',
      nextStep: {
        label: 'Browse Jobs',
        action: { type: 'navigate', target: 'jobs' },
      },
    },
    jobApplied: {
      id: 'developer.jobApplied',
      title: 'Application Sent!',
      message: 'Your application is on its way. Employers can see your Career Card with all your credentials.',
      icon: 'Send',
      nextStep: {
        label: 'View My Applications',
        action: { type: 'navigate', target: 'applications' },
      },
    },
  },
}

/**
 * Get a journey step by its full ID (e.g., "driver.resumeUploaded")
 */
export function getJourneyStep(stepId: string): JourneyStep | null {
  const [role, step] = stepId.split('.') as [UserRole, string]
  if (!role || !step) return null
  
  const roleSteps = JOURNEY_STEPS[role as keyof JourneyConfig]
  if (!roleSteps) return null
  
  return roleSteps[step] || null
}

/**
 * Get all journey steps for a specific role
 */
export function getJourneyStepsForRole(role: UserRole): JourneyStep[] {
  if (!role) return []
  const roleSteps = JOURNEY_STEPS[role as keyof JourneyConfig]
  return Object.values(roleSteps || {})
}
