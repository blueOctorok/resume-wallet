'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  QrCode,
  Share2,
  Download,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  ExternalLink,
  Loader2,
  Shield,
} from 'lucide-react'

interface ShareSettings {
  showResume: boolean
  showDotApp?: boolean
  showMvr?: boolean
  showPortfolio?: boolean
  showGitHub?: boolean
  showContact: boolean
  allowConnect: boolean
}

interface ShareProfileCardProps {
  /** Wallet address for API auth (preferred) */
  walletAddress?: string
  /** Alias for walletAddress — used by DeveloperHub */
  userAddress?: string
  driverName?: string
  /** When 'developer', uses /api/developer/share for Career Card */
  userRole?: 'driver' | 'developer'
}

export default function ShareProfileCard({
  walletAddress,
  userAddress,
  driverName,
  userRole = 'driver',
}: ShareProfileCardProps) {
  const { theme } = useTheme()
  const address = walletAddress ?? userAddress
  const shareApiUrl =
    userRole === 'developer' ? '/api/developer/share' : '/api/driver/share'
  // Driver Career Card: /d/[token]; Developer Career Card: /dev-card/[token]
  const profileBasePath = userRole === 'developer' ? '/dev-card' : '/d'

  const [shareToken, setShareToken] = useState<string | null>(null)
  const [settings, setSettings] = useState<ShareSettings>({
    showResume: true,
    showDotApp: true,
    showMvr: true,
    showPortfolio: true,
    showGitHub: true,
    showContact: false,
    allowConnect: true,
  })
  const [viewCount, setViewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  // Fetch current share token and settings
  useEffect(() => {
    if (address) fetchShareInfo()
    else setLoading(false)
  }, [address, userRole])

  const fetchShareInfo = async () => {
    if (!address) return
    try {
      setLoading(true)
      const response = await fetch(shareApiUrl, {
        headers: { 'x-wallet-address': address },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.shareToken) {
          setShareToken(data.shareToken)
        }
        if (data.shareSettings) {
          setSettings(data.shareSettings)
        }
        setViewCount(data.shareViewsCount || 0)
      }
    } catch (err) {
      console.error('Error fetching share info:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateToken = async (regenerate = false) => {
    if (!address) return
    try {
      setGenerating(true)
      const response = await fetch(shareApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address,
        },
        body: JSON.stringify({ regenerate }),
      })

      if (response.ok) {
        const data = await response.json()
        setShareToken(data.shareToken)
        if (regenerate) {
          setViewCount(0) // Reset view count on regenerate
        }
      }
    } catch (err) {
      console.error('Error generating token:', err)
    } finally {
      setGenerating(false)
    }
  }

  const updateSettings = async (newSettings: ShareSettings) => {
    if (!address) return
    try {
      setSavingSettings(true)
      const response = await fetch(shareApiUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address,
        },
        body: JSON.stringify({ shareSettings: newSettings }),
      })

      if (response.ok) {
        setSettings(newSettings)
      }
    } catch (err) {
      console.error('Error updating settings:', err)
    } finally {
      setSavingSettings(false)
    }
  }

  const copyLink = () => {
    if (!shareToken) return
    const url = `${window.location.origin}${profileBasePath}/${shareToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    if (!shareToken) return

    // Create a canvas from the QR image
    const qrUrl = getQRUrl()
    const link = document.createElement('a')
    link.href = qrUrl
    link.download = `career-card-${driverName?.replace(/\s+/g, '-').toLowerCase() || 'driver'}.png`
    link.click()
  }

  const getQRUrl = () => {
    if (!shareToken) return ''
    const profileUrl = encodeURIComponent(
      `${window.location.origin}${profileBasePath}/${shareToken}`
    )
    // Using QR Server API (free, no key needed)
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${profileUrl}&bgcolor=1a1a2e&color=5eead4&margin=10`
  }

  const profileUrl = shareToken
    ? `${window.location.origin}${profileBasePath}/${shareToken}`
    : ''

  // Developer hub: match hub sections (gray). Driver: sage styling.
  const isHubStyle = userRole === 'developer'
  const cardBg = isHubStyle
    ? theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white/70 border-gray-200'
    : theme === 'dark'
      ? 'bg-brand-sage-dark/50 border border-brand-mint/30'
      : 'bg-white border border-brand-sage/20 shadow-xl'
  const accentClass = isHubStyle
    ? 'text-brand-mint'
    : theme === 'dark'
      ? 'text-brand-mint'
      : 'text-brand-sage'
  const accentBg = isHubStyle
    ? 'bg-brand-mint/20'
    : theme === 'dark'
      ? 'bg-brand-mint/20'
      : 'bg-brand-sage/10'
  const primaryBtn = isHubStyle
    ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
    : theme === 'dark'
      ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
      : 'bg-brand-sage text-white hover:bg-brand-sage/90'

  if (loading) {
    return (
      <div className={`rounded-2xl p-6 ${cardBg}`}>
        <div className='flex items-center justify-center py-8'>
          <Loader2 className={`w-8 h-8 animate-spin ${accentClass}`} />
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
      {/* Header */}
      <div
        className={`p-4 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <QrCode className={`w-5 h-5 ${accentClass}`} />
            <h3
              className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Career Card
            </h3>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <Settings
              className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            />
          </button>
        </div>
        <p
          className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Share your verified credentials with employers
        </p>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          className={`p-4 border-b ${
            theme === 'dark'
              ? 'border-gray-700 bg-gray-800/50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <h4
            className={`text-sm font-medium mb-3 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Privacy Settings
          </h4>
          <div className='space-y-2'>
            <SettingToggle
              label='Show Resume'
              enabled={settings.showResume}
              onChange={(v) => updateSettings({ ...settings, showResume: v })}
              theme={theme}
            />
            <SettingToggle
              label='Show DOT Application'
              enabled={settings.showDotApp}
              onChange={(v) => updateSettings({ ...settings, showDotApp: v })}
              theme={theme}
            />
            <SettingToggle
              label='Show MVR Record'
              enabled={settings.showMvr}
              onChange={(v) => updateSettings({ ...settings, showMvr: v })}
              theme={theme}
            />
            <SettingToggle
              label='Show Contact Info'
              enabled={settings.showContact}
              onChange={(v) => updateSettings({ ...settings, showContact: v })}
              theme={theme}
            />
            <SettingToggle
              label='Allow Employers to Connect'
              enabled={settings.allowConnect}
              onChange={(v) => updateSettings({ ...settings, allowConnect: v })}
              theme={theme}
            />
          </div>
          {savingSettings && (
            <p className={`text-xs mt-2 ${accentClass}`}>Saving...</p>
          )}
        </div>
      )}

      {/* QR Code Section */}
      <div className='p-6'>
        {!shareToken ? (
          // Generate Token CTA
          <div className='text-center py-4'>
            <div
              className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${accentBg}`}
            >
              <QrCode className={`w-8 h-8 ${accentClass}`} />
            </div>
            <h4
              className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Create Your Career Card
            </h4>
            <p
              className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Generate a QR code to share your verified credentials at job fairs
              and meetups
            </p>
            <button
              onClick={() => generateToken(false)}
              disabled={generating}
              className={`px-6 py-3 rounded-xl font-semibold ${primaryBtn} disabled:opacity-50`}
            >
              {generating ? (
                <Loader2 className='w-5 h-5 animate-spin mx-auto' />
              ) : (
                'Generate QR Code'
              )}
            </button>
          </div>
        ) : (
          // QR Code Display
          <div className='text-center'>
            {/* QR Code */}
            <div
              ref={qrRef}
              className={`inline-block p-4 rounded-2xl mb-4 ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
              }`}
            >
              <img
                src={getQRUrl()}
                alt='Career Card QR Code'
                className='w-48 h-48 mx-auto'
              />
              {driverName && (
                <p
                  className={`mt-2 font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {driverName}
                </p>
              )}
              <p
                className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
              >
                Scan to view verified profile
              </p>
            </div>

            {/* Stats */}
            <div className='flex justify-center gap-4 mb-4'>
              <div
                className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
              >
                <p className='text-2xl font-bold'>{viewCount}</p>
                <p className='text-xs'>Profile Views</p>
              </div>
            </div>

            {/* URL Display */}
            <div
              className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              }`}
            >
              <input
                type='text'
                value={profileUrl}
                readOnly
                className={`flex-1 bg-transparent text-sm truncate ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              />
              <button
                onClick={copyLink}
                className={`p-2 rounded-lg transition-colors ${
                  copied
                    ? 'bg-green-500/20 text-green-500'
                    : theme === 'dark'
                      ? 'hover:bg-gray-700 text-gray-400'
                      : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                {copied ? (
                  <Check className='w-4 h-4' />
                ) : (
                  <Copy className='w-4 h-4' />
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className='grid grid-cols-3 gap-2'>
              <button
                onClick={downloadQR}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Download className='w-5 h-5' />
                <span className='text-xs'>Download</span>
              </button>
              <a
                href={profileUrl}
                target='_blank'
                rel='noopener noreferrer'
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <ExternalLink className='w-5 h-5' />
                <span className='text-xs'>Preview</span>
              </a>
              <button
                onClick={() => generateToken(true)}
                disabled={generating}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                } disabled:opacity-50`}
              >
                {generating ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <RefreshCw className='w-5 h-5' />
                )}
                <span className='text-xs'>Regenerate</span>
              </button>
            </div>

            {/* Tip */}
            <p
              className={`text-xs mt-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
            >
              💡 Tip: Show this QR at job fairs for instant credential sharing
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Setting Toggle Component
function SettingToggle({
  label,
  enabled,
  onChange,
  theme,
}: {
  label: string
  enabled: boolean
  onChange: (value: boolean) => void
  theme: string
}) {
  return (
    <label className='flex items-center justify-between cursor-pointer'>
      <span
        className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
      >
        {label}
      </span>
      <button
        type='button'
        onClick={() => onChange(!enabled)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          enabled
            ? theme === 'dark'
              ? 'bg-brand-mint'
              : 'bg-brand-mint'
            : theme === 'dark'
              ? 'bg-gray-600'
              : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </label>
  )
}
