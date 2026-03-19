'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import BackToHubButton from '@/components/ui/BackToHubButton'
import { Github, Check, RefreshCw } from 'lucide-react'

interface GitHubPageProps {
  userAddress: string
  onBack: () => void
}

export default function GitHubPage({ userAddress, onBack }: GitHubPageProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [githubConnected, setGithubConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!userAddress) return
    try {
      const res = await fetch('/api/developer/profile', {
        headers: { 'x-wallet-address': userAddress },
      })
      if (!res.ok) return
      const data = await res.json()
      const p = data.profile
      if (p) {
        setGithubUsername(p.githubUsername ?? null)
        setGithubConnected(!!p.githubUsername)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userAddress])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchProfile()
  }

  const handleConnect = () => {
    if (userAddress) {
      window.location.href = `/api/github/oauth?wallet=${encodeURIComponent(userAddress)}`
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackToHubButton onClick={onBack} className="mb-4" />
        <div className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading…</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <BackToHubButton onClick={onBack} className="mb-4" />
      <div className="mb-6">
        <h1 className={isDark ? 'text-2xl font-bold text-white' : 'text-2xl font-bold text-gray-900'}>
          GitHub Activity
        </h1>
        <p className={isDark ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>
          Connect GitHub to show contributions and repo stats on your career card (public and private)
        </p>
      </div>

      <div
        className={
          isDark
            ? 'rounded-2xl border border-white/10 bg-white/5 p-6'
            : 'rounded-2xl border border-gray-200 bg-gray-50 p-6'
        }
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Github className={isDark ? 'w-5 h-5 text-gray-300' : 'w-5 h-5 text-gray-600'} />
            <h2 className={isDark ? 'text-lg font-semibold text-white' : 'text-lg font-semibold text-gray-900'}>
              GitHub
            </h2>
          </div>
          {githubConnected && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh status"
                className={
                  isDark
                    ? 'p-2 rounded-lg hover:bg-white/10 text-gray-400 disabled:opacity-50'
                    : 'p-2 rounded-lg hover:bg-gray-200 text-gray-500 disabled:opacity-50'
                }
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                <Check className="w-3 h-3" />
                Connected
              </span>
            </div>
          )}
        </div>

        {githubConnected ? (
          <div className="space-y-3">
            <div
              className={
                isDark
                  ? 'flex items-center gap-3 p-3 rounded-lg bg-white/5'
                  : 'flex items-center gap-3 p-3 rounded-lg bg-white'
              }
            >
              <Github className={isDark ? 'w-8 h-8 text-white' : 'w-8 h-8 text-gray-900'} />
              <div>
                <p className={isDark ? 'font-medium text-white' : 'font-medium text-gray-900'}>
                  @{githubUsername ?? 'GitHub'}
                </p>
                <p className={isDark ? 'text-xs text-gray-400' : 'text-xs text-gray-500'}>
                  Private repos included on Career Card
                </p>
              </div>
            </div>
            <p className={isDark ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>
              Your GitHub is connected. Your Career Card shows contribution data and repo stats (including private repos when you granted access).
            </p>
          </div>
        ) : (
          <div className="text-center py-6">
            <div
              className={
                isDark
                  ? 'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/10'
                  : 'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gray-200'
              }
            >
              <Github className="w-8 h-8 text-white" />
            </div>
            <h3 className={isDark ? 'font-semibold mb-2 text-white' : 'font-semibold mb-2 text-gray-900'}>
              Connect GitHub
            </h3>
            <p
              className={
                isDark
                  ? 'text-sm mb-4 max-w-xs mx-auto text-gray-400'
                  : 'text-sm mb-4 max-w-xs mx-auto text-gray-600'
              }
            >
              Link your GitHub to show contributions, repo stats, and give employers the full picture. We use a token to read public and private repos for display only.
            </p>
            <button
              onClick={handleConnect}
              disabled={!userAddress}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              <Github className="w-5 h-5" />
              Connect GitHub
            </button>
            <p className={isDark ? 'text-xs mt-3 text-gray-500' : 'text-xs mt-3 text-gray-400'}>
              We only read repo data — we never modify anything
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
