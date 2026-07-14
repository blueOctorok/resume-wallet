'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import SaveProgressButton from './SaveProgressButton'
import { StateSelect, normalizeState } from '@/components/ui/StateSelect'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import VerifiedFieldBadge from '@/components/driver-application/VerifiedFieldBadge'
import {
  type DotForm2RowProvenance,
  type DotFieldProvenanceEntry,
} from '@/lib/dot-field-provenance'
import {
  resolveMvrRowDotBadge,
  type AttestationBadgeSummary,
} from '@/lib/dot-attestation-badge'

/** Normalize saved values to MM/YYYY for MonthYearPicker (legacy text or ISO dates). */
function normalizeConvictionMonthYear(raw: string): string {
  if (!raw) return ''
  const t = raw.trim()
  const slash = t.match(/^(\d{1,2})\/(\d{4})$/)
  if (slash) return `${String(parseInt(slash[1], 10)).padStart(2, '0')}/${slash[2]}`
  const iso = t.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (iso) return `${iso[2]}/${iso[1]}`
  return ''
}

// 49 CFR 391.15 disqualifying offenses — shown as checkboxes when driver answers "yes"
const CFR391_OFFENSES = [
  { key: 'bac04',             label: 'Driving a CMV with a blood alcohol concentration (BAC) of .04% or more' },
  { key: 'dui',               label: 'Driving under the influence of alcohol, as prescribed by state law' },
  { key: 'refusalTest',       label: 'Refusal to undergo drug and alcohol testing as required by any jurisdiction for the enforcement of FMCSA regulations' },
  { key: 'controlledSub',     label: 'Driving a CMV under the influence of a Schedule I controlled substance, amphetamine, narcotic drug, or derivative thereof' },
  { key: 'possession',        label: 'Transportation, possession, or unlawful use of a Schedule I controlled substance, amphetamines, or narcotic drugs while on duty driving for a motor carrier' },
  { key: 'hitAndRun',         label: 'Leaving the scene of an accident while operating a CMV' },
  { key: 'felony',            label: 'Any other felony involving the use of a commercial motor vehicle' },
]

const STEPS = [
  {
    id: 1,
    title: 'Driving Experience',
    description: 'Equipment types and driving experience',
  },
  {
    id: 2,
    title: 'Accident Record',
    description: 'Accidents from the past 5 years',
  },
  {
    id: 3,
    title: 'Safety & Compliance History',
    description: 'Drug testing history, criminal convictions, and traffic violations',
  },
]

interface PersonalInfoForm2Props {
  onNavigateToForm?: (formNumber: number) => void
  onDataChange?: (data: any) => void
  initialData?: any
  sessionUserId?: string
  /** Centralized save function - saves ALL forms to driver profile */
  onSaveProgress?: () => Promise<boolean | undefined>
  /** P3.7 — issuer row provenance for accident/conviction/inspection locks + badges. */
  rowProvenance?: DotForm2RowProvenance | null
  /** Active attestations for honesty-tier badge upgrades (MVR only in v1) */
  attestations?: AttestationBadgeSummary[]
}

