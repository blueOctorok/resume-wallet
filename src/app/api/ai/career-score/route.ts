import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  buildCareerScorePrompt,
  parseCareerScoreResponse,
  calculateFallbackScore,
  CareerScoreInput,
  GitHubMetrics,
  PortfolioMetrics,
  ProfileMetrics,
  PortfolioSiteContent,
  CareerScoreResult,
} from '@/lib/career-score-prompt'

const T_BACKEND_BASE_URL =
  process.env.T_BACKEND_BASE_URL || 'https://api-v2.fluxpointstudios.com'

// Common tech keywords to detect in portfolio site content
const TECH_KEYWORDS = [
  'react',
  'vue',
  'angular',
  'svelte',
  'next.js',
  'nextjs',
  'nuxt',
  'typescript',
  'javascript',
  'python',
  'java',
  'rust',
  'go',
  'golang',
  'node',
  'nodejs',
  'express',
  'fastapi',
  'django',
  'flask',
  'rails',
  'postgresql',
  'postgres',
  'mysql',
  'mongodb',
  'redis',
  'graphql',
  'aws',
  'azure',
  'gcp',
  'docker',
  'kubernetes',
  'terraform',
  'tailwind',
  'css',
  'sass',
  'webpack',
  'vite',
  'vercel',
  'netlify',
  'figma',
  'sketch',
  'ui/ux',
  'responsive',
  'mobile',
  'ios',
  'android',
  'api',
  'rest',
  'microservices',
  'serverless',
  'ci/cd',
  'devops',
  'machine learning',
  'ml',
  'ai',
  'data science',
  'blockchain',
  'web3',
  'solidity',
  'ethereum',
  'smart contracts',
]

/**
 * Crawl a portfolio website and extract useful content for AI analysis.
 * Uses simple HTML parsing - no headless browser needed.
 */
async function crawlPortfolioSite(
  url: string
): Promise<PortfolioSiteContent | null> {
  try {
    console.log('[CAREER SCORE] Crawling portfolio site:', url)

    // Validate URL
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.log('[CAREER SCORE] Invalid URL protocol')
      return null
    }

    // Fetch the page with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'StormChain-CareerScore/1.0 (Portfolio Analysis Bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      console.log('[CAREER SCORE] Failed to fetch portfolio:', response.status)
      return null
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null

    // Extract meta description
    const descMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
      )
    const description = descMatch ? descMatch[1].trim() : null

    // Strip HTML tags and extract text content
    // Remove script, style, nav, footer tags first
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')

    // Extract text from remaining HTML
    const textContent = cleanHtml
      .replace(/<[^>]+>/g, ' ') // Remove all remaining tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .slice(0, 5000) // Limit content size

    // Detect technologies mentioned
    const lowerText = textContent.toLowerCase()
    const technologiesMentioned = TECH_KEYWORDS.filter((tech) =>
      lowerText.includes(tech.toLowerCase())
    )

    // Try to detect project names (look for headings and bold text in original HTML)
    const projectPatterns = [
      /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi,
      /<strong[^>]*>([^<]+)<\/strong>/gi,
      /<b[^>]*>([^<]+)<\/b>/gi,
    ]
    const projectsMentioned: string[] = []
    for (const pattern of projectPatterns) {
      const matches = html.matchAll(pattern)
      for (const match of matches) {
        const text = match[1].trim()
        // Filter out common non-project headings
        if (
          text.length > 3 &&
          text.length < 50 &&
          ![
            'about',
            'contact',
            'home',
            'blog',
            'projects',
            'work',
            'experience',
            'skills',
            'services',
            'portfolio',
            'resume',
            'cv',
          ].includes(text.toLowerCase())
        ) {
          projectsMentioned.push(text)
        }
      }
    }
    // Dedupe and limit
    const uniqueProjects = [...new Set(projectsMentioned)].slice(0, 10)

    // Check for about section
    const hasAboutSection = /about(\s+me)?|who\s+i\s+am|introduction/i.test(
      html
    )

    // Check for contact info
    const hasContactInfo =
      /contact|email|mailto:|@.*\.(com|io|dev|net)|linkedin|twitter|github/i.test(
        html
      )

    const result: PortfolioSiteContent = {
      url,
      title,
      description,
      textContent,
      projectsMentioned: uniqueProjects,
      technologiesMentioned,
      hasContactInfo,
      hasAboutSection,
      crawledAt: new Date().toISOString(),
    }

    console.log('[CAREER SCORE] Portfolio crawl complete:', {
      title,
      textLength: textContent.length,
      techsFound: technologiesMentioned.length,
      projectsFound: uniqueProjects.length,
    })

    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[CAREER SCORE] Portfolio fetch timed out')
    } else {
      console.error('[CAREER SCORE] Portfolio crawl error:', error)
    }
    return null
  }
}

