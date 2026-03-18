'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, Send, CheckCircle } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import type { ProjectedCareerCard as CardData } from '@/types/career-card'

function PublicCardContent() {
  const { token } = useParams<{ token: string }>()
  const { isDark } = useTheme()

  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Connect form
  const [showConnect, setShowConnect] = useState(false)
  const [connectSuccess, setConnectSuccess] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectForm, setConnectForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
  })

  useEffect(() => {
    if (token) fetchCard()
  }, [token])

  const fetchCard = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/career-card?token=${token}`, { cache: 'no-store' })
      if (!res.ok) {
        setError(res.status === 404 ? 'Profile not found or sharing is disabled' : 'Failed to load profile')
        return
      }
      const json = await res.json()
      setData(json.card)
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connectForm.email && !connectForm.phone) {
      alert('Please provide email or phone number')
      return
    }

    try {
      setConnecting(true)
      const res = await fetch('/api/career-card/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: connectForm.name,
          email: connectForm.email,
          phone: connectForm.phone,
          company: connectForm.company,
          notes: connectForm.notes,
        }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setConnectSuccess(true)
      setShowConnect(false)
    } catch {
      alert('Failed to send connection request. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin text-teal-400' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='w-12 h-12 text-red-400 mx-auto mb-4' />
          <h1 className='text-xl font-bold text-white mb-2'>Profile Not Found</h1>
          <p className='text-gray-400'>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4'>
      {/* StormChain branding */}
      <div className='text-center mb-8'>
        <h2 className='text-sm font-semibold text-teal-400 tracking-wider uppercase'>
          StormChain Career Card
        </h2>
      </div>

      <ProjectedCareerCard
        data={data}
        mode='public'
        onConnect={() => setShowConnect(true)}
      />

      {/* Connect success */}
      {connectSuccess && (
        <div className='max-w-2xl mx-auto mt-4'>
          <div className='rounded-xl bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3'>
            <CheckCircle className='w-5 h-5 text-green-400 flex-shrink-0' />
            <div>
              <p className='text-sm font-medium text-green-300'>Connection request sent!</p>
              <p className='text-xs text-green-400/70'>{data.name} has been notified.</p>
            </div>
          </div>
        </div>
      )}

      {/* Connect form modal */}
      {showConnect && (
        <Modal onClose={() => setShowConnect(false)} maxWidth="max-w-md">
          <ModalHeader title={`Connect with ${data.name.split(' ')[0]}`} onClose={() => setShowConnect(false)} />
          <form onSubmit={handleConnect} className='p-6 space-y-3'>
              <input
                type='text'
                placeholder='Your name'
                value={connectForm.name}
                onChange={(e) => setConnectForm(f => ({ ...f, name: e.target.value }))}
                className='w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400'
              />
              <input
                type='email'
                placeholder='Email *'
                value={connectForm.email}
                onChange={(e) => setConnectForm(f => ({ ...f, email: e.target.value }))}
                className='w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400'
              />
              <input
                type='tel'
                placeholder='Phone'
                value={connectForm.phone}
                onChange={(e) => setConnectForm(f => ({ ...f, phone: e.target.value }))}
                className='w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400'
              />
              <input
                type='text'
                placeholder='Company'
                value={connectForm.company}
                onChange={(e) => setConnectForm(f => ({ ...f, company: e.target.value }))}
                className='w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400'
              />
              <textarea
                placeholder='Notes (optional)'
                value={connectForm.notes}
                onChange={(e) => setConnectForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className='w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400 resize-none'
              />
              <button
                type='submit'
                disabled={connecting}
                className='w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors'
              >
                {connecting ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
                Send Connection Request
              </button>
            </form>
        </Modal>
      )}

      {/* Footer */}
      <div className='text-center mt-8'>
        <p className='text-xs text-gray-500'>
          Powered by{' '}
          <a href='/' className='text-teal-400 hover:text-teal-300'>StormChain</a>
        </p>
      </div>
    </div>
  )
}

/**
 * Public career card page — renders any candidate's career card via share token.
 * Replaces both /d/[token] (driver) and /dev-card/[token] (developer).
 */
export default function PublicCardPage() {
  return (
    <ThemeProvider>
      <PublicCardContent />
    </ThemeProvider>
  )
}
