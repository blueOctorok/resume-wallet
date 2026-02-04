/**
 * Career Score Prompt Builder
 *
 * Builds a structured prompt for AI to analyze a developer's profile
 * and generate a meaningful career score with detailed breakdown.
 */

export interface GitHubMetrics {
  connected: boolean
  totalRepos: number
  publicRepos: number
  privateRepos: number
  totalStars: number
  totalForks: number
  followers: number
  following: number
  topLanguages: Array<{ language: string; count: number; percentage: number }>
  recentActivity: {
    totalContributions: number
    contributionDays: number // days with at least 1 contribution
    longestStreak: number
    currentStreak: number
  }
}

export interface PortfolioMetrics {
  totalProjects: number
  featuredProjects: number
  projectsWithLiveUrl: number
  projectsWithRepo: number
  projectsWithDemo: number
  uniqueTechStack: string[]
  avgTechPerProject: number
}

export interface ProfileMetrics {
  completenessPercent: number
  hasHeadline: boolean
  hasBio: boolean
  hasLocation: boolean
  skillsCount: number
  skillCategories: string[]
  yearsExperience: number | null
  educationCount: number
  certificationsCount: number
  hasPortfolioUrl: boolean
  hasLinkedIn: boolean
  hasPersonalWebsite: boolean
}

// Content extracted from crawling the portfolio site
export interface PortfolioSiteContent {
  url: string
  title: string | null
  description: string | null
  textContent: string // Main text extracted from the page
  projectsMentioned: string[] // Any project names detected
  technologiesMentioned: string[] // Tech keywords found
  hasContactInfo: boolean
  hasAboutSection: boolean
  crawledAt: string
}

export interface CareerScoreInput {
  github: GitHubMetrics | null
  portfolio: PortfolioMetrics
  profile: ProfileMetrics
  portfolioSite: PortfolioSiteContent | null // Crawled portfolio website content
}

export interface CareerScoreResult {
  score: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: {
    github: { score: number; weight: number; factors: Record<string, number> }
    portfolio: {
      score: number
      weight: number
      factors: Record<string, number>
    }
    profile: { score: number; weight: number; factors: Record<string, number> }
  }
  suggestions: string[]
  analyzedAt: string
}

/**
 * Build the AI prompt for career score analysis
 */
