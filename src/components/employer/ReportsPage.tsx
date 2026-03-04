'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { BarChart3 } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import AnalyticsDashboard from './AnalyticsDashboard'

interface ReportsPageProps {
  walletAddress: string
  onBack: () => void
}

export default function ReportsPage({ walletAddress, onBack }: ReportsPageProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Back button */}
      <div className="mb-6">
        <BackToHubButton onClick={onBack} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Reports & Analytics
          </h1>
        </div>
        <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          Track your hiring pipeline, conversion rates, and application trends
        </p>
      </div>

      {/* Analytics Dashboard */}
      <AnalyticsDashboard walletAddress={walletAddress} />
    </div>
  )
}
