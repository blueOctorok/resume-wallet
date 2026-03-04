'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { BarChart3, TrendingUp, Users, Briefcase, Clock } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'

interface ReportsPageProps {
  walletAddress: string
  onBack: () => void
}

export default function ReportsPage({ walletAddress, onBack }: ReportsPageProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const cardClass = isDark
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-white border-gray-200'

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Back button */}
      <div className="mb-6">
        <BackToHubButton onClick={onBack} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Reports
          </h1>
        </div>
        <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
          Analytics and insights for your hiring pipeline
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className={`rounded-2xl border p-8 text-center ${cardClass}`}>
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
          isDark ? 'bg-teal-500/20' : 'bg-teal-100'
        }`}>
          <TrendingUp className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
        </div>
        
        <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Coming Soon
        </h2>
        <p className={`max-w-md mx-auto mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          We&apos;re building powerful analytics to help you understand your hiring funnel, 
          track candidate sources, and measure time-to-hire.
        </p>

        {/* Preview of planned features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <Users className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Pipeline Stats
            </p>
          </div>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <Briefcase className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Job Performance
            </p>
          </div>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <Clock className={`w-5 h-5 mx-auto mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Time to Hire
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
