'use client'

import { useTheme } from '@/contexts/ThemeContext'

interface ProfileConflictData {
  conflicts: string[]
  existing: {
    name: string
    cdlNumber?: string
    email?: string
    lastUpdatedFrom?: string
  }
  incoming: {
    name: string
    cdlNumber?: string
    email?: string
    source?: string
  }
  profileData: any
}

interface ProfileConflictModalProps {
  isOpen: boolean
  conflict: ProfileConflictData | null
  userAddress: string | null
  onKeepExisting: () => void
  onReplaceWithNew: () => void
}

export default function ProfileConflictModal({
  isOpen,
  conflict,
  userAddress,
  onKeepExisting,
  onReplaceWithNew,
}: ProfileConflictModalProps) {
  const { theme } = useTheme()

  if (!isOpen || !conflict) return null

  const handleReplace = async () => {
    if (!userAddress || !conflict) return

    try {
      const response = await fetch('/api/driver/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': userAddress,
        },
        body: JSON.stringify({
          profileData: conflict.profileData,
          source: 'uploaded_resume',
          force: true,
        }),
      })

      if (response.ok) {
        console.log('✅ [PROFILE] Profile replaced with new resume data')
        onReplaceWithNew()
      } else {
        const error = await response.json().catch(() => ({}))
        alert(`Failed to update profile: ${error.error || 'Unknown error'}`)
      }
    } catch (err) {
      console.error('Failed to replace profile:', err)
      alert('Failed to update profile. Please try again.')
    }
  }

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <div
        className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
      >
        <h3
          className={`text-xl font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Profile Conflict Detected
        </h3>

        <p
          className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
          }`}
        >
          This resume appears to be for a different person than your existing
          profile:
        </p>

        {/* Conflicts List */}
        <div
          className={`mb-4 p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-gray-700/50 border-gray-600'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          {conflict.conflicts.map((conflictText, idx) => (
            <div
              key={idx}
              className={`text-sm mb-2 ${
                theme === 'dark' ? 'text-amber-300' : 'text-amber-700'
              }`}
            >
              ⚠️ {conflictText}
            </div>
          ))}
        </div>

        {/* Comparison Grid */}
        <div className='grid grid-cols-2 gap-3 mb-4'>
          {/* Existing Profile */}
          <div
            className={`p-3 rounded-lg border ${
              theme === 'dark'
                ? 'bg-gray-700/50 border-gray-600'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div
              className={`text-xs font-semibold mb-1 ${
                theme === 'dark' ? 'text-brand-cream/50' : 'text-gray-500'
              }`}
            >
              EXISTING PROFILE
            </div>
            <div
              className={`text-sm ${
                theme === 'dark' ? 'text-brand-cream' : 'text-gray-800'
              }`}
            >
              {conflict.existing.name || 'No name'}
            </div>
            {conflict.existing.cdlNumber && (
              <div
                className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-600'
                }`}
              >
                CDL: {conflict.existing.cdlNumber}
              </div>
            )}
            {conflict.existing.lastUpdatedFrom && (
              <div
                className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-brand-cream/50' : 'text-gray-500'
                }`}
              >
                From: {conflict.existing.lastUpdatedFrom}
              </div>
            )}
          </div>

          {/* New Resume */}
          <div
            className={`p-3 rounded-lg border ${
              theme === 'dark'
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div
              className={`text-xs font-semibold mb-1 ${
                theme === 'dark' ? 'text-amber-300/70' : 'text-amber-700'
              }`}
            >
              NEW RESUME
            </div>
            <div
              className={`text-sm ${
                theme === 'dark' ? 'text-amber-300' : 'text-amber-800'
              }`}
            >
              {conflict.incoming.name || 'No name'}
            </div>
            {conflict.incoming.cdlNumber && (
              <div
                className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-amber-300/70' : 'text-amber-700'
                }`}
              >
                CDL: {conflict.incoming.cdlNumber}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex gap-3'>
          <button
            onClick={onKeepExisting}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              theme === 'dark'
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Keep Existing Profile
          </button>
          <button
            onClick={handleReplace}
            className='flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-all'
          >
            Replace with New Resume
          </button>
        </div>
      </div>
    </div>
  )
}
