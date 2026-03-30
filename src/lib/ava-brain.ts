/**
 * Stormi Brain (legacy file: ava-brain) — Smart Event Router (Role-Aware)
 *
 * This module makes Stormi appear omniscient while minimizing AI costs.
 *
 * Architecture:
 * - User actions are tracked and categorized
 * - Most responses use pre-written templates (instant, free)
 * - Complex scenarios escalate to AI (smart, contextual)
 * - User always sees responses from "Stormi" regardless of source
 * - Role-aware: Different templates and AI prompts for drivers vs developers
 */

import {
  DEVELOPER_TEMPLATES,
  DEVELOPER_AI_PATTERNS,
  buildDeveloperAIPrompt,
  getDeveloperTemplateKey,
} from './developer-brain-templates'

// =====================================================
// EVENT TYPES
// =====================================================

export type AvaEventCategory =
  | 'navigation' // User navigating between pages/forms
  | 'form_interaction' // Filling forms, validation
  | 'resume' // Upload, extraction, verification
  | 'help_request' // User explicitly asks for help
  | 'error' // Something went wrong
  | 'success' // Action completed successfully
  | 'inactivity' // User idle for a while
  | 'conflict' // Data conflicts
  | 'milestone' // User reaches important milestone

export interface AvaEvent {
  category: AvaEventCategory
  action: string
  context?: Record<string, unknown>
  timestamp: number
}

export interface AvaResponse {
  message: string
  useAI: boolean // If true, this is a prompt to send to AI, not final message
  actions?: Array<{
    id: string
    label: string
    value: string
  }>
  metadata?: {
    step?: string
    priority?: 'low' | 'normal' | 'high'
    dismissable?: boolean
  }
}

// =====================================================
// USER CONTEXT TRACKER
// =====================================================

export interface UserContext {
  // Current location
  currentPage: string | null
  currentForm: number

  // Progress
  hasResume: boolean
  formsCompleted: number[]
  profileCompleteness: number

  // Session info
  sessionStart: number
  lastActivity: number
  eventsThisSession: AvaEvent[]

  // Help history (to avoid repeating same help)
  helpTopicsShown: Set<string>

  // User behavior patterns
  timeOnCurrentPage: number
  fieldsFilledThisForm: number
  errorsEncountered: number
}

export function createInitialContext(): UserContext {
  return {
    currentPage: null,
    currentForm: 1,
    hasResume: false,
    formsCompleted: [],
    profileCompleteness: 0,
    sessionStart: Date.now(),
    lastActivity: Date.now(),
    eventsThisSession: [],
    helpTopicsShown: new Set(),
    timeOnCurrentPage: 0,
    fieldsFilledThisForm: 0,
    errorsEncountered: 0,
  }
}

// =====================================================
// TEMPLATE LIBRARY
// Pre-written Stormi messages for common scenarios
// =====================================================

