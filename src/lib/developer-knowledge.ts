/**
 * Developer Knowledge Base
 *
 * Domain knowledge for the AI assistant when helping software developers.
 * This provides context about common topics, best practices, and Storm features.
 */

// =====================================================
// STORMCHAIN DEVELOPER FEATURES
// =====================================================

export const STORMCHAIN_FEATURES = {
  careerCard: {
    description:
      "A public-facing profile page showing a developer's skills, GitHub activity, portfolio, and AI-generated Career Score",
    benefits: [
      'One-click sharing with potential employers',
      'Verified GitHub contributions displayed',
      'AI Career Score provides quick assessment',
      'Portfolio projects showcased professionally',
    ],
    url: '/dev-card/{share_token}',
  },
  careerScore: {
    description:
      "An AI-generated score (0-100) evaluating a developer's profile strength",
    factors: {
      github: {
        weight: 35,
        components: [
          'contribution consistency',
          'repo quality',
          'language diversity',
          'recent activity',
        ],
      },
      portfolio: {
        weight: 40,
        components: [
          'project count',
          'live URLs',
          'tech diversity',
          'demos/screenshots',
        ],
      },
      profile: {
        weight: 25,
        components: [
          'completeness',
          'skills listed',
          'experience',
          'external links',
        ],
      },
    },
    gradeScale: {
      A: '90-100 - Outstanding profile',
      B: '75-89 - Strong profile',
      C: '60-74 - Good profile with room to improve',
      D: '45-59 - Needs significant improvement',
      F: '0-44 - Minimal profile',
    },
  },
  githubIntegration: {
    description:
      'OAuth connection that pulls contribution data, repos, and languages',
    dataCollected: [
      'Total contributions (past year)',
      'Contribution calendar/streaks',
      'Public and private repo counts',
      'Top languages by repo count',
      'Star and fork counts',
      'Follower count',
    ],
    benefits: [
      'Proves coding activity is real',
      'Shows consistent contribution patterns',
      'Employers see verified work history',
      'Boosts Career Score significantly',
    ],
  },
  portfolio: {
    description: "A collection of projects that showcase a developer's work",
    projectFields: [
      'title',
      'description',
      'long_description',
      'tech_stack',
      'live_url',
      'repo_url',
      'demo_video_url',
      'screenshots',
      'role',
      'team_size',
      'is_featured',
    ],
    bestPractices: [
      'Include 3-5 high-quality projects',
      'Add live URLs whenever possible',
      'Include screenshots or demo videos',
      'Clearly list technologies used',
      'Mark best projects as featured',
    ],
  },
}

// =====================================================
// CAREER ADVICE KNOWLEDGE
// =====================================================

export const CAREER_ADVICE = {
  portfolioTips: [
    'Quality beats quantity - 3 excellent projects > 10 mediocre ones',
    'Deploy your projects - live demos are much more impressive',
    'Write clear README files explaining what you built and why',
    'Include both solo and team projects to show versatility',
    "Update regularly to show you're actively building",
  ],
  githubTips: [
    'Commit regularly, even small changes - consistency matters',
    'Contribute to open source projects in your field',
    'Write descriptive commit messages',
    'Pin your best repositories on your profile',
    'Keep your profile README updated',
  ],
  interviewPrep: [
    'Be ready to explain your portfolio projects in detail',
    'Practice coding problems relevant to your target role',
    'Review fundamentals of your primary languages/frameworks',
    'Prepare questions to ask the interviewer',
    "Research the company's tech stack beforehand",
  ],
  resumeTips: [
    'Lead with achievements, not just responsibilities',
    'Quantify impact when possible (%, users, performance)',
    'Tailor your resume to each application',
    'Keep it to 1-2 pages maximum',
    'Include links to your GitHub and portfolio',
  ],
}

// =====================================================
// TECH TRENDS KNOWLEDGE
// =====================================================

