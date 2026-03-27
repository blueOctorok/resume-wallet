'use client'

import Image from 'next/image'

// Size → pixel dimensions and font size
const SIZE_MAP = {
  xs:  { px: 24,  text: 'text-xs',   ring: 'rounded-lg' },
  sm:  { px: 32,  text: 'text-sm',   ring: 'rounded-lg' },
  md:  { px: 40,  text: 'text-base', ring: 'rounded-xl' },
  lg:  { px: 56,  text: 'text-xl',   ring: 'rounded-2xl' },
  xl:  { px: 64,  text: 'text-2xl',  ring: 'rounded-2xl' },
  /** Hero / career card — larger disk */
  '2xl': { px: 88, text: 'text-3xl', ring: 'rounded-2xl' },
} as const

// Accent color token → Tailwind classes (bg + text)
const COLOR_MAP = {
  teal:   { bg: 'bg-teal-500/20',   text: 'text-teal-400',   border: 'border-teal-500/30'   },
  indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  amber:  { bg: 'bg-amber-500/20',  text: 'text-amber-400',  border: 'border-amber-500/30'  },
  gray:   { bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/30'   },
} as const

export type AvatarSize  = keyof typeof SIZE_MAP
export type AvatarColor = keyof typeof COLOR_MAP

export interface AvatarProps {
  /** Display name — used to derive the initials fallback */
  name: string
  /** Public URL from Supabase Storage. If present the photo is shown. */
  avatarUrl?: string | null
  size?:    AvatarSize
  color?:   AvatarColor
  /** Extra Tailwind classes applied to the outer wrapper */
  className?: string
  /**
   * True circle — use inside circular frames (e.g. career card gradient ring).
   * Default keeps rounded-lg/xl/2xl per size so avatars match cards elsewhere.
   */
  round?: boolean
}

/**
 * Avatar
 *
 * Single source of truth for user profile images.
 * Shows a photo when `avatarUrl` is provided; otherwise falls back to
 * the first initial of `name` on a tinted background.
 *
 * Used everywhere a user's face/identity appears — hubs, career cards,
 * kanban cards, applicant lists.
 */
export default function Avatar({
  name,
  avatarUrl,
  size    = 'md',
  color   = 'teal',
  className = '',
  round = false,
}: AvatarProps) {
  const { px, text, ring } = SIZE_MAP[size]
  const { bg, text: textColor, border } = COLOR_MAP[color]

  const initial = (name || '?').charAt(0).toUpperCase()

  const shapeClass = round ? 'rounded-full' : ring
  const base = `flex-shrink-0 flex items-center justify-center overflow-hidden border ${shapeClass} ${border}`
  const style = { width: px, height: px }

  if (avatarUrl) {
    return (
      <div className={`${base} ${className}`} style={style}>
        <Image
          src={avatarUrl}
          alt={name}
          width={px}
          height={px}
          className="w-full h-full object-cover"
          // Unoptimized so Supabase Storage public URLs work without domain config
          unoptimized
        />
      </div>
    )
  }

  return (
    <div
      className={`${base} ${bg} ${className}`}
      style={style}
    >
      <span className={`font-bold select-none ${text} ${textColor}`}>
        {initial}
      </span>
    </div>
  )
}
