/**
 * Public homepage wording for search and answer engines.
 *
 * Order matters: the DOT application leads, the resume is the second phrase.
 * The resume phrases stay so the terms the marketing review asked the homepage
 * to rank for are still in the first HTML response.
 *
 * "Verified" is reserved for a fact a licensed screener issued (an MVR).
 * A resume or DOT application the driver typed is never described as verified.
 */
export const SITE_SEO = {
  title: 'Provven - Your DOT Driver Application, Done Once',
  /** The visible H1, the WebPage schema name, and the share-image alt text. */
  headline: 'Your DOT Application. Done Once. Share It With Employers.',
  description:
    'Fill out your DOT driver application once and share it with every trucking employer. Free for drivers. Your truck driver resume prints from the same file.',
  intro:
    'Fill out your DOT driver application one time, free. The next trucking company that asks gets the file you already finished, so you stop retyping your work history for every job.',
  resumeNote: 'Your truck driver resume prints from the same application.',
  footerSummary:
    'Provven lets truck drivers fill out a DOT driver application once and share that same truck driver employment application with each employer, free. A truck driver resume prints from the file, so work history is typed one time. Truck driver employment verification from a licensed screener, such as an MVR, is shared only when the driver chooses.',
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
        name: SITE_SEO.headline,
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
