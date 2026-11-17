/**
 * Which resumes Provven shows.
 *
 * driver, developer, and general are hub and career-card resumes.
 * portfolio is a print for another site. It may be stored on the same user.
 * Hub, career card, talent search, and admin resume lists do not read it.
 */
export const SITE_RESUME_ROLES = ['driver', 'developer', 'general'] as const

export type SiteResumeRole = (typeof SITE_RESUME_ROLES)[number]

export const PORTFOLIO_RESUME_ROLE = 'portfolio' as const
