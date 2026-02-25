'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Wallet, Pencil, Check, X, Loader2, Copy } from 'lucide-react'

type AvatarColor = 'purple' | 'blue' | 'teal' | 'green' | 'amber' | 'rose' | 'gray'

interface UserIdentityProps {
  name?: string | null
  walletAddress?: string | null
  email?: string | null
  avatarColor?: AvatarColor
  size?: 'sm' | 'md' | 'lg'
  showWallet?: boolean
  showEmail?: boolean
  editable?: boolean
  onNameChange?: (newName: string) => Promise<void>
  copyWalletOnClick?: boolean
  className?: string
}

const avatarColors: Record<AvatarColor, { bg: string; text: string }> = {
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  teal: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  rose: { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  gray: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
}

const sizeConfig = {
  sm: { avatar: 'w-8 h-8 text-sm', name: 'text-sm', meta: 'text-xs', icon: 'w-3 h-3' },
  md: { avatar: 'w-10 h-10 text-base', name: 'text-base', meta: 'text-sm', icon: 'w-3.5 h-3.5' },
  lg: { avatar: 'w-12 h-12 text-lg', name: 'text-lg', meta: 'text-sm', icon: 'w-4 h-4' },
}

export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

export default function UserIdentity({
  name,
  walletAddress,
  email,
  avatarColor = 'teal',
  size = 'md',
  showWallet = true,
  showEmail = false,
  editable = false,
  onNameChange,
  copyWalletOnClick = false,
  className = '',
}: UserIdentityProps) {
  const { theme } = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const colors = avatarColors[avatarColor]
  const sizes = sizeConfig[size]
  const displayName = name || 'No name set'
  const initial = (name || email || walletAddress || '?').charAt(0).toUpperCase()

  const startEdit = () => {
    setEditValue(name || '')
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditValue('')
  }

  const saveEdit = async () => {
    if (!onNameChange || !editValue.trim()) {
      cancelEdit()
      return
    }

    setIsSaving(true)
    try {
      await onNameChange(editValue.trim())
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save name:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const copyWallet = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Avatar */}
      <div className={`${sizes.avatar} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${colors.bg} ${colors.text}`}>
        {initial}
      </div>

      {/* Info */}
      <div className='flex-1 min-w-0'>
        {/* Name row */}
        <div className='flex items-center gap-2'>
          {isEditing ? (
            <div className='flex items-center gap-1.5'>
              <input
                type='text'
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className={`px-2 py-0.5 rounded border ${sizes.name} font-medium ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
              />
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className='p-1 rounded text-green-500 hover:bg-green-500/20 transition-colors'
                title='Save'
              >
                {isSaving ? <Loader2 className={`${sizes.icon} animate-spin`} /> : <Check className={sizes.icon} />}
              </button>
              <button
                onClick={cancelEdit}
                className={`p-1 rounded transition-colors ${
                  theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
                title='Cancel'
              >
                <X className={sizes.icon} />
              </button>
            </div>
          ) : (
            <>
              <span className={`font-semibold truncate ${sizes.name} ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              } ${!name ? 'opacity-50 italic' : ''}`}>
                {displayName}
              </span>
              {editable && onNameChange && (
                <button
                  onClick={startEdit}
                  className={`p-1 rounded opacity-50 hover:opacity-100 transition-opacity flex-shrink-0 ${
                    theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title='Edit name'
                >
                  <Pencil className={sizes.icon} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Email row */}
        {showEmail && email && (
          <p className={`${sizes.meta} truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {email}
          </p>
        )}

        {/* Wallet row */}
        {showWallet && walletAddress && (
          <div
            className={`flex items-center gap-1.5 ${sizes.meta} ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            } ${copyWalletOnClick ? 'cursor-pointer hover:text-gray-400' : ''}`}
            onClick={copyWalletOnClick ? copyWallet : undefined}
            title={copyWalletOnClick ? (copied ? 'Copied!' : 'Click to copy') : walletAddress}
          >
            {copied ? (
              <Check className={sizes.icon} />
            ) : (
              copyWalletOnClick ? <Copy className={sizes.icon} /> : <Wallet className={sizes.icon} />
            )}
            <code className='font-mono'>{truncateAddress(walletAddress)}</code>
          </div>
        )}
      </div>
    </div>
  )
}
