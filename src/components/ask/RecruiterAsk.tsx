'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, ClipboardList, Loader2, PenLine, ScanLine } from 'lucide-react'
import Button from '@/components/ui/Button'
import ProvvenWordmark from '@/components/ui/ProvvenWordmark'
import type { RecruiterAskTaskId } from '@/lib/recruiter-ask'

/**
 * The page behind the button in a recruiter email.
 * Email apps cannot run a form, so the choices live here.
 * The link can only remind the driver. It cannot open their file.
 */

interface AskTask {
  id: RecruiterAskTaskId
  label: string
  detail: string
}

interface AskView {
  companyName: string
  driverName: string
  firstName: string
  note: string
  tasks: AskTask[]
  expired: boolean
  sent: boolean
}

const ICONS: Record<RecruiterAskTaskId, typeof PenLine> = {
  consent: PenLine,
  license: ScanLine,
  dot: ClipboardList,
}

export default function RecruiterAsk({ token }: { token: string }) {
  const [view, setView] = useState<AskView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RecruiterAskTaskId[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sentName, setSentName] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/ask/${encodeURIComponent(token)}`)
        const data = (await res.json().catch(() => ({}))) as AskView & { error?: string }
        if (!res.ok) throw new Error(data.error || 'This link is not valid.')
        if (cancelled) return
        setView(data)
        setSelected(data.tasks.map((task) => task.id))
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'This link is not valid.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const toggle = (id: RecruiterAskTaskId) => {
    setSelected((current) => (current.includes(id) ? current.filter((task) => task !== id) : [...current, id]))
  }

  const send = async () => {
    if (!view || selected.length === 0) return
    setSending(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/ask/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: selected, message }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; firstName?: string }
      if (!res.ok) throw new Error(data.error || 'Could not send')
      setSentName(data.firstName || view.firstName)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not send')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f4f5] px-4 py-10 text-[#173150] dark:bg-[#0c1522] dark:text-gray-100 sm:py-16">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-5 flex justify-center">
          <ProvvenWordmark className="text-[15px]" tone="auto" />
        </div>

        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:bg-gray-900 dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
          {loadError ? (
            <Closed title={loadError} body="If this came from a recent email, ask HR to send it again." />
          ) : !view ? (
            <div className="flex items-center justify-center gap-2 px-8 py-16 text-sm text-[#939598]" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-[#f15a2b]" />
              Opening…
            </div>
          ) : sentName || view.sent ? (
            <Closed
              title={`${sentName || view.firstName} has the email`}
              body="They got the steps you picked, and your note if you wrote one. You can close this page."
              done
            />
          ) : view.expired ? (
            <Closed
              title="This link has expired"
              body="Ask your HR contact to send a fresh status email. That creates a new link."
            />
          ) : view.tasks.length === 0 ? (
            <Closed
              title="Nothing for them to do"
              body={`${view.firstName}'s remaining steps are on the HR side. Ordering reports and starting employment checks stay there.`}
            />
          ) : (
            <>
              <header className="bg-[#173150] px-6 pb-6 pt-8 sm:px-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea]">{view.companyName}</p>
                <h1 className="mt-1.5 font-display text-2xl font-bold leading-tight text-[#f4f1ea]">{view.firstName}</h1>
                <p className="mt-1 text-sm text-[#f4f1ea]/75">{view.driverName}</p>
              </header>
              <div className="h-[3px] bg-[#f15a2b]" aria-hidden />

              <div className="px-6 py-7 sm:px-10">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#939598]">From HR</p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#173150] dark:text-gray-100">{view.note}</p>

                <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-[#939598]">
                  Send {view.firstName} these steps
                </p>
                <ul className="space-y-2.5">
                  {view.tasks.map((task) => {
                    const on = selected.includes(task.id)
                    const Icon = ICONS[task.id]
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => toggle(task.id)}
                          aria-pressed={on}
                          className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-colors ${
                            on
                              ? 'border-[#f15a2b] bg-[#f15a2b]/10 dark:bg-[#f15a2b]/15'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              on ? 'bg-[#f15a2b] text-white' : 'bg-white text-[#173150] dark:bg-gray-900 dark:text-gray-200'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{task.label}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-[#64748b] dark:text-gray-400">{task.detail}</span>
                          </span>
                          <span
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              on ? 'border-[#f15a2b] bg-[#f15a2b] text-white' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <label className="mb-2 mt-8 block text-xs font-semibold uppercase tracking-[0.12em] text-[#939598]" htmlFor="ask-note">
                  A note for them, optional
                </label>
                <textarea
                  id="ask-note"
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
                  rows={4}
                  placeholder={`Hi ${view.firstName}, can you knock this out today?`}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-[#173150] outline-none placeholder:text-[#939598] focus:border-[#f15a2b] focus:ring-2 focus:ring-[#f15a2b]/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />

                {formError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p> : null}

                <Button
                  className="mt-5 w-full"
                  size="lg"
                  isLoading={sending}
                  disabled={selected.length === 0}
                  onClick={() => void send()}
                >
                  Email {view.firstName}
                </Button>
                <p className="mt-3 text-center text-xs leading-relaxed text-[#939598]">
                  Provven emails them. Their address stays off this page.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function Closed({ title, body, done = false }: { title: string; body: string; done?: boolean }) {
  return (
    <div className="px-8 py-14 text-center sm:px-12">
      <span
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
          done ? 'bg-[#f15a2b] text-white' : 'bg-gray-100 text-[#173150] dark:bg-gray-800 dark:text-gray-200'
        }`}
      >
        {done ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <AlertCircle className="h-5 w-5" />}
      </span>
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#64748b] dark:text-gray-400">{body}</p>
    </div>
  )
}
