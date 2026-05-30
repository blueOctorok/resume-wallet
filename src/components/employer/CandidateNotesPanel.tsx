'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  MessageSquare,
  Star,
  Tag,
  Plus,
  Loader2,
  Clock,
  User,
  X,
  Send,
  AlertCircle,
} from 'lucide-react'

interface CandidateNote {
  id: string
  dataType: 'note' | 'rating' | 'tag'
  content: {
    text?: string
    rating?: number
    tag?: string
  }
  createdAt: string
  createdByName?: string
}

interface CandidateNotesPanelProps {
  candidateUserId: string
  applicationId?: string
  walletAddress: string
  candidateName: string
}

const QUICK_TAGS = [
  'Hot Candidate',
  'Backup',
  'Needs Follow-up',
  'Strong Experience',
  'Culture Fit',
  'Salary Concerns',
  'Relocation Required',
]

export default function CandidateNotesPanel({
  candidateUserId,
  applicationId,
  walletAddress,
  candidateName,
}: CandidateNotesPanelProps) {
  const { theme } = useTheme()
  const [notes, setNotes] = useState<CandidateNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [activeTab, setActiveTab] = useState<'note' | 'rating' | 'tag'>('note')
  const [noteText, setNoteText] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [selectedTag, setSelectedTag] = useState('')
  const [customTag, setCustomTag] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/employer/candidate-data/${candidateUserId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }

      const data = await response.json()
      setNotes(data.items || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [candidateUserId, walletAddress])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const submitData = async () => {
    let dataType: string
    let content: Record<string, unknown>

    if (activeTab === 'note') {
      if (!noteText.trim()) return
      dataType = 'note'
      content = { text: noteText.trim() }
    } else if (activeTab === 'rating') {
      if (rating === 0) return
      dataType = 'rating'
      content = { rating }
    } else {
      const tagValue = selectedTag || customTag.trim()
      if (!tagValue) return
      dataType = 'tag'
      content = { tag: tagValue }
    }

    try {
      setSubmitting(true)
      
      const response = await fetch('/api/employer/candidate-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateUserId,
          applicationId,
          dataType,
          content,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      // Reset form and refresh
      setNoteText('')
      setRating(0)
      setSelectedTag('')
      setCustomTag('')
      await fetchNotes()
    } catch (err) {
      console.error('Error saving note:', err)
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Get current rating if exists
  const currentRating = notes.find(n => n.dataType === 'rating')?.content.rating || 0
  const existingTags = notes.filter(n => n.dataType === 'tag').map(n => n.content.tag)

  const cardClass = isDarkTheme(theme)
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-white border-gray-200'

  const inputClass = isDarkTheme(theme)
    ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'

  const tabClass = (isActive: boolean) => `
    px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
    ${isActive
      ? isDarkTheme(theme)
        ? 'bg-teal-500/20 text-teal-400'
        : 'bg-teal-100 text-teal-700'
      : isDarkTheme(theme)
        ? 'text-gray-400 hover:text-gray-300'
        : 'text-gray-600 hover:text-gray-700'
    }
  `

  return (
    <div className={`rounded-xl border ${cardClass}`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className='flex items-center justify-between'>
          <h3 className={`font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            Notes & Activity
          </h3>
          {currentRating > 0 && (
            <div className='flex items-center gap-1'>
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${star <= currentRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
                />
              ))}
            </div>
          )}
        </div>
        <p className={`text-sm mt-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
          Private notes about {candidateName}
        </p>
      </div>

      {/* Quick Tags */}
      {existingTags.length > 0 && (
        <div className={`px-4 py-3 border-b flex flex-wrap gap-2 ${isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'}`}>
          {existingTags.map((tag, idx) => (
            <span
              key={idx}
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                isDarkTheme(theme)
                  ? 'bg-teal-500/20 text-teal-400'
                  : 'bg-teal-100 text-teal-700'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Add Note Form */}
      <div className={`p-4 border-b ${isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'}`}>
        {/* Tabs */}
        <div className='flex gap-2 mb-3'>
          <button onClick={() => setActiveTab('note')} className={tabClass(activeTab === 'note')}>
            <MessageSquare className='w-3.5 h-3.5 inline mr-1' />
            Note
          </button>
          <button onClick={() => setActiveTab('rating')} className={tabClass(activeTab === 'rating')}>
            <Star className='w-3.5 h-3.5 inline mr-1' />
            Rating
          </button>
          <button onClick={() => setActiveTab('tag')} className={tabClass(activeTab === 'tag')}>
            <Tag className='w-3.5 h-3.5 inline mr-1' />
            Tag
          </button>
        </div>

        {/* Note Input */}
        {activeTab === 'note' && (
          <div className='flex gap-2'>
            <input
              type='text'
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder='Add a note...'
              className={`flex-1 px-3 py-2 text-sm rounded-lg border ${inputClass}`}
              onKeyDown={e => e.key === 'Enter' && submitData()}
            />
            <button
              onClick={submitData}
              disabled={!noteText.trim() || submitting}
              className='px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {submitting ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
            </button>
          </div>
        )}

        {/* Rating Input */}
        {activeTab === 'rating' && (
          <div className='flex items-center gap-3'>
            <div className='flex gap-1'>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className='p-1 transition-transform hover:scale-110'
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : isDarkTheme(theme) ? 'text-gray-600' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={submitData}
              disabled={rating === 0 || submitting}
              className='px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {submitting ? <Loader2 className='w-4 h-4 animate-spin' /> : 'Save Rating'}
            </button>
          </div>
        )}

        {/* Tag Input */}
        {activeTab === 'tag' && (
          <div className='space-y-3'>
            <div className='flex flex-wrap gap-2'>
              {QUICK_TAGS.filter(t => !existingTags.includes(t)).map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTag(selectedTag === tag ? '' : tag)
                    setCustomTag('')
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    selectedTag === tag
                      ? 'border-teal-500 bg-teal-500/20 text-teal-500'
                      : isDarkTheme(theme)
                        ? 'border-gray-600 text-gray-400 hover:border-gray-500'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className='flex gap-2'>
              <input
                type='text'
                value={customTag}
                onChange={e => {
                  setCustomTag(e.target.value)
                  setSelectedTag('')
                }}
                placeholder='Or add custom tag...'
                className={`flex-1 px-3 py-2 text-sm rounded-lg border ${inputClass}`}
              />
              <button
                onClick={submitData}
                disabled={(!selectedTag && !customTag.trim()) || submitting}
                className='px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {submitting ? <Loader2 className='w-4 h-4 animate-spin' /> : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes Timeline */}
      <div className='p-4 max-h-80 overflow-y-auto'>
        {loading ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='w-5 h-5 animate-spin text-teal-500' />
          </div>
        ) : error ? (
          <div className='flex items-center gap-2 text-red-500 py-4'>
            <AlertCircle className='w-4 h-4' />
            <span className='text-sm'>{error}</span>
          </div>
        ) : notes.filter(n => n.dataType === 'note').length === 0 ? (
          <div className={`text-center py-8 ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
            <MessageSquare className='w-8 h-8 mx-auto mb-2 opacity-50' />
            <p className='text-sm'>No notes yet</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {notes
              .filter(n => n.dataType === 'note')
              .map(note => (
                <div
                  key={note.id}
                  className={`p-3 rounded-lg ${isDarkTheme(theme) ? 'bg-gray-900/50' : 'bg-gray-50'}`}
                >
                  <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                    {note.content.text}
                  </p>
                  <div className={`flex items-center gap-2 mt-2 text-xs ${isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Clock className='w-3 h-3' />
                    {formatDate(note.createdAt)}
                    {note.createdByName && (
                      <>
                        <span>•</span>
                        <User className='w-3 h-3' />
                        {note.createdByName}
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