const TEMPLATES: Record<string, AvaResponse> = {
  // Navigation
  'nav:home': {
    message: 'Welcome back! What would you like to work on today?',
    useAI: false,
    actions: [
      { id: 'resume', label: '📄 My Resume', value: 'resume' },
      { id: 'dotapp', label: '📋 DOT Application', value: 'dotapp' },
      { id: 'jobs', label: '💼 Browse Jobs', value: 'jobs' },
    ],
  },
  'nav:resume': {
    message:
      'Ready to work on your resume! You can upload an existing one or build a new one from scratch.',
    useAI: false,
  },
  'nav:dotapp': {
    message:
      "Let's tackle your DOT application. This is required for commercial driving jobs. I'll guide you through each section!",
    useAI: false,
  },
  'nav:form1': {
    message:
      '**Form 1: Personal Information**\n\nThis covers your basic info, address history, and license details. Most of this should be straightforward!',
    useAI: false,
  },
  'nav:form2': {
    message:
      "**Form 2: Driving Experience**\n\nHere we'll document your experience with different vehicle types, your driving record, and any accidents or violations.\n\n💡 Be honest here - employers verify this information!",
    useAI: false,
  },
  'nav:form3': {
    message:
      '**Form 3: Employment History**\n\nList your work history for the past 10 years, plus professional references.\n\n💡 Tip: Include all driving jobs, even short ones. Gaps in history raise red flags!',
    useAI: false,
  },

  // Form interactions
  'form:saved': {
    message: '✅ Saved! Your progress is secure.',
    useAI: false,
    metadata: { dismissable: true, priority: 'low' },
  },
  'form:validation_error': {
    message:
      "Hmm, looks like some fields need attention. Check the highlighted areas and I'll help if you get stuck!",
    useAI: false,
  },
  'form:field_empty_required': {
    message: 'This field is required. Need help figuring out what to put here?',
    useAI: false,
    actions: [
      { id: 'help', label: 'Help me', value: 'help:field' },
      { id: 'skip', label: "I'll come back", value: 'dismiss' },
    ],
  },
  'form:complete': {
    message: '🎉 Awesome! This section is complete. Ready to move on?',
    useAI: false,
    actions: [
      { id: 'next', label: 'Next section', value: 'next' },
      { id: 'review', label: 'Review this section', value: 'review' },
    ],
  },

  // Resume events
  'resume:upload_start': {
    message: '📤 Uploading your resume... just a moment!',
    useAI: false,
  },
  'resume:upload_complete': {
    message:
      "✅ Resume uploaded! Now I'll read through it and extract your information.",
    useAI: false,
  },
  'resume:extraction_start': {
    message:
      "🔍 Reading your resume now...\n\nI'll pull out your name, contact info, work history, licenses, and more. This usually takes 15-20 seconds.",
    useAI: false,
  },
  'resume:extraction_complete': {
    message:
      "🎉 Got it! I found your information and filled out what I could.\n\n**What I filled:**\n• Personal info & contact\n• License details\n• Employment history\n\n**What you'll need to add:**\n• Detailed driving experience\n• Accident/violation records\n• References contact info",
    useAI: false,
  },
  'resume:verification_start': {
    message:
      '⛓️ Recording your resume on the blockchain... this makes it tamper-proof and verifiable by employers.',
    useAI: false,
  },
  'resume:verification_complete': {
    message:
      "✅ Your resume is now verified on the blockchain! Employers can trust it's authentic.",
    useAI: false,
  },
  'resume:build_start': {
    message:
      "Let's build your resume step by step. I'll guide you through each section!",
    useAI: false,
  },

  // Success milestones
  'milestone:first_resume': {
    message:
      "🎉 **Milestone unlocked!**\n\nYou've uploaded your first resume. This is the foundation for everything else - nice work!",
    useAI: false,
  },
  'milestone:form1_complete': {
    message:
      "🎉 **Form 1 Complete!**\n\nYou're 1/3 of the way through the DOT application. Keep going!",
    useAI: false,
  },
  'milestone:form2_complete': {
    message:
      "🎉 **Form 2 Complete!**\n\nJust one more form to go. You're doing great!",
    useAI: false,
  },
  'milestone:all_forms_complete': {
    message:
      "🎉 **All Forms Complete!**\n\nYou've finished your DOT application! Ready to submit it to the blockchain for verification?",
    useAI: false,
    actions: [
      { id: 'submit', label: 'Submit for verification', value: 'submit' },
      { id: 'review', label: 'Review first', value: 'review' },
    ],
  },
  'milestone:profile_50': {
    message:
      '📊 Your profile is 50% complete! Keep adding info to stand out to employers.',
    useAI: false,
  },
  'milestone:profile_100': {
    message:
      "🌟 **Profile 100% Complete!**\n\nYou're now a top-tier candidate. Employers can see you're serious about this!",
    useAI: false,
  },

  // Inactivity / stuck
  'inactivity:30s': {
    message: "Need any help with this field? I can explain what's needed.",
    useAI: false,
    actions: [
      { id: 'help', label: 'Yes, help me', value: 'help:current_field' },
      { id: 'ok', label: "I'm good", value: 'dismiss' },
    ],
    metadata: { dismissable: true, priority: 'low' },
  },
  'inactivity:2min': {
    message:
      'Looks like you might be stuck. Want me to explain this section or skip to another part?',
    useAI: false,
    actions: [
      { id: 'explain', label: 'Explain this', value: 'help:section' },
      { id: 'skip', label: 'Skip for now', value: 'skip' },
      { id: 'ok', label: 'Just thinking', value: 'dismiss' },
    ],
  },

  // Errors
  'error:network': {
    message: '⚠️ Connection issue. Check your internet and try again?',
    useAI: false,
    actions: [{ id: 'retry', label: 'Try again', value: 'retry' }],
  },
  'error:save_failed': {
    message:
      "⚠️ Couldn't save just now. Your data is safe locally - I'll retry automatically.",
    useAI: false,
  },
  'error:upload_failed': {
    message:
      "⚠️ Upload failed. Common fixes:\n• Check your internet\n• Make sure it's a PDF\n• Try a smaller file (under 10MB)",
    useAI: false,
    actions: [{ id: 'retry', label: 'Try again', value: 'retry' }],
  },

  // Conflicts
  'conflict:profile_mismatch': {
    message:
      '⚠️ This resume appears to be for a different person than your existing profile.\n\nA dialog will appear - choose whether to keep your existing profile or replace it with this new data.',
    useAI: false,
  },
  'conflict:duplicate_resume': {
    message:
      "📋 I see you've already uploaded this resume. Want to use your existing one or upload a different file?",
    useAI: false,
    actions: [
      { id: 'existing', label: 'Use existing', value: 'use_existing' },
      { id: 'new', label: 'Upload different', value: 'upload_new' },
    ],
  },

  // =====================================================
  // EMPLOYMENT VERIFICATION TEMPLATES
  // For drivers and employers
  // =====================================================

  // Driver-facing templates
  'verification:driver_intro': {
    message:
      '📋 Your employment history is self-reported. When companies are interested in hiring you, they may verify this information with your previous employers.',
    useAI: false,
  },
  'verification:driver_request_started': {
    message:
      "📨 A company is verifying your employment history. This is normal during the hiring process - it means they're seriously considering you!",
    useAI: false,
  },
  'verification:driver_verified': {
    message:
      "✅ Great news! Your previous employer verified your employment. This strengthens your profile and shows employers you're trustworthy.",
    useAI: false,
  },
  'verification:driver_partially_verified': {
    message:
      '⚠️ Your employment was partially verified - some details matched, others were corrected. Check the verification section for details.',
    useAI: false,
  },
  'verification:driver_denied': {
    message:
      '❌ Your previous employer disputed some of your employment details. You may want to review and update your employment history.',
    useAI: false,
  },
  'verification:driver_exhausted': {
    message:
      "⚠️ After 3 attempts, your previous employer hasn't responded to the verification request. Your employment remains self-reported.",
    useAI: false,
  },
  'verification:driver_multiple_active': {
    message:
      '📊 Multiple companies are currently verifying your employment history. You can track all verifications in your Driver Hub.',
    useAI: false,
  },

  // Employer-facing templates
  'verification:employer_intro': {
    message:
      '📋 Employment verification helps you confirm drivers actually worked where they claim. You can verify with previous employers through email or phone - up to 3 attempts per request.',
    useAI: false,
  },
  'verification:employer_initiated': {
    message:
      "📨 Verification request created! I'll help you track the status. The previous employer will receive a secure link to verify the driver's employment.",
    useAI: false,
  },
  'verification:employer_attempt_sent': {
    message:
      "📧 Contact attempt sent to the previous employer. You'll be notified when they respond. If no response in 3 days, you can send another attempt (max 3 total).",
    useAI: false,
  },
  'verification:employer_response_received': {
    message:
      '🔔 Previous employer responded to your verification request! Check the verification section for the results.',
    useAI: false,
  },
  'verification:employer_verified': {
    message:
      "✅ Employment verified! The previous employer confirmed the driver's employment details. All 6 FMCSA questions have been answered.",
    useAI: false,
  },
  'verification:employer_denied': {
    message:
      "❌ The previous employer disputed this driver's employment claims. Review the details carefully before making a hiring decision.",
    useAI: false,
  },
  'verification:employer_exhausted': {
    message:
      '⚠️ After 3 attempts, no response from the previous employer. The employment remains unverified - consider this in your hiring decision.',
    useAI: false,
  },
  'verification:employer_declined': {
    message:
      '🚫 The previous employer declined to verify employment. This sometimes happens due to company policy.',
    useAI: false,
  },
  'verification:employer_no_contact': {
    message:
      '📞 No contact information for this previous employer. The driver may need to provide updated contact details.',
    useAI: false,
  },

  // General verification help
  'verification:help_what_is': {
    message:
      "**What is Employment Verification?**\n\nIt's the process where a future employer contacts your previous employers to confirm:\n\n1. ✅ Employment dates were correct\n2. ✅ Whether you were terminated\n3. ✅ If you're eligible to return\n4. ✅ Any accident history\n5. ✅ FMCSA Clearinghouse test results\n6. ✅ Drug test history\n\nThis is required for DOT-regulated positions and helps build trust in the hiring process.",
    useAI: false,
  },
  'verification:help_3_attempts': {
    message:
      "**The 3-Attempt Rule**\n\nWhen verifying employment:\n\n• **Attempt 1**: Initial contact (email/phone)\n• **Attempt 2**: Follow-up after 3 days\n• **Attempt 3**: Final attempt after 3 more days\n\nIf no response after 3 attempts, the verification is marked as 'No Response' and the employment remains self-reported.",
    useAI: false,
  },
  'verification:help_self_reported': {
    message:
      "**Self-Reported Employment**\n\nThis means the driver submitted their employment history, but it hasn't been verified by the previous employer yet.\n\nIt's not bad - it just means no one has verified it. Future employers can initiate verification when they're interested in hiring.",
    useAI: false,
  },
}

