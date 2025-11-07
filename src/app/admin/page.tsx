'use client'

import dynamic from 'next/dynamic'
import { useTheme } from '@/contexts/ThemeContext'

// Dynamically import to avoid SSR issues
const TBackendSetup = dynamic(() => import('@/components/admin/TBackendSetup'), {
  ssr: false,
})

export default function AdminPage() {
  const { theme } = useTheme()

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1
            className={`text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-brand-sage'
            }`}
          >
            Admin Panel
          </h1>
          <p
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            Manage T Backend configuration and setup
          </p>
        </div>

        <TBackendSetup />
      </div>
    </div>
  )
}