export const TECH_TRENDS = {
  inDemandSkills2025: [
    { skill: 'TypeScript', category: 'Languages' },
    { skill: 'React', category: 'Frontend' },
    { skill: 'Node.js', category: 'Backend' },
    { skill: 'Python', category: 'Languages' },
    { skill: 'Go', category: 'Languages' },
    { skill: 'Rust', category: 'Languages' },
    { skill: 'AWS/Cloud', category: 'Infrastructure' },
    { skill: 'Docker/K8s', category: 'DevOps' },
    { skill: 'AI/ML', category: 'Specialization' },
    { skill: 'GraphQL', category: 'APIs' },
  ],
  growingFields: [
    'AI/ML Engineering',
    'Platform Engineering',
    'Security Engineering',
    'Developer Experience',
    'Web3/Blockchain',
  ],
  learningResources: {
    coding: ['LeetCode', 'HackerRank', 'Codewars', 'Exercism'],
    courses: ['Coursera', 'Udemy', 'Frontend Masters', 'Pluralsight'],
    docs: ['MDN Web Docs', 'Official language docs', 'Framework docs'],
    practice: ['Build side projects', 'Contribute to OSS', 'Hackathons'],
  },
}

// =====================================================
// COMMON DEVELOPER QUESTIONS
// Quick answers for frequently asked questions
// =====================================================

export const FAQ_ANSWERS: Record<string, string> = {
  how_to_improve_score:
    "The best ways to improve your Career Score are: 1) Connect GitHub if you haven't, 2) Add projects with live URLs, 3) Complete your profile with skills and bio, 4) Keep contributing to GitHub regularly.",

  what_employers_see:
    'When you share your Career Card, employers see: your Career Score and grade, GitHub contributions graph, top languages, portfolio projects, skills, bio, and any verified resume.',

  github_not_updating:
    "GitHub data refreshes when you visit your profile. If it seems stale, try disconnecting and reconnecting GitHub, or click 'Refresh Score' in your Career Score card.",

  project_ideas:
    'Great portfolio projects show problem-solving skills. Try: a full-stack app with auth, a tool that solves a real problem, contributing to open source, or rebuilding a popular app with your own twist.',

  career_card_vs_resume:
    'Your Career Card is a dynamic, always-up-to-date profile with verified data. Your resume is a traditional document for formal applications. Use both - the Career Card shows your live work, the resume shows your history.',
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get improvement suggestions based on a Career Score breakdown
 */
export function getScoreImprovementSuggestions(breakdown: {
  github: { score: number }
  portfolio: { score: number }
  profile: { score: number }
}): string[] {
  const suggestions: string[] = []

  if (breakdown.github.score < 50) {
    suggestions.push(
      'Connect GitHub and make regular contributions to boost your GitHub score'
    )
  } else if (breakdown.github.score < 75) {
    suggestions.push(
      'Increase GitHub activity - aim for consistent contributions throughout the week'
    )
  }

  if (breakdown.portfolio.score < 50) {
    suggestions.push(
      'Add more projects to your portfolio - aim for at least 3 with descriptions'
    )
  } else if (breakdown.portfolio.score < 75) {
    suggestions.push(
      'Deploy your projects with live URLs - this significantly improves your portfolio score'
    )
  }

  if (breakdown.profile.score < 50) {
    suggestions.push(
      'Complete your profile - add a headline, bio, skills, and location'
    )
  } else if (breakdown.profile.score < 75) {
    suggestions.push(
      'Add more skills and link your LinkedIn to improve profile completeness'
    )
  }

  return suggestions.slice(0, 3) // Return max 3 suggestions
}

/**
 * Get relevant knowledge based on a topic keyword
 */
export function getKnowledgeForTopic(topic: string): string | null {
  const lowerTopic = topic.toLowerCase()

  // Career Score related
  if (lowerTopic.includes('score') || lowerTopic.includes('grade')) {
    return `Career Score is calculated based on: GitHub (${STORMCHAIN_FEATURES.careerScore.factors.github.weight}%), Portfolio (${STORMCHAIN_FEATURES.careerScore.factors.portfolio.weight}%), and Profile (${STORMCHAIN_FEATURES.careerScore.factors.profile.weight}%).`
  }

  // GitHub related
  if (lowerTopic.includes('github') || lowerTopic.includes('contribution')) {
    return STORMCHAIN_FEATURES.githubIntegration.benefits.join('. ')
  }

  // Portfolio related
  if (lowerTopic.includes('portfolio') || lowerTopic.includes('project')) {
    return STORMCHAIN_FEATURES.portfolio.bestPractices.join('. ')
  }

  // Career Card related
  if (lowerTopic.includes('career card') || lowerTopic.includes('share')) {
    return STORMCHAIN_FEATURES.careerCard.benefits.join('. ')
  }

  return null
}
