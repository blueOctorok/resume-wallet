'use client'

import { isDotFormDark as isDarkTheme, DOT_PAPER_CARD, DOT_PAPER_LOCKED } from '@/lib/dot-form-paper'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'
import SaveProgressButton from './SaveProgressButton'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import { Briefcase, Clock, Truck, Shield, X, Plus, ChevronDown } from 'lucide-react'
import AskStormiButton from '@/components/ui/AskStormiButton'
import {
  CDL_CERTIFICATION_OPTIONS,
  addCertification,
  joinCertifications,
  parseCertifications,
} from '@/lib/cdl-certifications'
import { MonthYearPicker, parseDateToNumber } from '@/components/ui/MonthYearPicker'
import { resolveEmploymentDotBadge, type AttestationBadgeSummary } from '@/lib/dot-attestation-badge'
import type { DotForm3EmployerProvenance } from '@/lib/employment-form3-provenance'
import {
  DotFieldError,
  DotValidationBanner,
  dotErrorInputClass,
  scrollToDotValidationErrors,
} from './dot-form-validation'

// History entry types
type HistoryEntryType = 'employment' | 'unemployment' | 'school' | 'drivingSchool' | 'military'

// Per-entry labels. Legacy 'school' entries (from before School/Education was
// merged into CDL/School) still render — grouped under the CDL/School section.
const HISTORY_TYPES = [
  { value: 'employment' as const, label: 'Employment / Contract' },
  { value: 'unemployment' as const, label: 'Unemployment' },
  { value: 'school' as const, label: 'College / High School' },
  { value: 'drivingSchool' as const, label: 'Driving School' },
  { value: 'military' as const, label: 'Military Service' },
]

// The four history sections shown on the Employment History step, in fixed order.
// Required sections always show at least one ready-to-fill card (auto-seeded);
// optional sections start as a dashed "add if it applies" placeholder.
type HistoryGroup = 'employment' | 'drivingSchool' | 'unemployment' | 'military'

const HISTORY_SECTIONS: Array<{
  group: HistoryGroup
  /** Entry type auto-seeded when a required section has no entries. */
  seedType: HistoryEntryType
  label: string
  required: boolean
  description: string
  /** One add button per entry type the section accepts; first one is primary. */
  addActions: Array<{ type: HistoryEntryType; label: string }>
  icon: typeof Briefcase
  color: string
}> = [
  {
    group: 'employment',
    seedType: 'employment',
    label: 'Employment',
    required: true,
    description: 'Every job or contract position in the last 10 years — start with your most recent.',
    addActions: [{ type: 'employment', label: 'Add another employer' }],
    icon: Briefcase,
    color: 'bg-[#173150]',
  },
  {
    group: 'drivingSchool',
    seedType: 'drivingSchool',
    label: 'CDL / School',
    required: true,
    description: 'Where you earned your CDL and which classes or endorsements you hold. College or high school is optional.',
    addActions: [
      { type: 'drivingSchool', label: 'Add driving school' },
      { type: 'school', label: 'Add college or high school' },
    ],
    icon: Truck,
    color: 'bg-[#f15a2b]',
  },
  {
    group: 'unemployment',
    seedType: 'unemployment',
    label: 'Unemployment',
    required: false,
    description: 'Time between jobs — only dates are needed. Adding gaps keeps your 10-year timeline airtight.',
    addActions: [{ type: 'unemployment', label: 'Add unemployment period' }],
    icon: Clock,
    color: 'bg-[#3F8A8C]',
  },
  {
    group: 'military',
    seedType: 'military',
    label: 'Military Service',
    required: false,
    description: 'Branch, dates, and role. Military driving experience is a strong signal for carriers.',
    addActions: [{ type: 'military', label: 'Add military service' }],
    icon: Shield,
    color: 'bg-[#00608b]',
  },
]

// Which section an entry renders under. Legacy 'school' entries merge into the
// CDL/School section; entries with no type fall back to the old isUnemployment flag.
const entryGroupOf = (entry: { type?: HistoryEntryType; isUnemployment?: boolean }): HistoryGroup => {
  const type = entry.type || (entry.isUnemployment ? 'unemployment' : 'employment')
  if (type === 'school' || type === 'drivingSchool') return 'drivingSchool'
  if (type === 'unemployment' || type === 'military') return type
  return 'employment'
}

// Blank entry factory — shared by the section add buttons and the auto-seed
// effect that keeps required sections populated with a ready-to-fill card.
const blankHistoryEntry = (type: HistoryEntryType) => ({
  id:
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  name: '',
  phone: '',
  hiringManagerName: '',
  hiringManagerPhone: '',
  hiringManagerEmail: '',
  address: '',
  positionHeld: '',
  duties: '',
  fromDate: '',
  toDate: '',
  reasonForLeaving: '',
  salary: '',
  gapsInEmployment: '',
  subjectToFMCSR: '',
  safetySensitiveFunction: '',
  isUnemployment: type === 'unemployment',
  schoolName: '',
  courseOfStudy: '',
  militaryBranch: '',
  dischargeType: '',
  _source: 'self' as const,
})

// Stable identity for collapse state + React keys. Falls back to array index
// for very old drafts whose entries predate generated ids.
const entryCardKey = (entry: { id?: string; _evrKey?: string }, index: number) =>
  entry.id || entry._evrKey || `emp-${index}`

// Education is no longer its own step — the required CDL / School section in
// Employment History already documents schooling for the 10-year timeline.
const STEPS = [
  {
    id: 1,
    title: 'Employment History',
    description: 'Current and previous employment details',
  },
  {
    id: 2,
    title: 'Signature',
    description: 'Application completion and signature',
  },
]

interface PersonalInfoForm3Props {
  onComplete?: () => void
  onDataChange?: (data: any) => void
  initialData?: any
  sessionUserId?: string
  /** Centralized save function - saves ALL forms to driver profile */
  onSaveProgress?: () => Promise<boolean | undefined>
  /** Active attestations for honesty-tier badge upgrades on EVR rows */
  attestations?: AttestationBadgeSummary[]
}

