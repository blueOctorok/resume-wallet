import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getDevGithub } from '@/lib/block-data'

/**
 * GET /api/github/contributions
 *
 * Fetches GitHub contribution data using GraphQL API.
 * Requires share_token to look up the user's GitHub OAuth token.
 *
 * Query params:
 *   - token: Share token to identify the developer profile
 *   - year: Year to fetch contributions for (defaults to current year)
 */

// GraphQL query to fetch contribution calendar
const CONTRIBUTIONS_QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`

// Map GitHub's contribution levels to numeric values (0-4)
function levelToNumber(level: string): number {
  switch (level) {
    case 'NONE':
      return 0
    case 'FIRST_QUARTILE':
      return 1
    case 'SECOND_QUARTILE':
      return 2
    case 'THIRD_QUARTILE':
      return 3
    case 'FOURTH_QUARTILE':
      return 4
    default:
      return 0
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shareToken = searchParams.get('token')
    const yearParam = searchParams.get('year')

    // Public callers pass ?token= (no auth). Self-view resolves the user from
    // the session/wallet helper instead of reading the header directly.
    const selfUserId = shareToken ? null : await getStormUserIdFromRequest(request)

    if (!shareToken && !selfUserId) {
      return NextResponse.json(
        { error: 'Share token or authentication is required' },
        { status: 400 }
      )
    }

    // Default to current year
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

    // Validate year
    if (isNaN(year) || year < 2008 || year > new Date().getFullYear()) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Resolve user from share_token (public view) or wallet address (self view)
    const userQuery = shareToken
      ? supabase.from('users').select('id').eq('share_token', shareToken).single()
      : supabase.from('users').select('id').eq('id', selfUserId!).single()

    const { data: user, error: userError } = await userQuery

    if (userError || !user) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // GitHub credentials from block_dev_github
    const github = await getDevGithub(supabase, user.id)

    if (!github?.username) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      )
    }

    // Build date range for the year
    const from = `${year}-01-01T00:00:00Z`
    const to =
      year === new Date().getFullYear()
        ? new Date().toISOString() // Current date for current year
        : `${year}-12-31T23:59:59Z`

    // Prepare headers - use OAuth token if available, otherwise use app token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // GraphQL API requires authentication
    if (github.access_token) {
      // Use user's OAuth token (includes private contributions)
      headers.Authorization = `Bearer ${github.access_token}`
    } else if (process.env.GITHUB_TOKEN) {
      // Fallback to app token (public contributions only)
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    } else {
      return NextResponse.json(
        { error: 'GitHub authentication required for contribution data' },
        { status: 401 }
      )
    }

    // Make GraphQL request
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: {
          username: github.username,
          from,
          to,
        },
      }),
    })

    const result = await response.json()

    if (result.errors) {
      console.error('[GITHUB CONTRIBUTIONS] GraphQL errors:', result.errors)
      return NextResponse.json(
        { error: 'Failed to fetch contributions' },
        { status: 500 }
      )
    }

    const calendar =
      result.data?.user?.contributionsCollection?.contributionCalendar

    if (!calendar) {
      return NextResponse.json(
        { error: 'No contribution data found' },
        { status: 404 }
      )
    }

    // Transform the data into a flat array of contributions
    const contributions: Array<{
      date: string
      count: number
      level: number
    }> = []

    for (const week of calendar.weeks) {
      for (const day of week.contributionDays) {
        contributions.push({
          date: day.date,
          count: day.contributionCount,
          level: levelToNumber(day.contributionLevel),
        })
      }
    }

    return NextResponse.json({
      success: true,
      year,
      total: calendar.totalContributions,
      contributions,
      // Flag if this includes private contributions
      includesPrivate: !!github.access_token,
    })
  } catch (error) {
    console.error('[GITHUB CONTRIBUTIONS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
