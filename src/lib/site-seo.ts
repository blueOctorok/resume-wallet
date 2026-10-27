/**
 * Public homepage wording for search and answer engines.
 *
 * Driver phrases are the ones the marketing review asked the homepage to rank
 * for. "Verified" is reserved for a fact a licensed screener issued (an MVR).
 * A resume or DOT application the driver typed is never described as verified.
 */
export const SITE_SEO = {
  title: 'Provven - Truck Driver Applications & Verified Credentials',
  description:
    'Build a truck driver resume and a DOT employment application once, then reuse them. Your Career Card stays yours. A verified MVR is shared only when you choose.',
  intro:
    'Build your truck driver resume and DOT application once, then reuse them on the next job. Your employment history stays on the Career Card. A credential a licensed screener verifies, such as an MVR, is shared only when you choose.',
  footerSummary:
    'Provven helps truck drivers keep a truck driver resume, a truck driver employment application, and a DOT driver application in one Career Card they own. They update that work history once instead of retyping it for every job. Truck driver employment verification from a licensed screener, such as an MVR, is shared only when the driver chooses.',
} as const

/** Organization + WebSite. LocalBusiness is omitted: Provven has no public shop address. */
export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Provven',
        url: 'https://provven.com',
        logo: 'https://provven.com/og-image.png',
        email: 'support@provven.com',
        description: SITE_SEO.description,
      },
      {
        '@type': 'WebSite',
        name: 'Provven',
        url: 'https://provven.com',
        description: SITE_SEO.description,
        publisher: {
          '@type': 'Organization',
          name: 'Provven',
          url: 'https://provven.com',
        },
      },
      {
        '@type': 'WebPage',
        url: 'https://provven.com/',
        name: 'Build Your Truck Driver Resume and Reuse It for Every Job',
        description: SITE_SEO.footerSummary,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Provven',
          url: 'https://provven.com',
        },
      },
    ],
  }
}