export default function PersonalInfoForm3({
  onComplete,
  onDataChange,
  initialData,
  sessionUserId,
  onSaveProgress,
  attestations = [],
}: PersonalInfoForm3Props) {
  const { theme } = useTheme()
  const { requestHelp } = useAssistantBridge()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Per-entry collapse state, keyed by entryCardKey (local UI toggle only)
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({})
  
  const [formData, setFormData] = useState({
    // Employment History - now with entry type
    employers: [] as Array<{
      id?: string
      type: HistoryEntryType
      name: string
      phone: string
      email?: string
      hiringManagerName?: string
      hiringManagerPhone?: string
      hiringManagerEmail?: string
      address: string
      positionHeld: string
      duties: string
      fromDate: string
      toDate: string
      reasonForLeaving: string
      salary: string
      gapsInEmployment: string
      subjectToFMCSR: string
      safetySensitiveFunction: string
      isUnemployment: boolean
      /** Skip EV packet for this employer (default on current / Present jobs). */
      doNotContact?: boolean
      schoolName?: string
      courseOfStudy?: string
      militaryBranch?: string
      dischargeType?: string
      _source?: 'verified' | 'self'
      _verificationRequestId?: string
      _evrKey?: string
      _verificationStatus?: string
      _verifiedAt?: string
    }>,

    // Signature
    applicantSignature: '',
    signatureDate: '',
    applicantNamePrinted: '',
    safetyPerformanceHistoryAcknowledgement: false,
    safetyPerformanceInquiryConsent: false,
    roadTestAcknowledgement: false,
    hasPreviousRoadTest: '',
    previousRoadTestDetails: '',
    hasValidCDL: '',
    roadTestCertificateFiles: [],
    medicalCertificateFiles: [],
    dqFileAcknowledgement: false,
    dqHasApplicationComplete: '',
    dqHasRoadTestDocs: '',
    dqHasMedicalDocs: '',
    dqUnderstandsRetention: '',
    dqInvestigationConsent: false,
    dqHasInvestigationRecords: '',
    dqUnderstandsAccessControls: '',
    // Electronic signature metadata
    signedAt: '',
    ipAddress: '',
    fcraAcknowledgement: false,
  })

  const lockedInputClass = DOT_PAPER_LOCKED
  const isVerifiedEmployer = (row: { _source?: string } | undefined) =>
    row?._source === 'verified'

  const handleInputChange = (field: string, value: any, index?: number) => {
    // P3.7 — block edits to prior-employer-verified employment rows
    if (
      index !== undefined &&
      field === 'employers' &&
      isVerifiedEmployer(formData.employers[index])
    ) {
      return
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

  // Sync form data to parent component
  // Don't sync on initial mount if initialData is null (reset scenario)
  // But DO sync after user makes any changes
  const initialMountRef = useRef(true)
  const employerProvenanceRef = useRef<DotForm3EmployerProvenance | null>(null)
  employerProvenanceRef.current =
    (initialData as { _employerProvenance?: DotForm3EmployerProvenance } | null)
      ?._employerProvenance ?? null

  useEffect(() => {
    // On initial mount with no data, don't sync the empty form state
    if (initialMountRef.current && (!initialData || Object.keys(initialData).length === 0)) {
      initialMountRef.current = false
      return
    }
    // After initial mount, or if we have initialData, always sync
    initialMountRef.current = false
    const provenance = employerProvenanceRef.current
    onDataChange?.(
      provenance ? { ...formData, _employerProvenance: provenance } : formData,
    )
  }, [formData, onDataChange, initialData])

  // Initialize/restore from parent once to avoid loops
  const hasHydratedRef = useRef(false)
  const previousInitialDataRef = useRef<any>(null)
  useEffect(() => {
    // If initialData becomes null/undefined after having data, reset the form
    if (previousInitialDataRef.current && !initialData) {
      hasHydratedRef.current = false
      setFormData({
        employers: [
          {
            type: 'employment' as const,
            name: '',
            phone: '',
            hiringManagerName: '',
            hiringManagerPhone: '',
            hiringManagerEmail: '',
            address: '',
            positionHeld: '',
            duties: '',
            fromDate: '',
            toDate: '',
            reasonForLeaving: '',
            salary: '',
            gapsInEmployment: '',
            subjectToFMCSR: '',
            safetySensitiveFunction: '',
            isUnemployment: false,
            schoolName: '',
            courseOfStudy: '',
            militaryBranch: '',
            dischargeType: '',
          },
        ],
        applicantSignature: '',
        signatureDate: '',
        applicantNamePrinted: '',
        safetyPerformanceHistoryAcknowledgement: false,
        safetyPerformanceInquiryConsent: false,
        roadTestAcknowledgement: false,
        hasPreviousRoadTest: '',
        previousRoadTestDetails: '',
        hasValidCDL: '',
        roadTestCertificateFiles: [],
        medicalCertificateFiles: [],
        dqFileAcknowledgement: false,
        dqHasApplicationComplete: '',
        dqHasRoadTestDocs: '',
        dqHasMedicalDocs: '',
        dqUnderstandsRetention: '',
        dqInvestigationConsent: false,
        dqHasInvestigationRecords: '',
        dqUnderstandsAccessControls: '',
        signedAt: '',
        ipAddress: '',
        fcraAcknowledgement: false,
      })
    }
    previousInitialDataRef.current = initialData
    
    if (hasHydratedRef.current) return
    if (initialData && Object.keys(initialData).length > 0) {
      hasHydratedRef.current = true
      setFormData((prev) => {
        const merged = { ...prev, ...initialData }
        if (!Array.isArray(merged.employers)) merged.employers = prev.employers
        return merged
      })
    }
  }, [initialData])

  // Required history sections (Employment, CDL/School) always show a
  // ready-to-fill card — if a group has no entry (fresh form, hydrated draft
  // from before CDL/School was required, or the driver removed the last one),
  // seed a blank entry so the section never collapses to nothing.
  // Runs after the hydrate effect above, so functional updates see merged data.
  useEffect(() => {
    setFormData((prev) => {
      const missing = HISTORY_SECTIONS.filter(
        (section) =>
          section.required &&
          !prev.employers.some((entry) => entryGroupOf(entry) === section.group),
      )
      if (missing.length === 0) return prev
      return {
        ...prev,
        employers: [...prev.employers, ...missing.map((section) => blankHistoryEntry(section.seedType))],
      }
    })
  }, [formData.employers])

  // Employment cards are long, so filled-in entries (loaded drafts, verified
  // rows) start collapsed to a one-line summary; blank/new entries start open.
  // The default is snapshotted ONCE per entry — otherwise a card would collapse
  // itself mid-edit the moment its fields became "complete".
  useEffect(() => {
    setCollapsedEntries((prev) => {
      let changed = false
      const next = { ...prev }
      formData.employers.forEach((employer, index) => {
        const key = entryCardKey(employer, index)
        if (next[key] === undefined) {
          next[key] = Boolean(
            employer.fromDate && employer.toDate && (employer.name || employer.militaryBranch),
          )
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [formData.employers])

  // Capture IP address on mount — stored in form data so it's saved with the signature
  useEffect(() => {
    if (formData.ipAddress) return // already captured (e.g. loaded from saved data)
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then((d: { ip: string }) => handleInputChange('ipAddress', d.ip))
      .catch(() => {/* non-fatal — IP capture is best-effort */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-set signedAt timestamp the first time the applicant types their signature
  useEffect(() => {
    if (formData.applicantSignature && !formData.signedAt) {
      handleInputChange('signedAt', new Date().toISOString())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.applicantSignature])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      // Employment History validation
      let totalYearsCovered = 0
      const today = new Date()
      const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())
      
      // Helper to parse dates
      const parseDate = (dateStr: string, isEndDate = false): Date | null => {
        if (!dateStr || dateStr.toLowerCase() === 'present') return today
        const trimmed = dateStr.trim()
        
        const getLastDayOfMonth = (year: number, month: number) => new Date(year, month + 1, 0)
        
        // Try MM/YYYY or MM/YY format
        const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{2,4})$/)
        if (slashMatch) {
          const month = parseInt(slashMatch[1]) - 1
          let year = parseInt(slashMatch[2])
          if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
          if (month >= 0 && month < 12) {
            return isEndDate ? getLastDayOfMonth(year, month) : new Date(year, month, 1)
          }
        }
        
        // Try MM-YYYY format
        const dashMatch = trimmed.match(/^(\d{1,2})-(\d{2,4})$/)
        if (dashMatch) {
          const month = parseInt(dashMatch[1]) - 1
          let year = parseInt(dashMatch[2])
          if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
          if (month >= 0 && month < 12) {
            return isEndDate ? getLastDayOfMonth(year, month) : new Date(year, month, 1)
          }
        }
        
        // Try YYYY-MM format
        const reversedMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})$/)
        if (reversedMatch) {
          const year = parseInt(reversedMatch[1])
          const month = parseInt(reversedMatch[2]) - 1
          if (month >= 0 && month < 12) {
            return isEndDate ? getLastDayOfMonth(year, month) : new Date(year, month, 1)
          }
        }
        
        // Fallback
        const isoDate = new Date(trimmed)
        return isNaN(isoDate.getTime()) ? null : isoDate
      }

      ;(formData.employers ?? []).forEach((employer, index) => {
        // Check both old flag and new type field
        const isUnemploymentEntry = employer.isUnemployment || employer.type === 'unemployment'
        const isSchoolEntry = employer.type === 'school' || employer.type === 'drivingSchool'
        const isMilitaryEntry = employer.type === 'military'
        
        // Validate employer details ONLY for actual employers (not unemployment/school/military)
        if (!isUnemploymentEntry && !isSchoolEntry && !isMilitaryEntry) {
          if (!employer.name.trim())
            newErrors[`employer${index}Name`] = 'Employer name is required (DOT § 383.35)'
          if (!employer.address.trim()) {
            if (index < 3) {
              newErrors[`employer${index}Address`] = 'Employer address is required for verification (DOT § 383.35)'
            } else {
              newErrors[`employer${index}Address`] = 'Employer address is required (DOT § 383.35)'
            }
          }
          if (!employer.fromDate)
            newErrors[`employer${index}FromDate`] = 'Start date is required (DOT § 383.35)'
          if (!employer.toDate)
            newErrors[`employer${index}ToDate`] = 'End date is required (DOT § 383.35)'
          // Only require reason for leaving for PAST jobs (not current employment with "Present")
          const isCurrentJob = employer.toDate?.toLowerCase() === 'present'
          if (!isCurrentJob && !employer.reasonForLeaving.trim())
            newErrors[`employer${index}Reason`] = 'Reason for leaving is required (DOT § 383.35(c)(3))'
          if (!employer.subjectToFMCSR)
            newErrors[`employer${index}FMCSR`] = 'Please specify FMCSR compliance'
          if (!employer.safetySensitiveFunction)
            newErrors[`employer${index}Safety`] = 'Please specify safety-sensitive function'
        } else if (isUnemploymentEntry) {
          // Unemployment periods only need dates
          if (!employer.fromDate)
            newErrors[`employer${index}FromDate`] = 'Start date is required'
          if (!employer.toDate)
            newErrors[`employer${index}ToDate`] = 'End date is required (use "Present" if still unemployed)'
        } else if (isSchoolEntry) {
          // School entries need name and dates
          if (!employer.name.trim())
            newErrors[`employer${index}Name`] = 'School name is required'
          if (!employer.fromDate)
            newErrors[`employer${index}FromDate`] = 'Start date is required'
          if (!employer.toDate)
            newErrors[`employer${index}ToDate`] = 'End date is required'
        } else if (isMilitaryEntry) {
          // Military entries need branch and dates
          if (!employer.militaryBranch && !employer.name.trim())
            newErrors[`employer${index}Name`] = 'Branch of service is required'
          if (!employer.fromDate)
            newErrors[`employer${index}FromDate`] = 'Start date is required'
          if (!employer.toDate)
            newErrors[`employer${index}ToDate`] = 'End date is required'
        }

        // Calculate years covered for ALL entries (employment AND unemployment)
        if (employer.fromDate && employer.toDate) {
          const fromDate = parseDate(employer.fromDate, false)
          const toDate = parseDate(employer.toDate, true)
          
          if (fromDate && toDate) {
            const periodStart = fromDate > tenYearsAgo ? fromDate : tenYearsAgo
            const periodEnd = toDate < today ? toDate : today
            
            if (periodStart <= periodEnd) {
              const years = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
              totalYearsCovered += Math.max(0, years)
            }
          }
        }
      })

      // DOT § 383.35: Must cover 10 years (with small tolerance for rounding)
      const YEARS_REQUIRED = 10
      const TOLERANCE = 0.1 // Allow 9.9+ years to pass
      
      // Check if user has current unemployment (covers "present")
      const hasCurrentUnemployment = formData.employers.some(
        emp => (emp.isUnemployment || emp.type === 'unemployment') && emp.toDate?.toLowerCase() === 'present'
      )
      const hasCurrentEmployment = formData.employers.some(
        emp => !emp.isUnemployment && emp.type !== 'unemployment' && emp.toDate?.toLowerCase() === 'present'
      )
      const isCoveredToPresent = hasCurrentUnemployment || hasCurrentEmployment
      
      if (totalYearsCovered < YEARS_REQUIRED - TOLERANCE) {
        // Find most recent end date to give better guidance
        let mostRecentEnd = ''
        formData.employers.forEach(emp => {
          if (emp.toDate && emp.toDate.toLowerCase() !== 'present') {
            if (!mostRecentEnd || emp.toDate > mostRecentEnd) mostRecentEnd = emp.toDate
          }
        })
        
        if (!isCoveredToPresent && mostRecentEnd) {
          newErrors.employmentYearsCoverage = 
            `DOT § 383.35 requires the last 10 years to be documented. Your most recent entry ends at ${mostRecentEnd}. Please account for the period from then to present (add current employer, mark as "Present", or add unemployment).`
        } else if (!isCoveredToPresent) {
          newErrors.employmentYearsCoverage = 
            `DOT § 383.35 requires 10 years of history. Please ensure your entries cover up to the present date.`
        } else {
          newErrors.employmentYearsCoverage = 
            `DOT § 383.35 requires 10 years of history. You have ${totalYearsCovered.toFixed(1)} years. Please add more history.`
        }
      }
    } else if (step === 2) {
      // Signature validation
      if (!formData.applicantSignature?.trim())
        newErrors.applicantSignature = 'Signature is required'
      if (!formData.signatureDate)
        newErrors.signatureDate = 'Signature date is required'
      if (!formData.safetyPerformanceHistoryAcknowledgement) {
        newErrors.safetyPerformanceHistoryAcknowledgement =
          'You must acknowledge the safety performance history investigation (49 CFR 391.21(d)).'
      }
      if (!formData.safetyPerformanceInquiryConsent) {
        newErrors.safetyPerformanceInquiryConsent =
          'Consent is required so we can contact prior DOT-regulated employers under 49 CFR 391.23.'
      }
      if (!formData.roadTestAcknowledgement) {
        newErrors.roadTestAcknowledgement =
          'Please acknowledge the road test requirement under 49 CFR 391.31.'
      }
      if (!formData.hasPreviousRoadTest) {
        newErrors.hasPreviousRoadTest =
          'Let us know if you already completed a compliant road test.'
      } else if (
        formData.hasPreviousRoadTest === 'yes' &&
        !formData.previousRoadTestDetails.trim()
      ) {
        newErrors.previousRoadTestDetails =
          'Provide details about the prior road test so we can document the certificate.'
      }
      if (!formData.hasValidCDL) {
        newErrors.hasValidCDL =
          'Indicate whether you hold a CDL that covers the vehicle type you will drive.'
      }
      if (!formData.fcraAcknowledgement) {
        newErrors.fcraAcknowledgement =
          'You must acknowledge receipt of the Federal FCRA Summary of Rights.'
      }
    }

    // Auto-expand any collapsed history card that has validation errors —
    // otherwise the red fields would be hidden inside a closed card.
    if (step === 1) {
      const errorEntryIndexes = new Set(
        Object.keys(newErrors)
          .map((key) => key.match(/^employer(\d+)/)?.[1])
          .filter((value): value is string => value !== undefined)
          .map(Number),
      )
      if (errorEntryIndexes.size > 0) {
        setCollapsedEntries((prev) => {
          const next = { ...prev }
          errorEntryIndexes.forEach((idx) => {
            const employer = formData.employers[idx]
            if (employer) next[entryCardKey(employer, idx)] = false
          })
          return next
        })
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setErrors({})
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } else {
        // Form is completed, call onComplete callback
        onComplete?.()
      }
    } else {
      scrollToDotValidationErrors()
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

  const addHistoryEntry = (type: HistoryEntryType) => {
    setFormData((prev) => ({
      ...prev,
      employers: [...prev.employers, blankHistoryEntry(type)],
    }))
  }

  const removeEmployer = (index: number) => {
    if (isVerifiedEmployer(formData.employers[index])) return
    setFormData((prev) => ({
      ...prev,
      employers: prev.employers.filter((_, i) => i !== index),
    }))
  }

  /**
   * Normalize date input to MM/YYYY format
   * Handles various input formats users might enter:
   * - 01/2022 → 01/2022 (already correct)
   * - 1/2022 → 01/2022 (pad month)
   * - 01/22 → 01/2022 (expand 2-digit year)
   * - 01-2022 → 01/2022 (convert dash)
   * - 2022-01 → 01/2022 (ISO format)
   * - 2022-01-15 → 01/2022 (full ISO, extract month/year)
   * - Present/present → Present (standardize case)
   */
  const normalizeDateInput = (value: string): string => {
    if (!value) return ''
    const trimmed = value.trim()
    
    // Handle "Present" (case-insensitive)
    if (trimmed.toLowerCase() === 'present') return 'Present'
    
    // Try MM/YYYY or MM/YY format (with slash)
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{2,4})$/)
    if (slashMatch) {
      const month = slashMatch[1].padStart(2, '0')
      let year = parseInt(slashMatch[2])
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year
      }
      return `${month}/${year}`
    }
    
    // Try MM-YYYY or MM-YY format (with dash)
    const dashMatch = trimmed.match(/^(\d{1,2})-(\d{2,4})$/)
    if (dashMatch) {
      const month = dashMatch[1].padStart(2, '0')
      let year = parseInt(dashMatch[2])
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year
      }
      return `${month}/${year}`
    }
    
    // Try YYYY-MM or YYYY/MM format (reversed)
    const reversedMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})$/)
    if (reversedMatch) {
      const year = reversedMatch[1]
      const month = reversedMatch[2].padStart(2, '0')
      return `${month}/${year}`
    }
    
    // Try full ISO format YYYY-MM-DD (extract month/year only)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-\d{1,2}$/)
    if (isoMatch) {
      const year = isoMatch[1]
      const month = isoMatch[2].padStart(2, '0')
      return `${month}/${year}`
    }
    
    // If nothing matched, return as-is (parser will handle or show error)
    return trimmed
  }

  // Handle date blur - normalize the format
  const handleDateBlur = (field: 'fromDate' | 'toDate', index: number) => {
    const currentValue = formData.employers[index]?.[field]
    if (currentValue) {
      const normalized = normalizeDateInput(currentValue)
      if (normalized !== currentValue) {
        handleInputChange('employers', { [field]: normalized }, index)
      }
    }
  }

  const fillTestData = () => {
    // Fill with complete test data for testing Form 3 validation
    // This REPLACES any existing data to allow proper form testing
    setFormData((prev) => {
      // Test data: type-based entries covering 10+ years (Form 3 Tenstreet-style structure)
      // Timeline is CONTINUOUS with no gaps: Present → Jan 2015 (11 years)
      const cy = new Date().getFullYear()
      return {
        ...prev,
        employers: [
          // 1. Current job (employment) — Jan 2023 to Present (3 years)
          {
            type: 'employment' as const,
            name: 'ABC Trucking Company',
            phone: '(555) 123-4567',
            email: 'hr@abctrucking.com',
            address: '123 Highway Road, Columbus, OH 43215',
            positionHeld: 'Commercial Driver',
            duties: 'OTR freight hauling, pre-trip inspections, load securing, DOT compliance',
            fromDate: `01/${cy - 3}`,
            toDate: 'Present',
            reasonForLeaving: '',
            salary: '$55,000',
            gapsInEmployment: '',
            subjectToFMCSR: 'yes',
            safetySensitiveFunction: 'yes',
            isUnemployment: false,
            schoolName: '',
            courseOfStudy: '',
            militaryBranch: '',
            dischargeType: '',
          },
          // 2. Previous job (employment) — Jan 2020 to Dec 2022 (3 years)
          {
            type: 'employment' as const,
            name: 'XYZ Logistics',
            phone: '(555) 987-6543',
            email: 'verification@xyzlogistics.com',
            address: '456 Freight Lane, Cleveland, OH 44101',
            positionHeld: 'Delivery Driver',
            duties: 'Local delivery routes, customer service, inventory management',
            fromDate: `01/${cy - 6}`,
            toDate: `12/${cy - 4}`,
            reasonForLeaving: 'Better opportunity',
            salary: '$48,000',
            gapsInEmployment: '',
            subjectToFMCSR: 'yes',
            safetySensitiveFunction: 'yes',
            isUnemployment: false,
            schoolName: '',
            courseOfStudy: '',
            militaryBranch: '',
            dischargeType: '',
          },
          // 3. Unemployment period — Jul 2019 to Dec 2019 (6 months)
          {
            type: 'unemployment' as const,
            name: '',
            phone: '',
            email: '',
            address: '',
            positionHeld: '',
            duties: '',
            fromDate: `07/${cy - 7}`,
            toDate: `12/${cy - 7}`,
            reasonForLeaving: '',
            salary: '',
            gapsInEmployment: 'Between jobs; relocating to Ohio',
            subjectToFMCSR: '',
            safetySensitiveFunction: '',
            isUnemployment: true,
            schoolName: '',
            courseOfStudy: '',
            militaryBranch: '',
            dischargeType: '',
          },
          // 4. Earlier job (employment) — Jan 2017 to Jun 2019 (2.5 years)
          {
            type: 'employment' as const,
            name: 'Midwest Transport Solutions',
            phone: '(555) 456-7890',
            email: 'employment@midwesttransport.com',
            address: '789 Industrial Blvd, Indianapolis, IN 46225',
            positionHeld: 'Regional Driver',
            duties: 'Regional freight routes, equipment maintenance, HazMat transport',
            fromDate: `01/${cy - 9}`,
            toDate: `06/${cy - 7}`,
            reasonForLeaving: 'Relocated for better pay',
            salary: '$45,000',
            gapsInEmployment: '',
            subjectToFMCSR: 'yes',
            safetySensitiveFunction: 'yes',
            isUnemployment: false,
            schoolName: '',
            courseOfStudy: '',
            militaryBranch: '',
            dischargeType: '',
          },
          // 5. Driving school (CDL training) — Mar 2016 to Dec 2016 (10 months)
          {
            type: 'drivingSchool' as const,
            name: 'Ohio Commercial Driving Academy',
            phone: '',
            email: '',
            address: '100 Training Center Dr, Columbus, OH 43215',
            positionHeld: '',
            duties: '',
            fromDate: `03/${cy - 10}`,
            toDate: `12/${cy - 10}`,
            reasonForLeaving: '',
            salary: '',
            gapsInEmployment: '',
            subjectToFMCSR: '',
            safetySensitiveFunction: '',
            isUnemployment: false,
            schoolName: '',
            courseOfStudy: 'Class A CDL',
            militaryBranch: '',
            dischargeType: '',
          },
          // 6. Oldest job (employment) — Jan 2015 to Feb 2016 (1+ year, covers 10+ years total)
          {
            type: 'employment' as const,
            name: 'First Transport Inc',
            phone: '(555) 345-6789',
            email: 'hr@firsttransport.com',
            address: '555 Main Street, Toledo, OH 43601',
            positionHeld: 'Entry Level Driver',
            duties: 'Local routes, warehouse support, basic vehicle maintenance',
            fromDate: `01/${cy - 11}`,
            toDate: `02/${cy - 10}`,
            reasonForLeaving: 'Attended CDL training school',
            salary: '$40,000',
            gapsInEmployment: '',
            subjectToFMCSR: 'yes',
            safetySensitiveFunction: 'yes',
            isUnemployment: false,
            schoolName: '',
            courseOfStudy: '',
            militaryBranch: '',
            dischargeType: '',
          },
        ],
      
      // Signature - use AI-extracted name if available, otherwise test data
      applicantSignature: prev.applicantSignature || 'John Michael Doe',
      signatureDate: prev.signatureDate || new Date().toISOString().slice(0, 10),
      applicantNamePrinted: prev.applicantNamePrinted || 'John Michael Doe',
      safetyPerformanceHistoryAcknowledgement:
        prev.safetyPerformanceHistoryAcknowledgement ?? true,
      safetyPerformanceInquiryConsent:
        prev.safetyPerformanceInquiryConsent ?? true,
      roadTestAcknowledgement: prev.roadTestAcknowledgement ?? true,
      hasPreviousRoadTest:
        prev.hasPreviousRoadTest || 'yes',
      previousRoadTestDetails:
        prev.previousRoadTestDetails ||
        'Completed road test with XYZ Logistics on 01/15/2024 (tractor-trailer, 15 miles).',
      hasValidCDL: prev.hasValidCDL || 'yes',
      roadTestCertificateFiles: prev.roadTestCertificateFiles || [],
      medicalCertificateFiles: prev.medicalCertificateFiles || [],
      dqFileAcknowledgement: prev.dqFileAcknowledgement ?? true,
      dqHasApplicationComplete:
        prev.dqHasApplicationComplete || 'yes',
      dqHasRoadTestDocs:
        prev.dqHasRoadTestDocs || 'yes',
      dqHasMedicalDocs:
        prev.dqHasMedicalDocs || 'yes',
      dqUnderstandsRetention:
        prev.dqUnderstandsRetention || 'yes',
      dqInvestigationConsent: prev.dqInvestigationConsent ?? true,
      dqHasInvestigationRecords:
        prev.dqHasInvestigationRecords || 'yes',
      dqUnderstandsAccessControls:
        prev.dqUnderstandsAccessControls || 'yes',
      fcraAcknowledgement: prev.fcraAcknowledgement ?? true,
      signedAt: prev.signedAt || new Date().toISOString(),
      // ipAddress is captured async; don't override if already set
    }
    })
    setErrors({})
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderEmploymentHistory()
      case 2:
        return renderSignature()
      default:
        return null
    }
  }

  const renderEmploymentHistory = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          EMPLOYMENT HISTORY
        </h2>
        <AskStormiButton
          label='Ask AI about 10-year history'
          className='justify-end mb-4'
          onClick={() =>
            requestHelp({
              section: 'Section 3 – Employment History',
              question:
                'What specifically must drivers include to satisfy the 10-year DOT employment history requirement?',
              regulation: '49 CFR 391.21(b)(10) & 49 CFR 383.35',
              context:
                'Driver is reviewing the employment history step in PersonalInfoForm3 and wants to ensure the provided timeline is complete.',
              dataSnapshot: formData.employers,
            })
          }
        />
        <div
          className={`p-4 rounded-lg border-2 ${
            isDarkTheme(theme)
              ? 'rounded-xl border border-gray-700/50 bg-gray-700/30'
              : 'rounded-xl border border-gray-200 bg-gray-50/80'
          }`}
        >
          <p
            className={`text-sm font-semibold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
          >
            ⚠️ DOT § 383.35 - 10-Year Employment History Requirement
          </p>
          <p
            className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
          >
            <strong>
              Federal regulation requires 10 years of employment history:
            </strong>
          </p>
          <ul
            className={`text-sm mt-2 space-y-1 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
          >
            <li>
              • <strong>Last 3 years:</strong> Must be verified by employers
              (complete contact info and address required)
            </li>
            <li>
              • <strong>Years 4-10:</strong> Self-reported (employers will not
              be contacted for verification)
            </li>
            <li>• <strong>Required for each employer:</strong> Name, address, dates, reason for leaving (DOT § 383.35(c))</li>
            <li>• Any gaps in employment over 1 month must be explained</li>
          </ul>
        </div>
        {/* Years Covered Indicator - shows real-time progress */}
        {(() => {
          const calculateYearsCovered = () => {
            let totalYears = 0
            const today = new Date()
            const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())
            
            // Helper to get last day of month
            const getLastDayOfMonth = (year: number, month: number) => {
              return new Date(year, month + 1, 0)
            }
            
            // Parse dates - handles multiple formats for robustness
            // isEndDate: when true, uses last day of month (e.g., "12/2024" → Dec 31, 2024)
            const parseDate = (dateStr: string, isEndDate = false): Date | null => {
              if (!dateStr || dateStr.toLowerCase() === 'present') return today
              const trimmed = dateStr.trim()
              
              // Try MM/YYYY or MM/YY format (with slash)
              const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{2,4})$/)
              if (slashMatch) {
                const month = parseInt(slashMatch[1]) - 1 // 0-indexed
                let year = parseInt(slashMatch[2])
                if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
                if (month >= 0 && month < 12) {
                  return isEndDate ? getLastDayOfMonth(year, month) : new Date(year, month, 1)
                }
              }
              
              // Try MM-YYYY or MM-YY format (with dash)
              const dashMatch = trimmed.match(/^(\d{1,2})-(\d{2,4})$/)
              if (dashMatch) {
                const month = parseInt(dashMatch[1]) - 1
                let year = parseInt(dashMatch[2])
                if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
                if (month >= 0 && month < 12) {
                  return isEndDate ? getLastDayOfMonth(year, month) : new Date(year, month, 1)
                }
              }
              
              // Try YYYY-MM or YYYY/MM format (reversed)
              const reversedMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})$/)
              if (reversedMatch) {
                const year = parseInt(reversedMatch[1])
                const month = parseInt(reversedMatch[2]) - 1
                if (month >= 0 && month < 12) {
                  return isEndDate ? getLastDayOfMonth(year, month) : new Date(year, month, 1)
                }
              }
              
              // Try full ISO format YYYY-MM-DD (exact day specified, use as-is)
              const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
              if (isoMatch) {
                return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]))
              }
              
              // Final fallback to native Date parsing
              const isoDate = new Date(trimmed)
              return isNaN(isoDate.getTime()) ? null : isoDate
            }
            
            const employerBreakdown: string[] = []
            
            formData.employers.forEach((employer, idx) => {
              // Unemployment periods COUNT toward the 10-year requirement (they're valid history)
              if (!employer.fromDate || !employer.toDate) {
                employerBreakdown.push(`#${idx + 1}: SKIP (missing dates: from="${employer.fromDate}" to="${employer.toDate}")`)
                return
              }
              
              const fromDate = parseDate(employer.fromDate, false)
              const toDate = parseDate(employer.toDate, true) // End dates use last day of month
              
              if (!fromDate || !toDate) {
                employerBreakdown.push(`#${idx + 1}: SKIP (parse failed: from="${employer.fromDate}"→${fromDate}, to="${employer.toDate}"→${toDate})`)
                return
              }
              
              // Only count years within the 10-year window
              const periodStart = fromDate > tenYearsAgo ? fromDate : tenYearsAgo
              const periodEnd = toDate < today ? toDate : today
              
              if (periodStart > periodEnd) {
                employerBreakdown.push(`#${idx + 1}: SKIP (outside window or invalid: ${employer.fromDate}-${employer.toDate})`)
                return
              }
              
              const years = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
              const addedYears = Math.max(0, years)
              totalYears += addedYears
              
              const typeLabel = employer.isUnemployment ? 'Unemployment' : 'Employment'
              employerBreakdown.push(`#${idx + 1}: +${addedYears.toFixed(2)}yr ${typeLabel} (${employer.fromDate} to ${employer.toDate})`)
            })
            
            console.log('📊 [YEARS CALC] Today:', today.toLocaleDateString(), '10yr ago:', tenYearsAgo.toLocaleDateString())
            console.log('📊 [YEARS CALC] Breakdown:', employerBreakdown)
            console.log('📊 [YEARS CALC] TOTAL:', totalYears.toFixed(2), 'years')
            
            return totalYears
          }
          
          const yearsCovered = calculateYearsCovered()
          // Allow small tolerance (9.9+ counts as complete) to handle rounding
          const isComplete = yearsCovered >= 9.9
          
          // Find the most recent end date (employment OR unemployment) to detect gaps
          const today = new Date()
          let mostRecentEndDate: Date | null = null
          let totalHistoryYears = 0
          let hasCurrentUnemployment = false
          
          formData.employers.forEach(emp => {
            if (!emp.fromDate || !emp.toDate) return
            
            // Parse dates to find total span and most recent end
            const parseSimple = (dateStr: string) => {
              if (!dateStr || dateStr.toLowerCase() === 'present') return today
              const match = dateStr.trim().match(/^(\d{1,2})\/(\d{4})$/)
              if (match) return new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1)
              return null
            }
            
            const from = parseSimple(emp.fromDate)
            const isPresent = emp.toDate.toLowerCase() === 'present'
            const to = isPresent ? today : parseSimple(emp.toDate)
            
            // Track if currently unemployed (unemployment + "Present" or current month)
            // Check both old flag (isUnemployment) and new type field for backwards compatibility
            const isUnemploymentEntry = emp.isUnemployment || emp.type === 'unemployment'
            if (isUnemploymentEntry && isPresent) {
              hasCurrentUnemployment = true
            }
            
            if (from && to) {
              // Track total history span (both employment AND unemployment count)
              const years = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
              totalHistoryYears += Math.max(0, years)
              
              // Track most recent end date (employment OR unemployment)
              if (!mostRecentEndDate || to > mostRecentEndDate) {
                mostRecentEndDate = to
              }
            }
          })
          
          // Check if there's a gap at the end (no coverage up to today)
          // If currently unemployed, there's NO gap - they've accounted for present
          const hasRecentGap = !hasCurrentUnemployment && mostRecentEndDate && mostRecentEndDate < today
          const gapMonths = hasRecentGap 
            ? Math.round((today.getTime() - mostRecentEndDate!.getTime()) / (1000 * 60 * 60 * 24 * 30))
            : 0
          
          // Format the gap period for display
          const formatGapPeriod = () => {
            if (!mostRecentEndDate || !hasRecentGap) return ''
            const endMonth = mostRecentEndDate.getMonth() + 2 // Next month after end
            const endYear = endMonth > 12 ? mostRecentEndDate.getFullYear() + 1 : mostRecentEndDate.getFullYear()
            const adjustedMonth = endMonth > 12 ? endMonth - 12 : endMonth
            return `${String(adjustedMonth).padStart(2, '0')}/${endYear} to Present`
          }
          
          if (formData.employers.some(e => e.fromDate || e.toDate)) {
            return (
              <div className={`mt-4 p-4 rounded-lg border-2 ${
                isComplete
                  ? isDarkTheme(theme)
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-green-50 border-green-200'
                  : isDarkTheme(theme)
                    ? 'bg-yellow-900/20 border-yellow-500/50'
                    : 'bg-yellow-50 border-yellow-200'
              }`}>
                {/* Show total history entered */}
                <p className={`text-sm mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'}`}>
                  📋 Employment history entered: <strong>{totalHistoryYears.toFixed(1)} years</strong>
                </p>
                
                {/* Main status message */}
                <p className={`text-sm font-medium ${
                  isComplete
                    ? isDarkTheme(theme) ? 'text-green-400' : 'text-green-800'
                    : isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-800'
                }`}>
                  {isComplete
                    ? `✓ Requirement met! Last 10 years are accounted for.`
                    : hasRecentGap && gapMonths > 0
                      ? `⚠ Gap detected: Your most recent employment ends before today. Please account for ${formatGapPeriod()} (~${gapMonths} months).`
                      : `⚠ ${yearsCovered.toFixed(1)} of 10 years covered within the required window.`
                  }
                </p>
                
                {/* Helpful hint for gaps */}
                {!isComplete && hasRecentGap && (
                  <p className={`text-xs mt-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                    💡 Tip: If you&apos;re still employed there, change the end date to &quot;Present&quot;. Otherwise, add your current status (new job, unemployment, etc.)
                  </p>
                )}
                
                {/* Collapsible breakdown */}
                <details className="mt-3">
                  <summary className={`text-xs cursor-pointer ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'}`}>
                    📋 Show detailed breakdown
                  </summary>
                  <div className={`text-xs mt-2 p-2 rounded ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <p className="mb-2">The DOT requires documentation of the <strong>last 10 years</strong> leading up to today.</p>
                    <ul className="space-y-1">
                      {(formData.employers ?? []).map((emp, idx) => {
                        if (!emp.fromDate || !emp.toDate) {
                          return <li key={idx} className="text-orange-500">#{idx + 1}: ⚠ Missing dates</li>
                        }
                        if (emp.isUnemployment || emp.type === 'unemployment') {
                          return (
                            <li key={idx} className="text-blue-600 dark:text-blue-400">
                              #{idx + 1}: ✓ Unemployment — {emp.fromDate} to {emp.toDate}
                            </li>
                          )
                        }
                        return (
                          <li key={idx} className="text-green-600 dark:text-green-400">
                            #{idx + 1}: ✓ {emp.name?.slice(0, 20) || 'Unnamed'} — {emp.fromDate} to {emp.toDate}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </details>
              </div>
            )
          }
          return null
        })()}
        {errors.employmentYearsCoverage && (
          <div className={`mt-2 p-4 rounded-lg border-2 ${
            isDarkTheme(theme)
              ? 'bg-red-900/20 border-red-500/50'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm font-medium ${
              isDarkTheme(theme) ? 'text-red-400' : 'text-red-800'
            }`}>
              {errors.employmentYearsCoverage}
            </p>
          </div>
        )}
        <p
          className={`text-sm mt-4 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Start with your most recent position and work backwards. Include
          complete mailing addresses with street number, city, state, zip for
          all entries.
        </p>
      </div>

      {/* History sections — every entry type is visible by default, required
          sections first. Entries keep their index in the FULL employers array
          so validation error keys (employer{index}…) and handleInputChange
          continue to work unchanged. */}
      {HISTORY_SECTIONS.map((section) => {
        const entries = (formData.employers ?? [])
          .map((employer, index) => ({ employer, index }))
          .filter(({ employer }) => entryGroupOf(employer) === section.group)
        const SectionIcon = section.icon
        // Only optional sections can be empty — required ones are auto-seeded
        const isEmptyOptional = entries.length === 0

        return (
          <section key={section.group} className='space-y-3'>
            {/* Section header — greyed out while an optional section is untouched */}
            <div className={`flex items-start gap-3 ${isEmptyOptional ? 'opacity-60' : ''}`}>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  isEmptyOptional
                    ? 'border-2 border-dashed border-stone-300 bg-white text-ironside'
                    : `${section.color} text-white`
                }`}
              >
                <SectionIcon className='h-5 w-5' />
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h3 className='text-lg font-bold text-[#173150]'>{section.label}</h3>
                  {section.required ? (
                    <span className='rounded-full bg-[#f15a2b]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f15a2b] ring-1 ring-[#f15a2b]/25'>
                      Required
                    </span>
                  ) : (
                    <span className='rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ironside ring-1 ring-stone-200'>
                      Optional
                    </span>
                  )}
                  {entries.length > 1 && (
                    <span className='text-xs font-medium text-ironside'>
                      {entries.length} entries
                    </span>
                  )}
                </div>
                <p className='text-sm text-gray-600'>{section.description}</p>
              </div>
            </div>

            {/* Rail visually ties the section's cards to its header — ml-5 puts
                the line under the center of the 40px icon tile above. Dashed
                while an optional section is still untouched. */}
            <div
              className={`ml-5 space-y-4 border-l-2 pl-4 sm:pl-6 ${
                isEmptyOptional ? 'border-dashed border-stone-300' : 'border-stone-200'
              }`}
            >
            {/* NOTE: the card body below kept its original (shallower) indentation
                when it moved inside this section loop — re-indenting ~570 lines
                would have destroyed the git history for the whole card. */}
            {entries.map(({ employer, index }, groupPos) => {
        // Get type info for this entry (default to employment for legacy entries)
        const entryType = employer.type || (employer.isUnemployment ? 'unemployment' : 'employment')
        const typeInfo = HISTORY_TYPES.find(t => t.value === entryType) || HISTORY_TYPES[0]
        const locked = isVerifiedEmployer(employer)
        const cardKey = entryCardKey(employer, index)
        const collapsed = collapsedEntries[cardKey] ?? false
        // Driving school and college/high school share one field block; the CDL
        // picker stores its selections in the same `courseOfStudy` string.
        const isSchoolType = entryType === 'school' || entryType === 'drivingSchool'
        const certifications = parseCertifications(employer.courseOfStudy)
        const remainingCertifications = CDL_CERTIFICATION_OPTIONS.filter(
          (option) => !certifications.includes(option),
        )
        const setCertifications = (next: string[]) =>
          handleInputChange('employers', { courseOfStudy: joinCertifications(next) }, index)
        const verifiedBadge =
          entryType === 'employment' && locked
            ? resolveEmploymentDotBadge(
                {
                  status: employer._verificationStatus,
                  verifiedAt: employer._verifiedAt,
                  verificationRequestId: employer._verificationRequestId,
                  employmentId: employer.id,
                },
                attestations,
              )
            : null
        
        return (
        <div
          key={cardKey}
          className={`overflow-hidden rounded-xl border-2 border-l-4 ${
            locked
              ? 'border-teal-200 border-l-teal-600 bg-teal-50/50'
              : groupPos % 2 === 0
                ? 'border-stone-200 border-l-[#173150] bg-white'
                : 'border-stone-300 border-l-[#00608b] bg-stone-100'
          }`}
        >
          {/* Header is the collapse control. Number + zebra fill keep Employer
             2/3 visually distinct from the cream page; the chevron + Show/Hide
             chip make expand/collapse an obvious action, not a decorative caret. */}
          {(() => {
            const entryTitle =
              section.group === 'employment'
                ? groupPos === 0
                  ? 'Most recent'
                  : `Employer ${groupPos + 1}`
                : entries.length > 1
                  ? `${typeInfo.label} ${groupPos + 1}`
                  : 'Details'
            const selfCertified = entryType === 'employment' && !locked && groupPos < 3
            // Removing the last card in a required section just re-seeds a blank
            // one, so only offer the X when it actually removes something.
            const showRemove = !locked && (entries.length > 1 || !section.required)
            const summaryName =
              entryType === 'military' ? employer.militaryBranch || employer.name : employer.name
            const summaryDates =
              employer.fromDate || employer.toDate
                ? `${employer.fromDate || '…'} – ${employer.toDate || '…'}`
                : ''
            const summary = [summaryName, summaryDates].filter(Boolean).join(' · ')
            return (
              <div
                className={`flex items-center justify-between gap-2 pr-2 ${
                  collapsed ? '' : 'border-b border-stone-200'
                } ${groupPos % 2 === 0 ? 'bg-stone-50' : 'bg-stone-200/60'}`}
              >
                <button
                  type='button'
                  onClick={() =>
                    setCollapsedEntries((prev) => ({ ...prev, [cardKey]: !collapsed }))
                  }
                  aria-expanded={!collapsed}
                  className='flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-black/5'
                >
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#173150] transition-transform ${
                      collapsed ? '-rotate-90' : ''
                    }`}
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
                      <span className='text-xs font-bold uppercase tracking-wider text-[#173150]'>
                        {entryTitle}
                      </span>
                      <span className='rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#173150] ring-1 ring-stone-300'>
                        {collapsed ? 'Show details' : 'Hide details'}
                      </span>
                      {verifiedBadge && (
                        <span className='text-xs text-teal-700' data-honesty-tier={verifiedBadge.tier}>
                          {verifiedBadge.text}
                        </span>
                      )}
                    </span>
                    {collapsed && (
                      <span className='mt-0.5 block truncate text-sm text-gray-600'>
                        {summary || 'Not filled in yet'}
                      </span>
                    )}
                    {!collapsed && selfCertified && (
                      <span className='mt-0.5 block text-xs text-yellow-700'>
                        Self-certified — request prior-employer verification from your hub
                      </span>
                    )}
                  </span>
                </button>
                {showRemove && (
                  <button
                    type='button'
                    onClick={() => removeEmployer(index)}
                    aria-label='Remove entry'
                    className='shrink-0 rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50'
                  >
                    <X className='h-4 w-4' />
                  </button>
                )}
              </div>
            )
          })()}
          
          {!collapsed && (
          <fieldset disabled={locked} className="p-6 space-y-5 border-0 min-w-0 disabled:opacity-90">
            {/* Date Range - Common to ALL types */}
            {(() => {
              // Only enforce that "To" is after "From" within the same entry.
              // We intentionally allow overlapping dates between entries — drivers
              // commonly hold two jobs simultaneously during a transition period.
              const fromNum = parseDateToNumber(employer.fromDate)
              const toNum   = parseDateToNumber(employer.toDate)
              const dateOrderError = !!(fromNum && toNum && fromNum > toNum)

              // From's upper bound: can't be later than "To" (within same entry)
              const maxFromDate = employer.toDate && employer.toDate.toLowerCase() !== 'present'
                ? employer.toDate
                : undefined

              return (
                <>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                        FROM <span className="text-red-500">*</span>
                      </label>
                      <MonthYearPicker
                        value={employer.fromDate}
                        onChange={(value) => handleInputChange('employers', { fromDate: value }, index)}
                        placeholder="Select start date"
                        error={!!errors[`employer${index}FromDate`] || dateOrderError}
                        theme={theme}
                        maxDate={maxFromDate}
                      />
                      <DotFieldError message={errors[`employer${index}FromDate`]} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                        TO <span className="text-red-500">*</span>
                      </label>
                      <MonthYearPicker
                        value={employer.toDate}
                        onChange={(value) => {
                          handleInputChange('employers', { toDate: value }, index)
                        }}
                        placeholder="Select end date"
                        allowPresent={groupPos === 0}
                        error={!!errors[`employer${index}ToDate`] || dateOrderError}
                        theme={theme}
                        minDate={employer.fromDate}
                      />
                      <DotFieldError message={errors[`employer${index}ToDate`]} />
                    </div>
                  </div>
                  {dateOrderError && (
                    <div className={`p-3 rounded-lg text-sm ${
                      isDarkTheme(theme) ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
                    }`}>
                      ⚠️ "To" date must be after "From" date
                    </div>
                  )}
                  {section.group === 'employment' && groupPos === 0 && !employer.toDate && (
                    <div className={`p-3 rounded-lg text-sm ${
                      isDarkTheme(theme) ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'
                    }`}>
                      💡 Start with your most recent/current position. Select "Present" if you're still here.
                    </div>
                  )}
                </>
              )
            })()}
            
            {/* EMPLOYMENT-specific fields */}
            {entryType === 'employment' && (
              <>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='md:col-span-2'>
                    <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      EMPLOYER NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      type='text'
                      value={employer.name}
                      onChange={(e) => handleInputChange('employers', { name: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        isDarkTheme(theme)
                          ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                      } ${dotErrorInputClass(!!errors[`employer${index}Name`])}`}
                    />
                    <DotFieldError message={errors[`employer${index}Name`]} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      PHONE
                    </label>
                    <PhoneInput
                      value={employer.phone}
                      onChange={(formatted) => handleInputChange('employers', { phone: formatted }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        isDarkTheme(theme)
                          ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                      }`}
                    />
                  </div>
                </div>


                {/* Hiring-manager / EV contact is collected on the Employment
                    Verification block so a later edit lives in one place. */}

                {/* Address */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                    ADDRESS <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={employer.address}
                    onChange={(e) => handleInputChange('employers', { address: e.target.value }, index)}
                    rows={2}
                    placeholder="Street, City, State, ZIP"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${dotErrorInputClass(!!errors[`employer${index}Address`])}`}
                  />
                  <DotFieldError message={errors[`employer${index}Address`]} />
                </div>

                {/* Reason for Leaving */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                    REASON FOR LEAVING <span className="text-red-500">*</span>
                    <span className="text-xs ml-2 opacity-60">(DOT § 383.35)</span>
                  </label>
                  <input
                    type='text'
                    value={employer.reasonForLeaving}
                    onChange={(e) => handleInputChange('employers', { reasonForLeaving: e.target.value }, index)}
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${dotErrorInputClass(!!errors[`employer${index}Reason`])}`}
                  />
                  <DotFieldError message={errors[`employer${index}Reason`]} />
                </div>

                {/* FMCSR Questions */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className={`p-4 rounded-lg ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'} ${errors[`employer${index}FMCSR`] ? 'ring-1 ring-red-500' : ''}`}>
                    <label className={`block text-sm font-medium mb-3 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      Subject to FMCSR? <span className="text-red-500">*</span>
                    </label>
                    <div className='flex gap-4'>
                      {['yes', 'no'].map(val => (
                        <label key={val} className='flex items-center cursor-pointer'>
                          <input
                            type='radio'
                            name={`subjectToFMCSR_${index}`}
                            value={val}
                            checked={employer.subjectToFMCSR === val}
                            onChange={(e) => handleInputChange('employers', { subjectToFMCSR: e.target.value }, index)}
                            className="mr-2 accent-indigo-500"
                          />
                          <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                            {val.toUpperCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                    <DotFieldError message={errors[`employer${index}FMCSR`]} />
                  </div>
                  <div className={`p-4 rounded-lg ${isDarkTheme(theme) ? 'bg-gray-800' : 'bg-gray-50'} ${errors[`employer${index}Safety`] ? 'ring-1 ring-red-500' : ''}`}>
                    <label className={`block text-sm font-medium mb-3 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      Safety-sensitive function? <span className="text-red-500">*</span>
                    </label>
                    <div className='flex gap-4'>
                      {['yes', 'no'].map(val => (
                        <label key={val} className='flex items-center cursor-pointer'>
                          <input
                            type='radio'
                            name={`safetySensitiveFunction_${index}`}
                            value={val}
                            checked={employer.safetySensitiveFunction === val}
                            onChange={(e) => handleInputChange('employers', { safetySensitiveFunction: e.target.value }, index)}
                            className="mr-2 accent-indigo-500"
                          />
                          <span className={isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}>
                            {val.toUpperCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                    <DotFieldError message={errors[`employer${index}Safety`]} />
                  </div>
                </div>
              </>
            )}
            
            {/* UNEMPLOYMENT-specific fields */}
            {entryType === 'unemployment' && (
              <div className={`p-4 rounded-lg ${isDarkTheme(theme) ? 'bg-yellow-900/20 border border-yellow-700/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-sm ${isDarkTheme(theme) ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  <strong>Unemployment Period</strong> — This entry accounts for time between jobs. Only dates are required.
                </p>
                <div className="mt-3">
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                    Optional: Explanation
                  </label>
                  <input
                    type='text'
                    value={employer.gapsInEmployment}
                    onChange={(e) => handleInputChange('employers', { gapsInEmployment: e.target.value }, index)}
                    placeholder="e.g., Looking for work, Personal reasons"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
              </div>
            )}
            
            {/* SCHOOL fields — shared by driving school and college/high school.
                Only the second field differs: CDL picker vs. free-text course. */}
            {isSchoolType && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                    SCHOOL NAME <span className="text-red-500">*</span>
                  </label>
                  <input
                    type='text'
                    value={employer.name}
                    onChange={(e) => handleInputChange('employers', { name: e.target.value }, index)}
                    placeholder={entryType === 'drivingSchool' ? 'Name of CDL / driving school' : 'Name of college, high school, or program'}
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    } ${dotErrorInputClass(!!errors[`employer${index}Name`])}`}
                  />
                  <DotFieldError message={errors[`employer${index}Name`]} />
                </div>

                {entryType === 'drivingSchool' ? (
                  /* Picker + chips instead of free text — employers filter on
                     these, so "Class A" vs "class-a cdl" can't both exist. */
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      CDL CLASSES &amp; ENDORSEMENTS
                    </label>

                    {certifications.length > 0 && (
                      <div className='mb-2 flex flex-wrap gap-2'>
                        {certifications.map((cert) => (
                          <span
                            key={cert}
                            className='inline-flex items-center gap-1.5 rounded-full bg-[#f15a2b]/10 px-3 py-1 text-xs font-semibold text-[#f15a2b] ring-1 ring-[#f15a2b]/25'
                          >
                            {cert}
                            <button
                              type='button'
                              onClick={() => setCertifications(certifications.filter((c) => c !== cert))}
                              className='rounded-full p-0.5 transition-colors hover:bg-[#f15a2b]/20'
                              aria-label={`Remove ${cert}`}
                            >
                              <X className='h-3 w-3' />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <select
                      value=''
                      disabled={remainingCertifications.length === 0}
                      onChange={(e) => {
                        if (e.target.value) setCertifications(addCertification(certifications, e.target.value))
                      }}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-60 ${
                        isDarkTheme(theme)
                          ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                      }`}
                    >
                      <option value=''>
                        {remainingCertifications.length === 0
                          ? 'All classes and endorsements added'
                          : certifications.length === 0
                            ? 'Select a class or endorsement…'
                            : 'Add another…'}
                      </option>
                      {remainingCertifications.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <p className='mt-1.5 text-xs text-gray-500'>
                      Add each one you hold — carriers search by class and endorsement.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      COURSE OF STUDY
                    </label>
                    <input
                      type='text'
                      value={employer.courseOfStudy || ''}
                      onChange={(e) => handleInputChange('employers', { courseOfStudy: e.target.value }, index)}
                      placeholder="e.g., High School Diploma, Associate Degree"
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        isDarkTheme(theme)
                          ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                      }`}
                    />
                  </div>
                )}
              </>
            )}
            
            {/* MILITARY-specific fields */}
            {entryType === 'military' && (
              <>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      BRANCH OF SERVICE <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={employer.militaryBranch || ''}
                      onChange={(e) => handleInputChange('employers', { militaryBranch: e.target.value, name: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        isDarkTheme(theme)
                          ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                      } ${dotErrorInputClass(!!errors[`employer${index}Name`])}`}
                    >
                      <option value="">Select branch...</option>
                      <option value="Army">Army</option>
                      <option value="Navy">Navy</option>
                      <option value="Air Force">Air Force</option>
                      <option value="Marines">Marines</option>
                      <option value="Coast Guard">Coast Guard</option>
                      <option value="Space Force">Space Force</option>
                      <option value="National Guard">National Guard</option>
                      <option value="Reserves">Reserves</option>
                    </select>
                    <DotFieldError message={errors[`employer${index}Name`]} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                      DISCHARGE TYPE
                    </label>
                    <select
                      value={employer.dischargeType || ''}
                      onChange={(e) => handleInputChange('employers', { dischargeType: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        isDarkTheme(theme)
                          ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                      }`}
                    >
                      <option value="">Select discharge type...</option>
                      <option value="Honorable">Honorable</option>
                      <option value="General">General (Under Honorable)</option>
                      <option value="Other Than Honorable">Other Than Honorable</option>
                      <option value="Currently Serving">Currently Serving</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
                    POSITION / MOS
                  </label>
                  <input
                    type='text'
                    value={employer.positionHeld}
                    onChange={(e) => handleInputChange('employers', { positionHeld: e.target.value }, index)}
                    placeholder="e.g., 88M Motor Transport Operator"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      isDarkTheme(theme)
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
              </>
            )}
          </fieldset>
          )}
        </div>
        )
      })}

            {isEmptyOptional ? (
              /* Dashed placeholder — the whole card is the add button. Greyed +
                 dotted signals "not filled in, and that's fine". */
              <button
                type='button'
                onClick={() => addHistoryEntry(section.addActions[0].type)}
                className='group w-full rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/60 p-5 text-left transition-all hover:border-[#173150]/40 hover:bg-white'
              >
                <div className='flex items-center gap-3'>
                  <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-stone-400 text-ironside transition-colors group-hover:border-[#173150]/50 group-hover:text-[#173150]'>
                    <Plus className='h-4 w-4' />
                  </div>
                  <div>
                    <p className='text-sm font-semibold text-gray-500 transition-colors group-hover:text-[#173150]'>
                      {section.addActions[0].label}
                    </p>
                    <p className='text-xs text-gray-400'>
                      Optional — skip it if this doesn&apos;t apply. It won&apos;t hold up your application.
                    </p>
                  </div>
                </div>
              </button>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {section.addActions.map((action) => (
                  <button
                    key={action.type}
                    type='button'
                    onClick={() => addHistoryEntry(action.type)}
                    className='inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-stone-300 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-[#173150]/50 hover:bg-white hover:text-[#173150]'
                  >
                    <Plus className='h-4 w-4' />
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            </div>
          </section>
        )
      })}

    </div>
  )

  const renderSignature = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          TO BE READ AND SIGNED BY APPLICANT
        </h2>
      </div>
      <div className='flex justify-end mb-4 text-left'>
        <button
          type='button'
          onClick={() =>
            requestHelp({
              section: 'Section 3 – Final Certifications',
              question:
                'Summarize what acknowledgements and consents the applicant must provide in the signature section and why they are required.',
              regulation: '49 CFR 391.21(d) & 49 CFR 391.23',
              context:
                'Driver is on the final signature step of PersonalInfoForm3 and needs a plain-language explanation of the acknowledgements before signing.',
              dataSnapshot: {
                consents: {
                  safetyPerformanceHistoryAcknowledgement:
                    formData.safetyPerformanceHistoryAcknowledgement,
                  safetyPerformanceInquiryConsent:
                    formData.safetyPerformanceInquiryConsent,
                  roadTestAcknowledgement: formData.roadTestAcknowledgement,
                },
              },
            })
          }
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
            isDarkTheme(theme)
              ? 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10'
              : 'border-indigo-500/40 text-indigo-600 hover:bg-indigo-500/10'
          }`}
        >
          <span>✍️</span>
          <span>Break down the acknowledgements</span>
        </button>
      </div>

      {/*
        Legal “paper” — always light surface + dark ink.
        Quiet Ink remaps .bg-white / .text-gray-* to zinc/white and made the
        nested reminder unreadable (light text on light gray).
      */}
      <div
        className='dot-legal-paper p-6 rounded-lg border-2 border-gray-300 bg-white'
        style={{ backgroundColor: '#ffffff', color: '#1f2937' }}
      >
        <div className='text-sm space-y-4' style={{ color: '#1f2937' }}>
          <p>
            I authorize you to make investigations (including contacting current
            and prior employers) into my personal, employment, financial,
            medical history, and other related matters as may be necessary in
            arriving at an employment decision. I hereby release employers,
            schools, health care providers, and other persons from all liability
            in responding to inquiries and releasing information in connection
            with my application.
          </p>

          <p>
            In the event of employment, I understand that false or misleading
            information given in my application or interview(s) may result in
            discharge. I also understand that I am required to abide by all
            rules and regulations of the Company.
          </p>

          <p>
            I understand that the information I provide regarding my current
            and/or prior employers may be used, and those employer(s) will be
            contacted for the purpose of investigating my safety performance
            history as required by 49 CFR 391.23. I understand that I have the
            right to:
          </p>

          <ul className='list-disc list-inside space-y-2 ml-4'>
            <li>Review information provided by current/previous employers;</li>
            <li>
              Have errors in the information corrected by previous employers,
              and for those previous employers to resend the corrected
              information to the prospective employer; and
            </li>
            <li>
              Have a rebuttal statement attached to the alleged erroneous
              information, if the previous employer(s) and I cannot agree on the
              accuracy of the information.
            </li>
          </ul>

          <p>
            I understand these inquiries include motor vehicle records from each
            licensing State covering the previous three years, DOT safety
            performance history (accidents, employment verification, and
            drug/alcohol testing program data), and Drug &amp; Alcohol
            Clearinghouse queries where required. Results and good-faith contact
            attempts will be kept on file for compliance with 49 CFR 391.23(b)-(g).
          </p>

          <p>
            This certifies that I completed this application, and that all
            entries on it and information in it are true and complete to the
            best of my knowledge. Note: A motor carrier may require an applicant
            to provide more information than that required by the Federal Motor
            Carrier Safety Regulations.
          </p>

          <div
            className='mt-4 p-4 rounded-xl border border-gray-300'
            style={{ backgroundColor: '#f3f4f6', color: '#111827' }}
          >
            <p className='text-sm font-semibold' style={{ color: '#111827' }}>
              Reminder: 49 CFR 391.41 Medical Qualification
            </p>
            <p className='text-sm mt-2' style={{ color: '#1f2937' }}>
              Motor carriers must verify that your medical certificate is current, retain it in your driver qualification file, and keep any variance documentation on hand. Please ensure the medical information you provided is accurate so we can stay compliant.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`p-4 rounded-lg border-2 ${
          isDarkTheme(theme)
            ? 'rounded-xl border border-gray-700/50 bg-gray-700/30'
            : 'rounded-xl border border-gray-200 bg-gray-50/80'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          49 CFR 391.21(d) Disclosure — Safety Performance History Investigation
        </p>
        <p
          className={`text-sm mb-4 ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          The motor carrier will use the employment information you provide to investigate your safety performance history under 49 CFR 391.23. We must also remind you of your due-process rights (review, correct, and rebut) regarding any information obtained.
        </p>
        <label className='flex items-start gap-3'>
          <input
            type='checkbox'
            checked={Boolean(formData.safetyPerformanceHistoryAcknowledgement)}
            onChange={(e) =>
              handleInputChange('safetyPerformanceHistoryAcknowledgement', e.target.checked)
            }
            className={`mt-1 h-5 w-5 rounded border-2 ${
              isDarkTheme(theme)
                ? 'border-gray-600 bg-transparent accent-indigo-500'
                : 'border-gray-300 bg-white accent-indigo-500'
            }`}
          />
          <span
            className={`text-sm ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-800'
            }`}
          >
            I acknowledge that my safety performance history will be investigated and that I have been notified of my rights under 49 CFR 391.23(i).
          </span>
        </label>
        {errors.safetyPerformanceHistoryAcknowledgement && (
          <p className='mt-2 text-sm text-red-600'>
            {errors.safetyPerformanceHistoryAcknowledgement}
          </p>
        )}
      </div>

      <div
        className={`p-4 rounded-lg border-2 ${
          isDarkTheme(theme)
            ? 'rounded-xl border border-gray-700/50 bg-gray-700/30'
            : 'rounded-xl border border-gray-200 bg-gray-50/80'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          49 CFR 391.23 Consent — Previous Employer &amp; Clearinghouse Investigations
        </p>
        <p
          className={`text-sm mb-4 ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          By granting consent, you authorize us to request motor vehicle records, contact prior DOT-regulated employers about accidents and drug/alcohol program results, and query the FMCSA Drug &amp; Alcohol Clearinghouse as required. We will only use the information for hiring decisions and protect it as mandated by 49 CFR 391.23(k).
        </p>
        <label className='flex items-start gap-3'>
          <input
            type='checkbox'
            checked={Boolean(formData.safetyPerformanceInquiryConsent)}
            onChange={(e) =>
              handleInputChange('safetyPerformanceInquiryConsent', e.target.checked)
            }
            className={`mt-1 h-5 w-5 rounded border-2 ${
              isDarkTheme(theme)
                ? 'border-gray-600 bg-transparent accent-indigo-500'
                : 'border-gray-300 bg-white accent-indigo-500'
            }`}
          />
          <span
            className={`text-sm ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-800'
            }`}
          >
            I authorize the prospective motor carrier to investigate my driving record, prior DOT employment safety performance, drug/alcohol program history, and the FMCSA Clearinghouse as required by 49 CFR 391.23.
          </span>
        </label>
        {errors.safetyPerformanceInquiryConsent && (
          <p className='mt-2 text-sm text-red-600'>
            {errors.safetyPerformanceInquiryConsent}
          </p>
        )}
      </div>

      <div
        className={`p-4 rounded-lg border-2 ${
          isDarkTheme(theme)
            ? 'rounded-xl border border-gray-700/50 bg-gray-700/30'
            : 'rounded-xl border border-gray-200 bg-gray-50/80'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          49 CFR 391.31 Road Test Requirement
        </p>
        <p
          className={`text-sm ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          You must successfully complete a carrier-administered road test covering pre-trip inspections, coupling, vehicle control, traffic operations, turning, braking, and backing. We'll document the results and issue the required certificate before you operate equipment for us.
        </p>

        <label className='flex items-start gap-3 mt-4 mb-4'>
          <input
            type='checkbox'
            checked={Boolean(formData.roadTestAcknowledgement)}
            onChange={(e) =>
              handleInputChange('roadTestAcknowledgement', e.target.checked)
            }
            className={`mt-1 h-5 w-5 rounded border-2 ${
              isDarkTheme(theme)
                ? 'border-gray-600 bg-transparent accent-indigo-500'
                : 'border-gray-300 bg-white accent-indigo-500'
            }`}
          />
          <span
            className={`text-sm ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-800'
            }`}
          >
            I acknowledge that I must pass the road test described in 49 CFR 391.31 before driving for this carrier.
          </span>
        </label>
        {errors.roadTestAcknowledgement && (
          <p className='-mt-2 mb-2 text-sm text-red-600'>
            {errors.roadTestAcknowledgement}
          </p>
        )}

        <div className='space-y-3'>
          <p
            className={`text-sm font-medium ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-900'
            }`}
          >
            Have you already completed a road test (with certificate) that meets FMCSA requirements in the past 12 months?
          </p>
          <div className='flex flex-wrap gap-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasPreviousRoadTest'
                  value={value}
                  checked={formData.hasPreviousRoadTest === value}
                  onChange={(e) =>
                    handleInputChange('hasPreviousRoadTest', e.target.value)
                  }
                  className={`mr-1 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  } accent-indigo-500`}
                />
                <span
                  className={`${
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  {value.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          {errors.hasPreviousRoadTest && (
            <p className='text-sm text-red-600'>{errors.hasPreviousRoadTest}</p>
          )}
        </div>

        {formData.hasPreviousRoadTest === 'yes' && (
          <div className='mt-4'>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Provide details about the prior road test (date, examiner, equipment type, miles, certificate location)
            </label>
            <textarea
              value={formData.previousRoadTestDetails}
              onChange={(e) =>
                handleInputChange('previousRoadTestDetails', e.target.value)
              }
              className={`w-full min-h-[100px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                errors.previousRoadTestDetails
                  ? 'border-red-500'
                  : isDarkTheme(theme)
                    ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
              }`}
            />
            {errors.previousRoadTestDetails && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.previousRoadTestDetails}
              </p>
            )}
          </div>
        )}
      </div>

      <div
        className={`mt-6 p-4 rounded-lg border-2 ${
          isDarkTheme(theme)
            ? 'rounded-xl border border-gray-700/50 bg-gray-700/30'
            : 'rounded-xl border border-gray-200 bg-gray-50/80'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          Road Test Equivalent (49 CFR 391.33)
        </p>
        <p
          className={`text-sm mb-4 ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          If you already hold a valid CDL for the assigned vehicle class or have a road test certificate issued in the last 3 years, we can accept that documentation instead of retesting. Upload clear copies so we can retain them in your driver qualification file per § 391.33(b).
        </p>

        <div className='space-y-3'>
          <p
            className={`text-sm font-medium ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-900'
            }`}
          >
            Do you currently hold a CDL that covers the equipment we'll assign?
          </p>
          <div className='flex flex-wrap gap-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasValidCDL'
                  value={value}
                  checked={formData.hasValidCDL === value}
                  onChange={(e) => handleInputChange('hasValidCDL', e.target.value)}
                  className={`mr-1 ${
                    isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                  } accent-indigo-500`}
                />
                <span
                  className={`${
                    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  {value.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          {errors.hasValidCDL && (
            <p className='text-sm text-red-600'>{errors.hasValidCDL}</p>
          )}
        </div>

        <div className='mt-4 space-y-2'>
          <label
            className={`block text-sm font-medium ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Upload CDL copy or most recent road test certificate (PDF or image)
          </label>
          <input
            type='file'
            accept='.pdf,.jpg,.jpeg,.png'
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              handleInputChange('roadTestCertificateFiles', files)
            }}
            className={`block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold ${
              isDarkTheme(theme)
                ? 'file:bg-indigo-500 file:text-white'
                : 'file:bg-indigo-600 file:text-white'
            }`}
          />
          {formData.roadTestCertificateFiles?.length ? (
            <ul className='text-sm text-gray-600 dark:text-gray-300 list-disc list-inside'>
              {formData.roadTestCertificateFiles.map((file: File, index: number) => (
                <li key={`${file.name}-${index}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
          <p
            className={`text-xs ${
              isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            We'll store these documents securely to satisfy § 391.33(b). If you prefer to provide them later, let us know during onboarding.
          </p>
        </div>
      </div>

      <div
        className={`mt-6 p-4 rounded-lg border-2 ${
          isDarkTheme(theme)
            ? 'rounded-xl border border-gray-700/50 bg-gray-700/30'
            : 'rounded-xl border border-gray-200 bg-gray-50/80'
        }`}
      >
        <p
          className={`text-sm font-medium mb-2 ${
            isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
          }`}
        >
          Driver Qualification File Checklist (49 CFR 391.51)
        </p>
        <p
          className={`text-sm mb-4 ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          We must maintain a complete driver qualification file. Confirm each item below so we can log compliance and follow up if anything is missing.
        </p>

        <label className='flex items-start gap-3 mb-4'>
          <input
            type='checkbox'
            checked={Boolean(formData.dqFileAcknowledgement)}
            onChange={(e) =>
              handleInputChange('dqFileAcknowledgement', e.target.checked)
            }
            className={`mt-1 h-5 w-5 rounded border-2 ${
              isDarkTheme(theme)
                ? 'border-gray-600 bg-transparent accent-indigo-500'
                : 'border-gray-300 bg-white accent-indigo-500'
            }`}
          />
          <span
            className={`text-sm ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-800'
            }`}
          >
            I acknowledge the carrier will maintain my driver qualification file and that I will provide requested documents promptly.
          </span>
        </label>
        {errors.dqFileAcknowledgement && (
          <p className='-mt-3 mb-3 text-sm text-red-600'>
            {errors.dqFileAcknowledgement}
          </p>
        )}

        <div className='space-y-3'>
          <div>
            <p
              className={`text-sm font-medium ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-900'
              }`}
            >
              Employment application and background (391.51(b)(1)-(5))
            </p>
            <div className='flex gap-6 mt-1'>
              {['yes', 'no'].map((value) => (
                <label key={value} className='flex items-center gap-2'>
                  <input
                    type='radio'
                    name='dqHasApplicationComplete'
                    value={value}
                    checked={formData.dqHasApplicationComplete === value}
                    onChange={(e) =>
                      handleInputChange('dqHasApplicationComplete', e.target.value)
                    }
                    className={`mr-1 ${
                      isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                    } accent-indigo-500`}
                  />
                  <span
                    className={`${
                      isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {value.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
            {errors.dqHasApplicationComplete && (
              <p className='text-sm text-red-600'>
                {errors.dqHasApplicationComplete}
              </p>
            )}
          </div>

          <div>
            <p
              className={`text-sm font-medium ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-900'
              }`}
            >
              Road test, CDL, or equivalent documents (391.51(b)(3))
            </p>
            <div className='flex gap-6 mt-1'>
              {['yes', 'no'].map((value) => (
                <label key={value} className='flex items-center gap-2'>
                  <input
                    type='radio'
                    name='dqHasRoadTestDocs'
                    value={value}
                    checked={formData.dqHasRoadTestDocs === value}
                    onChange={(e) =>
                      handleInputChange('dqHasRoadTestDocs', e.target.value)
                    }
                    className={`mr-1 ${
                      isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                    } accent-indigo-500`}
                  />
                  <span
                    className={`${
                      isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {value.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
            {errors.dqHasRoadTestDocs && (
              <p className='text-sm text-red-600'>
                {errors.dqHasRoadTestDocs}
              </p>
            )}
          </div>

          <div>
            <p
              className={`text-sm font-medium ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-900'
              }`}
            >
              Medical certificates, variances, and examiner verification (391.51(b)(6)-(8))
            </p>
            <div className='flex gap-6 mt-1'>
              {['yes', 'no'].map((value) => (
                <label key={value} className='flex items-center gap-2'>
                  <input
                    type='radio'
                    name='dqHasMedicalDocs'
                    value={value}
                    checked={formData.dqHasMedicalDocs === value}
                    onChange={(e) =>
                      handleInputChange('dqHasMedicalDocs', e.target.value)
                    }
                    className={`mr-1 ${
                      isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                    } accent-indigo-500`}
                  />
                  <span
                    className={`${
                      isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {value.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
            {errors.dqHasMedicalDocs && (
              <p className='text-sm text-red-600'>
                {errors.dqHasMedicalDocs}
              </p>
            )}
          </div>

          <div>
            <p
              className={`text-sm font-medium ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-900'
              }`}
            >
              I understand records stay on file during employment plus 3 years (391.51(c)-(d))
            </p>
            <div className='flex gap-6 mt-1'>
              {['yes', 'no'].map((value) => (
                <label key={value} className='flex items-center gap-2'>
                  <input
                    type='radio'
                    name='dqUnderstandsRetention'
                    value={value}
                    checked={formData.dqUnderstandsRetention === value}
                    onChange={(e) =>
                      handleInputChange('dqUnderstandsRetention', e.target.value)
                    }
                    className={`mr-1 ${
                      isDarkTheme(theme) ? 'text-indigo-400' : 'text-indigo-600'
                    } accent-indigo-500`}
                  />
                  <span
                    className={`${
                      isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {value.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
            {errors.dqUnderstandsRetention && (
              <p className='text-sm text-red-600'>
                {errors.dqUnderstandsRetention}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── FCRA Summary of Rights Acknowledgment ─────────────────── */}
      <div className={`p-4 rounded-xl border-2 ${
        isDarkTheme(theme) ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-indigo-300 bg-indigo-50'
      }`}>
        <p className={`text-sm font-semibold mb-2 ${isDarkTheme(theme) ? 'text-indigo-300' : 'text-indigo-800'}`}>
          Federal FCRA Summary of Rights Acknowledgment
        </p>
        <p className={`text-sm mb-3 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
          You have been provided a copy of the Summary of Your Rights under the Fair Credit Reporting Act (FCRA) in connection with this application. By checking below, you acknowledge receipt of the FCRA Summary of Rights.
        </p>
        <label className='flex items-start gap-3 cursor-pointer'>
          <input
            type='checkbox'
            checked={Boolean(formData.fcraAcknowledgement)}
            onChange={(e) => handleInputChange('fcraAcknowledgement', e.target.checked)}
            className={`mt-1 h-5 w-5 rounded border-2 ${
              isDarkTheme(theme) ? 'border-gray-600 bg-transparent accent-indigo-500' : 'border-gray-300 bg-white accent-indigo-500'
            }`}
          />
          <span className={`text-sm ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-800'}`}>
            I acknowledge receipt of the Federal FCRA Summary of Rights.
          </span>
        </label>
        {errors.fcraAcknowledgement && (
          <p className='mt-2 text-sm text-red-600'>{errors.fcraAcknowledgement}</p>
        )}
      </div>

      {/* ── Electronic Signature ────────────────────────────────────── */}
      <div className={`p-5 rounded-xl border-2 ${
        isDarkTheme(theme) ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'
      }`}>
        <p className={`text-sm mb-4 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
          By signing below, I agree to use an electronic signature to demonstrate my consent. An electronic signature is as legally binding as an ink signature. This certifies that this application was completed by me, and that all entries on it and information in it are true and complete to the best of my knowledge.
        </p>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
              Signature (type your full name)
            </label>
            <input
              type='text'
              value={formData.applicantSignature}
              onChange={(e) => handleInputChange('applicantSignature', e.target.value)}
              placeholder='Full legal name'
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent italic ${
                isDarkTheme(theme) ? 'bg-gray-700/50 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            {errors.applicantSignature && <p className='mt-1 text-sm text-red-600'>{errors.applicantSignature}</p>}
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
              Date
            </label>
            <input
              type='date'
              value={formData.signatureDate}
              onChange={(e) => handleInputChange('signatureDate', e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                isDarkTheme(theme) ? 'bg-gray-700/50 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            {errors.signatureDate && <p className='mt-1 text-sm text-red-600'>{errors.signatureDate}</p>}
          </div>
        </div>

        <div className='mt-4'>
          <label className={`block text-sm font-medium mb-2 ${isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'}`}>
            Printed Name
          </label>
          <input
            type='text'
            value={formData.applicantNamePrinted}
            onChange={(e) => handleInputChange('applicantNamePrinted', e.target.value)}
            placeholder='Print your full name'
            className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              isDarkTheme(theme) ? 'bg-gray-700/50 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          />
        </div>

        {/* Read-only metadata — populated automatically */}
        <div className={`mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs ${
          isDarkTheme(theme) ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'
        }`}>
          <div>
            <span className='font-medium'>Signed Date/Time: </span>
            {formData.signedAt
              ? new Date(formData.signedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : <span className='italic'>Set when signature is entered</span>
            }
          </div>
          <div>
            <span className='font-medium'>IP Address: </span>
            {formData.ipAddress || <span className='italic'>Capturing…</span>}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`max-w-4xl mx-auto relative z-10 ${DOT_PAPER_CARD}`}
    >
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
          DRIVER EMPLOYMENT APPLICATION
        </h1>
        <p
          className={`text-lg ${
            isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          [COMPANY NAME, ADDRESS, PHONE NUMBER, AND EMAIL]
        </p>
        <p
          className={`text-sm ${
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
          COMPLETE IN FULL OR IT WILL NOT BE CONSIDERED.
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
      <div className='px-6 py-8'>
        <DotValidationBanner errors={errors} isDark={isDarkTheme(theme)} />
        {renderStepContent()}
      </div>

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
          {currentStep === STEPS.length ? 'Complete Application' : 'Next'}
        </button>
      </div>
    </div>
  )
}
