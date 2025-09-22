import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Base Account SDK works with Turbopack out of the box
  // No special configuration needed

  // Suppress 404 errors for missing Viem modules in browser
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Suppress 404 errors for missing Viem modules
      config.ignoreWarnings = [
        /Failed to parse source map/,
        /404.*viem/,
        /404.*account-abstraction/,
      ]
    }
    return config
  },
}

export default nextConfig
