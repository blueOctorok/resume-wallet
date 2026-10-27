'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdminTabProps } from '@/components/admin/admin-types'
import { getTableCellClass, getTableHeaderClass } from '@/components/admin/admin-styles'
import { isDarkTheme } from '@/lib/theme-storage'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface SupportListItem {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string
  receivedAt: string
  readAt: string | null
}

interface SupportMessage extends SupportListItem {
  toEmail: string
  body: string
  direction: string
}

export default function SupportTab({
  theme,
  searchQuery,
  currentPage,
  pageSize,
  setTotalCount,
}: AdminTabProps) {
  const [messages, setMessages] = useState<SupportListItem[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ message: SupportMessage; replies: SupportMessage[] } | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyError, setReplyError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * pageSize
      const response = await fetch(
        `/api/admin/support?search=${encodeURIComponent(searchQuery)}&limit=${pageSize}&offset=${offset}`,
      )
      const data = (await response.json()) as {
        success?: boolean
        error?: string
        messages?: SupportListItem[]
        total?: number
      }
      if (!response.ok || !data.success) {
        setError(data.error || 'Could not load support messages')
        return
      }
      setError(null)
      setMessages(data.messages ?? [])
      setTotalCount(data.total ?? 0)
    } catch (err) {
      console.error('[ADMIN SUPPORT]', err)
      setError('Could not load support messages')
    }
  }, [searchQuery, currentPage, pageSize, setTotalCount])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const openMessage = async (id: string) => {
    setOpenId(id)
    setDetail(null)
    setReply('')
    setReplyError(null)
    try {
      const response = await fetch(`/api/admin/support/${id}`)
      const data = (await response.json()) as {
        success?: boolean
        error?: string
        message?: SupportMessage
        replies?: SupportMessage[]
      }
      if (!response.ok || !data.message) {
        setReplyError(data.error || 'Could not open the message')
        return
      }
      setDetail({ message: data.message, replies: data.replies ?? [] })
      setMessages((current) =>
        current.map((row) => (row.id === id ? { ...row, readAt: data.message?.readAt ?? row.readAt } : row)),
      )
    } catch (err) {
      console.error('[ADMIN SUPPORT]', err)
      setReplyError('Could not open the message')
    }
  }

  const sendReply = async () => {
    if (!openId || !reply.trim()) return
    setSending(true)
    setReplyError(null)
    try {
      const response = await fetch(`/api/admin/support/${openId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        setReplyError(data.error || 'Could not send the reply')
        return
      }
      setReply('')
      await openMessage(openId)
    } catch (err) {
      console.error('[ADMIN SUPPORT]', err)
      setReplyError('Could not send the reply')
    } finally {
      setSending(false)
    }
  }

  const header = getTableHeaderClass(theme)
  const cell = getTableCellClass(theme)
  const muted = isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'

  return (
    <div>
      {error && <p className='mb-3 text-sm text-red-600 dark:text-red-400'>{error}</p>}
      {messages.length === 0 && !error ? (
        <p className={`py-8 text-center text-sm ${muted}`}>
          No support mail yet. Messages appear here after support@provven.com and info@provven.com are forwarded to the same names at verify.provven.com.
        </p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className={isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className={`${header} px-4 py-3 text-left`}>From</th>
                <th className={`${header} px-4 py-3 text-left`}>Subject</th>
                <th className={`${header} px-4 py-3 text-left`}>Received</th>
                <th className={`${header} px-4 py-3`} />
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
              {messages.map((message) => (
                <tr key={message.id}>
                  <td className={cell}>
                    <span className={message.readAt ? '' : 'font-semibold'}>
                      {message.fromName || message.fromEmail}
                    </span>
                    {message.fromName && <div className={`text-xs ${muted}`}>{message.fromEmail}</div>}
                  </td>
                  <td className={cell}>{message.subject}</td>
                  <td className={cell}>{new Date(message.receivedAt).toLocaleString()}</td>
                  <td className={cell}>
                    <Button variant='ghost' size='sm' onClick={() => void openMessage(message.id)}>
                      {message.readAt ? 'View' : 'New'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <Modal onClose={() => setOpenId(null)} maxWidth='max-w-2xl' zIndex={1100}>
          <ModalHeader
            title={detail?.message.subject || 'Support message'}
            subtitle={detail ? `${detail.message.fromName ? `${detail.message.fromName} · ` : ''}${detail.message.fromEmail}` : 'Loading…'}
            onClose={() => setOpenId(null)}
          />
          <div className='space-y-4 p-4 sm:p-5'>
            {!detail && !replyError && <p className={`text-sm ${muted}`}>Loading the message…</p>}
            {detail && (
              <>
                <p className='whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100'>{detail.message.body || 'No message body.'}</p>
                {detail.replies.map((item) => (
                  <div key={item.id} className='rounded-lg border border-gray-200 p-3 dark:border-gray-700'>
                    <p className={`text-xs ${muted}`}>Reply · {new Date(item.receivedAt).toLocaleString()}</p>
                    <p className='mt-1 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100'>{item.body}</p>
                  </div>
                ))}
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={4}
                  placeholder='Write a reply'
                  className='w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                />
                <Button variant='primary' onClick={() => void sendReply()} isLoading={sending} disabled={!reply.trim()}>
                  Send reply
                </Button>
              </>
            )}
            {replyError && <p className='text-sm text-red-600 dark:text-red-400'>{replyError}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
