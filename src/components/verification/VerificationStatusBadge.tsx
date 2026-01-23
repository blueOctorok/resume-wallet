'use client'

import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Ban,
  Send,
} from 'lucide-react'
import { 
  VerificationStatus, 
  VERIFICATION_STATUS_LABELS,
} from '@/types/employment-verification'

interface VerificationStatusBadgeProps {
  status: VerificationStatus
  attemptCount?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  theme?: 'light' | 'dark'
}

const STATUS_CONFIG: Record<VerificationStatus, {
  icon: typeof CheckCircle
  bgLight: string
  bgDark: string
  textLight: string
  textDark: string
  borderLight: string
  borderDark: string
}> = {
  SELF_REPORTED: {
    icon: FileText,
    bgLight: 'bg-gray-100',
    bgDark: 'bg-gray-800',
    textLight: 'text-gray-600',
    textDark: 'text-gray-400',
    borderLight: 'border-gray-300',
    borderDark: 'border-gray-600',
  },
  VERIFICATION_REQUESTED: {
    icon: Send,
    bgLight: 'bg-yellow-100',
    bgDark: 'bg-yellow-900/30',
    textLight: 'text-yellow-700',
    textDark: 'text-yellow-400',
    borderLight: 'border-yellow-300',
    borderDark: 'border-yellow-600',
  },
  VERIFICATION_IN_PROGRESS: {
    icon: Clock,
    bgLight: 'bg-blue-100',
    bgDark: 'bg-blue-900/30',
    textLight: 'text-blue-700',
    textDark: 'text-blue-400',
    borderLight: 'border-blue-300',
    borderDark: 'border-blue-600',
  },
  VERIFIED: {
    icon: CheckCircle,
    bgLight: 'bg-green-100',
    bgDark: 'bg-green-900/30',
    textLight: 'text-green-700',
    textDark: 'text-green-400',
    borderLight: 'border-green-300',
    borderDark: 'border-green-600',
  },
  PARTIALLY_VERIFIED: {
    icon: AlertTriangle,
    bgLight: 'bg-orange-100',
    bgDark: 'bg-orange-900/30',
    textLight: 'text-orange-700',
    textDark: 'text-orange-400',
    borderLight: 'border-orange-300',
    borderDark: 'border-orange-600',
  },
  VERIFICATION_DENIED: {
    icon: XCircle,
    bgLight: 'bg-red-100',
    bgDark: 'bg-red-900/30',
    textLight: 'text-red-700',
    textDark: 'text-red-400',
    borderLight: 'border-red-300',
    borderDark: 'border-red-600',
  },
  ATTEMPTS_EXHAUSTED: {
    icon: AlertTriangle,
    bgLight: 'bg-orange-100',
    bgDark: 'bg-orange-900/30',
    textLight: 'text-orange-700',
    textDark: 'text-orange-400',
    borderLight: 'border-orange-300',
    borderDark: 'border-orange-600',
  },
  VERIFICATION_DECLINED: {
    icon: Ban,
    bgLight: 'bg-gray-100',
    bgDark: 'bg-gray-800',
    textLight: 'text-gray-600',
    textDark: 'text-gray-400',
    borderLight: 'border-gray-300',
    borderDark: 'border-gray-600',
  },
}

const SIZE_CONFIG = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    icon: 'w-3 h-3',
    gap: 'gap-1',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    icon: 'w-4 h-4',
    gap: 'gap-1.5',
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    icon: 'w-5 h-5',
    gap: 'gap-2',
  },
}

export default function VerificationStatusBadge({
  status,
  attemptCount,
  size = 'md',
  showLabel = true,
  theme = 'dark',
}: VerificationStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = config.icon

  const isDark = theme === 'dark'
  const bg = isDark ? config.bgDark : config.bgLight
  const text = isDark ? config.textDark : config.textLight
  const border = isDark ? config.borderDark : config.borderLight

  // Build label with attempt count for in-progress statuses
  let label = VERIFICATION_STATUS_LABELS[status]
  if (attemptCount !== undefined && ['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(status)) {
    label = `${label} (${attemptCount}/3)`
  }

  return (
    <span
      className={`
        inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding}
        ${bg} ${text} border ${border}
        rounded-full font-medium ${sizeConfig.text}
      `}
    >
      <Icon className={sizeConfig.icon} />
      {showLabel && <span>{label}</span>}
    </span>
  )
}
