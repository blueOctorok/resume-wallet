'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import type { ProfileCompletenessResult } from '@/lib/profile-completeness'
import { getStatusColor, getStatusMessage } from '@/lib/profile-completeness'

interface ProfileCompletenessProps {
  completeness: ProfileCompletenessResult
  showDetails?: boolean
  compact?: boolean
  onImproveClick?: () => void
}

export default function ProfileCompleteness({
  completeness,
  showDetails = false,
  compact = false,
  onImproveClick
}: ProfileCompletenessProps) {
  const { theme } = useTheme()
  const colors = getStatusColor(completeness.status)
  const message = getStatusMessage(completeness.status)

  // Compact version (for small spaces)
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              completeness.status === 'excellent'
                ? 'bg-green-500'
                : completeness.status === 'good'
                ? 'bg-blue-500'
                : completeness.status === 'basic'
                ? 'bg-orange-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${completeness.score}%` }}
          />
        </div>
        <span className={`text-sm font-semibold ${
          isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {completeness.percentage}
        </span>
      </div>
    )
  }

  // Full version
  return (
    <div
      className={`rounded-xl p-6 ${colors.bg} border-2 ${colors.border} transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {completeness.status === 'excellent' ? (
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          ) : completeness.status === 'good' ? (
            <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          ) : completeness.status === 'basic' ? (
            <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          )}
          <div>
            <h3 className={`text-lg font-bold ${colors.text}`}>
              Profile Completeness
            </h3>
            <p className={`text-sm ${colors.text} opacity-80`}>
              {message}
            </p>
          </div>
        </div>
        <div className={`text-3xl font-bold ${colors.text}`}>
          {completeness.percentage}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-full h-4 overflow-hidden shadow-inner">
          <div
            className={`h-4 rounded-full transition-all duration-500 ${
              completeness.status === 'excellent'
                ? 'bg-green-500'
                : completeness.status === 'good'
                ? 'bg-blue-500'
                : completeness.status === 'basic'
                ? 'bg-orange-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${completeness.score}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      {showDetails && (
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${colors.text}`}>
              Core Information
            </span>
            <span className={`text-sm font-bold ${colors.text}`}>
              {completeness.breakdown.core.earned}/{completeness.breakdown.core.total} points
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${colors.text}`}>
              Resume & Application
            </span>
            <span className={`text-sm font-bold ${colors.text}`}>
              {completeness.breakdown.resume.earned}/{completeness.breakdown.resume.total} points
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${colors.text}`}>
              Preferences
            </span>
            <span className={`text-sm font-bold ${colors.text}`}>
              {completeness.breakdown.preferences.earned}/{completeness.breakdown.preferences.total} points
            </span>
          </div>
        </div>
      )}

      {/* Missing Fields (Top 3) */}
      {completeness.missingFields.length > 0 && (
        <div className="mt-4 pt-4 border-t border-current opacity-20">
          <p className={`text-sm font-semibold ${colors.text} mb-2`}>
            Quick Wins ({completeness.missingFields.slice(0, 3).reduce((sum, f) => sum + f.points, 0)} points):
          </p>
          <ul className="space-y-1">
            {completeness.missingFields.slice(0, 3).map((field, index) => (
              <li key={index} className={`text-sm ${colors.text} flex items-center gap-2`}>
                <span className="opacity-50">•</span>
                <span>{field.label}</span>
                <span className="ml-auto font-semibold">+{field.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Button */}
      {onImproveClick && completeness.status !== 'excellent' && (
        <button
          onClick={onImproveClick}
          className={`mt-4 w-full py-2 px-4 rounded-lg font-semibold transition-all ${
            isDarkTheme(theme)
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-black/10 hover:bg-black/20 text-black'
          }`}
        >
          Improve Profile
        </button>
      )}
    </div>
  )
}

