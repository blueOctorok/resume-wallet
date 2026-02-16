import { describe, it, expect } from 'vitest'
import {
  parseCareerScoreResponse,
  calculateFallbackScore,
  type CareerScoreInput,
  type GitHubMetrics,
  type PortfolioMetrics,
  type ProfileMetrics,
} from './career-score-prompt'

function baseInput(overrides?: Partial<CareerScoreInput>): CareerScoreInput {
  return {
    github: null,
    portfolio: {
      totalProjects: 3,
      featuredProjects: 1,
      projectsWithLiveUrl: 2,
      projectsWithRepo: 3,
      projectsWithDemo: 1,
      uniqueTechStack: ['React', 'TypeScript', 'Node'],
      avgTechPerProject: 3,
    },
    profile: {
      completenessPercent: 85,
      hasHeadline: true,
      hasBio: true,
      hasLocation: true,
      skillsCount: 8,
      skillCategories: ['Frontend', 'Backend'],
      yearsExperience: 5,
      educationCount: 1,
      certificationsCount: 0,
      hasPortfolioUrl: true,
      hasLinkedIn: true,
      hasPersonalWebsite: false,
    },
    portfolioSite: null,
    ...overrides,
  }
}

function githubMetrics(overrides?: Partial<GitHubMetrics>): GitHubMetrics {
  return {
    connected: true,
    publicRepos: 20,
    privateRepos: 5,
    totalRepos: 25,
    totalStars: 50,
    totalForks: 10,
    followers: 20,
    following: 30,
    topLanguages: [
      { language: 'TypeScript', count: 100, percentage: 40 },
      { language: 'JavaScript', count: 80, percentage: 30 },
    ],
    recentActivity: {
      totalContributions: 500,
      contributionDays: 200,
      longestStreak: 30,
      currentStreak: 5,
    },
    ...overrides,
  }
}

describe('parseCareerScoreResponse', () => {
  it('parses valid JSON response', () => {
    const response = JSON.stringify({
      score: 85,
      grade: 'B',
      breakdown: {
        github: { score: 80, weight: 0.35, factors: {} },
        portfolio: { score: 90, weight: 0.4, factors: {} },
        profile: { score: 85, weight: 0.25, factors: {} },
      },
      suggestions: ['Add more projects', 'Connect GitHub'],
    })
    const result = parseCareerScoreResponse(response)
    expect(result).not.toBeNull()
    expect(result!.score).toBe(85)
    expect(result!.grade).toBe('B')
    expect(result!.suggestions).toHaveLength(2)
  })

  it('extracts JSON from response with extra text', () => {
    const response =
      'Here is the analysis:\n{"score":70,"grade":"C","breakdown":{},\"suggestions\":[]}'
    const result = parseCareerScoreResponse(response)
    expect(result).not.toBeNull()
    expect(result!.score).toBe(70)
  })

  it('clamps score to 0-100', () => {
    const response = JSON.stringify({
      score: 150,
      grade: 'A',
      breakdown: {},
      suggestions: [],
    })
    const result = parseCareerScoreResponse(response)
    expect(result!.score).toBe(100)
  })

  it('returns null for invalid JSON', () => {
    expect(parseCareerScoreResponse('not json')).toBeNull()
  })

  it('returns null for missing required fields', () => {
    expect(
      parseCareerScoreResponse(JSON.stringify({ score: 80 }))
    ).toBeNull()
  })

  it('returns null for invalid grade', () => {
    const response = JSON.stringify({
      score: 80,
      grade: 'X',
      breakdown: {},
      suggestions: [],
    })
    expect(parseCareerScoreResponse(response)).toBeNull()
  })

  it('limits suggestions to 5', () => {
    const response = JSON.stringify({
      score: 80,
      grade: 'B',
      breakdown: {},
      suggestions: ['a', 'b', 'c', 'd', 'e', 'f'],
    })
    const result = parseCareerScoreResponse(response)
    expect(result!.suggestions).toHaveLength(5)
  })
})

