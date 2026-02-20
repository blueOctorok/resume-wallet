'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  Clock,
  CheckCircle,
  BarChart3,
  ArrowRight,
  Loader2,
  UserPlus,
  Target,
} from 'lucide-react'

interface Analytics {
  overview: {
    totalApplications: number
    activeJobs: number
    totalJobs: number
    avgTimeToHire: number
    totalHires: number
  }
  pipeline: {
    new: number
    reviewing: number
    interviewing: number
    offer: number
    hired: number
    rejected: number
  }
  conversionRates: {
    toReview: number
    toInterview: number
    toOffer: number
    toHired: number
  }
  sourceBreakdown: {
    applicantInitiated: number
    employerRecruited: number
  }
  trends: {
    applicationsLast7Days: number
    applicationsLast30Days: number
    applicationsByWeek: { week: string; count: number }[]
  }
  activity: {
    pendingReview: number
    inProgress: number
    completed: number
  }
}

interface AnalyticsDashboardProps {
  walletAddress: string
}

export default function AnalyticsDashboard({ walletAddress }: AnalyticsDashboardProps) {
  const { theme } = useTheme()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [walletAddress])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employer/analytics', {
        headers: { 'x-wallet-address': walletAddress },
      })
      
      if (!response.ok) throw new Error('Failed to fetch analytics')
      
      const data = await response.json()
      setAnalytics(data.analytics)
    } catch (err) {
      setError('Failed to load analytics')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        {error || 'No data available'}
      </div>
    )
  }

  const maxWeeklyCount = Math.max(...analytics.trends.applicationsByWeek.map(w => w.count), 1)

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Applications"
          value={analytics.overview.totalApplications}
          trend={analytics.trends.applicationsLast7Days > 0 ? `+${analytics.trends.applicationsLast7Days} this week` : undefined}
          trendUp={analytics.trends.applicationsLast7Days > 0}
          theme={theme}
        />
        <StatCard
          icon={<Briefcase className="w-5 h-5" />}
          label="Active Jobs"
          value={analytics.overview.activeJobs}
          subValue={`${analytics.overview.totalJobs} total`}
          theme={theme}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg. Time to Hire"
          value={analytics.overview.avgTimeToHire}
          suffix="days"
          theme={theme}
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Total Hires"
          value={analytics.overview.totalHires}
          theme={theme}
          highlight={analytics.overview.totalHires > 0}
        />
      </div>

      {/* Pipeline Funnel */}
      <div className={`rounded-2xl p-6 ${
        theme === 'dark' ? 'bg-gray-800/50' : 'bg-white border border-gray-200'
      }`}>
        <div className="flex items-center gap-2 mb-6">
          <Target className={`w-5 h-5 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Hiring Pipeline
          </h3>
        </div>
        
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          <PipelineStage label="New" count={analytics.pipeline.new} color="blue" theme={theme} />
          <ArrowRight className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
          <PipelineStage label="Reviewing" count={analytics.pipeline.reviewing} color="purple" theme={theme} />
          <ArrowRight className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
          <PipelineStage label="Interview" count={analytics.pipeline.interviewing} color="orange" theme={theme} />
          <ArrowRight className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
          <PipelineStage label="Offer" count={analytics.pipeline.offer} color="yellow" theme={theme} />
          <ArrowRight className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
          <PipelineStage label="Hired" count={analytics.pipeline.hired} color="green" theme={theme} />
        </div>

        {/* Conversion Rates */}
        <div className={`mt-6 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Conversion Rates
          </p>
          <div className="flex flex-wrap gap-4">
            <ConversionRate label="→ Review" rate={analytics.conversionRates.toReview} theme={theme} />
            <ConversionRate label="→ Interview" rate={analytics.conversionRates.toInterview} theme={theme} />
            <ConversionRate label="→ Offer" rate={analytics.conversionRates.toOffer} theme={theme} />
            <ConversionRate label="→ Hired" rate={analytics.conversionRates.toHired} theme={theme} />
          </div>
        </div>
      </div>

      {/* Application Trends & Source */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Weekly Trend Chart */}
        <div className={`rounded-2xl p-6 ${
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-white border border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className={`w-5 h-5 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Applications (Last 4 Weeks)
            </h3>
          </div>
          
          <div className="flex items-end justify-between gap-2 h-32">
            {analytics.trends.applicationsByWeek.map((week, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-24">
                  <div
                    className={`w-full max-w-[40px] rounded-t-lg transition-all ${
                      theme === 'dark' ? 'bg-teal-500' : 'bg-teal-500'
                    }`}
                    style={{ 
                      height: `${Math.max((week.count / maxWeeklyCount) * 100, 8)}%`,
                      minHeight: week.count > 0 ? '8px' : '4px',
                      opacity: week.count > 0 ? 1 : 0.3
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className={`text-xs font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {week.count}
                  </p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    {week.week}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Application Source */}
        <div className={`rounded-2xl p-6 ${
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-white border border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className={`w-5 h-5 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} />
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Application Source
            </h3>
          </div>

          <div className="space-y-4">
            <SourceBar
              label="Candidate Applied"
              count={analytics.sourceBreakdown.applicantInitiated}
              total={analytics.overview.totalApplications}
              color="teal"
              theme={theme}
            />
            <SourceBar
              label="You Recruited"
              count={analytics.sourceBreakdown.employerRecruited}
              total={analytics.overview.totalApplications}
              color="purple"
              theme={theme}
            />
          </div>

          {/* Activity Summary */}
          <div className={`mt-6 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              Activity Summary
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={`text-lg font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  {analytics.activity.pendingReview}
                </p>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Pending
                </p>
              </div>
              <div>
                <p className={`text-lg font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                  {analytics.activity.inProgress}
                </p>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  In Progress
                </p>
              </div>
              <div>
                <p className={`text-lg font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                  {analytics.activity.completed}
                </p>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Completed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sub-components

function StatCard({
  icon,
  label,
  value,
  subValue,
  suffix,
  trend,
  trendUp,
  highlight,
  theme,
}: {
  icon: React.ReactNode
  label: string
  value: number
  subValue?: string
  suffix?: string
  trend?: string
  trendUp?: boolean
  highlight?: boolean
  theme: string
}) {
  return (
    <div className={`rounded-xl p-4 ${
      theme === 'dark' 
        ? highlight ? 'bg-teal-500/10 border border-teal-500/30' : 'bg-gray-800/50'
        : highlight ? 'bg-teal-50 border border-teal-200' : 'bg-white border border-gray-200'
    }`}>
      <div className={`mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {value}
        </span>
        {suffix && (
          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            {suffix}
          </span>
        )}
      </div>
      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        {label}
      </p>
      {subValue && (
        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          {subValue}
        </p>
      )}
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${
          trendUp ? 'text-green-500' : 'text-red-500'
        }`}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      )}
    </div>
  )
}

function PipelineStage({
  label,
  count,
  color,
  theme,
}: {
  label: string
  count: number
  color: 'blue' | 'purple' | 'orange' | 'yellow' | 'green'
  theme: string
}) {
  const colors = {
    blue: theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
    purple: theme === 'dark' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200',
    orange: theme === 'dark' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-50 text-orange-700 border-orange-200',
    yellow: theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: theme === 'dark' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200',
  }

  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${colors[color]}`}>
      <span className="text-xl font-bold">{count}</span>
      <span className="text-xs font-medium whitespace-nowrap">{label}</span>
    </div>
  )
}

function ConversionRate({ label, rate, theme }: { label: string; rate: number; theme: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold ${
        rate >= 50 ? 'text-green-500' : rate >= 25 ? 'text-yellow-500' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      }`}>
        {rate}%
      </span>
    </div>
  )
}

function SourceBar({
  label,
  count,
  total,
  color,
  theme,
}: {
  label: string
  count: number
  total: number
  color: 'teal' | 'purple'
  theme: string
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0
  const barColor = color === 'teal' 
    ? 'bg-teal-500' 
    : 'bg-purple-500'

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </span>
        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {count} ({percentage}%)
        </span>
      </div>
      <div className={`h-2 rounded-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
        <div
          className={`h-2 rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