export default function PersonalInfoForm2({
  onNavigateToForm,
  onDataChange,
  initialData,
  sessionUserId,
  onSaveProgress,
  rowProvenance = null,
  attestations = [],
}: PersonalInfoForm2Props) {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const lockedInputClass = isDarkTheme(theme)
    ? 'bg-gray-800/80 cursor-not-allowed opacity-90'
    : 'bg-gray-100 cursor-not-allowed'
  const isIssuerRow = (row: { _source?: string } | undefined) =>
    row?._source === 'mvr' || row?._source === 'psp'
  const issuerKindLabel = (row: { _source?: string } | undefined) =>
    row?._source === 'psp' ? 'PSP' : 'MVR'
  const rowBadgeText = (kind: 'mvr' | 'psp'): string | null => {
    if (!rowProvenance) return null
    if (kind === 'psp') {
      if (!rowProvenance.pspResultId) return null
      return resolveMvrRowDotBadge(
        {
          kind: 'psp',
          accioOrderNumber: rowProvenance.pspAccioOrderNumber,
          asOf: rowProvenance.pspAsOf,
        },
        attestations,
      ).text
    }
    if (!rowProvenance.mvrResultId) return null
    return resolveMvrRowDotBadge(
      {
        kind: 'mvr',
        accioOrderNumber: rowProvenance.accioOrderNumber,
        asOf: rowProvenance.asOf,
        orderId: rowProvenance.orderId,
      },
      attestations,
    ).text
  }
  /** Form 1-style badge entry still used for MVR conviction rows that share Accio stamp */
  const rowBadgeEntry = (path: string): DotFieldProvenanceEntry | null => {
    if (!rowProvenance?.mvrResultId) return null
    return {
      path: path as DotFieldProvenanceEntry['path'],
      source: 'mvr',
      mvrResultId: rowProvenance.mvrResultId,
      orderId: rowProvenance.orderId,
      accioOrderNumber: rowProvenance.accioOrderNumber,
      asOf: rowProvenance.asOf ?? new Date().toISOString(),
      value: '',
    }
  }
  const [formData, setFormData] = useState({
    // Driving Experience
    drivingExperience: [
      {
        equipmentType: '',
        yearsOfExperience: '',
      },
    ],

    // Accident Record
    accidents: [
      {
        date: '',
        nature: '',
        fatalities: '',
        injuries: '',
        chemicalSpills: '',
        atFault: '',
        _source: 'self' as 'mvr' | 'psp' | 'self',
        _mvrKey: undefined as string | undefined,
        _pspKey: undefined as string | undefined,
      },
    ],
    hasNoAccidents: false,

    // Traffic Convictions
    convictions: [
      {
        dateConvicted: '',
        violation: '',
        stateOfViolation: '',
        penalty: '',
        _source: 'self' as 'mvr' | 'psp' | 'self',
        _mvrKey: undefined as string | undefined,
      },
    ],
    hasNoConvictions: false,
    // FMCSA PSP inspections (P3.7) — issuer-backed when _source:'psp'
    inspections: [] as Array<{
      date: string
      reportNumber: string
      level: string
      state: string
      result: string
      outOfService: string
      violationSummary: string
      _source?: 'psp' | 'self'
      _pspKey?: string
    }>,
    hasNoInspections: false,
    deniedLicense: '',
    deniedLicenseExplain: '',
    suspendedLicense: '',
    suspendedLicenseExplain: '',
    // Drug & Alcohol pre-employment (past 2 years)
    drugTestPositive: '',
    drugTestPositiveExplain: '',
    // 49 CFR 391.15 disqualifying convictions (past 3 years)
    cfr391ConvictedYesNo: '',
    cfr391ConvictedOffenses: [] as string[],
    cfr391ConvictedExplain: '',
  })

  const handleInputChange = (field: string, value: any, index?: number) => {
    // P3.7 — block edits to issuer-sourced accident/conviction/inspection rows
    if (
      index !== undefined &&
      (field === 'accidents' || field === 'convictions' || field === 'inspections') &&
      isIssuerRow(
        (formData as Record<string, Array<{ _source?: string }>>)[field]?.[index],
      )
    ) {
      return
    }
    if (field === 'hasNoAccidents' || field === 'hasNoConvictions' || field === 'hasNoInspections') {
      // Don't let "none" wipe issuer rows — server will re-project on save anyway
      const hasIssuer =
        field === 'hasNoAccidents'
          ? formData.accidents.some((a) => isIssuerRow(a))
          : field === 'hasNoConvictions'
            ? formData.convictions.some((c) => c._source === 'mvr')
            : formData.inspections.some((i) => i._source === 'psp')
      if (hasIssuer && value === true) return
    }

    setFormData((prev) => {
      if (index !== undefined) {
        if (typeof value === 'object') {
          return {
            ...prev,
            [field]: prev[field].map((item: any, i: number) =>
              i === index ? { ...item, ...value } : item
            ),
          }
        }
        const fieldName = Object.keys(value)[0]
        const fieldValue = value[fieldName]
        return {
          ...prev,
          [field]: prev[field].map((item: any, i: number) =>
            i === index ? { ...item, [fieldName]: fieldValue } : item
          ),
        }
      }
      if (typeof value === 'object') {
        return {
          ...prev,
          [field]: { ...prev[field], ...value },
        }
      }
      return {
        ...prev,
        [field]: value,
      }
    })
  }

  // Sync local edits up to the store. ONLY depend on formData — including
  // initialData / rowProvenance here caused React #185 (infinite setState loop).
  const initialMountRef = useRef(true)
  const onDataChangeRef = useRef(onDataChange)
  const rowProvenanceRef = useRef(rowProvenance)
  const initialDataRef = useRef(initialData)
  const lastSyncedJsonRef = useRef<string>('')
  onDataChangeRef.current = onDataChange
  rowProvenanceRef.current = rowProvenance
  initialDataRef.current = initialData

  useEffect(() => {
    if (initialMountRef.current && (!initialDataRef.current || Object.keys(initialDataRef.current).length === 0)) {
      initialMountRef.current = false
      return
    }
    initialMountRef.current = false

    const provenance =
      rowProvenanceRef.current ??
      (initialDataRef.current as { _rowProvenance?: DotForm2RowProvenance } | null)
        ?._rowProvenance
    const payload = provenance ? { ...formData, _rowProvenance: provenance } : formData

    let json: string
    try {
      json = JSON.stringify(payload)
    } catch {
      json = ''
    }
    if (json && json === lastSyncedJsonRef.current) return
    lastSyncedJsonRef.current = json
    onDataChangeRef.current?.(payload)
  }, [formData])

  // Initialize/restore from parent once to avoid loops
  const hasHydratedRef = useRef(false)
  const previousInitialDataRef = useRef<any>(null)
  useEffect(() => {
    // If initialData becomes null/undefined after having data, reset the form
    if (previousInitialDataRef.current && !initialData) {
      hasHydratedRef.current = false
      setFormData({
        drivingExperience: [{ equipmentType: '', yearsOfExperience: '' }],
        accidents: [{ date: '', nature: '', fatalities: '', injuries: '', chemicalSpills: '', atFault: '', _source: 'self' as const, _mvrKey: undefined as string | undefined, _pspKey: undefined as string | undefined }],
        hasNoAccidents: false,
        convictions: [{ dateConvicted: '', violation: '', stateOfViolation: '', penalty: '', _source: 'self' as const, _mvrKey: undefined as string | undefined }],
        hasNoConvictions: false,
        inspections: [],
        hasNoInspections: false,
        deniedLicense: '',
        deniedLicenseExplain: '',
        suspendedLicense: '',
        suspendedLicenseExplain: '',
        drugTestPositive: '',
        drugTestPositiveExplain: '',
        cfr391ConvictedYesNo: '',
        cfr391ConvictedOffenses: [],
        cfr391ConvictedExplain: '',
      })
    }
    previousInitialDataRef.current = initialData
    
    if (hasHydratedRef.current) return
    if (initialData && Object.keys(initialData).length > 0) {
      hasHydratedRef.current = true
      setFormData((prev) => {
        const merged = { ...prev, ...initialData }
        if (Array.isArray(merged.convictions)) {
          merged.convictions = merged.convictions.map((c: { stateOfViolation?: string; dateConvicted?: string; [k: string]: unknown }) => ({
            ...c,
            stateOfViolation: normalizeState(String(c.stateOfViolation ?? '')),
            dateConvicted: normalizeConvictionMonthYear(String(c.dateConvicted ?? '')),
          }))
        }
        return merged
      })
    }
  }, [initialData])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      // Driving Experience validation
      formData.drivingExperience.forEach((exp, index) => {
        if (!exp.equipmentType.trim())
          newErrors[`drivingExp${index}Equipment`] =
            'Equipment type is required'
        if (!exp.yearsOfExperience.trim())
          newErrors[`drivingExp${index}Years`] =
            'Years of experience is required'
      })
    } else if (step === 2) {
      // Accident Record validation
      if (!formData.hasNoAccidents) {
        formData.accidents.forEach((accident, index) => {
          if (accident.date.trim() || accident.nature.trim()) {
            if (!accident.date.trim())
              newErrors[`accident${index}Date`] = 'Accident date is required'
            if (!accident.nature.trim())
              newErrors[`accident${index}Nature`] =
                'Accident nature is required'
            if (!accident.atFault)
              newErrors[`accident${index}AtFault`] =
                'Please specify if at fault'
          }
        })
      }
    } else if (step === 3) {
      // Drug/alcohol pre-employment question
      if (!formData.drugTestPositive)
        newErrors.drugTestPositive = 'Please answer this question'
      // 49 CFR 391.15 question
      if (!formData.cfr391ConvictedYesNo)
        newErrors.cfr391ConvictedYesNo = 'Please answer this question'
      // Traffic Convictions
      formData.convictions.forEach((conviction, index) => {
        if (conviction.dateConvicted?.trim() || conviction.violation?.trim()) {
          if (!conviction.dateConvicted?.trim())
            newErrors[`conviction${index}Date`] = 'Conviction date is required'
          if (!conviction.violation?.trim())
            newErrors[`conviction${index}Violation`] = 'Violation description is required'
          // State is always stored as 2-letter code via StateSelect; require selection when row is used
          if (!conviction.stateOfViolation?.trim())
            newErrors[`conviction${index}State`] = 'State of violation is required'
        }
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } else {
        // Form is completed, navigate to Form 3
        onNavigateToForm?.(3)
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const addDrivingExperience = () => {
    setFormData((prev) => ({
      ...prev,
      drivingExperience: [
        ...prev.drivingExperience,
        {
          equipmentType: '',
          yearsOfExperience: '',
        },
      ],
    }))
  }

  const removeDrivingExperience = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      drivingExperience: prev.drivingExperience.filter((_, i) => i !== index),
    }))
  }

  const addAccident = () => {
    setFormData((prev) => ({
      ...prev,
      hasNoAccidents: false,
      accidents: [
        ...prev.accidents,
        {
          date: '',
          nature: '',
          fatalities: '',
          injuries: '',
          chemicalSpills: '',
          atFault: '',
          _source: 'self' as const,
          _mvrKey: undefined as string | undefined,
        },
      ],
    }))
  }

  const removeAccident = (index: number) => {
    if (isIssuerRow(formData.accidents[index])) return
    setFormData((prev) => ({
      ...prev,
      accidents: prev.accidents.filter((_, i) => i !== index),
    }))
  }

  const addConviction = () => {
    setFormData((prev) => ({
      ...prev,
      hasNoConvictions: false,
      convictions: [
        ...prev.convictions,
        {
          dateConvicted: '',
          violation: '',
          stateOfViolation: '',
          penalty: '',
          _source: 'self' as const,
          _mvrKey: undefined as string | undefined,
        },
      ],
    }))
  }

  const removeConviction = (index: number) => {
    if (isIssuerRow(formData.convictions[index])) return
    setFormData((prev) => ({
      ...prev,
      convictions: prev.convictions.filter((_, i) => i !== index),
    }))
  }

  const fillTestData = () => {
    // Smart fill: only fill EMPTY fields, preserve existing data
    setFormData((prev) => ({
      // Driving Experience - add test data only if empty
      drivingExperience: prev.drivingExperience?.length > 0 && prev.drivingExperience.some(exp => exp.equipmentType || exp.yearsOfExperience)
        ? prev.drivingExperience
        : [
            {
              equipmentType: 'TRACTOR & SEMI-TRAILER',
              yearsOfExperience: '5',
            },
            {
              equipmentType: 'STRAIGHT TRUCK',
              yearsOfExperience: '2',
            },
          ],
      
      // Accidents - add test data only if empty
      accidents: prev.accidents?.length > 0 && prev.accidents.some(acc => acc.date || acc.nature)
        ? prev.accidents
        : [
            {
              date: '2022-06-15',
              nature: 'Rear-end collision',
              fatalities: '0',
              injuries: '1',
              chemicalSpills: 'N',
              atFault: 'no',
              _source: 'self' as const,
              _mvrKey: undefined as string | undefined,
            },
          ],
      hasNoAccidents: prev.hasNoAccidents ?? false,
      
      // Convictions - add test data only if empty
      convictions: prev.convictions?.length > 0 && prev.convictions.some(conv => conv.dateConvicted || conv.violation)
        ? prev.convictions
        : [
            {
              dateConvicted: '03/2023',
              violation: 'Speeding - 15 mph over limit',
              stateOfViolation: 'OH',
              penalty: 'Fine $150, 2 points',
              _source: 'self' as const,
              _mvrKey: undefined as string | undefined,
            },
          ],
      hasNoConvictions: prev.hasNoConvictions ?? false,
      
      // License denial/suspension - only fill if empty
      deniedLicense: prev.deniedLicense || 'no',
      deniedLicenseExplain: prev.deniedLicenseExplain || '',
      suspendedLicense: prev.suspendedLicense || 'no',
      suspendedLicenseExplain: prev.suspendedLicenseExplain || '',
      // Drug/alcohol + CFR 391.15 - only fill if empty
      drugTestPositive: prev.drugTestPositive || 'no',
      drugTestPositiveExplain: prev.drugTestPositiveExplain || '',
      cfr391ConvictedYesNo: prev.cfr391ConvictedYesNo || 'no',
      cfr391ConvictedOffenses: prev.cfr391ConvictedOffenses || [],
      cfr391ConvictedExplain: prev.cfr391ConvictedExplain || '',
    }))
    setErrors({})
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderDrivingExperience()
      case 2: return renderAccidentRecord()
      case 3: return renderSafetyCompliance()
      default: return null
    }
  }

  const renderDrivingExperience = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          DRIVING EXPERIENCE
        </h2>
      </div>

      {formData.drivingExperience.map((experience, index) => (
        <div key={index} className='space-y-4'>
          <div className='flex justify-between items-center'>
            <h3
              className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
            >
              EXPERIENCE {index + 1}
            </h3>
            <button
              type='button'
              onClick={() => removeDrivingExperience(index)}
              className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                isDarkTheme(theme)
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              Remove
            </button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                TYPE OF EQUIPMENT
              </label>
              <select
                value={experience.equipmentType}
                onChange={(e) =>
                  handleInputChange(
                    'drivingExperience',
                    { equipmentType: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  isDarkTheme(theme)
                    ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                }`}
              >
                <option value=''>Select equipment type...</option>
                <option value='STRAIGHT TRUCK'>Straight Truck</option>
                <option value='TRACTOR & SEMI-TRAILER'>
                  Tractor & Semi-Trailer
                </option>
                <option value='TRACTOR & 2 TRAILERS'>
                  Tractor & 2 Trailers
                </option>
                <option value='TRACTOR & TANKER'>Tractor & Tanker</option>
                <option value='BUS'>Bus</option>
                <option value='MOTORCOACH'>Motorcoach</option>
                <option value='SCHOOL BUS'>School Bus</option>
                <option value='OTHER'>Other</option>
              </select>
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                YEARS OF EXPERIENCE
              </label>
              <input
                type='text'
                value={experience.yearsOfExperience}
                onChange={(e) =>
                  handleInputChange(
                    'drivingExperience',
                    { yearsOfExperience: e.target.value },
                    index
                  )
                }
                placeholder='e.g., 2.5, 5, 10+'
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  isDarkTheme(theme)
                    ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                }`}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add More Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={addDrivingExperience}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            isDarkTheme(theme)
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
          }`}
        >
          + Add Driving Experience
        </button>
      </div>
    </div>
  )

  const renderAccidentRecord = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          ACCIDENT RECORD FOR THE PAST 5 YEARS
        </h2>
        <p
          className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Attach additional sheet if more space is needed. Check this box if
          none
        </p>
      </div>

      {/* No Accidents Checkbox */}
      <div className='flex items-center space-x-3'>
        <input
          type='checkbox'
          id='hasNoAccidents'
          checked={formData.hasNoAccidents}
          disabled={formData.accidents.some((a) => isIssuerRow(a))}
          onChange={(e) =>
            handleInputChange('hasNoAccidents', e.target.checked)
          }
          className={`w-4 h-4 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'}`}
        />
        <label
          htmlFor='hasNoAccidents'
          className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Check this box if you have had no accidents in the past 5 years
        </label>
      </div>

      {!formData.hasNoAccidents && (
        <div className='space-y-6'>
          {formData.accidents.map((accident, index) => {
            const locked = isIssuerRow(accident)
            const badgeText =
              accident._source === 'psp' || accident._source === 'mvr'
                ? rowBadgeText(accident._source)
                : null
            return (
            <div key={accident._pspKey || accident._mvrKey || `acc-${index}`} className='space-y-4'>
              <div className='flex justify-between items-center'>
                <h3
                  className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
                >
                  ACCIDENT {index + 1}
                  {locked && (
                    <span
                      className={`ml-2 text-xs font-medium ${
                        isDarkTheme(theme) ? 'text-teal-300' : 'text-teal-700'
                      }`}
                    >
                      (from {issuerKindLabel(accident)})
                    </span>
                  )}
                </h3>
                {!locked && formData.accidents.length > 1 && (
                  <button
                    type='button'
                    onClick={() => removeAccident(index)}
                    className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                      isDarkTheme(theme)
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    Remove
                  </button>
                )}
              </div>
              {badgeText && (
                <p
                  className={`flex items-start gap-1 text-[11px] leading-snug ${
                    isDarkTheme(theme) ? 'text-teal-300/90' : 'text-teal-800'
                  }`}
                >
                  {badgeText}
                </p>
              )}
              {/* Label row uses min-h so multi-line labels don't push inputs down; keeps inputs aligned */}
              <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    DATE
                  </label>
                  <input
                    type='date'
                    value={accident.date}
                    disabled={locked}
                    readOnly={locked}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { date: e.target.value },
                        index
                      )
                    }
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${locked ? lockedInputClass : ''}`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    NATURE OF ACCIDENT
                  </label>
                  <input
                    type='text'
                    value={accident.nature}
                    disabled={locked}
                    readOnly={locked}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { nature: e.target.value },
                        index
                      )
                    }
                    placeholder='Head-on, rear-end, upset, etc.'
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${locked ? lockedInputClass : ''}`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    # FATALITIES
                  </label>
                  <input
                    type='text'
                    value={accident.fatalities}
                    disabled={locked}
                    readOnly={locked}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { fatalities: e.target.value },
                        index
                      )
                    }
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${locked ? lockedInputClass : ''}`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    # INJURIES
                  </label>
                  <input
                    type='text'
                    value={accident.injuries}
                    disabled={locked}
                    readOnly={locked}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { injuries: e.target.value },
                        index
                      )
                    }
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${locked ? lockedInputClass : ''}`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    CHEMICAL SPILLS (Y/N)
                  </label>
                  <input
                    type='text'
                    value={accident.chemicalSpills}
                    disabled={locked}
                    readOnly={locked}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { chemicalSpills: e.target.value },
                        index
                      )
                    }
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${locked ? lockedInputClass : ''}`}
                  />
                </div>
              </div>

              {/* At Fault Radio Buttons */}
              <div className='space-y-3'>
                <label
                  className={`block text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Were you at fault for this accident?
                </label>
                <div className='flex space-x-6'>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      name={`atFault-${index}`}
                      value='yes'
                      checked={accident.atFault === 'yes'}
                      disabled={locked}
                      onChange={(e) =>
                        handleInputChange(
                          'accidents',
                          { atFault: e.target.value },
                          index
                        )
                      }
                      className={`mr-2 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
                    />
                    <span
                      className={`${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      YES
                    </span>
                  </label>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      name={`atFault-${index}`}
                      value='no'
                      checked={accident.atFault === 'no'}
                      disabled={locked}
                      onChange={(e) =>
                        handleInputChange(
                          'accidents',
                          { atFault: e.target.value },
                          index
                        )
                      }
                      className={`mr-2 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
                    />
                    <span
                      className={`${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      NO
                    </span>
                  </label>
                </div>
              </div>
            </div>
            )
          })}

          {/* Add More Button — append-only self disclosures (391.21) */}
          <div className='flex justify-center pt-4'>
            <button
              type='button'
              onClick={addAccident}
              className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
                isDarkTheme(theme)
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
              }`}
            >
              + Add Accident
            </button>
          </div>
        </div>
      )}

      {/* FMCSA PSP inspections (P3.7) — shown when PSP projected rows or clean stamp */}
      {(formData.inspections.length > 0 ||
        formData.hasNoInspections ||
        Boolean(rowProvenance?.pspResultId)) && (
        <div className='mt-8 space-y-4 border-t pt-6 border-gray-200 dark:border-gray-700'>
          <h3
            className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
          >
            FMCSA Inspection History (PSP)
          </h3>
          <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
            Projected from your Pre-Employment Screening Program report. Rows are locked;
            you can still add a self-certified note below if needed.
          </p>
          {formData.hasNoInspections || formData.inspections.length === 0 ? (
            <p
              className={`text-sm rounded-md px-3 py-2 ${
                isDarkTheme(theme)
                  ? 'bg-teal-500/10 text-teal-200'
                  : 'bg-teal-50 text-teal-800'
              }`}
            >
              {rowBadgeText('psp') ?? 'No FMCSA inspections on file (PSP)'}
            </p>
          ) : (
            <div className='space-y-4'>
              {formData.inspections.map((insp, index) => {
                const locked = insp._source === 'psp'
                const badgeText = locked ? rowBadgeText('psp') : null
                return (
                  <div
                    key={insp._pspKey || `insp-${index}`}
                    className={`rounded-lg p-4 space-y-3 ${
                      locked
                        ? isDarkTheme(theme)
                          ? 'bg-teal-500/10 ring-1 ring-teal-500/30'
                          : 'bg-teal-50 ring-1 ring-teal-200'
                        : isDarkTheme(theme)
                          ? 'bg-gray-800'
                          : 'bg-gray-50'
                    }`}
                  >
                    <div className='flex justify-between items-center'>
                      <h4
                        className={`text-sm font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
                      >
                        INSPECTION {index + 1}
                        {locked && (
                          <span className='ml-2 text-xs font-medium text-teal-700 dark:text-teal-300'>
                            (from PSP)
                          </span>
                        )}
                      </h4>
                    </div>
                    {badgeText && (
                      <p
                        className={`text-[11px] ${isDarkTheme(theme) ? 'text-teal-300/90' : 'text-teal-800'}`}
                      >
                        {badgeText}
                      </p>
                    )}
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                      {(
                        [
                          ['date', 'Date'],
                          ['reportNumber', 'Report #'],
                          ['level', 'Level'],
                          ['state', 'State'],
                          ['result', 'Result'],
                          ['outOfService', 'Out of service'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <label
                            className={`block text-xs mb-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            {label}
                          </label>
                          <input
                            type='text'
                            value={insp[key] || ''}
                            disabled={locked}
                            readOnly={locked}
                            onChange={(e) =>
                              handleInputChange('inspections', { [key]: e.target.value }, index)
                            }
                            className={`w-full px-3 py-2 border rounded-md text-sm ${
                              isDarkTheme(theme)
                                ? 'bg-gray-700/50 border-gray-600 text-white'
                                : 'bg-white border-gray-200 text-gray-900'
                            } ${locked ? lockedInputClass : ''}`}
                          />
                        </div>
                      ))}
                    </div>
                    {insp.violationSummary && (
                      <p className={`text-xs ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>
                        Violations: {insp.violationSummary}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const toggleCfr391Offense = (key: string) => {
    setFormData(prev => {
      const current = prev.cfr391ConvictedOffenses || []
      return {
        ...prev,
        cfr391ConvictedOffenses: current.includes(key)
          ? current.filter(k => k !== key)
          : [...current, key],
      }
    })
  }

  const inputClass = `w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
    isDarkTheme(theme)
      ? 'bg-gray-700/50 border-gray-600 text-white'
      : 'bg-white border-gray-200 text-gray-900'
  }`

  // DOT asks for convictions in the past 3 years — disable months before this boundary
  const convictionMinBoundary = useMemo(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 3)
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }, [])

  const renderSafetyCompliance = () => (
    <div className='space-y-10'>

      {/* ── Block 1: Drug & Alcohol Pre-Employment (49 CFR 40.25) ─────── */}
      <div className='space-y-4'>
        <div className='text-center'>
          <h2 className={`text-2xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
            SAFETY &amp; COMPLIANCE HISTORY
          </h2>
        </div>

        <div className={`p-5 rounded-xl border-2 ${isDarkTheme(theme) ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-yellow-400 bg-yellow-50'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-700'}`}>
            Drug &amp; Alcohol — 49 CFR 40.25 (Past 2 Years)
          </p>
          <p className={`text-sm mb-4 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
            Within the past two years, have you tested positive, or refused to test, on a pre-employment drug or alcohol test by an employer to whom you applied, but did not obtain, safety-sensitive transportation work covered by DOT agency drug and alcohol testing rules?
          </p>
          <div className='flex gap-6'>
            {['yes', 'no'].map(val => (
              <label key={val} className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='drugTestPositive'
                  value={val}
                  checked={formData.drugTestPositive === val}
                  onChange={e => handleInputChange('drugTestPositive', e.target.value)}
                  className='accent-indigo-500'
                />
                <span className={`font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>{val.toUpperCase()}</span>
              </label>
            ))}
          </div>
          {errors.drugTestPositive && <p className='mt-2 text-sm text-red-500'>{errors.drugTestPositive}</p>}
          {formData.drugTestPositive === 'yes' && (
            <div className='mt-4'>
              <label className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                Please explain:
              </label>
              <textarea
                value={formData.drugTestPositiveExplain}
                onChange={e => handleInputChange('drugTestPositiveExplain', e.target.value)}
                rows={3}
                className={inputClass}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Block 2: 49 CFR 391.15 Criminal Convictions ──────────────── */}
      <div className={`p-5 rounded-xl border-2 ${isDarkTheme(theme) ? 'border-red-500/40 bg-red-500/5' : 'border-red-300 bg-red-50'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDarkTheme(theme) ? 'text-red-400' : 'text-red-700'}`}>
          Disqualifying Convictions — 49 CFR 391.15 (Past 3 Years)
        </p>
        <p className={`text-sm mb-3 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
          In the past three (3) years, have you ever been convicted of any of the following offenses? Review the list, then answer Yes or No.
        </p>
        {/* Show covered offenses before Yes/No so drivers know what the question means (hidden after "Yes" — same items appear as checkboxes below). */}
        {formData.cfr391ConvictedYesNo !== 'yes' && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs space-y-1.5 max-h-[min(50vh,22rem)] overflow-y-auto border ${
              isDarkTheme(theme) ? 'bg-gray-800/80 border-gray-700 text-gray-300' : 'bg-white border-red-200 text-gray-700'
            }`}
          >
            <p className={`font-semibold text-sm mb-2 ${isDarkTheme(theme) ? 'text-red-300' : 'text-red-800'}`}>
              Covered offenses
            </p>
            {CFR391_OFFENSES.map((o) => (
              <p key={o.key} className='leading-snug'>
                • {o.label}
              </p>
            ))}
          </div>
        )}
        <div className='flex gap-6 mb-4'>
          {['yes', 'no'].map(val => (
            <label key={val} className='flex items-center gap-2 cursor-pointer'>
              <input
                type='radio'
                name='cfr391ConvictedYesNo'
                value={val}
                checked={formData.cfr391ConvictedYesNo === val}
                onChange={e => handleInputChange('cfr391ConvictedYesNo', e.target.value)}
                className='accent-indigo-500'
              />
              <span className={`font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>{val.toUpperCase()}</span>
            </label>
          ))}
        </div>
        {errors.cfr391ConvictedYesNo && <p className='mb-3 text-sm text-red-500'>{errors.cfr391ConvictedYesNo}</p>}

        {formData.cfr391ConvictedYesNo === 'yes' && (
          <div className='space-y-3 mt-2'>
            <p className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>Select all that apply:</p>
            {CFR391_OFFENSES.map(offense => (
              <label key={offense.key} className='flex items-start gap-3 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={(formData.cfr391ConvictedOffenses || []).includes(offense.key)}
                  onChange={() => toggleCfr391Offense(offense.key)}
                  className='mt-0.5 h-4 w-4 accent-indigo-500 flex-shrink-0'
                />
                <span className={`text-sm ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>{offense.label}</span>
              </label>
            ))}
            <div className='mt-3'>
              <label className={`block text-sm font-medium mb-1 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                Please provide details:
              </label>
              <textarea
                value={formData.cfr391ConvictedExplain}
                onChange={e => handleInputChange('cfr391ConvictedExplain', e.target.value)}
                rows={3}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Block 3: Traffic Convictions Table ───────────────────────── */}
      <div className='space-y-6'>
      <div className='text-center'>
        <h2 className={`text-2xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}>
          TRAFFIC CONVICTIONS AND FORFEITURES FOR THE PAST 3 YEARS
        </h2>
        <p className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}>(OTHER THAN PARKING VIOLATIONS)</p>
      </div>

      {/* No Convictions Checkbox */}
      <div className='flex items-center space-x-3'>
        <input
          type='checkbox'
          id='hasNoConvictions'
          checked={formData.hasNoConvictions}
          disabled={formData.convictions.some((c) => c._source === 'mvr')}
          onChange={(e) =>
            handleInputChange('hasNoConvictions', e.target.checked)
          }
          className={`w-4 h-4 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'}`}
        />
        <label
          htmlFor='hasNoConvictions'
          className={`text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Check this box if you have had no convictions in the past 3 years
        </label>
      </div>

      {!formData.hasNoConvictions && (
        <div className='space-y-6'>
          {formData.convictions.map((conviction, index) => {
            const locked = isIssuerRow(conviction)
            const badge = locked && conviction._source === 'mvr'
              ? rowBadgeEntry(`convictions.${index}`)
              : null
            return (
            <div key={conviction._mvrKey || `conv-${index}`} className='space-y-4'>
              <div className='flex justify-between items-center'>
                <h3
                  className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
                >
                  CONVICTION {index + 1}
                  {locked && (
                    <span
                      className={`ml-2 text-xs font-medium ${
                        isDarkTheme(theme) ? 'text-teal-300' : 'text-teal-700'
                      }`}
                    >
                      (from {issuerKindLabel(conviction)})
                    </span>
                  )}
                </h3>
                {!locked && formData.convictions.length > 1 && (
                  <button
                    type='button'
                    onClick={() => removeConviction(index)}
                    className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                      isDarkTheme(theme)
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    Remove
                  </button>
                )}
              </div>
              {badge && <VerifiedFieldBadge entry={badge} attestations={attestations} />}
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    DATE CONVICTED
                  </label>
                  {locked ? (
                    <input
                      type='text'
                      value={conviction.dateConvicted}
                      disabled
                      readOnly
                      className={`w-full px-4 py-3 border-2 rounded-md ${
                        isDarkTheme(theme)
                          ? 'border-gray-600 text-white rounded-lg'
                          : 'border-gray-200 text-gray-900 rounded-lg'
                      } ${lockedInputClass}`}
                    />
                  ) : (
                    <MonthYearPicker
                      value={conviction.dateConvicted}
                      onChange={(v) =>
                        handleInputChange('convictions', { dateConvicted: v }, index)
                      }
                      placeholder='Select month & year'
                      allowPresent={false}
                      error={!!errors[`conviction${index}Date`]}
                      theme={isDarkTheme(theme) ? 'dark' : 'light'}
                      minDate={convictionMinBoundary}
                    />
                  )}
                  {errors[`conviction${index}Date`] && (
                    <p className='mt-1 text-sm text-red-500'>{errors[`conviction${index}Date`]}</p>
                  )}
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    VIOLATION
                  </label>
                  <input
                    type='text'
                    value={conviction.violation}
                    disabled={locked}
                    readOnly={locked}
                    onChange={(e) =>
                      handleInputChange(
                        'convictions',
                        { violation: e.target.value },
                        index
                      )
                    }
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${locked ? lockedInputClass : ''}`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    htmlFor={`conviction-state-${index}`}
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    STATE OF VIOLATION
                  </label>
                  <StateSelect
                    id={`conviction-state-${index}`}
                    name={`conviction-state-${index}`}
                    value={conviction.stateOfViolation}
                    disabled={locked}
                    onChange={(value) =>
                      handleInputChange('convictions', { stateOfViolation: value }, index)
                    }
                    className={`${inputClass} ${locked ? lockedInputClass : ''}`}
                  />
                  {errors[`conviction${index}State`] && (
                    <p className='mt-1 text-sm text-red-500'>{errors[`conviction${index}State`]}</p>
                  )}
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    PENALTY
                  </label>
                  <input
                    type='text'
                    value={conviction.penalty}
                    disabled={locked}
                    readOnly={locked}
                    onChange={(e) =>
                      handleInputChange(
                        'convictions',
                        { penalty: e.target.value },
                        index
                      )
                    }
                    placeholder='Forfeited bond, collateral and/or points'
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${locked ? lockedInputClass : ''}`}
                  />
                </div>
              </div>
            </div>
            )
          })}

          {/* Add More — append-only self disclosures */}
          <div className='flex justify-center pt-4'>
            <button
              type='button'
              onClick={addConviction}
              className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
                isDarkTheme(theme)
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
              }`}
            >
              + Add Conviction
            </button>
          </div>
        </div>
      )}

      {/* License Questions */}
      <div className='space-y-6'>
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Have you ever been denied a license, permit, or privilege to operate
            a motor vehicle?
          </label>
          <div className='flex space-x-6'>
            <label className='flex items-center'>
              <input
                type='radio'
                name='deniedLicense'
                value='yes'
                checked={formData.deniedLicense === 'yes'}
                onChange={(e) =>
                  handleInputChange('deniedLicense', e.target.value)
                }
                className={`mr-2 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                YES
              </span>
            </label>
            <label className='flex items-center'>
              <input
                type='radio'
                name='deniedLicense'
                value='no'
                checked={formData.deniedLicense === 'no'}
                onChange={(e) =>
                  handleInputChange('deniedLicense', e.target.value)
                }
                className={`mr-2 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                NO
              </span>
            </label>
          </div>
          {formData.deniedLicense === 'yes' && (
            <div className='mt-3'>
              <label
                className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                If yes, explain:
              </label>
              <textarea
                value={formData.deniedLicenseExplain}
                onChange={(e) =>
                  handleInputChange('deniedLicenseExplain', e.target.value)
                }
                rows={3}
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  isDarkTheme(theme)
                    ? 'bg-white border-gray-300 text-gray-900 focus:ring-teal-400 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-teal-500'
                }`}
              />
            </div>
          )}
        </div>

        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Has any license, permit, or privilege ever been suspended or
            revoked?
          </label>
          <div className='flex space-x-6'>
            <label className='flex items-center'>
              <input
                type='radio'
                name='suspendedLicense'
                value='yes'
                checked={formData.suspendedLicense === 'yes'}
                onChange={(e) =>
                  handleInputChange('suspendedLicense', e.target.value)
                }
                className={`mr-2 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                YES
              </span>
            </label>
            <label className='flex items-center'>
              <input
                type='radio'
                name='suspendedLicense'
                value='no'
                checked={formData.suspendedLicense === 'no'}
                onChange={(e) =>
                  handleInputChange('suspendedLicense', e.target.value)
                }
                className={`mr-2 ${isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                NO
              </span>
            </label>
          </div>
          {formData.suspendedLicense === 'yes' && (
            <div className='mt-3'>
              <label
                className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}
              >
                If yes, explain:
              </label>
              <textarea
                value={formData.suspendedLicenseExplain}
                onChange={(e) =>
                  handleInputChange('suspendedLicenseExplain', e.target.value)
                }
                rows={3}
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  isDarkTheme(theme)
                    ? 'bg-white border-gray-300 text-gray-900 focus:ring-teal-400 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-teal-500'
                }`}
              />
            </div>
          )}
        </div>
      </div>
      </div>{/* end Block 3 */}
    </div>
  )

  const cardClass =
    isDarkTheme(theme)
      ? 'rounded-2xl border border-gray-700 bg-gray-800/50 shadow-lg'
      : 'rounded-2xl border border-gray-200 bg-white/70 shadow-lg'

  return (
    <div className={`max-w-4xl mx-auto relative z-10 ${cardClass}`}>
      {/* Header */}
      <div
        className={`text-center py-8 px-6 border-b ${
          isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <h1
          className={`text-2xl font-bold mb-2 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          Driver Employment Application
        </h1>
        <p
          className={`text-base ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          [COMPANY NAME, ADDRESS, PHONE NUMBER, AND EMAIL]
        </p>
        <p
          className={`text-sm mt-1 ${
            isDarkTheme(theme) ? 'text-gray-500' : 'text-gray-500'
          }`}
        >
          An Equal Opportunity Employer
        </p>
        <p
          className={`text-sm font-semibold mt-2 ${
            isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
          }`}
        >
          Complete in full or it will not be considered.
        </p>

        {/* Save and Test Data Buttons */}
        <div className='mt-4 flex flex-wrap items-center gap-3'>
          <SaveProgressButton
            onSaveProgress={onSaveProgress}
            sessionUserId={sessionUserId}
          />
          <button
            type='button'
            onClick={fillTestData}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow hover:shadow-md ${
              isDarkTheme(theme)
                ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
                : 'bg-yellow-500 text-white hover:bg-yellow-400'
            }`}
            title='Fill test data'
          >
            <span>⚡</span>
            <span>Fill Test Data</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className='px-6 py-4'>
        <div className='flex items-center justify-between mb-4'>
          <div
            className={`text-sm font-medium ${
              isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
            }`}
          >
            Step {currentStep} of {STEPS.length}
          </div>
          <div
            className={`text-sm ${
              isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {Math.round((currentStep / STEPS.length) * 100)}% Complete
          </div>
        </div>
        <div
          className={`w-full bg-gray-200 rounded-full h-2 ${
            isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'
          }`}
        >
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isDarkTheme(theme)
                ? 'bg-indigo-500'
                : 'bg-indigo-600'
            }`}
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className='px-6 py-8'>{renderStepContent()}</div>

      {/* Navigation */}
      <div
        className={`flex justify-between items-center px-6 py-8 border-t-2 ${
          isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
            currentStep === 1
              ? 'opacity-50 cursor-not-allowed'
              : isDarkTheme(theme)
                ? 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
          }`}
        >
          Previous
        </button>

        <div className='flex space-x-2 mx-8'>
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`w-3 h-3 rounded-full ${
                step.id <= currentStep
                  ? isDarkTheme(theme)
                    ? 'bg-indigo-500'
                    : 'bg-indigo-600'
                  : isDarkTheme(theme)
                    ? 'bg-gray-600'
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <button
          onClick={nextStep}
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
            isDarkTheme(theme)
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
          }`}
        >
          {currentStep === STEPS.length ? 'Continue to Form 3' : 'Next'}
        </button>
      </div>
    </div>
  )
}
