/**
 * Developer Brain Templates
 *
 * Role-specific templates for software developers using StormChain.
 * These templates provide instant responses for common developer scenarios.
 */

import type { AvaResponse, AvaEvent, UserContext } from './ava-brain'

// =====================================================
// DEVELOPER TEMPLATES
// Pre-written Ava messages for developer scenarios
// =====================================================

export const DEVELOPER_TEMPLATES: Record<string, AvaResponse> = {
  // Navigation
  'nav:home': {
    message: 'Welcome back, developer! What would you like to work on today?',
    useAI: false,
    actions: [
      { id: 'portfolio', label: '📂 Portfolio', value: 'portfolio' },
      { id: 'resume', label: '📄 Resume', value: 'resume' },
      { id: 'github', label: '🐙 GitHub', value: 'github' },
      { id: 'jobs', label: '💼 Browse Jobs', value: 'jobs' },
    ],
  },
  'nav:portfolio': {
    message:
      "Let's showcase your best work! A strong portfolio is key to landing great opportunities.",
    useAI: false,
  },
  'nav:github': {
    message:
      'Connect your GitHub to show off your contributions and open source work. This significantly boosts your Career Score!',
    useAI: false,
  },
  'nav:resume': {
    message:
      'Ready to build or update your developer resume! Include your tech stack, projects, and achievements.',
    useAI: false,
  },

  // GitHub Connection
  'github:connect_prompt': {
    message:
      '🐙 **Connect GitHub**\n\nLinking your GitHub lets employers see your:\n• Real contribution activity\n• Top projects and languages\n• Open source involvement\n\nThis is one of the best ways to boost your Career Score!',
    useAI: false,
    actions: [
      { id: 'connect', label: 'Connect GitHub', value: 'connect_github' },
      { id: 'later', label: 'Maybe later', value: 'dismiss' },
    ],
  },
  'github:connected': {
    message:
      '🎉 GitHub connected! I can now see your contributions, repos, and languages. Your Career Score will reflect this data.',
    useAI: false,
  },
  'github:sync_complete': {
    message:
      '✅ GitHub data synced! Your profile now shows your latest contributions and repositories.',
    useAI: false,
  },

  // Portfolio Events
  'portfolio:empty': {
    message:
      '📂 **Your Portfolio is Empty**\n\nAdd your best projects to showcase what you can build. Include:\n• Project descriptions\n• Tech stack used\n• Live URLs or demos\n• Screenshots',
    useAI: false,
    actions: [{ id: 'add', label: 'Add Project', value: 'add_project' }],
  },
  'portfolio:project_added': {
    message:
      '✅ Project added to your portfolio! Consider adding a live URL or demo video to make it stand out.',
    useAI: false,
  },
  'portfolio:project_featured': {
    message:
      '⭐ Project marked as featured! Featured projects appear prominently on your Career Card.',
    useAI: false,
  },

  // Career Score Events
  'score:calculated': {
    message:
      '📊 Career Score calculated! This AI-generated score considers your GitHub activity, portfolio quality, and profile completeness.',
    useAI: false,
  },
  'score:improved': {
    message:
      '🎉 Your Career Score improved! Keep adding projects and keeping your GitHub active to climb higher.',
    useAI: false,
  },
  'score:low_github': {
    message:
      '💡 **Boost Your Score**: Your GitHub activity is low. Consider:\n• Making more contributions\n• Pushing to public repos\n• Participating in open source',
    useAI: false,
  },
  'score:low_portfolio': {
    message:
      '💡 **Boost Your Score**: Your portfolio needs more projects. Add at least 3 with live URLs to improve your score.',
    useAI: false,
  },
  'score:low_profile': {
    message:
      '💡 **Boost Your Score**: Complete your profile! Add a headline, bio, skills, and location.',
    useAI: false,
  },

  // Resume Events (Developer)
  'resume:dev_build_start': {
    message:
      "Let's build your developer resume! I'll help you highlight your technical skills, projects, and experience.",
    useAI: false,
  },
  'resume:dev_skills_empty': {
    message:
      "⚠️ Don't forget to add your technical skills! List languages, frameworks, and tools you're proficient in.",
    useAI: false,
  },
  'resume:dev_projects_tip': {
    message:
      '💡 **Pro Tip**: Include 2-3 of your best projects with clear descriptions of what you built and what tech you used.',
    useAI: false,
  },

  // Career Card Events
  'careercard:shared': {
    message:
      '🔗 Career Card shared! Anyone with the link can see your public profile, portfolio, and GitHub stats.',
    useAI: false,
  },
  'careercard:viewed': {
    message:
      '👀 Someone viewed your Career Card! Make sure your profile is complete to make a great impression.',
    useAI: false,
  },

  // Job Application Events
  'jobs:applied': {
    message:
      '✅ Application submitted! The employer can now view your Career Card with your full profile and portfolio.',
    useAI: false,
  },
  'jobs:dev_match': {
    message:
      '💼 Found some jobs that match your skills! Check out the listings and apply with one click.',
    useAI: false,
  },

  // Success Milestones
  'milestone:first_project': {
    message:
      '🎉 **Milestone unlocked!**\n\nYou added your first project! Keep adding more to build a compelling portfolio.',
    useAI: false,
  },
  'milestone:github_connected': {
    message:
      '🎉 **Milestone unlocked!**\n\nGitHub connected! Your Career Card now shows real contribution data.',
    useAI: false,
  },
  'milestone:score_70': {
    message:
      "🎉 **Milestone unlocked!**\n\nCareer Score hit 70! You're in the top tier of candidates.",
    useAI: false,
  },
  'milestone:score_90': {
    message:
      "🌟 **Milestone unlocked!**\n\nCareer Score hit 90! Outstanding profile - you're highly competitive.",
    useAI: false,
  },

  // Errors
  'error:github_connect_failed': {
    message:
      "⚠️ Couldn't connect to GitHub. Please try again or check that you've authorized the app.",
    useAI: false,
    actions: [{ id: 'retry', label: 'Try again', value: 'retry_github' }],
  },
  'error:project_save_failed': {
    message: "⚠️ Couldn't save project. Check your connection and try again.",
    useAI: false,
    actions: [{ id: 'retry', label: 'Try again', value: 'retry' }],
  },

  // Help Topics
  'help:career_card': {
    message:
      "**What is a Career Card?**\n\nIt's your public developer profile that includes:\n\n• Personal info & headline\n• GitHub contributions graph\n• Portfolio projects\n• Tech stack & skills\n\nShare it with employers to showcase your full profile!",
    useAI: false,
  },
  'help:portfolio_tips': {
    message:
      '**Portfolio Best Practices**\n\n1. **Quality over quantity** - 3-5 great projects beat 10 mediocre ones\n2. **Live demos** - Deploy your projects so employers can try them\n3. **Clear descriptions** - Explain what you built and why\n4. **Tech stack** - List all technologies used\n5. **Screenshots/videos** - Visual evidence of your work',
    useAI: false,
  },
  'help:github_tips': {
    message:
      '**GitHub Tips for Developers**\n\n1. **Contribute regularly** - Even small commits count\n2. **README files** - Every repo should have one\n3. **Diverse languages** - Shows versatility\n4. **Open source** - Contributing to OSS is highly valued\n5. **Pin best repos** - Showcase your top work',
    useAI: false,
  },
}

