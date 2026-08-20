'use client'

import { isDotFormDark as isDarkTheme } from '@/lib/dot-form-paper'
import React, { useState, useEffect, useRef } from 'react'
// Namespace import: Vercel/Next production bundles can drop named `createPortal` from `react-dom`.
import * as ReactDOM from 'react-dom'
import { Calendar, ChevronDown } from 'lucide-react'

/** Parse MM/YYYY or "Present" to YYYYMM for range checks */
export function parseDateToNumber(dateStr: string): number | null {
  if (!dateStr) return null
  if (dateStr.toLowerCase() === 'present') {
    const now = new Date()
    return now.getFullYear() * 100 + (now.getMonth() + 1)
  }
  const match = dateStr.match(/^(\d{1,2})\/(\d{4})$/)
  if (match) {
    return parseInt(match[2], 10) * 100 + parseInt(match[1], 10)
  }
  return null
}

export interface MonthYearPickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowPresent?: boolean
  error?: boolean
  /** Ignored — DOT date pickers stay cream paper even when the app is Dark. */
  theme?: string
  /** MM/YYYY — earliest selectable month */
  minDate?: string
  /** MM/YYYY or omit — latest is current month when unset */
  maxDate?: string
}

/**
 * Month + year selector (DOT employment / conviction style).
 * Value stored as `MM/YYYY` or `Present` when allowPresent.
 */
export function MonthYearPicker({
  value,
  onChange,
  placeholder = 'Select date',
  allowPresent = false,
  error = false,
  theme: _theme = 'light',
  minDate,
  maxDate,
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(() => {
    if (value && value.toLowerCase() !== 'present') {
      const match = value.match(/(\d{4})/)
      return match ? parseInt(match[1], 10) : new Date().getFullYear()
    }
    return new Date().getFullYear()
  })
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i)

  const minNum = parseDateToNumber(minDate || '')
  const maxNum = parseDateToNumber(maxDate || 'Present')

  const isMonthDisabled = (monthIndex: number, year: number): boolean => {
    const dateNum = year * 100 + (monthIndex + 1)
    if (minNum && dateNum < minNum) return true
    if (maxNum && dateNum > maxNum) return true
    return false
  }

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMonthSelect = (monthIndex: number) => {
    if (isMonthDisabled(monthIndex, selectedYear)) return
    const formatted = `${String(monthIndex + 1).padStart(2, '0')}/${selectedYear}`
    onChange(formatted)
    setIsOpen(false)
  }

  const handlePresentSelect = () => {
    onChange('Present')
    setIsOpen(false)
  }

  const displayValue = value || placeholder
  const isPresent = value?.toLowerCase() === 'present'

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 9999,
      }}
      className={`rounded-lg shadow-xl border-2 ${
        isDarkTheme(_theme) ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {allowPresent && (
        <button
          type='button'
          onClick={handlePresentSelect}
          className={`w-full px-4 py-3 text-left font-semibold flex items-center gap-3 rounded-t-lg ${
            isPresent
              ? isDarkTheme(_theme)
                ? 'bg-indigo-500 text-white'
                : 'bg-indigo-600 text-white'
              : isDarkTheme(_theme)
                ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                : 'bg-indigo-500/20 text-indigo-600 hover:bg-indigo-500/30'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              isPresent
                ? isDarkTheme(_theme)
                  ? 'bg-gray-900/20'
                  : 'bg-white/30'
                : isDarkTheme(_theme)
                  ? 'bg-indigo-500/30'
                  : 'bg-indigo-500/30'
            }`}
          >
            ✓
          </span>
          Present (Still here)
        </button>
      )}

      {allowPresent && (
        <div
          className={`px-4 py-2 text-xs text-center ${
            isDarkTheme(_theme) ? 'text-gray-500 bg-gray-800/50' : 'text-gray-400 bg-gray-50'
          }`}
        >
          — or select a specific date —
        </div>
      )}

      <div className={`px-3 py-2 border-b ${isDarkTheme(_theme) ? 'border-gray-700' : 'border-gray-200'}`}>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className={`w-full px-2 py-1 rounded ${
            isDarkTheme(_theme)
              ? 'bg-gray-700 text-gray-100 border-gray-600'
              : 'bg-gray-100 text-gray-900 border-gray-300'
          } border`}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className='grid grid-cols-4 gap-1 p-2'>
        {months.map((month, idx) => {
          const monthValue = `${String(idx + 1).padStart(2, '0')}/${selectedYear}`
          const isSelected = value === monthValue
          const disabled = isMonthDisabled(idx, selectedYear)
          return (
            <button
              key={month}
              type='button'
              onClick={() => handleMonthSelect(idx)}
              disabled={disabled}
              className={`px-2 py-2 text-sm rounded transition-colors ${
                disabled
                  ? 'text-gray-400 cursor-not-allowed opacity-40'
                  : isSelected
                    ? isDarkTheme(_theme)
                      ? 'bg-indigo-500 text-white font-medium'
                      : 'bg-indigo-600 text-white font-medium'
                    : isDarkTheme(_theme)
                      ? 'text-gray-100 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {month}
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <div className='relative'>
      <button
        ref={buttonRef}
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 border-2 rounded-md text-left flex items-center justify-between [color-scheme:light] ${
          error
            ? 'border-red-500'
            : isDarkTheme(_theme)
              ? 'bg-gray-700 text-gray-100 border-gray-600'
              : 'bg-white border-gray-300 text-[#173150]'
        } ${!value ? 'text-ironside' : ''}`}
      >
        <span className='flex items-center gap-2'>
          <Calendar className='w-4 h-4 text-gray-400' />
          {displayValue}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {typeof document !== 'undefined' &&
        dropdownContent &&
        ReactDOM.createPortal(dropdownContent, document.body)}
    </div>
  )
}