// =====================================================
// AI ESCALATION TRIGGERS
// Scenarios that require actual AI
// =====================================================

const AI_REQUIRED_PATTERNS = [
  // Explicit questions
  /^(what|why|how|when|where|who|can|should|do|does|is|are|will|would|could)\s/i,
  /\?$/, // Ends with question mark

  // Complex help requests
  /explain|help me understand|confused about|don't get|what does.*mean/i,

  // Regulation questions
  /fmcsa|dot|regulation|requirement|legal|law|rule/i,

  // Career advice
  /should i|recommend|best way|advice|tips|how to get|career/i,

  // Specific form field help (context-dependent)
  /hazmat|endorsement|medical.*card|physical|drug test|accident.*report/i,

  // Verification-related complex questions
  /verification.*failed|employer.*not respond|dispute.*employment|wrong.*dates|clearinghouse/i,
  /what if.*employer|previous.*employer.*respond|verify.*employment.*history/i,
]

// =====================================================
// EVENT ROUTER
// Decides whether to use template or AI
// Now role-aware: routes to driver or developer templates
// =====================================================

export type UserRole = 'driver' | 'developer' | null

export function routeEvent(
  event: AvaEvent,
  context: UserContext,
  userMessage?: string,
  userRole: UserRole = null
): AvaResponse | { useAI: true; prompt: string } {
  // Determine which template set and AI patterns to use
  const isDevRole = userRole === 'developer'
  const aiPatterns = isDevRole ? DEVELOPER_AI_PATTERNS : AI_REQUIRED_PATTERNS

  // If user typed a message, check if it needs AI
  if (userMessage) {
    const needsAI = aiPatterns.some((pattern) => pattern.test(userMessage))

    if (needsAI) {
      return {
        useAI: true,
        prompt: isDevRole
          ? buildDeveloperAIPrompt(userMessage, context)
          : buildAIPrompt(userMessage, context),
      }
    }
  }

  // Check for template match (role-aware)
  const templateKey = isDevRole
    ? getDeveloperTemplateKey(event, context)
    : getTemplateKey(event, context)

  if (templateKey) {
    // Check developer templates first if dev role, then fall back to shared templates
    if (isDevRole && DEVELOPER_TEMPLATES[templateKey]) {
      return DEVELOPER_TEMPLATES[templateKey]
    }
    if (TEMPLATES[templateKey]) {
      return TEMPLATES[templateKey]
    }
  }

  // Complex events that always need AI
  if (event.category === 'help_request' && event.context?.question) {
    return {
      useAI: true,
      prompt: isDevRole
        ? buildDeveloperAIPrompt(event.context.question as string, context)
        : buildAIPrompt(event.context.question as string, context),
    }
  }

  // Default: silent (no message needed)
  return {
    message: '',
    useAI: false,
  }
}

