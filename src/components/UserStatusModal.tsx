'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import Modal from '@/components/ui/Modal'
import { useTheme } from '@/contexts/ThemeContext'
import type { UserRole } from '@/stores/types'
import { User, X } from 'lucide-react'

interface UserStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onLogout: () => void
  user: {
    email?: string
    address?: string
    chain?: string
  }
  userRole?: UserRole
}

const ROLE_LABEL: Record<string, string> = {
  driver: '🚗 Driver',
  developer: '💻 Developer',
  candidate: '🧩 Candidate',
  employer: '🏢 Employer',
}

/**
 * Account modal. Personal crypto-wallet UI (balances / send / receive /
 * history) was removed at the T1.12 cutover — auth is Supabase-only and there
 * is no signer to act on. This now surfaces plain account info + sign out.
 */
export default function UserStatusModal({
  isOpen,
  onClose,
  onLogout,
  user,
  userRole,
}: UserStatusModalProps) {
  const { theme } = useTheme()

  if (!isOpen) return null

  const dark = isDarkTheme(theme)

  const handleLogout = () => {
    onLogout()
    onClose()
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md" zIndex={100}>
      <div className={`flex flex-col ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 sm:p-5 border-b ${
            dark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className='flex items-center gap-3'>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                dark ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'
              }`}
            >
              <User className={`w-5 h-5 ${dark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <h2 className={`text-lg font-semibold ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
              Account
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              dark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
            }`}
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Content */}
        <div className='p-4 sm:p-5 space-y-4'>
          <div
            className={`rounded-2xl border p-4 flex items-center gap-3 ${
              dark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/70 border-gray-200'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                dark ? 'bg-indigo-500/20' : 'bg-indigo-50'
              }`}
            >
              <User className={`w-6 h-6 ${dark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <div className='flex-1 min-w-0'>
              {user.email ? (
                <p className={`text-sm truncate ${dark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {user.email}
                </p>
              ) : (
                <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Signed in</p>
              )}
              {userRole && (
                <p className={`text-xs ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {ROLE_LABEL[userRole] ?? userRole}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className={`w-full px-4 py-3 font-semibold rounded-xl transition-all duration-200 ${
              dark ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Sign Out
          </button>
        </div>
      </div>
    </Modal>
  )
}