export function buildCareerScorePrompt(input: CareerScoreInput): string {
  const githubSection = input.github
    ? `
## GitHub Profile (${input.github.connected ? 'Full Access - includes private repos' : 'Public Only'})
- Total Repositories: ${input.github.totalRepos} (${input.github.publicRepos} public, ${input.github.privateRepos} private)
- Total Stars Received: ${input.github.totalStars}
- Total Forks: ${input.github.totalForks}
- Followers: ${input.github.followers}
- Following: ${input.github.following}
- Top Languages: ${input.github.topLanguages.map((l) => `${l.language} (${l.percentage}%)`).join(', ') || 'None detected'}
- Recent Activity:
  - Total Contributions (past year): ${input.github.recentActivity.totalContributions}
  - Active Contribution Days: ${input.github.recentActivity.contributionDays}
  - Longest Streak: ${input.github.recentActivity.longestStreak} days
  - Current Streak: ${input.github.recentActivity.currentStreak} days
`
    : `
## GitHub Profile
- Not connected (no GitHub data available)
`

  const portfolioSection = `
## Portfolio Projects
- Total Projects: ${input.portfolio.totalProjects}
- Featured Projects: ${input.portfolio.featuredProjects}
- Projects with Live URL: ${input.portfolio.projectsWithLiveUrl}
- Projects with Repository: ${input.portfolio.projectsWithRepo}
- Projects with Demo Video: ${input.portfolio.projectsWithDemo}
- Unique Technologies Used: ${input.portfolio.uniqueTechStack.length} (${input.portfolio.uniqueTechStack.slice(0, 10).join(', ')}${input.portfolio.uniqueTechStack.length > 10 ? '...' : ''})
- Average Tech Stack per Project: ${input.portfolio.avgTechPerProject.toFixed(1)}
`

  const profileSection = `
## Profile Information
- Profile Completeness: ${input.profile.completenessPercent}%
- Has Headline: ${input.profile.hasHeadline ? 'Yes' : 'No'}
- Has Bio: ${input.profile.hasBio ? 'Yes' : 'No'}
- Has Location: ${input.profile.hasLocation ? 'Yes' : 'No'}
- Skills Listed: ${input.profile.skillsCount} across ${input.profile.skillCategories.length} categories
- Years of Experience: ${input.profile.yearsExperience ?? 'Not specified'}
- Education Entries: ${input.profile.educationCount}
- Certifications: ${input.profile.certificationsCount}
- External Links:
  - Portfolio URL: ${input.profile.hasPortfolioUrl ? 'Yes' : 'No'}
  - LinkedIn: ${input.profile.hasLinkedIn ? 'Yes' : 'No'}
  - Personal Website: ${input.profile.hasPersonalWebsite ? 'Yes' : 'No'}
`

  // Portfolio site analysis section (if crawled)
  const portfolioSiteSection = input.portfolioSite
    ? `
## Portfolio Website Analysis (Crawled)
- URL: ${input.portfolioSite.url}
- Page Title: ${input.portfolioSite.title || 'Not found'}
- Meta Description: ${input.portfolioSite.description || 'Not found'}
- Has About Section: ${input.portfolioSite.hasAboutSection ? 'Yes' : 'No'}
- Has Contact Info: ${input.portfolioSite.hasContactInfo ? 'Yes' : 'No'}
- Projects Mentioned: ${input.portfolioSite.projectsMentioned.length > 0 ? input.portfolioSite.projectsMentioned.join(', ') : 'None detected'}
- Technologies Found: ${input.portfolioSite.technologiesMentioned.length > 0 ? input.portfolioSite.technologiesMentioned.join(', ') : 'None detected'}

### Extracted Content (summarized):
${input.portfolioSite.textContent.slice(0, 2000)}${input.portfolioSite.textContent.length > 2000 ? '... [truncated]' : ''}
`
    : `
## Portfolio Website Analysis
- No portfolio URL provided or site could not be crawled
`

  return `You are a career assessment AI for StormChain, a platform that helps developers showcase their skills and find jobs.

Analyze this developer's profile data and generate a career score.

${githubSection}
${portfolioSection}
${portfolioSiteSection}
${profileSection}

## Scoring Guidelines

Generate a score from 0-100 based on these weighted categories:

1. **GitHub Activity (35% weight if connected, 0% if not)**
   - Contribution consistency is more important than raw numbers
   - Quality indicators: stars, forks, language diversity
   - Recent activity matters more than old repos
   - Having private repos with OAuth shows professional work

2. **Portfolio Quality (40% weight, or 60% if no GitHub)**
   - Live deployed projects are highly valuable
   - Demo videos show extra effort
   - Tech stack diversity shows adaptability
   - Featured projects indicate curation
   - If portfolio site was crawled: evaluate design clarity, content quality, professionalism
   - Portfolio site with clear project descriptions and tech mentions is a strong signal

3. **Profile Completeness (25% weight, or 40% if no GitHub)**
   - Complete profiles get more employer attention
   - Skills with categories show organization
   - External links add credibility
   - Bio and headline are essential

## Response Format

Respond with ONLY valid JSON in this exact format:
{
  "score": <number 0-100>,
  "grade": "<A|B|C|D|F>",
  "breakdown": {
    "github": {
      "score": <number 0-100>,
      "weight": <decimal, e.g. 0.35>,
      "factors": {
        "contributions": <number 0-100>,
        "repoQuality": <number 0-100>,
        "consistency": <number 0-100>,
        "languageDiversity": <number 0-100>
      }
    },
    "portfolio": {
      "score": <number 0-100>,
      "weight": <decimal>,
      "factors": {
        "projectCount": <number 0-100>,
        "liveProjects": <number 0-100>,
        "techDiversity": <number 0-100>,
        "presentation": <number 0-100>,
        "siteQuality": <number 0-100 based on crawled portfolio site, or 50 if not crawled>
      }
    },
    "profile": {
      "score": <number 0-100>,
      "weight": <decimal>,
      "factors": {
        "completeness": <number 0-100>,
        "skills": <number 0-100>,
        "experience": <number 0-100>,
        "credibility": <number 0-100>
      }
    }
  },
  "suggestions": [
    "<actionable suggestion 1>",
    "<actionable suggestion 2>",
    "<actionable suggestion 3>"
  ]
}

Grade scale: A = 90-100, B = 75-89, C = 60-74, D = 45-59, F = 0-44

Provide 3 specific, actionable suggestions to improve their score. Be encouraging but honest.`
}

/**
 * Parse the AI response into a structured result
 */