/**
 * POST /api/ai/career-score
 *
 * Calculates an AI-generated career score for a developer profile.
 *
 * Body:
 *   - userId: string (required) - The user's ID
 *   - forceRefresh: boolean (optional) - Force recalculation even if cached
 *
 * Headers:
 *   - x-wallet-address: string (required) - For authentication
 *
 * Returns: CareerScoreResult with score, grade, breakdown, and suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { userId, forceRefresh = false } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Verify user owns this profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Security: Only allow users to calculate their own score
    if (user.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch profile and projects in parallel
    const [profileResult, projectsResult] = await Promise.all([
      supabase
        .from('developer_profiles')
        .select('*')
        .eq('user_id', userId)
        .single(),
      supabase.from('developer_projects').select('*').eq('user_id', userId),
    ])

    if (profileResult.error || !profileResult.data) {
      return NextResponse.json(
        { error: 'Developer profile not found' },
        { status: 404 }
      )
    }

    const profile = profileResult.data
    const projects = projectsResult.data || []

    // Debug: Log what we found
    console.log('[CAREER SCORE] Data from DB:', {
      userId,
      profileId: profile.id,
      githubUsername: profile.github_username,
      hasGithubToken: !!profile.github_access_token,
      projectCount: projects.length,
      projectIds: projects.map((p: { id: string }) => p.id),
    })

    // Check for cached score (less than 24 hours old)
    if (!forceRefresh && profile.career_score) {
      const cachedScore = profile.career_score as CareerScoreResult
      const analyzedAt = new Date(cachedScore.analyzedAt)
      const hoursSinceAnalysis =
        (Date.now() - analyzedAt.getTime()) / (1000 * 60 * 60)

      if (hoursSinceAnalysis < 24) {
        console.log(
          `[CAREER SCORE] Returning cached score (${hoursSinceAnalysis.toFixed(1)}h old)`
        )
        return NextResponse.json({
          success: true,
          cached: true,
          ...cachedScore,
        })
      }
    }

    // Build metrics from profile and projects (fetches GitHub data live)
    const metrics = await buildMetrics(profile, projects)

    // Debug: Log the metrics being used
    console.log('[CAREER SCORE] Metrics collected:', {
      github: metrics.github
        ? {
            connected: metrics.github.connected,
            totalRepos: metrics.github.totalRepos,
            totalStars: metrics.github.totalStars,
            contributions: metrics.github.recentActivity.totalContributions,
            languages: metrics.github.topLanguages.length,
          }
        : 'NOT CONNECTED',
      portfolio: {
        totalProjects: metrics.portfolio.totalProjects,
        withLiveUrl: metrics.portfolio.projectsWithLiveUrl,
        techStack: metrics.portfolio.uniqueTechStack.length,
      },
      profile: {
        completeness: metrics.profile.completenessPercent,
        skills: metrics.profile.skillsCount,
        hasHeadline: metrics.profile.hasHeadline,
        hasBio: metrics.profile.hasBio,
      },
    })

    // Try AI scoring first, fallback to algorithmic if AI fails
    let scoreResult: CareerScoreResult

    try {
      scoreResult = await getAIScore(metrics)
      console.log('[CAREER SCORE] AI score calculated:', scoreResult.score)
    } catch (aiError) {
      console.error('[CAREER SCORE] AI failed, using fallback:', aiError)
      scoreResult = calculateFallbackScore(metrics)
      console.log(
        '[CAREER SCORE] Fallback score calculated:',
        scoreResult.score,
        'Breakdown:',
        scoreResult.breakdown
      )
    }

    // Cache the score in the profile
    const { error: updateError } = await supabase
      .from('developer_profiles')
      .update({ career_score: scoreResult })
      .eq('user_id', userId)

    if (updateError) {
      console.error('[CAREER SCORE] Failed to cache score:', updateError)
      // Continue anyway - we have the score
    }

    return NextResponse.json({
      success: true,
      cached: false,
      ...scoreResult,
    })
  } catch (error) {
    console.error('[CAREER SCORE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate career score' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/career-score
 *
 * Get career score by share token (for public Career Card view)
 *
 * Query params:
 *   - token: Share token to identify the developer
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shareToken = searchParams.get('token')

    if (!shareToken) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: profile, error: profileError } = await supabase
      .from('developer_profiles')
      .select('career_score')
      .eq('share_token', shareToken)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!profile.career_score) {
      return NextResponse.json(
        { error: 'Score not yet calculated', needsCalculation: true },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ...(profile.career_score as CareerScoreResult),
    })
  } catch (error) {
    console.error('[CAREER SCORE GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get career score' },
      { status: 500 }
    )
  }
}

/**
 * Build metrics object from profile and projects data
 * Now fetches GitHub data LIVE using the OAuth token
 */
