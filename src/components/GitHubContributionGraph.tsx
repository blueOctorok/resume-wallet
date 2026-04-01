'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

interface ContributionDay {
  date: string
  count: number
  level: number // 0-4
}

interface GitHubContributionGraphProps {
  shareToken?: string | null
  walletAddress?: string | null
  className?: string
}

// GitHub's contribution colors (dark theme)
const LEVEL_COLORS = [
  'bg-gray-800', // Level 0 - no contributions
  'bg-green-900', // Level 1
  'bg-green-700', // Level 2
  'bg-green-500', // Level 3
  'bg-green-400', // Level 4 - most contributions
]

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function GitHubContributionGraph({
  shareToken,
  walletAddress,
  className = '',
}: GitHubContributionGraphProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [showYearPicker, setShowYearPicker] = useState(false)
  const [contributions, setContributions] = useState<ContributionDay[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includesPrivate, setIncludesPrivate] = useState(false)

  // Generate available years (last 5 years)
  const availableYears = useMemo(() => {
    const years = []
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y)
    }
    return years
  }, [currentYear])

  // Fetch contributions when year changes
  useEffect(() => {
    const fetchContributions = async () => {
      setLoading(true)
      setError(null)

      try {
        const url = shareToken
          ? `/api/github/contributions?token=${encodeURIComponent(shareToken)}&year=${selectedYear}`
          : `/api/github/contributions?year=${selectedYear}`
        const fetchOptions: RequestInit = shareToken
          ? {}
          : { headers: { 'x-wallet-address': walletAddress ?? '' } }
        const res = await fetch(url, fetchOptions)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch')
        }

        setContributions(data.contributions || [])
        setTotal(data.total || 0)
        setIncludesPrivate(data.includesPrivate || false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setContributions([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }

    if (!shareToken && !walletAddress) return
    fetchContributions()
  }, [shareToken, walletAddress, selectedYear])

  // Organize contributions into weeks (columns) for the grid
  const weeks = useMemo(() => {
    if (contributions.length === 0) return []

    // Create a map for quick lookup
    const dateMap = new Map<string, ContributionDay>()
    contributions.forEach((c) => dateMap.set(c.date, c))

    // Find the first Sunday on or before Jan 1 of selected year
    const startDate = new Date(selectedYear, 0, 1)
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1)
    }

    // Always use full year (Dec 31) so grid shows all 12 months; future days are empty cells
    const endDate = new Date(selectedYear, 11, 31)
    while (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + 1)
    }

    const weeksArray: Array<Array<ContributionDay | null>> = []
    let currentWeek: Array<ContributionDay | null> = []
    const cursor = new Date(startDate)

    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0]
      const contribution = dateMap.get(dateStr) || {
        date: dateStr,
        count: 0,
        level: 0,
      }

      // Only include days within the selected year
      if (cursor.getFullYear() === selectedYear) {
        currentWeek.push(contribution)
      } else {
        currentWeek.push(null) // Empty cell for days outside the year
      }

      if (cursor.getDay() === 6) {
        // Saturday - end of week
        weeksArray.push(currentWeek)
        currentWeek = []
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    // Push remaining days if any
    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek)
    }

    return weeksArray
  }, [contributions, selectedYear, currentYear])

  // Calculate month labels with start and end week index so we can center each label
  // Only show labels for months in the selected year (avoids "Dec" from previous year at start)
  const monthLabels = useMemo(() => {
    if (weeks.length === 0) return []

    const labels: Array<{
      month: string
      weekIndex: number
      endWeekIndex: number
    }> = []
    let lastMonth = -1
    let startWeekIndex = 0

    weeks.forEach((week, weekIndex) => {
      const firstDayInYear = week.find((d) => {
        if (d === null) return false
        const date = new Date(d.date)
        return date.getFullYear() === selectedYear
      })
      if (firstDayInYear) {
        const date = new Date(firstDayInYear.date)
        const month = date.getMonth()
        if (month !== lastMonth) {
          if (lastMonth >= 0) {
            labels[labels.length - 1].endWeekIndex = weekIndex
          }
          labels.push({
            month: MONTHS[month],
            weekIndex,
            endWeekIndex: weeks.length,
          })
          lastMonth = month
        }
      }
    })
    if (labels.length > 0) {
      labels[labels.length - 1].endWeekIndex = weeks.length
    }

    return labels
  }, [weeks, selectedYear])

  if (error) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <p className='text-sm'>{error}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header with year selector */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <span className='text-sm text-gray-400'>
            {loading ? (
              <Loader2 className='w-4 h-4 animate-spin inline mr-1' />
            ) : (
              <>
                <span className='font-semibold text-white'>
                  {total.toLocaleString()}
                </span>{' '}
                contributions in {selectedYear}
              </>
            )}
          </span>
          {includesPrivate && !loading && (
            <span className='text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded'>
              +Private
            </span>
          )}
        </div>

        {/* Year selector dropdown */}
        <div className='relative'>
          <button
            onClick={() => setShowYearPicker(!showYearPicker)}
            className='flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors'
          >
            {selectedYear}
            <ChevronDown className='w-4 h-4' />
          </button>

          {showYearPicker && (
            <>
              {/* Backdrop to close */}
              <div
                className='fixed inset-0 z-10'
                onClick={() => setShowYearPicker(false)}
              />
              <div className='absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden'>
                {availableYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => {
                      setSelectedYear(year)
                      setShowYearPicker(false)
                    }}
                    className={`block w-full px-4 py-2 text-sm text-left hover:bg-gray-700 transition-colors ${
                      year === selectedYear
                        ? 'text-teal-600 dark:text-teal-400 bg-gray-700/50'
                        : 'text-gray-300'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contribution grid */}
      <div className='overflow-x-auto pb-2'>
        <div className='min-w-[720px]'>
          {/* Month labels — centered over each month's columns */}
          <div className='flex mb-1 ml-0 relative'>
            {monthLabels.map(({ month, weekIndex, endWeekIndex }, i) => {
              const labelOffset = 28 // Align with grid (day labels col + half square)
              const startPx = weekIndex * 12 + labelOffset
              const endPx = endWeekIndex * 12 + labelOffset
              const centerPx = (startPx + endPx) / 2
              return (
                <div
                  key={`${month}-${i}`}
                  className='text-[10px] text-gray-500 absolute'
                  style={{
                    left: `${centerPx}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {month}
                </div>
              )
            })}
          </div>

          {/* Grid with day labels */}
          <div className='flex mt-4'>
            {/* Day labels (show Mon, Wed, Fri) */}
            <div className='flex flex-col gap-[2px] mr-1 mt-0'>
              {DAYS.map((day, i) => (
                <div
                  key={day}
                  className='h-[10px] text-[10px] text-gray-500 flex items-center'
                  style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Contribution squares */}
            <div className='flex gap-[2px]'>
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className='flex flex-col gap-[2px]'>
                  {week.map((day, dayIdx) => (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className={`w-[10px] h-[10px] rounded-sm ${
                        day === null
                          ? 'bg-transparent'
                          : LEVEL_COLORS[day.level]
                      } ${day ? 'hover:ring-1 hover:ring-gray-500 cursor-pointer' : ''}`}
                      title={
                        day
                          ? `${day.count} contribution${day.count !== 1 ? 's' : ''} on ${day.date}`
                          : ''
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className='flex items-center justify-end gap-2 mt-3'>
            <span className='text-[10px] text-gray-500'>Less</span>
            {LEVEL_COLORS.map((color, i) => (
              <div
                key={i}
                className={`w-[10px] h-[10px] rounded-sm ${color}`}
              />
            ))}
            <span className='text-[10px] text-gray-500'>More</span>
          </div>
        </div>
      </div>
    </div>
  )
}