describe('calculateFallbackScore', () => {
  describe('without GitHub', () => {
    it('uses higher portfolio and profile weights (0.6 and 0.4)', () => {
      const result = calculateFallbackScore(baseInput())
      expect(result.breakdown.github.weight).toBe(0)
      expect(result.breakdown.portfolio.weight).toBe(0.6)
      expect(result.breakdown.profile.weight).toBe(0.4)
    })
    it('suggests connecting GitHub', () => {
      const result = calculateFallbackScore(baseInput())
      expect(result.suggestions).toContain(
        'Connect your GitHub account to boost your score and show your coding activity'
      )
    })
  })

  describe('with GitHub', () => {
    it('uses weights 0.35, 0.4, 0.25 for github, portfolio, profile', () => {
      const result = calculateFallbackScore(
        baseInput({ github: githubMetrics() })
      )
      expect(result.breakdown.github.weight).toBe(0.35)
      expect(result.breakdown.portfolio.weight).toBe(0.4)
      expect(result.breakdown.profile.weight).toBe(0.25)
    })
    it('computes github score from repos, stars, contributions, streak', () => {
      const result = calculateFallbackScore(
        baseInput({
          github: githubMetrics({
            totalRepos: 30,
            totalStars: 20,
            recentActivity: {
              totalContributions: 500,
              contributionDays: 200,
              longestStreak: 40,
              currentStreak: 5,
            },
          }),
        })
      )
      expect(result.breakdown.github.score).toBeGreaterThan(0)
    })
  })

  describe('grade thresholds', () => {
    it('A for 90+', () => {
      const result = calculateFallbackScore(
        baseInput({
          portfolio: {
            totalProjects: 10,
            featuredProjects: 5,
            projectsWithLiveUrl: 8,
            projectsWithRepo: 10,
            projectsWithDemo: 5,
            uniqueTechStack: Array(10).fill('x'),
            avgTechPerProject: 5,
          } as PortfolioMetrics,
          profile: {
            completenessPercent: 95,
            hasHeadline: true,
            hasBio: true,
            hasLocation: true,
            skillsCount: 15,
            skillCategories: ['a', 'b'],
            yearsExperience: 8,
            educationCount: 2,
            certificationsCount: 2,
            hasPortfolioUrl: true,
            hasLinkedIn: true,
            hasPersonalWebsite: true,
          } as ProfileMetrics,
        })
      )
      expect(result.grade).toBe('A')
    })
    it('B for 75-89', () => {
      const result = calculateFallbackScore(
        baseInput({
          portfolio: {
            totalProjects: 4,
            featuredProjects: 2,
            projectsWithLiveUrl: 2,
            projectsWithRepo: 4,
            projectsWithDemo: 1,
            uniqueTechStack: ['a', 'b', 'c', 'd', 'e'],
            avgTechPerProject: 4,
          } as PortfolioMetrics,
          profile: {
            completenessPercent: 80,
            hasHeadline: true,
            hasBio: true,
            hasLocation: true,
            skillsCount: 8,
            skillCategories: ['a'],
            yearsExperience: 5,
            educationCount: 1,
            certificationsCount: 0,
            hasPortfolioUrl: true,
            hasLinkedIn: true,
            hasPersonalWebsite: false,
          } as ProfileMetrics,
        })
      )
      expect(['A', 'B', 'C']).toContain(result.grade)
    })
    it('F for low scores', () => {
      const result = calculateFallbackScore(
        baseInput({
          portfolio: {
            totalProjects: 0,
            featuredProjects: 0,
            projectsWithLiveUrl: 0,
            projectsWithRepo: 0,
            projectsWithDemo: 0,
            uniqueTechStack: [],
            avgTechPerProject: 0,
          } as PortfolioMetrics,
          profile: {
            completenessPercent: 20,
            hasHeadline: false,
            hasBio: false,
            hasLocation: false,
            skillsCount: 0,
            skillCategories: [],
            yearsExperience: null,
            educationCount: 0,
            certificationsCount: 0,
            hasPortfolioUrl: false,
            hasLinkedIn: false,
            hasPersonalWebsite: false,
          } as ProfileMetrics,
        })
      )
      expect(result.grade).toBe('F')
    })
  })

  describe('suggestions', () => {
    it('suggests more projects when < 3', () => {
      const result = calculateFallbackScore(
        baseInput({
          portfolio: {
            totalProjects: 1,
            featuredProjects: 0,
            projectsWithLiveUrl: 0,
            projectsWithRepo: 1,
            projectsWithDemo: 0,
            uniqueTechStack: [],
            avgTechPerProject: 1,
          } as PortfolioMetrics,
        })
      )
      expect(result.suggestions).toContain(
        'Add more projects to your portfolio (aim for at least 3)'
      )
    })
    it('suggests live URL when none', () => {
      const result = calculateFallbackScore(
        baseInput({
          portfolio: {
            totalProjects: 3,
            featuredProjects: 0,
            projectsWithLiveUrl: 0,
            projectsWithRepo: 3,
            projectsWithDemo: 0,
            uniqueTechStack: [],
            avgTechPerProject: 2,
          } as PortfolioMetrics,
        })
      )
      expect(result.suggestions).toContain(
        'Deploy at least one project with a live URL'
      )
    })
    it('limits suggestions to 3', () => {
      const result = calculateFallbackScore(
        baseInput({
          portfolio: {
            totalProjects: 0,
            featuredProjects: 0,
            projectsWithLiveUrl: 0,
            projectsWithRepo: 0,
            projectsWithDemo: 0,
            uniqueTechStack: [],
            avgTechPerProject: 0,
          } as PortfolioMetrics,
          profile: {
            completenessPercent: 30,
            hasHeadline: false,
            hasBio: false,
            hasLocation: false,
            skillsCount: 1,
            skillCategories: [],
            yearsExperience: null,
            educationCount: 0,
            certificationsCount: 0,
            hasPortfolioUrl: false,
            hasLinkedIn: false,
            hasPersonalWebsite: false,
          } as ProfileMetrics,
        })
      )
      expect(result.suggestions.length).toBeLessThanOrEqual(3)
    })
  })

  describe('result shape', () => {
    it('includes score, grade, breakdown, suggestions, analyzedAt', () => {
      const result = calculateFallbackScore(baseInput())
      expect(result).toHaveProperty('score')
      expect(result).toHaveProperty('grade')
      expect(result).toHaveProperty('breakdown')
      expect(result.breakdown).toHaveProperty('github')
      expect(result.breakdown).toHaveProperty('portfolio')
      expect(result.breakdown).toHaveProperty('profile')
      expect(result).toHaveProperty('suggestions')
      expect(result).toHaveProperty('analyzedAt')
      expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})