async function buildMetrics(
  profile: Record<string, unknown>,
  projects: Record<string, unknown>[]
): Promise<CareerScoreInput> {
  // GitHub metrics - fetch LIVE data using OAuth token
  let github: GitHubMetrics | null = null

  if (profile.github_username && profile.github_access_token) {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'StormChain-CareerScore',
        Authorization: `Bearer ${profile.github_access_token}`,
      }

      // Fetch user profile
      const userRes = await fetch('https://api.github.com/user', { headers })
      const userData = await userRes.json()

      if (userData && !userData.message) {
        // Fetch repos (includes private with OAuth token)
        const reposRes = await fetch(
          'https://api.github.com/user/repos?per_page=100&sort=updated',
          { headers }
        )
        const reposData = await reposRes.json()

        const repos = Array.isArray(reposData) ? reposData : []

        // Calculate totals
        const totalStars = repos.reduce(
          (sum: number, r: Record<string, unknown>) =>
            sum + ((r.stargazers_count as number) || 0),
          0
        )
        const totalForks = repos.reduce(
          (sum: number, r: Record<string, unknown>) =>
            sum + ((r.forks_count as number) || 0),
          0
        )
        const privateRepos = repos.filter(
          (r: Record<string, unknown>) => r.private
        ).length

        // Calculate language stats
        const langCount: Record<string, number> = {}
        repos.forEach((r: Record<string, unknown>) => {
          const lang = r.language as string | null
          if (lang) {
            langCount[lang] = (langCount[lang] || 0) + 1
          }
        })
        const totalLangs = Object.values(langCount).reduce((a, b) => a + b, 0)
        const topLanguages = Object.entries(langCount)
          .map(([language, count]) => ({
            language,
            count,
            percentage:
              totalLangs > 0 ? Math.round((count / totalLangs) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)

        github = {
          connected: true,
          totalRepos: repos.length,
          publicRepos: repos.length - privateRepos,
          privateRepos,
          totalStars,
          totalForks,
          followers: (userData.followers as number) || 0,
          following: (userData.following as number) || 0,
          topLanguages,
          recentActivity: {
            // These would require GraphQL API for accurate data
            // For now, estimate based on repo activity
            totalContributions: repos.length * 10, // Rough estimate
            contributionDays: Math.min(repos.length * 5, 365),
            longestStreak: Math.min(repos.length * 2, 100),
            currentStreak: Math.min(repos.length, 30),
          },
        }

        console.log('[CAREER SCORE] GitHub data fetched live:', {
          repos: repos.length,
          stars: totalStars,
          languages: topLanguages.length,
        })

        // Store fetched data in DB for future use (fire and forget)
        const supabase = await getAdminSupabaseClient()
        supabase
          .from('developer_profiles')
          .update({
            github_data: {
              totalRepos: repos.length,
              publicRepos: repos.length - privateRepos,
              privateRepos,
              totalStars,
              totalForks,
              followers: userData.followers || 0,
              following: userData.following || 0,
              avatarUrl: userData.avatar_url || null,
              bio: userData.bio || null,
              topLanguages,
              syncedAt: new Date().toISOString(),
            },
          })
          .eq('id', profile.id)
          .then(() => console.log('[CAREER SCORE] GitHub data stored in DB'))
          .catch((err) =>
            console.error('[CAREER SCORE] Failed to store GitHub data:', err)
          )
      }
    } catch (error) {
      console.error('[CAREER SCORE] Failed to fetch GitHub data:', error)
      // Fall through to null github
    }
  } else if (profile.github_username) {
    // Has username but no OAuth token - mark as not fully connected
    console.log('[CAREER SCORE] GitHub username exists but no OAuth token')
  }

  // Portfolio metrics
  const uniqueTechStack = new Set<string>()
  let totalTech = 0

  for (const project of projects) {
    const techStack = (project.tech_stack as string[]) || []
    techStack.forEach((tech) => uniqueTechStack.add(tech))
    totalTech += techStack.length
  }

  const portfolio: PortfolioMetrics = {
    totalProjects: projects.length,
    featuredProjects: projects.filter((p) => p.is_featured).length,
    projectsWithLiveUrl: projects.filter((p) => p.live_url).length,
    projectsWithRepo: projects.filter((p) => p.repo_url).length,
    projectsWithDemo: projects.filter((p) => p.demo_video_url).length,
    uniqueTechStack: Array.from(uniqueTechStack),
    avgTechPerProject: projects.length > 0 ? totalTech / projects.length : 0,
  }

  // Profile metrics
  const skills =
    (profile.skills as Array<{ name: string; category: string }>) || []
  const skillCategories = [
    ...new Set(skills.map((s) => s.category).filter(Boolean)),
  ]
  const education = (profile.education as unknown[]) || []
  const certifications = (profile.certifications as unknown[]) || []

  // Calculate profile completeness (same algorithm as hub)
  let completeness = 15 // Base for having profile
  if (profile.headline || profile.bio) completeness += 15
  if (skills.length > 0) completeness += 15
  if (profile.github_username) completeness += 20
  if (
    (profile.job_types as unknown[])?.length > 0 ||
    (profile.work_styles as unknown[])?.length > 0
  )
    completeness += 10
  if (projects.length > 0) completeness += 25

  const profileMetrics: ProfileMetrics = {
    completenessPercent: Math.min(100, completeness),
    hasHeadline: !!profile.headline,
    hasBio: !!profile.bio,
    hasLocation: !!profile.location,
    skillsCount: skills.length,
    skillCategories,
    yearsExperience: (profile.years_experience as number) || null,
    educationCount: education.length,
    certificationsCount: certifications.length,
    hasPortfolioUrl: !!profile.portfolio_url,
    hasLinkedIn: !!profile.linkedin_url,
    hasPersonalWebsite: !!profile.personal_website,
  }

  // Crawl portfolio site if URL is provided
  let portfolioSite: PortfolioSiteContent | null = null
  const portfolioUrl = profile.portfolio_url as string | null
  if (portfolioUrl) {
    portfolioSite = await crawlPortfolioSite(portfolioUrl)
  }

  return {
    github,
    portfolio,
    profile: profileMetrics,
    portfolioSite,
  }
}

/**
 * Get AI-generated score from T Backend
 */
async function getAIScore(
  metrics: CareerScoreInput
): Promise<CareerScoreResult> {
  const prompt = buildCareerScorePrompt(metrics)

  // Use the T Backend chat API for AI analysis
  const response = await fetch(`${T_BACKEND_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Partner': 'pace_drivers',
    },
    body: JSON.stringify({
      message: prompt,
      system:
        'You are a career assessment AI. Respond ONLY with valid JSON. No explanations, no markdown.',
    }),
  })

  if (!response.ok) {
    throw new Error(`T Backend error: ${response.status}`)
  }

  const data = await response.json()
  const aiResponse = data.reply || data.response || data.message

  if (!aiResponse) {
    throw new Error('No response from AI')
  }

  const parsed = parseCareerScoreResponse(aiResponse)
  if (!parsed) {
    throw new Error('Failed to parse AI response')
  }

  return parsed
}
