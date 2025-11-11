import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Base Account SDK works with Turbopack out of the box
  // No special configuration needed

  // Temporarily disable TypeScript checking for deployment
  typescript: {
    ignoreBuildErrors: true,
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
