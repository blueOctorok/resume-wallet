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
        headers: { 'x-wallet-address': walletAddress },
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

  return (
    <div className={`relative group cursor-pointer ${className}`} onClick={() => fileRef.current?.click()}>
      <Avatar
        name={name}
        avatarUrl={localUrl ?? avatarUrl}
        size={size}
        color={color}
      />

      {/* Camera overlay — visible on hover or while uploading */}
      <div className={`absolute inset-0 flex items-center justify-center rounded-inherit transition-opacity ${
        uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      } bg-black/50 rounded-2xl`}>
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
