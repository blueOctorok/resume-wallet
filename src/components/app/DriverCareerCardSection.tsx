'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Eye,
  RefreshCw,
  FileText,
  ClipboardCheck,
  Car,
} from 'lucide-react'
import CareerCard, { type CareerCardData } from '@/components/CareerCard'
import type { PageType } from '@/stores/types'

interface DriverCareerCardSectionProps {
  walletAddress: string
  onNavigate: (page: PageType) => void
  onBack: () => void
}

export default function DriverCareerCardSection({
  walletAddress,
  onNavigate,
  onBack,
}: DriverCareerCardSectionProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CareerCardData | null>(null)

  const fetchCard = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true)
      else setLoading(true)
      setError(null)

      const res = await fetch('/api/driver/career-card', {
        headers: { 'x-wallet-address': walletAddress },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load career card')
      setData(json.careerCard)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load career card')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCard()
    // Refresh when the user comes back to this tab — so edits in other sections
    // are reflected immediately without requiring a manual refresh.
    const handleFocus = () => fetchCard(true)
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [walletAddress])

  // ── Self-view action slots ────────────────────────────────────────────────
  // Drivers see navigation buttons instead of employer request buttons.

  const resumeAction = !data?.hasResume ? (
    <button
      onClick={() => onNavigate('resume')}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        theme === 'dark'
          ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
          : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
      }`}
    >
      <FileText className="w-3 h-3" />
      Create Resume
    </button>
  ) : null

  const dotAppAction = !data?.hasDriverApp ? (
    <button
      onClick={() => onNavigate('dotapp')}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        theme === 'dark'
          ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
      }`}
    >
      <ClipboardCheck className="w-3 h-3" />
      Start Application
    </button>
  ) : null

  const mvrAction = !data?.hasMvr ? (
    <button
      onClick={() => onNavigate('mvr')}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        theme === 'dark'
          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
      }`}
    >
      <Car className="w-3 h-3" />
      Order MVR
    </button>
  ) : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              My Career Card
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              This is exactly what employers see when they view your profile
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchCard(true)}
          disabled={isRefreshing}
          title="Refresh"
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Employer-perspective banner */}
      <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-3 text-sm ${
        theme === 'dark'
          ? 'bg-teal-500/10 border border-teal-500/30 text-teal-300'
          : 'bg-teal-50 border border-teal-200 text-teal-800'
      }`}>
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span>
          Employers see this card when searching for candidates. Keep it complete to stand out.
        </span>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className={`w-10 h-10 animate-spin ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
        </div>
      )}

      {error && (
        <div className={`p-6 rounded-xl text-center ${
          theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
        }`}>
          <AlertCircle className="w-10 h-10 mx-auto mb-2" />
          <p>{error}</p>
          <button
            onClick={() => fetchCard()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div className={`rounded-2xl p-6 ${
          theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white shadow-sm border border-gray-100'
        }`}>
          {/* Candidate header — same as employer modal header */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
              theme === 'dark' ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
            }`}>
              {data.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {data.name}
              </h3>
              <p className={`text-sm capitalize ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {data.role} · {data.location || 'Location not set'}
              </p>
            </div>
          </div>

          <CareerCard
            data={data}
            resumeAction={resumeAction}
            dotAppAction={dotAppAction}
            mvrAction={mvrAction}
          />
        </div>
      )}
    </div>
  )
}