export function parseCareerScoreResponse(
  response: string
): CareerScoreResult | null {
  try {
    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    // Validate required fields
    if (
      typeof parsed.score !== 'number' ||
      !['A', 'B', 'C', 'D', 'F'].includes(parsed.grade) ||
      !parsed.breakdown ||
      !Array.isArray(parsed.suggestions)
    ) {
      return null
    }

    return {
      score: Math.round(Math.max(0, Math.min(100, parsed.score))),
      grade: parsed.grade,
      breakdown: parsed.breakdown,
      suggestions: parsed.suggestions.slice(0, 5), // Max 5 suggestions
      analyzedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Calculate a fallback score without AI (for when API fails)
 */
export function calculateFallbackScore(
  input: CareerScoreInput
): CareerScoreResult {
  // Simple algorithmic fallback
  let githubScore = 0
  let githubWeight = 0

  if (input.github) {
    githubWeight = 0.35
    const repoScore = Math.min(100, input.github.totalRepos * 3)
    const starScore = Math.min(100, input.github.totalStars * 5)
    const contribScore = Math.min(
      100,
      input.github.recentActivity.totalContributions / 5
    )
    const streakScore = Math.min(
      100,
      input.github.recentActivity.longestStreak * 2
    )
    githubScore = (repoScore + starScore + contribScore + streakScore) / 4
  }

  const portfolioWeight = input.github ? 0.4 : 0.6
  const projectScore = Math.min(100, input.portfolio.totalProjects * 15)
  const liveScore = Math.min(100, input.portfolio.projectsWithLiveUrl * 25)
  const techScore = Math.min(100, input.portfolio.uniqueTechStack.length * 10)
  const portfolioScore = (projectScore + liveScore + techScore) / 3

  const profileWeight = input.github ? 0.25 : 0.4
  const profileScore = input.profile.completenessPercent

  const totalScore = Math.round(
    githubScore * githubWeight +
      portfolioScore * portfolioWeight +
      profileScore * profileWeight
  )

  const grade =
    totalScore >= 90
      ? 'A'
      : totalScore >= 75
        ? 'B'
        : totalScore >= 60
          ? 'C'
          : totalScore >= 45
            ? 'D'
            : 'F'

  const suggestions: string[] = []
  if (!input.github)
    suggestions.push(
      'Connect your GitHub account to boost your score and show your coding activity'
    )
  if (input.portfolio.totalProjects < 3)
    suggestions.push('Add more projects to your portfolio (aim for at least 3)')
  if (input.portfolio.projectsWithLiveUrl === 0)
    suggestions.push('Deploy at least one project with a live URL')
  if (input.profile.completenessPercent < 80)
    suggestions.push('Complete your profile to at least 80%')
  if (input.profile.skillsCount < 5)
    suggestions.push('Add more skills to your profile')

  return {
    score: totalScore,
    grade,
    breakdown: {
      github: {
        score: Math.round(githubScore),
        weight: githubWeight,
        factors: {
          contributions: input.github
            ? Math.min(100, input.github.recentActivity.totalContributions / 5)
            : 0,
          repoQuality: input.github
            ? Math.min(100, input.github.totalStars * 5)
            : 0,
          consistency: input.github
            ? Math.min(100, input.github.recentActivity.longestStreak * 2)
            : 0,
          languageDiversity: input.github
            ? Math.min(100, input.github.topLanguages.length * 15)
            : 0,
        },
      },
      portfolio: {
        score: Math.round(portfolioScore),
        weight: portfolioWeight,
        factors: {
          projectCount: projectScore,
          liveProjects: liveScore,
          techDiversity: techScore,
          presentation: input.portfolio.featuredProjects > 0 ? 80 : 40,
          // Rate site quality based on crawled content
          siteQuality: input.portfolioSite
            ? Math.min(
                100,
                (input.portfolioSite.title ? 20 : 0) +
                  (input.portfolioSite.description ? 15 : 0) +
                  (input.portfolioSite.hasAboutSection ? 20 : 0) +
                  (input.portfolioSite.hasContactInfo ? 15 : 0) +
                  Math.min(
                    20,
                    input.portfolioSite.technologiesMentioned.length * 4
                  ) +
                  Math.min(10, input.portfolioSite.projectsMentioned.length * 2)
              )
            : 50, // Default if not crawled
        },
      },
      profile: {
        score: Math.round(profileScore),
        weight: profileWeight,
        factors: {
          completeness: input.profile.completenessPercent,
          skills: Math.min(100, input.profile.skillsCount * 10),
          experience: input.profile.yearsExperience
            ? Math.min(100, input.profile.yearsExperience * 10)
            : 30,
          credibility:
            (input.profile.hasLinkedIn ? 30 : 0) +
            (input.profile.hasPortfolioUrl ? 35 : 0) +
            (input.profile.hasPersonalWebsite ? 35 : 0),
        },
      },
    },
    suggestions: suggestions.slice(0, 3),
    analyzedAt: new Date().toISOString(),
  }
}
