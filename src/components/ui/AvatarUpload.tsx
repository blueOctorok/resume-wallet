'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import Avatar, { type AvatarSize, type AvatarColor } from './Avatar'

interface AvatarUploadProps {
  name: string
  avatarUrl?: string | null
  size?: AvatarSize
  color?: AvatarColor
  /** API endpoint that accepts multipart/form-data with a 'file' field */
  uploadEndpoint: string
  walletAddress: string
  onSuccess?: (newUrl: string) => void
  className?: string
  /**
   * When true, show a small camera badge on the corner at all times (not only on hover).
   * Use on hub hero avatars so new users see they can add a photo.
   */
  persistentUploadHint?: boolean
  /** Match `Avatar` — circular frame (career card ring). */
  round?: boolean
  /** Native tooltip on the click target (accessibility hint). */
  title?: string
}

/**
 * AvatarUpload
 *
 * Wraps the Avatar primitive with click-to-upload behaviour.
 * - Click → opens native file picker (jpg/png/webp, max 5 MB)
 * - Shows a spinner overlay while uploading
 * - Calls onSuccess(newUrl) when the server responds with the new URL
 * - Renders as a plain Avatar when not in an upload context
 */
export default function AvatarUpload({
  name,
  avatarUrl,
  size = 'lg',
  color = 'teal',
  uploadEndpoint,
  walletAddress,
  onSuccess,
  className = '',
  persistentUploadHint = false,
  round = false,
  title,
}: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localUrl, setLocalUrl] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Optimistic preview so the UI feels instant
    const previewUrl = URL.createObjectURL(file)
    setLocalUrl(previewUrl)

    try {
      setUploading(true)
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(uploadEndpoint, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      onSuccess?.(data.avatarUrl)
    } catch {
      // Revert optimistic preview on failure
      setLocalUrl(null)
    } finally {
      setUploading(false)
      // Reset so the same file can be re-selected if needed
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const shape = round ? 'rounded-full' : 'rounded-2xl'

  return (
    <div
      className={`relative cursor-pointer group ${round ? 'rounded-full' : ''} ${className}`}
      title={title}
      onClick={() => fileRef.current?.click()}
    >
      <Avatar name={name} avatarUrl={localUrl ?? avatarUrl} size={size} color={color} round={round} />

      {persistentUploadHint && !uploading ? (
        <span
          className='pointer-events-none absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-teal-500 text-white shadow-md dark:border-gray-950'
          aria-hidden
        >
          <Camera className='h-4 w-4' />
        </span>
      ) : null}

      {/* Camera overlay — visible on hover or while uploading */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } bg-black/50 ${shape}`}
      >
        {uploading
          ? <Loader2 className="w-5 h-5 text-white animate-spin" />
          : <Camera className="w-5 h-5 text-white" />
        }
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