// =====================================================
// DEVELOPER AI ESCALATION TRIGGERS
// Scenarios that require AI for developers
// =====================================================

export const DEVELOPER_AI_PATTERNS = [
  // Explicit questions
  /^(what|why|how|when|where|who|can|should|do|does|is|are|will|would|could)\s/i,
  /\?$/, // Ends with question mark

  // Complex help requests
  /explain|help me understand|confused about|don't get|what does.*mean/i,

  // Tech-specific questions
  /best.*language|framework|library|stack|tool|technology/i,
  /should i learn|recommend.*tech|trending|popular/i,

  // Career advice
  /career|salary|interview|job search|portfolio advice|resume tip/i,
  /how to get.*job|prepare for|stand out|improve my/i,

  // GitHub specific
  /contribution|commit|pull request|open source|repository|github stats/i,

  // Portfolio specific
  /project idea|what to build|showcase|demo|deploy/i,

  // Career Score specific
  /improve.*score|boost.*score|score.*low|increase.*career/i,
  /how.*score.*calculated|what affects.*score/i,
]

// =====================================================
// DEVELOPER TEMPLATE KEY GETTER
// =====================================================

export function getDeveloperTemplateKey(
  event: AvaEvent,
  context: UserContext
): string | null {
  const { category, action } = event

  // Navigation events
  if (category === 'navigation') {
    if (action === 'page_change') {
      const page = event.context?.page as string
      if (page === 'home' || page === null) return 'nav:home'
      if (page === 'portfolio') return 'nav:portfolio'
      if (page === 'github') return 'nav:github'
      if (page === 'resume') return 'nav:resume'
    }
  }

  // GitHub events
  if (category === 'success' && action === 'github_connected') {
    return 'github:connected'
  }
  if (category === 'error' && action === 'github_connect_failed') {
    return 'error:github_connect_failed'
  }

  // Portfolio events
  if (category === 'success' && action === 'project_added') {
    return 'portfolio:project_added'
  }
  if (category === 'success' && action === 'project_featured') {
    return 'portfolio:project_featured'
  }
  if (category === 'error' && action === 'project_save_failed') {
    return 'error:project_save_failed'
  }

  // Career Score events
  if (category === 'success' && action === 'score_calculated') {
    return 'score:calculated'
  }
  if (category === 'success' && action === 'score_improved') {
    return 'score:improved'
  }

  // Milestones
  if (category === 'milestone') {
    if (action === 'first_project') return 'milestone:first_project'
    if (action === 'github_connected') return 'milestone:github_connected'
    if (action === 'score_70') return 'milestone:score_70'
    if (action === 'score_90') return 'milestone:score_90'
  }

  // Resume events
  if (category === 'resume') {
    if (action === 'build_start') return 'resume:dev_build_start'
  }

  // Job events
  if (category === 'success' && action === 'job_applied') {
    return 'jobs:applied'
  }

  // Career Card events
  if (category === 'success' && action === 'careercard_shared') {
    return 'careercard:shared'
  }
  if (category === 'success' && action === 'careercard_viewed') {
    return 'careercard:viewed'
  }

  return null
}

// =====================================================
// DEVELOPER AI PROMPT BUILDER
// =====================================================

export function buildDeveloperAIPrompt(
  userQuestion: string,
  context: UserContext
): string {
  const contextInfo = [
    `Current page: ${context.currentPage || 'home'}`,
    `Profile completeness: ${context.profileCompleteness}%`,
    `Has resume: ${context.hasResume}`,
    `Projects: ${context.formsCompleted.length || 0}`, // Reusing formsCompleted as project count
  ].join('\n')

  return `User question: "${userQuestion}"

Context:
${contextInfo}

You are Ava, the AI assistant for StormChain - a career platform for software developers.

StormChain helps developers:
- Build and showcase their portfolio
- Connect their GitHub for verified contributions
- Get an AI-generated Career Score
- Share a Career Card with employers
- Apply to jobs with one click

Provide a helpful, friendly response. Keep it concise (2-3 paragraphs max).

For technical questions:
- Give practical, actionable advice
- Mention relevant technologies when appropriate
- Suggest resources if helpful

For career questions:
- Be encouraging but realistic
- Focus on what they can do to improve
- Reference their Career Score or portfolio when relevant

If you don't know something specific, say so and suggest they look at official documentation or trusted sources.`
}
