'use client'

import { useState } from 'react'
import { Check, Mail, MessageSquare, Link2, Package, ShieldCheck, Send, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { BlockDefinition } from '@/lib/block-registry'

/** Registry stores icons as names; resolve the ones outreach blocks actually use. */
const ICON_BY_NAME: Record<string, LucideIcon> = { ShieldCheck }

export interface SendSelection {
  blockTypes: string[]
  viaEmail: boolean
  viaSms: boolean
  note?: string
}

interface SendBlocksPanelProps {
  blocks: BlockDefinition[]
  /** Block type → ISO date of a live (non-terminal) invite already out for this candidate. */
  alreadySent?: ReadonlyMap<string, string>
  email: string | null
  phone: string | null
  /** Detail modal shows a note field; the New outreach form has its own. */
  showNote?: boolean
  sending: boolean
  onSend: (selection: SendSelection) => Promise<void>
  recipientFirstName?: string | null
}

function sentAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/**
 * The one action a recruiter takes on a candidate: pick what to send, confirm
 * how it goes out, press Send. Creating the invite and delivering it happen in
 * the same click — "create" and "send" being separate steps is what let links
 * get minted and never delivered.
 *
 * Nothing is pre-checked on purpose: the list is registry-driven and will grow,
 * and a recruiter should always see what they are about to send.
 */
export default function SendBlocksPanel({
  blocks,
  alreadySent,
  email,
  phone,
  showNote = false,
  sending,
  onSend,
  recipientFirstName,
}: SendBlocksPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viaEmail, setViaEmail] = useState(Boolean(email))
  const [viaSms, setViaSms] = useState(Boolean(phone))
  const [note, setNote] = useState('')
  const [justSent, setJustSent] = useState<string | null>(null)

  const hasEmail = Boolean(email)
  const hasPhone = Boolean(phone)
  const emailOn = viaEmail && hasEmail
  const smsOn = viaSms && hasPhone
  const willDeliver = emailOn || smsOn

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleSend = async () => {
    if (selected.size === 0) return
    const blockTypes = [...selected]
    await onSend({
      blockTypes,
      viaEmail: emailOn,
      viaSms: smsOn,
      note: note.trim() || undefined,
    })
    const channels = [emailOn && 'email', smsOn && 'text'].filter(Boolean).join(' and ')
    setJustSent(willDeliver ? `Sent by ${channels}` : 'Link copied to clipboard')
    setSelected(new Set())
    setNote('')
    setTimeout(() => setJustSent(null), 4000)
  }

  const sendLabel = (() => {
    if (selected.size === 0) return 'Select what to send'
    if (!willDeliver) return 'Create link & copy'
    if (selected.size === 1) {
      const def = blocks.find((b) => b.id === [...selected][0])
      return `Send ${def?.requestLabel ?? def?.label ?? 'invite'}`
    }
    return `Send ${selected.size} invites`
  })()

  if (blocks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 px-4 py-3 text-xs text-ironside">
        Nothing to send yet — install an employer screening block to enable outreach.
      </p>
    )
  }

  // Everything sendable is already out — show the list as a status, not a form.
  // Nudging happens via the Email/Text link tools in the card footer.
  const allSent = blocks.every((b) => alreadySent?.has(b.id))

  return (
    <section className="rounded-xl border border-[#f15a2b]/25 bg-[#f15a2b]/[0.04] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#f15a2b]">
        {allSent ? `Waiting on ${recipientFirstName || 'candidate'}` : `Send to ${recipientFirstName || 'candidate'}`}
      </p>

      <ul className="mt-3 space-y-2">
        {blocks.map((block) => {
          const Icon = ICON_BY_NAME[block.icon] ?? Package
          const sentAt = alreadySent?.get(block.id)
          const disabled = Boolean(sentAt)
          const isOn = selected.has(block.id)
          return (
            <li key={block.id}>
              <button
                type="button"
                disabled={disabled || sending}
                aria-pressed={isOn}
                onClick={() => toggle(block.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border bg-white px-3 py-2.5 text-left transition-all',
                  disabled
                    ? 'cursor-not-allowed border-stone-200 opacity-60'
                    : isOn
                      ? 'border-[#173150] ring-1 ring-[#173150]'
                      : 'border-stone-200 hover:border-ironside/60',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                    isOn ? 'border-[#173150] bg-[#173150]' : 'border-stone-300 bg-white',
                  )}
                >
                  {isOn && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    isOn ? 'bg-[#173150] text-white' : 'bg-stone-100 text-[#173150]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-[#173150]">{block.label}</span>
                    {sentAt && (
                      <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-ironside">
                        Sent {sentAgo(sentAt)} · waiting on them
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-ironside">{block.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {allSent && (
        <p className="mt-2 text-[11px] text-ironside">
          Nothing else to send. Use <span className="font-medium text-[#173150]">Email link</span> or{' '}
          <span className="font-medium text-[#173150]">Text link</span> below to nudge them.
        </p>
      )}

      {!allSent && (
        <>
          {/* Delivery — the recruiter always sees exactly where this is going. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-ironside">Deliver by</span>
            <DeliveryToggle
              icon={Mail}
              label="Email"
              detail={email}
              on={emailOn}
              available={hasEmail}
              onToggle={() => setViaEmail((v) => !v)}
            />
            <DeliveryToggle
              icon={MessageSquare}
              label="Text"
              detail={phone}
              on={smsOn}
              available={hasPhone}
              onToggle={() => setViaSms((v) => !v)}
            />
          </div>
          {!hasEmail && !hasPhone && (
            <p className="mt-2 text-[11px] text-ironside">
              Add an email or phone above to deliver automatically — otherwise we copy the link for you.
            </p>
          )}

          {showNote && selected.size > 0 && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note they'll see on the invite…"
              className="mt-3 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-[#173150] placeholder-ironside outline-none focus:ring-2 focus:ring-[#173150]/20"
            />
          )}

          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="min-w-[12rem]"
              disabled={selected.size === 0 || sending}
              isLoading={sending}
              onClick={handleSend}
            >
              {!sending && (willDeliver ? <Send className="h-4 w-4" /> : <Link2 className="h-4 w-4" />)}
              {sending ? 'Sending…' : sendLabel}
            </Button>
            {justSent && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                {justSent}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function DeliveryToggle({
  icon: Icon,
  label,
  detail,
  on,
  available,
  onToggle,
}: {
  icon: LucideIcon
  label: string
  detail: string | null
  on: boolean
  available: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!available}
      onClick={onToggle}
      title={available ? undefined : `No ${label.toLowerCase()} on file`}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        !available
          ? 'cursor-not-allowed border-dashed border-stone-300 text-ironside/70'
          : on
            ? 'border-[#173150] bg-[#173150] text-white'
            : 'border-stone-300 bg-white text-ironside hover:border-ironside',
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="font-medium">{label}</span>
      {available && detail && <span className="truncate opacity-80">· {detail}</span>}
    </button>
  )
}