function getTemplateKey(event: AvaEvent, context: UserContext): string | null {
  const { category, action } = event

  // Navigation events
  if (category === 'navigation') {
    if (action === 'page_change') {
      const page = event.context?.page as string
      if (page === 'home' || page === null) return 'nav:home'
      if (page === 'resume') return 'nav:resume'
      if (page === 'dotapp') return 'nav:dotapp'
    }
    if (action === 'form_change') {
      const form = event.context?.form as number
      if (form === 1) return 'nav:form1'
      if (form === 2) return 'nav:form2'
      if (form === 3) return 'nav:form3'
    }
  }

  // Form events
  if (category === 'form_interaction') {
    if (action === 'saved') return 'form:saved'
    if (action === 'validation_error') return 'form:validation_error'
    if (action === 'complete') return 'form:complete'
  }

  // Resume events
  if (category === 'resume') {
    if (action === 'upload_start') return 'resume:upload_start'
    if (action === 'upload_complete') return 'resume:upload_complete'
    if (action === 'extraction_start') return 'resume:extraction_start'
    if (action === 'extraction_complete') return 'resume:extraction_complete'
    if (action === 'verification_start') return 'resume:verification_start'
    if (action === 'verification_complete')
      return 'resume:verification_complete'
  }

  // Milestones
  if (category === 'milestone') {
    if (action === 'first_resume') return 'milestone:first_resume'
    if (action === 'form1_complete') return 'milestone:form1_complete'
    if (action === 'form2_complete') return 'milestone:form2_complete'
    if (action === 'all_forms_complete') return 'milestone:all_forms_complete'
    if (action === 'profile_50') return 'milestone:profile_50'
    if (action === 'profile_100') return 'milestone:profile_100'
  }

  // Inactivity
  if (category === 'inactivity') {
    if (action === '30s') return 'inactivity:30s'
    if (action === '2min') return 'inactivity:2min'
  }

  // Errors
  if (category === 'error') {
    if (action === 'network') return 'error:network'
    if (action === 'save_failed') return 'error:save_failed'
    if (action === 'upload_failed') return 'error:upload_failed'
  }

  // Conflicts
  if (category === 'conflict') {
    if (action === 'profile_mismatch') return 'conflict:profile_mismatch'
    if (action === 'duplicate_resume') return 'conflict:duplicate_resume'
  }

  return null
}

