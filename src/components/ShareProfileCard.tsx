'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  QrCode,
  Settings,
  ExternalLink,
  Loader2,
  Eye,
  FileText,
  ClipboardCheck,
  Car,
  FileWarning,
} from 'lucide-react'
import Avatar from './ui/Avatar'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'

interface ShareSettings {
  showResume: boolean
  showDotApp?: boolean
  showMvr?: boolean
  showPortfolio?: boolean
  showGitHub?: boolean
  showContact: boolean
  allowConnect: boolean
}

interface CareerPreview {
  name: string
  role: string
  avatarUrl: string | null
  hasResume: boolean
  hasDriverApp: boolean
  hasMvr: boolean
  hasPsp: boolean
  completenessScore: number
}

interface ShareProfileCardProps {
  walletAddress?: string
  userAddress?: string
  driverName?: string
  userRole?: 'driver' | 'developer' | 'candidate'
  onViewCareerCard?: () => void
}

export default function ShareProfileCard({
  walletAddress,
  userAddress,
  driverName,
  userRole = 'candidate',
  onViewCareerCard,
}: ShareProfileCardProps) {
  const { theme } = useTheme()
  const address = walletAddress ?? userAddress
  const shareApiUrl = '/api/career-card/share'
  const careerCardApiUrl = '/api/career-card'

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
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  // Career card preview data (drivers only)
  const [preview, setPreview] = useState<CareerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (address) {
      fetchShareInfo()
      if (careerCardApiUrl) fetchPreview()
    } else {
      setLoading(false)
    }
  }, [address, userRole])

  const fetchShareInfo = async () => {
    if (!address) return
    try {
      setLoading(true)
      const res = await fetch(shareApiUrl)
      if (res.ok) {
        const data = await res.json()
        if (data.shareSettings) setSettings(data.shareSettings)
        setViewCount(data.shareViewsCount || 0)
      }
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }

  const fetchPreview = async () => {
    if (!address || !careerCardApiUrl) return
    try {
      setPreviewLoading(true)
      const res = await fetch(careerCardApiUrl)
      if (res.ok) {
        const json = await res.json()
        const cc = json.card
        if (cc) {
          const sectionTypes = new Set((cc.sections ?? []).map((s: { blockType: string }) => s.blockType))
          setPreview({
            name: cc.name || driverName || 'Unknown',
            role: cc.occupation || 'Candidate',
            avatarUrl: cc.avatarUrl ?? null,
            hasResume:
              sectionTypes.has('storm-resume') ||
              sectionTypes.has('driver-resume') ||
              sectionTypes.has('developer-resume') ||
              sectionTypes.has('general-resume'),
            hasDriverApp: sectionTypes.has('driver-dot-application'),
            hasMvr: sectionTypes.has('driver-mvr'),
            hasPsp: sectionTypes.has('driver-psp'),
            completenessScore: cc.sections?.length ?? 0,
          })
        }
      }
    } catch { /* non-critical */ }
    finally { setPreviewLoading(false) }
  }

  const updateSettings = async (newSettings: ShareSettings) => {
    if (!address) return
    try {
      setSavingSettings(true)
      const res = await fetch(shareApiUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ shareSettings: newSettings }),
      })
      if (res.ok) setSettings(newSettings)
    } catch { /* non-critical */ }
    finally { setSavingSettings(false) }
  }

  const isDark = isDarkTheme(theme)
  const cardBg = isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/70 border border-gray-200'
  const accentClass = isDark ? 'text-teal-400' : 'text-teal-600'
  const accentBg = isDark ? 'bg-teal-500/20' : 'bg-teal-50'

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
    <>
      <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
        {/* Header */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Eye className={`w-5 h-5 ${accentClass}`} />
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Career Card
              </h3>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Privacy settings"
              className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <Settings className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
            </button>
          </div>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Your verified credentials visible to employers
          </p>
        </div>

        {/* Privacy Settings Panel */}
        {showSettings && (
          <div className={`p-4 border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Privacy Settings
            </h4>
            <div className='space-y-2'>
              <SettingToggle label='Show Resume' enabled={settings.showResume}
                onChange={v => updateSettings({ ...settings, showResume: v })} theme={theme} />
              {userRole === 'driver' && (
                <SettingToggle label='Show DOT Application' enabled={settings.showDotApp ?? true}
                  onChange={v => updateSettings({ ...settings, showDotApp: v })} theme={theme} />
              )}
              {userRole === 'driver' && (
                <SettingToggle label='Show MVR Record' enabled={settings.showMvr ?? true}
                  onChange={v => updateSettings({ ...settings, showMvr: v })} theme={theme} />
              )}
              <SettingToggle label='Show Contact Info' enabled={settings.showContact}
                onChange={v => updateSettings({ ...settings, showContact: v })} theme={theme} />
              <SettingToggle label='Allow Employers to Connect' enabled={settings.allowConnect}
                onChange={v => updateSettings({ ...settings, allowConnect: v })} theme={theme} />
            </div>
            {savingSettings && <p className={`text-xs mt-2 ${accentClass}`}>Saving...</p>}
          </div>
        )}

        {/* Career Card Preview */}
        <div className='p-5'>
          {previewLoading ? (
            <div className='flex items-center justify-center py-6'>
              <Loader2 className={`w-6 h-6 animate-spin ${accentClass}`} />
            </div>
          ) : preview ? (
            <div className={`rounded-xl p-4 mb-4 ${isDark ? 'bg-gray-900/60' : 'bg-gray-50'}`}>
              {/* Identity row */}
              <div className='flex items-center gap-3 mb-4'>
                <Avatar
                  name={preview.name}
                  avatarUrl={preview.avatarUrl}
                  size="md"
                  color={userRole === 'developer' ? 'indigo' : 'teal'}
                />
                <div className='min-w-0'>
                  <p className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {preview.name}
                  </p>
                  <p className={`text-xs capitalize ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {preview.role}
                  </p>
                </div>
                {/* Completeness ring */}
                <div className='ml-auto flex flex-col items-center'>
                  <span className={`text-lg font-bold ${
                    preview.completenessScore >= 80 ? 'text-green-500'
                    : preview.completenessScore >= 50 ? 'text-yellow-500'
                    : 'text-gray-400'
                  }`}>
                    {preview.completenessScore}%
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>complete</span>
                </div>
              </div>

              {/* Credential status chips */}
              <div className='flex flex-wrap gap-2'>
                <CredentialChip
                  icon={<FileText className='w-3 h-3' />}
                  label='Resume'
                  done={preview.hasResume}
                  isDark={isDark}
                />
                <CredentialChip
                  icon={<ClipboardCheck className='w-3 h-3' />}
                  label='DOT App'
                  done={preview.hasDriverApp}
                  isDark={isDark}
                />
                <CredentialChip
                  icon={<Car className='w-3 h-3' />}
                  label='MVR'
                  done={preview.hasMvr}
                  isDark={isDark}
                />
                <CredentialChip
                  icon={<FileWarning className='w-3 h-3' />}
                  label='PSP'
                  done={preview.hasPsp}
                  isDark={isDark}
                />
              </div>

              {/* Profile views */}
              {viewCount > 0 && (
                <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {viewCount} employer {viewCount === 1 ? 'view' : 'views'}
                </p>
              )}
            </div>
          ) : (
            // No career card yet — prompt to set up
            <div className={`rounded-xl p-4 mb-4 text-center ${isDark ? 'bg-gray-900/60' : 'bg-gray-50'}`}>
              <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${accentBg}`}>
                <Eye className={`w-6 h-6 ${accentClass}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Your career card is empty
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Add a resume, DOT app, or MVR to build your profile
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className='flex gap-2'>
            <button
              onClick={onViewCareerCard}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              }`}
            >
              <Eye className='w-4 h-4' />
              View Career Card
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              title='Share link and QR code'
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <QrCode className='w-4 h-4' />
              Share QR
            </button>
          </div>
        </div>
      </div>

      <CareerCardShareModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        walletAddress={address ?? null}
        displayName={preview?.name || driverName}
        onShareUpdated={() => void fetchShareInfo()}
      />
    </>
  )
}

// ── CredentialChip ─────────────────────────────────────────────────────────────

function CredentialChip({
  icon,
  label,
  done,
  isDark,
}: {
  icon: React.ReactNode
  label: string
  done: boolean
  isDark: boolean
}) {
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
      done
        ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
        : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
    }`}>
      {icon}
      {label}
      {done ? ' ✓' : ''}
    </span>
  )
}

// ── SettingToggle ──────────────────────────────────────────────────────────────

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
      <span className={`text-sm ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
        {label}
      </span>
      <button
        type='button'
        onClick={() => onChange(!enabled)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          enabled
            ? 'bg-teal-600'
            : isDarkTheme(theme) ? 'bg-gray-600' : 'bg-gray-300'
        }`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-4' : ''
        }`} />
      </button>
    </label>
  )
}
