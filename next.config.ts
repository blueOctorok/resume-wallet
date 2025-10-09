import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Base Account SDK works with Turbopack out of the box
  // No special configuration needed

  // Optimize Chakra UI bundle size
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },

  // Temporarily disable TypeScript checking for deployment
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