function buildAIPrompt(userQuestion: string, context: UserContext): string {
  const contextInfo = [
    `Current page: ${context.currentPage || 'home'}`,
    `Current form: ${context.currentForm}`,
    `Profile completeness: ${context.profileCompleteness}%`,
    `Has resume: ${context.hasResume}`,
    `Forms completed: ${context.formsCompleted.join(', ') || 'none'}`,
  ].join('\n')

  return `User question: "${userQuestion}"

Context:
${contextInfo}

Provide a helpful, friendly response as Stormi, the AI assistant for truck drivers. 
Keep it concise (2-3 paragraphs max). 
If this is about DOT regulations, be accurate but explain in plain English.
If you don't know something specific, say so and suggest they verify with their employer or FMCSA.`
}

// =====================================================
// INACTIVITY DETECTOR
// =====================================================

export function checkInactivity(context: UserContext): AvaEvent | null {
  const now = Date.now()
  const timeSinceActivity = now - context.lastActivity

  // 30 second check (only once per field)
  if (timeSinceActivity > 30000 && timeSinceActivity < 35000) {
    if (!context.helpTopicsShown.has('inactivity:30s')) {
      context.helpTopicsShown.add('inactivity:30s')
      return {
        category: 'inactivity',
        action: '30s',
        timestamp: now,
      }
    }
  }

  // 2 minute check
  if (timeSinceActivity > 120000 && timeSinceActivity < 125000) {
    if (!context.helpTopicsShown.has('inactivity:2min')) {
      context.helpTopicsShown.add('inactivity:2min')
      return {
        category: 'inactivity',
        action: '2min',
        timestamp: now,
      }
    }
  }

  return null
}

// =====================================================
// MILESTONE DETECTOR
// =====================================================

export function checkMilestones(
  prevContext: UserContext,
  newContext: UserContext
): AvaEvent | null {
  // First resume uploaded
  if (!prevContext.hasResume && newContext.hasResume) {
    return {
      category: 'milestone',
      action: 'first_resume',
      timestamp: Date.now(),
    }
  }

  // Form completions
  const prevForms = new Set(prevContext.formsCompleted)
  const newForms = new Set(newContext.formsCompleted)

  if (!prevForms.has(1) && newForms.has(1)) {
    return {
      category: 'milestone',
      action: 'form1_complete',
      timestamp: Date.now(),
    }
  }
  if (!prevForms.has(2) && newForms.has(2)) {
    return {
      category: 'milestone',
      action: 'form2_complete',
      timestamp: Date.now(),
    }
  }
  if (
    newForms.has(1) &&
    newForms.has(2) &&
    newForms.has(3) &&
    !(prevForms.has(1) && prevForms.has(2) && prevForms.has(3))
  ) {
    return {
      category: 'milestone',
      action: 'all_forms_complete',
      timestamp: Date.now(),
    }
  }

  // Profile completeness milestones
  if (
    prevContext.profileCompleteness < 50 &&
    newContext.profileCompleteness >= 50
  ) {
    return {
      category: 'milestone',
      action: 'profile_50',
      timestamp: Date.now(),
    }
  }
  if (
    prevContext.profileCompleteness < 100 &&
    newContext.profileCompleteness >= 100
  ) {
    return {
      category: 'milestone',
      action: 'profile_100',
      timestamp: Date.now(),
    }
  }

  return null
}

// =====================================================
// EVENT LOGGER
// Tracks user actions for context
// =====================================================

export function logEvent(context: UserContext, event: AvaEvent): UserContext {
  const now = Date.now()

  return {
    ...context,
    lastActivity: now,
    eventsThisSession: [...context.eventsThisSession.slice(-50), event], // Keep last 50 events
    timeOnCurrentPage:
      context.currentPage === event.context?.page
        ? context.timeOnCurrentPage + (now - context.lastActivity)
        : 0,
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const AvaTemplates = TEMPLATES
