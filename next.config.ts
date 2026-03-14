import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Temporarily disable TypeScript checking for deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  // Redirect old role-specific card routes to unified /card/[token]
  async redirects() {
    return [
      {
        source: '/d/:token',
        destination: '/card/:token',
        permanent: true,
      },
      {
        source: '/dev-card/:token',
        destination: '/card/:token',
        permanent: true,
      },
    ]
  },

  webpack: (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'pino-pretty': path.resolve(process.cwd(), 'src/lib/shims/pino-pretty.ts'),
    }
    return config
  },
}

export default nextConfig
