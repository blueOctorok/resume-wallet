'use client'

import React, { useState } from 'react'
import { DriverApplicationData } from './types/driver-application.types'
import {
  AUTO_COMPLETE_DATA,
  AUTO_COMPLETE_DATA_WITH_ISSUES,
  AUTO_COMPLETE_DATA_NEW_DRIVER,
  QuickFill,
} from './auto-complete'

interface AutoCompletePanelProps {
  onFillData: (data: Partial<DriverApplicationData>) => void
  currentStep: number
  isVisible: boolean
  onToggle: () => void
}

export const AutoCompletePanel: React.FC<AutoCompletePanelProps> = ({
  onFillData,
  currentStep,
  isVisible,
  onToggle,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<
    'clean' | 'with-issues' | 'new-driver'
  >('clean')

  const handleFillAll = () => {
    let data: DriverApplicationData

    switch (selectedPreset) {
      case 'with-issues':
        data = AUTO_COMPLETE_DATA_WITH_ISSUES
        break
      case 'new-driver':
        data = AUTO_COMPLETE_DATA_NEW_DRIVER
        break
      default:
        data = AUTO_COMPLETE_DATA
    }

    onFillData(data)
  }

  const handleFillCurrentStep = () => {
    const stepData = getStepData(currentStep)
    if (stepData) {
      onFillData({ [getStepKey(currentStep)]: stepData })
    }
  }

  const getStepData = (step: number) => {
    switch (step) {
      case 1:
        return QuickFill.personalInfo()
      case 2:
        return QuickFill.cdlInfo()
      case 3:
        return QuickFill.employmentHistory()
      case 4:
        return QuickFill.drivingRecord()
      case 5:
        return QuickFill.medicalInfo()
      case 6:
        return QuickFill.drugAlcoholTesting()
      case 7:
        return QuickFill.trainingRecords()
      case 8:
        return QuickFill.drivingExperience()
      case 9:
        return QuickFill.safetyCompliance()
      case 10:
        return QuickFill.references()
      default:
        return null
    }
  }

  const getStepKey = (step: number): keyof DriverApplicationData => {
    const keys: (keyof DriverApplicationData)[] = [
      'personalInfo',
      'cdlInfo',
      'employmentHistory',
      'drivingRecord',
      'medicalInfo',
      'drugAlcoholTesting',
      'trainingRecords',
      'drivingExperience',
      'safetyCompliance',
      'references',
    ]
    return keys[step - 1]
  }

  const getStepName = (step: number): string => {
    const names = [
      'Personal Information',
      'CDL Information',
      'Employment History',
      'Driving Record',
      'Medical Information',
      'Drug/Alcohol Testing',
      'Training Records',
      'Driving Experience',
      'Safety & Compliance',
      'References',
    ]
    return names[step - 1] || 'Unknown Step'
  }

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className='fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors z-50'
        title='Show Auto-Complete Panel'
      >
        <svg
          className='w-5 h-5'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M13 10V3L4 14h7v7l9-11h-7z'
          />
        </svg>
      </button>
    )
  }

  return (
    <div className='fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80 z-50'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold text-gray-900'>Auto-Complete</h3>
        <button
          onClick={onToggle}
          className='text-gray-400 hover:text-gray-600'
        >
          <svg
            className='w-5 h-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </button>
      </div>

      <div className='space-y-4'>
        {/* Preset Selection */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Test Data Preset
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value as any)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500'
          >
            <option value='clean'>Clean Driver (No Issues)</option>
            <option value='with-issues'>Driver with Compliance Issues</option>
            <option value='new-driver'>New Driver (Minimal Experience)</option>
          </select>
        </div>

        {/* Quick Actions */}
        <div className='space-y-2'>
          <button
            onClick={handleFillAll}
            className='w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors'
          >
            Fill All Steps
          </button>

          <button
            onClick={handleFillCurrentStep}
            className='w-full px-4 py-2 text-brand-sage bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
          >
            Fill Current Step ({getStepName(currentStep)})
          </button>
        </div>

        {/* Preset Descriptions */}
        <div className='text-xs text-gray-600 space-y-1'>
          <div>
            <strong>Clean Driver:</strong> Experienced driver with good record
          </div>
          <div>
            <strong>With Issues:</strong> Driver with compliance problems
          </div>
          <div>
            <strong>New Driver:</strong> Recent CDL holder with minimal
            experience
          </div>
        </div>

        {/* Current Step Info */}
        <div className='bg-gray-50 rounded-md p-3'>
          <div className='text-sm text-gray-700'>
            <strong>Current Step:</strong> {currentStep}/10 -{' '}
            {getStepName(currentStep)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AutoCompletePanel
