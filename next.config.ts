import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply CSP to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-src https://app.dynamicauth.com 'self';",
          },
        ],
      },
    ]
  },
}

export default nextConfig
