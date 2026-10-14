'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Mail, Phone, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ContactPatch {
  candidateName?: string
  candidateEmail?: string
  candidatePhone?: string
}

interface ContactFieldsProps {
  name: string | null
  email: string | null
  phone: string | null
  /** Cancelled / expired invites are read-only — the link is dead. */
  disabled?: boolean
  onSave: (patch: ContactPatch) => Promise<void>
}

/**
 * Name / email / phone as quiet inputs: read like text, edit on click, save on
 * blur when the value changed. Replaces a separate Edit modal — a recruiter
 * fixing a typo'd email should not have to leave the candidate they're looking at.
 */
export default function ContactFields({ name, email, phone, disabled = false, onSave }: ContactFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <QuietField
        icon={User}
        label="Name"
        value={name ?? ''}
        placeholder="Add name"
        disabled={disabled}
        onCommit={(v) => onSave({ candidateName: v })}
      />
      <QuietField
        icon={Mail}
        label="Email"
        type="email"
        value={email ?? ''}
        placeholder="Add email"
        disabled={disabled}
        onCommit={(v) => onSave({ candidateEmail: v })}
      />
      <QuietField
        icon={Phone}
        label="Phone"
        type="tel"
        value={phone ?? ''}
        placeholder="Add phone"
        disabled={disabled}
        onCommit={(v) => onSave({ candidatePhone: v })}
      />
    </div>
  )
}

function QuietField({
  icon: Icon,
  label,
  value,
  placeholder,
  type = 'text',
  disabled,
  onCommit,
}: {
  icon: LucideIcon
  label: string
  value: string
  placeholder: string
  type?: 'text' | 'email' | 'tel'
  disabled: boolean
  onCommit: (value: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(value)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Parent may refresh the invite (e.g. after a send normalizes the phone to E.164).
  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = async () => {
    const next = draft.trim()
    if (next === value.trim()) return
    setState('saving')
    setError(null)
    try {
      await onCommit(next)
      setState('saved')
      setTimeout(() => setState('idle'), 1500)
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : 'Could not save')
      setDraft(value)
    }
  }

  return (
    <label className="group block min-w-0">
      <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ironside">
        <Icon className="h-3 w-3" />
        {label}
        {state === 'saving' && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
        {state === 'saved' && <Check className="ml-auto h-3 w-3 text-emerald-600" />}
      </span>
      <input
        type={type}
        value={draft}
        disabled={disabled || state === 'saving'}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(value)
            e.currentTarget.blur()
          }
        }}
        className={cn(
          'w-full truncate rounded-md border bg-transparent px-2 py-1.5 text-sm text-[#173150] outline-none transition-colors',
          'placeholder-ironside/60 disabled:cursor-not-allowed disabled:opacity-60',
          state === 'error'
            ? 'border-red-300 bg-red-50/60'
            : 'border-transparent hover:border-stone-200 focus:border-[#173150] focus:bg-white',
        )}
      />
      {error && <span className="mt-0.5 block text-[11px] text-red-600">{error}</span>}
    </label>
  )
}
