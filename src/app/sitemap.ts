import { MetadataRoute } from 'next'

/**
 * Dynamic sitemap for StormChain
 * Next.js automatically serves this at /sitemap.xml
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://stormchain.ai'

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/admin`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    // Public career card pages are dynamic (/d/[token]) so we don't list them here
    // but they're still crawlable when linked
  ]
}
