'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'
import SaveProgressButton from './SaveProgressButton'
import { HelpCircle, Briefcase, Clock, GraduationCap, Truck, Shield, X, ChevronDown, Calendar } from 'lucide-react'

// History entry types
type HistoryEntryType = 'employment' | 'unemployment' | 'school' | 'drivingSchool' | 'military'

const HISTORY_TYPES = [
  { value: 'employment' as const, label: 'Employment / Contract', icon: Briefcase, color: 'bg-blue-500' },
  { value: 'unemployment' as const, label: 'Unemployment', icon: Clock, color: 'bg-yellow-500' },
  { value: 'school' as const, label: 'School / Education', icon: GraduationCap, color: 'bg-purple-500' },
  { value: 'drivingSchool' as const, label: 'Driving School / CDL Training', icon: Truck, color: 'bg-green-500' },
  { value: 'military' as const, label: 'Military Service', icon: Shield, color: 'bg-red-500' },
]

// Month/Year Picker Component
function MonthYearPicker({
  value,
  onChange,
  placeholder = 'Select date',
  allowPresent = false,
  error = false,
  theme = 'dark',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowPresent?: boolean
  error?: boolean
  theme?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(() => {
    if (value && value.toLowerCase() !== 'present') {
      const match = value.match(/(\d{4})/)
      return match ? parseInt(match[1]) : new Date().getFullYear()
    }
    return new Date().getFullYear()
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleMonthSelect = (monthIndex: number) => {
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
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 border-2 rounded-md text-left flex items-center justify-between ${
          error
            ? 'border-red-500'
            : theme === 'dark'
            ? 'bg-brand-cream border-gray-300 text-gray-900'
            : 'bg-white border-gray-300 text-gray-900'
        } ${!value ? 'text-gray-400' : ''}`}
      >
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          {displayValue}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className={`absolute z-50 mt-1 w-full rounded-lg shadow-xl border-2 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}>
          {/* Present option - prominent styling */}
          {allowPresent && (
            <button
              type="button"
              onClick={handlePresentSelect}
              className={`w-full px-4 py-3 text-left font-semibold flex items-center gap-3 ${
                isPresent
                  ? theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                  : theme === 'dark'
                    ? 'bg-brand-mint/20 text-brand-mint hover:bg-brand-mint/30'
                    : 'bg-brand-sage/20 text-brand-sage hover:bg-brand-sage/30'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                isPresent
                  ? theme === 'dark' ? 'bg-gray-900/20' : 'bg-white/30'
                  : theme === 'dark' ? 'bg-brand-mint/30' : 'bg-brand-sage/30'
              }`}>
                ✓
              </span>
              Present (Still here)
            </button>
          )}
          
          {/* Divider with "or select date" */}
          {allowPresent && (
            <div className={`px-4 py-2 text-xs text-center ${
              theme === 'dark' ? 'text-gray-500 bg-gray-800/50' : 'text-gray-400 bg-gray-50'
            }`}>
              — or select a specific date —
            </div>
          )}
          
          {/* Year selector */}
          <div className={`px-3 py-2 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={`w-full px-2 py-1 rounded ${
                theme === 'dark'
                  ? 'bg-gray-700 text-brand-cream border-gray-600'
                  : 'bg-gray-100 text-gray-900 border-gray-300'
              } border`}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1 p-2">
            {months.map((month, idx) => {
              const monthValue = `${String(idx + 1).padStart(2, '0')}/${selectedYear}`
              const isSelected = value === monthValue
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleMonthSelect(idx)}
                  className={`px-2 py-2 text-sm rounded transition-colors ${
                    isSelected
                      ? theme === 'dark'
                        ? 'bg-brand-mint text-gray-900 font-medium'
                        : 'bg-brand-sage text-white font-medium'
                      : theme === 'dark'
                        ? 'text-brand-cream hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {month}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const STEPS = [
  {
    id: 1,
    title: 'Employment History',
    description: 'Current and previous employment details',
  },
  {
    id: 2,
    title: 'Education',
    description: 'Educational background and qualifications',
  },
  {
    id: 3,
    title: 'Signature',
    description: 'Application completion and signature',
  },
]

interface PersonalInfoForm3Props {
  onComplete?: () => void
  onDataChange?: (data: any) => void
  initialData?: any
  walletAddress?: string
  /** Centralized save function - saves ALL forms to driver profile */
  onSaveProgress?: () => Promise<boolean | undefined>
}

export default function PersonalInfoForm3({
  onComplete,
  onDataChange,
  initialData,
  walletAddress,
  onSaveProgress,
}: PersonalInfoForm3Props) {
  const { theme } = useTheme()
  const { requestHelp } = useAssistantBridge()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // State for type selector modal
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  
  const [formData, setFormData] = useState({
    // Employment History - now with entry type
    employers: [] as Array<{
      type: HistoryEntryType
      name: string
      phone: string
      address: string
      positionHeld: string
      fromDate: string
      toDate: string
      reasonForLeaving: string
      salary: string
      gapsInEmployment: string
      subjectToFMCSR: string
      safetySensitiveFunction: string
      // Legacy field - kept for backwards compatibility
      isUnemployment: boolean
      // Additional fields for specific types
      schoolName?: string
      courseOfStudy?: string
      militaryBranch?: string
      dischargeType?: string
    }>,

    // Education
    education: [
      {
        schoolType: '',
        nameAndLocation: '',
        courseOfStudy: '',
        yearsCompleted: '',
        graduated: '',
        details: '',
      },
    ],

    // Other Qualifications
    otherQualifications: '',

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
  })

  const handleInputChange = (field: string, value: any, index?: number) => {
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
  useEffect(() => {
    // On initial mount with no data, don't sync the empty form state
    if (initialMountRef.current && (!initialData || Object.keys(initialData).length === 0)) {
      initialMountRef.current = false
      return
    }
    // After initial mount, or if we have initialData, always sync
    initialMountRef.current = false
    onDataChange?.(formData)
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
            name: '',
            phone: '',
            address: '',
            positionHeld: '',
            fromDate: '',
            toDate: '',
            reasonForLeaving: '',
            salary: '',
            gapsInEmployment: '',
            subjectToFMCSR: '',
            safetySensitiveFunction: '',
            isUnemployment: false,
          },
        ],
        education: [
          {
            schoolType: '',
            nameAndLocation: '',
            courseOfStudy: '',
            yearsCompleted: '',
            graduated: '',
            details: '',
          },
        ],
        otherQualifications: '',
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
      })
    }
    previousInitialDataRef.current = initialData
    
    if (hasHydratedRef.current) return
    if (initialData && Object.keys(initialData).length > 0) {
      hasHydratedRef.current = true
      setFormData((prev) => ({ ...prev, ...initialData }))
    }
  }, [initialData])

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

      formData.employers.forEach((employer, index) => {
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
          if (!employer.reasonForLeaving.trim())
            newErrors[`employer${index}Reason`] = 'Reason for leaving is required (DOT § 383.35(c)(3))'
          if (!employer.positionHeld.trim())
            newErrors[`employer${index}Position`] = 'Position held is required'
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
      // Education validation
      formData.education.forEach((edu, index) => {
        if (edu.schoolType?.trim() || edu.nameAndLocation?.trim()) {
          if (!edu.schoolType?.trim())
            newErrors[`education${index}Type`] = 'School type is required'
          if (!edu.nameAndLocation?.trim())
            newErrors[`education${index}Name`] =
              'School name and location is required'
        }
      })
    } else if (step === 3) {
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
        // Form is completed, call onComplete callback
        onComplete?.()
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

  const addHistoryEntry = (type: HistoryEntryType) => {
    setFormData((prev) => ({
      ...prev,
      employers: [
        ...prev.employers,
        {
          type,
          name: '',
          phone: '',
          address: '',
          positionHeld: '',
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
        },
      ],
    }))
    setShowTypeSelector(false)
  }
  
  // Legacy function for backwards compatibility
  const addEmployer = () => addHistoryEntry('employment')

  const removeEmployer = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      employers: prev.employers.filter((_, i) => i !== index),
    }))
  }

  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          schoolType: '',
          nameAndLocation: '',
          courseOfStudy: '',
          yearsCompleted: '',
          graduated: '',
          details: '',
        },
      ],
    }))
  }

  const removeEducation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
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
    // Smart fill: only fill EMPTY fields, preserve existing data (especially AI-extracted employment history)
    setFormData((prev) => ({
      // Employment History - preserve if exists, especially from AI
      employers: prev.employers?.length > 0 && prev.employers.some(emp => emp.name || emp.positionHeld)
        ? prev.employers.map((employer) => {
            // Check if this is a past job (not current) that needs reasonForLeaving
            const isPastJob = employer.toDate && employer.toDate !== 'Present' && employer.toDate.trim() !== ''
            const needsReason = isPastJob && !employer.isUnemployment && (!employer.reasonForLeaving || employer.reasonForLeaving.trim() === '')
            
            return {
              // Fill missing fields within existing employers
              name: employer.name || '',
              phone: employer.phone || '',
              address: employer.address || '',
              positionHeld: employer.positionHeld || '',
              fromDate: employer.fromDate || '',
              toDate: employer.toDate || '',
              // Fill reasonForLeaving for past jobs if missing
              reasonForLeaving: needsReason 
                ? 'Better opportunity' 
                : (employer.reasonForLeaving || ''),
              salary: employer.salary || '',
              gapsInEmployment: employer.gapsInEmployment || '',
              subjectToFMCSR: employer.subjectToFMCSR || 'yes',
              safetySensitiveFunction: employer.safetySensitiveFunction || 'yes',
              isUnemployment: employer.isUnemployment ?? false,
            }
          })
        : (() => {
            // Calculate dates relative to today to ensure 10+ years coverage
            const today = new Date()
            const currentYear = today.getFullYear()
            const currentMonth = today.getMonth() + 1 // 1-12
            
            return [
              // Current Job (starts 3 years ago)
              {
                name: 'ABC Trucking Company',
                phone: '(555) 123-4567',
                address: '123 Highway Road, Columbus, OH 43215',
                positionHeld: 'Commercial Driver',
                fromDate: `01/${currentYear - 3}`,
                toDate: 'Present',
                reasonForLeaving: '', // Current job doesn't need reason
                salary: '$55,000',
                gapsInEmployment: 'None',
                subjectToFMCSR: 'yes',
                safetySensitiveFunction: 'yes',
                isUnemployment: false,
              },
              // Previous Job (2.5 years)
              {
                name: 'XYZ Logistics',
                phone: '(555) 987-6543',
                address: '456 Freight Lane, Cleveland, OH 44101',
                positionHeld: 'Delivery Driver',
                fromDate: `06/${currentYear - 6}`,
                toDate: `12/${currentYear - 3}`,
                reasonForLeaving: 'Better opportunity',
                salary: '$48,000',
                gapsInEmployment: 'None',
                subjectToFMCSR: 'yes',
                safetySensitiveFunction: 'yes',
                isUnemployment: false,
              },
              // Earlier Job (2.2 years)
              {
                name: 'Midwest Transport Solutions',
                phone: '(555) 456-7890',
                address: '789 Industrial Blvd, Indianapolis, IN 46225',
                positionHeld: 'Regional Driver',
                fromDate: `03/${currentYear - 8}`,
                toDate: `05/${currentYear - 6}`,
                reasonForLeaving: 'Relocated for better pay',
                salary: '$45,000',
                gapsInEmployment: 'None',
                subjectToFMCSR: 'yes',
                safetySensitiveFunction: 'yes',
                isUnemployment: false,
              },
              // Unemployment Period (0.2 years) - Tests checkbox functionality
              {
                name: 'Unemployment',
                phone: '',
                address: '',
                positionHeld: 'Unemployed',
                fromDate: `01/${currentYear - 8}`,
                toDate: `02/${currentYear - 8}`,
                reasonForLeaving: 'Between jobs',
                salary: '',
                gapsInEmployment: 'Short gap between positions',
                subjectToFMCSR: 'no',
                safetySensitiveFunction: 'no',
                isUnemployment: true, // Checkbox will be checked
              },
              // Earlier Job (1.2 years)
              {
                name: 'Swift Delivery Services',
                phone: '(555) 234-5678',
                address: '321 Commerce Dr, Cincinnati, OH 45202',
                positionHeld: 'Local Delivery Driver',
                fromDate: `11/${currentYear - 9}`,
                toDate: `12/${currentYear - 8}`,
                reasonForLeaving: 'Seeking long-haul opportunities',
                salary: '$42,000',
                gapsInEmployment: 'None',
                subjectToFMCSR: 'yes',
                safetySensitiveFunction: 'yes',
                isUnemployment: false,
              },
              // Additional Job to reach 10+ years (0.7 years)
              {
                name: 'First Transport Inc',
                phone: '(555) 345-6789',
                address: '555 Main Street, Toledo, OH 43601',
                positionHeld: 'Entry Level Driver',
                fromDate: `03/${currentYear - 10}`,
                toDate: `09/${currentYear - 9}`,
                reasonForLeaving: 'Found better opportunity',
                salary: '$40,000',
                gapsInEmployment: 'None',
                subjectToFMCSR: 'yes',
                safetySensitiveFunction: 'yes',
                isUnemployment: false,
              },
            ]
          })(),
      
      // Education - add test data only if empty
      education: prev.education?.length > 0 && prev.education.some(edu => edu.nameAndLocation || edu.courseOfStudy)
        ? prev.education
        : [
            {
              schoolType: 'HIGH SCHOOL',
              nameAndLocation: 'Central High School, Columbus, OH',
              courseOfStudy: 'General Education',
              yearsCompleted: '4',
              graduated: 'yes',
              details: 'High School Diploma',
            },
            {
              schoolType: 'TRADE SCHOOL',
              nameAndLocation: 'Ohio Commercial Driving Academy, Columbus, OH',
              courseOfStudy: 'CDL Training',
              yearsCompleted: '0.5',
              graduated: 'yes',
              details: 'CDL-A Certification',
            },
          ],
      
      // Qualifications - only fill if empty
      otherQualifications: prev.otherQualifications || 'Certified in Hazardous Materials Transportation, First Aid/CPR Certified',
      
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
    }))
    setErrors({})
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderEmploymentHistory()
      case 2:
        return renderEducation()
      case 3:
        return renderSignature()
      default:
        return null
    }
  }

  const renderEmploymentHistory = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          EMPLOYMENT HISTORY
        </h2>
        <div className='flex justify-end mb-4 text-left'>
          <div className='rotating-silver-border'>
            <button
              type='button'
              onClick={() =>
                requestHelp({
                  section: 'Form 3 – Employment History',
                  question:
                    'What specifically must drivers include to satisfy the 10-year DOT employment history requirement?',
                  regulation: '49 CFR 391.21(b)(10) & 49 CFR 383.35',
                  context:
                    'Driver is reviewing the employment history step in PersonalInfoForm3 and wants to ensure the provided timeline is complete.',
                  dataSnapshot: formData.employers,
                })
              }
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-gray-800 text-brand-cream hover:bg-gray-700'
                  : 'bg-white text-brand-sage hover:bg-gray-50'
              }`}
            >
              <HelpCircle className='w-4 h-4' strokeWidth={2} />
              <span>Ask AvA about 10-year history</span>
            </button>
          </div>
        </div>
        <div
          className={`p-4 rounded-lg border-2 ${
            theme === 'dark'
              ? 'bg-brand-mint/10 border-brand-mint/30'
              : 'bg-brand-sage/10 border-brand-sage/30'
          }`}
        >
          <p
            className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
          >
            ⚠️ DOT § 383.35 - 10-Year Employment History Requirement
          </p>
          <p
            className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
          >
            <strong>
              Federal regulation requires 10 years of employment history:
            </strong>
          </p>
          <ul
            className={`text-sm mt-2 space-y-1 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
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
                  ? theme === 'dark'
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-green-50 border-green-200'
                  : theme === 'dark'
                    ? 'bg-yellow-900/20 border-yellow-500/50'
                    : 'bg-yellow-50 border-yellow-200'
              }`}>
                {/* Show total history entered */}
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                  📋 Employment history entered: <strong>{totalHistoryYears.toFixed(1)} years</strong>
                </p>
                
                {/* Main status message */}
                <p className={`text-sm font-medium ${
                  isComplete
                    ? theme === 'dark' ? 'text-green-400' : 'text-green-800'
                    : theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
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
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    💡 Tip: If you&apos;re still employed there, change the end date to &quot;Present&quot;. Otherwise, add your current status (new job, unemployment, etc.)
                  </p>
                )}
                
                {/* Collapsible breakdown */}
                <details className="mt-3">
                  <summary className={`text-xs cursor-pointer ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    📋 Show detailed breakdown
                  </summary>
                  <div className={`text-xs mt-2 p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <p className="mb-2">The DOT requires documentation of the <strong>last 10 years</strong> leading up to today.</p>
                    <ul className="space-y-1">
                      {formData.employers.map((emp, idx) => {
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
            theme === 'dark'
              ? 'bg-red-900/20 border-red-500/50'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm font-medium ${
              theme === 'dark' ? 'text-red-400' : 'text-red-800'
            }`}>
              {errors.employmentYearsCoverage}
            </p>
          </div>
        )}
        <p
          className={`text-sm mt-4 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          Start with your most recent position and work backwards. Include
          complete mailing addresses with street number, city, state, zip for
          all entries.
        </p>
      </div>

      {/* Show message if no entries yet */}
      {formData.employers.length === 0 && (
        <div className={`p-8 rounded-xl border-2 border-dashed text-center ${
          theme === 'dark' ? 'border-gray-600 bg-gray-800/30' : 'border-gray-300 bg-gray-50'
        }`}>
          <p className={`text-lg mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            No history entries yet
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            Click &quot;+ Add History Entry&quot; below to start documenting your 10-year history
          </p>
        </div>
      )}
      
      {formData.employers.map((employer, index) => {
        // Get type info for this entry (default to employment for legacy entries)
        const entryType = employer.type || (employer.isUnemployment ? 'unemployment' : 'employment')
        const typeInfo = HISTORY_TYPES.find(t => t.value === entryType) || HISTORY_TYPES[0]
        const TypeIcon = typeInfo.icon
        
        return (
        <div key={index} className={`rounded-xl border-2 overflow-hidden ${
          theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white'
        }`}>
          {/* Entry Header with Type Badge */}
          <div className={`flex items-center justify-between p-4 ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
          }`}>
            <div className='flex items-center gap-3'>
              <div className={`w-10 h-10 rounded-lg ${typeInfo.color} flex items-center justify-center`}>
                <TypeIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {index === 0 ? 'Most Recent' : `Entry ${index + 1}`} — {typeInfo.label}
                </h3>
                {entryType === 'employment' && index < 3 && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                    Verification Required
                  </span>
                )}
              </div>
            </div>
            <button
              type='button'
              onClick={() => removeEmployer(index)}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-red-900/50 text-red-400'
                  : 'hover:bg-red-50 text-red-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-5">
            {/* Date Range - Common to ALL types */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                  FROM <span className="text-red-500">*</span>
                </label>
                <MonthYearPicker
                  value={employer.fromDate}
                  onChange={(value) => handleInputChange('employers', { fromDate: value }, index)}
                  placeholder="Select start date"
                  error={!!errors[`employer${index}FromDate`]}
                  theme={theme}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                  TO <span className="text-red-500">*</span>
                </label>
                <MonthYearPicker
                  value={employer.toDate}
                  onChange={(value) => handleInputChange('employers', { toDate: value }, index)}
                  placeholder="Select end date"
                  allowPresent={true}
                  error={!!errors[`employer${index}ToDate`]}
                  theme={theme}
                />
              </div>
            </div>
            
            {/* EMPLOYMENT-specific fields */}
            {entryType === 'employment' && (
              <>
                {/* Company Name and Phone */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='md:col-span-2'>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                      EMPLOYER NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      type='text'
                      value={employer.name}
                      onChange={(e) => handleInputChange('employers', { name: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                      PHONE
                    </label>
                    <input
                      type='tel'
                      value={employer.phone}
                      onChange={(e) => handleInputChange('employers', { phone: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                      }`}
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    ADDRESS <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={employer.address}
                    onChange={(e) => handleInputChange('employers', { address: e.target.value }, index)}
                    rows={2}
                    placeholder="Street, City, State, ZIP"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>

                {/* Position and Salary */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                      POSITION HELD <span className="text-red-500">*</span>
                    </label>
                    <input
                      type='text'
                      value={employer.positionHeld}
                      onChange={(e) => handleInputChange('employers', { positionHeld: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                      SALARY
                    </label>
                    <input
                      type='text'
                      value={employer.salary}
                      onChange={(e) => handleInputChange('employers', { salary: e.target.value }, index)}
                      placeholder="e.g., $50,000/year"
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                      }`}
                    />
                  </div>
                </div>

                {/* Reason for Leaving */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    REASON FOR LEAVING <span className="text-red-500">*</span>
                    <span className="text-xs ml-2 opacity-60">(DOT § 383.35)</span>
                  </label>
                  <input
                    type='text'
                    value={employer.reasonForLeaving}
                    onChange={(e) => handleInputChange('employers', { reasonForLeaving: e.target.value }, index)}
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>

                {/* FMCSR Questions */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
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
                            className="mr-2 accent-brand-mint"
                          />
                          <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                            {val.toUpperCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
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
                            className="mr-2 accent-brand-mint"
                          />
                          <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                            {val.toUpperCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* UNEMPLOYMENT-specific fields */}
            {entryType === 'unemployment' && (
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-yellow-900/20 border border-yellow-700/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  <strong>Unemployment Period</strong> — This entry accounts for time between jobs. Only dates are required.
                </p>
                <div className="mt-3">
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    Optional: Explanation
                  </label>
                  <input
                    type='text'
                    value={employer.gapsInEmployment}
                    onChange={(e) => handleInputChange('employers', { gapsInEmployment: e.target.value }, index)}
                    placeholder="e.g., Looking for work, Personal reasons"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>
              </div>
            )}
            
            {/* SCHOOL-specific fields */}
            {entryType === 'school' && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    SCHOOL NAME <span className="text-red-500">*</span>
                  </label>
                  <input
                    type='text'
                    value={employer.name}
                    onChange={(e) => handleInputChange('employers', { name: e.target.value }, index)}
                    placeholder="Name of school or institution"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    COURSE OF STUDY
                  </label>
                  <input
                    type='text'
                    value={employer.courseOfStudy || ''}
                    onChange={(e) => handleInputChange('employers', { courseOfStudy: e.target.value }, index)}
                    placeholder="e.g., High School Diploma, Associate Degree"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>
              </>
            )}
            
            {/* DRIVING SCHOOL-specific fields */}
            {entryType === 'drivingSchool' && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    DRIVING SCHOOL NAME <span className="text-red-500">*</span>
                  </label>
                  <input
                    type='text'
                    value={employer.name}
                    onChange={(e) => handleInputChange('employers', { name: e.target.value }, index)}
                    placeholder="Name of CDL/driving school"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    CDL/CERTIFICATION OBTAINED
                  </label>
                  <input
                    type='text'
                    value={employer.courseOfStudy || ''}
                    onChange={(e) => handleInputChange('employers', { courseOfStudy: e.target.value }, index)}
                    placeholder="e.g., Class A CDL, Hazmat endorsement"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>
              </>
            )}
            
            {/* MILITARY-specific fields */}
            {entryType === 'military' && (
              <>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                      BRANCH OF SERVICE <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={employer.militaryBranch || ''}
                      onChange={(e) => handleInputChange('employers', { militaryBranch: e.target.value, name: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                      }`}
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
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                      DISCHARGE TYPE
                    </label>
                    <select
                      value={employer.dischargeType || ''}
                      onChange={(e) => handleInputChange('employers', { dischargeType: e.target.value }, index)}
                      className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
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
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
                    POSITION / MOS
                  </label>
                  <input
                    type='text'
                    value={employer.positionHeld}
                    onChange={(e) => handleInputChange('employers', { positionHeld: e.target.value }, index)}
                    placeholder="e.g., 88M Motor Transport Operator"
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        )
      })}

      {/* Add More Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={() => setShowTypeSelector(true)}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
          }`}
        >
          + Add History Entry
        </button>
      </div>
      
      {/* Type Selector Modal - Using Portal to escape parent container positioning issues */}
      {showTypeSelector && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTypeSelector(false)}
          />
          
          {/* Modal */}
          <div className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage-dark'
              }`}>
                Select History Type
              </h3>
              <button
                type="button"
                onClick={() => setShowTypeSelector(false)}
                className={`p-2 rounded-lg ${
                  theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className={`text-sm mb-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              What type of history entry would you like to add?
            </p>
            
            <div className="space-y-2">
              {HISTORY_TYPES.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => addHistoryEntry(value)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    theme === 'dark'
                      ? 'bg-gray-700/50 hover:bg-gray-700 text-brand-cream'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )

  const renderEducation = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          EDUCATION
        </h2>
      </div>

      {formData.education.map((edu, index) => (
        <div key={index} className='space-y-4'>
          <div className='flex justify-between items-center'>
            <h3
              className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
            >
              EDUCATION {index + 1}
            </h3>
            {formData.education.length > 1 && (
              <button
                type='button'
                onClick={() => removeEducation(index)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                  theme === 'dark'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Remove
              </button>
            )}
          </div>
          <div className='grid grid-cols-1 md:grid-cols-6 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                SCHOOL TYPE
              </label>
              <select
                value={edu.schoolType}
                onChange={(e) =>
                  handleInputChange(
                    'education',
                    { schoolType: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              >
                <option value=''>Select school type...</option>
                <option value='HIGH SCHOOL'>High School</option>
                <option value='COLLEGE'>College</option>
                <option value='UNIVERSITY'>University</option>
                <option value='TRADE SCHOOL'>Trade School</option>
                <option value='VOCATIONAL'>Vocational</option>
                <option value='CERTIFICATION'>Certification Program</option>
                <option value='OTHER'>Other</option>
              </select>
            </div>
            <div className='md:col-span-2'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                NAME & LOCATION
              </label>
              <input
                type='text'
                value={edu.nameAndLocation}
                onChange={(e) =>
                  handleInputChange(
                    'education',
                    { nameAndLocation: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                COURSE OF STUDY
              </label>
              <input
                type='text'
                value={edu.courseOfStudy}
                onChange={(e) =>
                  handleInputChange(
                    'education',
                    { courseOfStudy: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                YEARS
              </label>
              <input
                type='text'
                value={edu.yearsCompleted}
                onChange={(e) =>
                  handleInputChange(
                    'education',
                    { yearsCompleted: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                GRADUATE (Y/N)
              </label>
              <div className='flex space-x-4'>
                <label className='flex items-center'>
                  <input
                    type='radio'
                    name={`graduated_${index}`}
                    value='yes'
                    checked={edu.graduated === 'yes'}
                    onChange={(e) =>
                      handleInputChange(
                        'education',
                        { graduated: e.target.value },
                        index
                      )
                    }
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'} accent-brand-mint`}
                  />
                  <span
                    className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    Y
                  </span>
                </label>
                <label className='flex items-center'>
                  <input
                    type='radio'
                    name={`graduated_${index}`}
                    value='no'
                    checked={edu.graduated === 'no'}
                    onChange={(e) =>
                      handleInputChange(
                        'education',
                        { graduated: e.target.value },
                        index
                      )
                    }
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'} accent-brand-mint`}
                  />
                  <span
                    className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    N
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Details field - full width */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
            >
              DETAILS
            </label>
            <input
              type='text'
              value={edu.details}
              onChange={(e) =>
                handleInputChange(
                  'education',
                  { details: e.target.value },
                  index
                )
              }
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>
      ))}

      {/* Add More Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={addEducation}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
          }`}
        >
          + Add Education
        </button>
      </div>

      {/* Other Qualifications */}
      <div className='space-y-4'>
        <h3
          className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          OTHER QUALIFICATIONS
        </h3>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          Please list any other qualifications that you have and which you
          believe should be considered.
        </p>
        <textarea
          value={formData.otherQualifications}
          onChange={(e) =>
            handleInputChange('otherQualifications', e.target.value)
          }
          rows={6}
          className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
            theme === 'dark'
              ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
              : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
          }`}
        />
      </div>
    </div>
  )

  const renderSignature = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          TO BE READ AND SIGNED BY APPLICANT
        </h2>
      </div>
      <div className='flex justify-end mb-4 text-left'>
        <button
          type='button'
          onClick={() =>
            requestHelp({
              section: 'Form 3 – Final Certifications',
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
            theme === 'dark'
              ? 'border-brand-mint/40 text-brand-mint hover:bg-brand-mint/10'
              : 'border-brand-sage/40 text-brand-sage hover:bg-brand-sage/10'
          }`}
        >
          <span>✍️</span>
          <span>Break down the acknowledgements</span>
        </button>
      </div>

      <div
        className={`p-6 rounded-lg border-2 ${
          theme === 'dark'
            ? 'bg-white border-gray-300'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div
          className={`text-sm space-y-4 ${theme === 'dark' ? 'text-gray-900' : 'text-gray-800'}`}
        >
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
            className={`mt-4 p-4 rounded-lg border ${
              theme === 'dark'
                ? 'bg-brand-mint/10 border-brand-mint/30 text-gray-900'
                : 'bg-brand-sage/10 border-brand-sage/30 text-brand-sage'
            }`}
          >
            <p className='text-sm font-semibold'>Reminder: 49 CFR 391.41 Medical Qualification</p>
            <p className='text-sm mt-2'>
              Motor carriers must verify that your medical certificate is current, retain it in your driver qualification file, and keep any variance documentation on hand. Please ensure the medical information you provided is accurate so we can stay compliant.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`p-4 rounded-lg border-2 ${
          theme === 'dark'
            ? 'bg-brand-mint/10 border-brand-mint/30'
            : 'bg-brand-sage/10 border-brand-sage/30'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
          }`}
        >
          49 CFR 391.21(d) Disclosure — Safety Performance History Investigation
        </p>
        <p
          className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-gray-800' : 'text-brand-sage/80'
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
              theme === 'dark'
                ? 'border-brand-mint bg-transparent accent-brand-mint'
                : 'border-brand-sage bg-white accent-brand-sage'
            }`}
          />
          <span
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-900' : 'text-gray-800'
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
          theme === 'dark'
            ? 'bg-brand-mint/10 border-brand-mint/30'
            : 'bg-brand-sage/10 border-brand-sage/30'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
          }`}
        >
          49 CFR 391.23 Consent — Previous Employer &amp; Clearinghouse Investigations
        </p>
        <p
          className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-gray-800' : 'text-brand-sage/80'
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
              theme === 'dark'
                ? 'border-brand-mint bg-transparent accent-brand-mint'
                : 'border-brand-sage bg-white accent-brand-sage'
            }`}
          />
          <span
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-900' : 'text-gray-800'
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
          theme === 'dark'
            ? 'bg-brand-mint/10 border-brand-mint/30'
            : 'bg-brand-sage/10 border-brand-sage/30'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
          }`}
        >
          49 CFR 391.31 Road Test Requirement
        </p>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-800' : 'text-brand-sage/80'
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
              theme === 'dark'
                ? 'border-brand-mint bg-transparent accent-brand-mint'
                : 'border-brand-sage bg-white accent-brand-sage'
            }`}
          />
          <span
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-900' : 'text-gray-800'
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
              theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
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
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  } accent-brand-mint`}
                />
                <span
                  className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                  : theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
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
          theme === 'dark'
            ? 'bg-brand-mint/10 border-brand-mint/30'
            : 'bg-brand-sage/10 border-brand-sage/30'
        }`}
      >
        <p
          className={`text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
          }`}
        >
          Road Test Equivalent (49 CFR 391.33)
        </p>
        <p
          className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-gray-800' : 'text-brand-sage/80'
          }`}
        >
          If you already hold a valid CDL for the assigned vehicle class or have a road test certificate issued in the last 3 years, we can accept that documentation instead of retesting. Upload clear copies so we can retain them in your driver qualification file per § 391.33(b).
        </p>

        <div className='space-y-3'>
          <p
            className={`text-sm font-medium ${
              theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
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
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  } accent-brand-mint`}
                />
                <span
                  className={`${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
              theme === 'dark'
                ? 'file:bg-brand-mint file:text-gray-900'
                : 'file:bg-brand-sage file:text-white'
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
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            We'll store these documents securely to satisfy § 391.33(b). If you prefer to provide them later, let us know during onboarding.
          </p>
        </div>
      </div>

      <div
        className={`mt-6 p-4 rounded-lg border-2 ${
          theme === 'dark'
            ? 'bg-brand-mint/10 border-brand-mint/30'
            : 'bg-brand-sage/10 border-brand-sage/30'
        }`}
      >
        <p
          className={`text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
          }`}
        >
          Driver Qualification File Checklist (49 CFR 391.51)
        </p>
        <p
          className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-gray-800' : 'text-brand-sage/80'
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
              theme === 'dark'
                ? 'border-brand-mint bg-transparent accent-brand-mint'
                : 'border-brand-sage bg-white accent-brand-sage'
            }`}
          />
          <span
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-900' : 'text-gray-800'
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
                theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
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
                      theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                    } accent-brand-mint`}
                  />
                  <span
                    className={`${
                      theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
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
                      theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                    } accent-brand-mint`}
                  />
                  <span
                    className={`${
                      theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
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
                      theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                    } accent-brand-mint`}
                  />
                  <span
                    className={`${
                      theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                theme === 'dark' ? 'text-gray-900' : 'text-brand-sage'
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
                      theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                    } accent-brand-mint`}
                  />
                  <span
                    className={`${
                      theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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

      <div className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
              }`}
            >
              Applicant Signature
            </label>
            <input
              type='text'
              value={formData.applicantSignature}
              onChange={(e) =>
                handleInputChange('applicantSignature', e.target.value)
              }
              placeholder='Type your full name as signature'
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
              }`}
            >
              Date
            </label>
            <input
              type='date'
              value={formData.signatureDate}
              onChange={(e) => handleInputChange('signatureDate', e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
            }`}
          >
            Applicant Name (printed)
          </label>
          <input
            type='text'
            value={formData.applicantNamePrinted}
            onChange={(e) =>
              handleInputChange('applicantNamePrinted', e.target.value)
            }
            placeholder='Print your full name'
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`max-w-4xl mx-auto rounded-lg shadow-xl border-t-4 relative z-10 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl border-brand-mint'
          : 'bg-white/80 backdrop-blur-xl border-t-brand-sage border-gray-200'
      }`}
    >
      {/* Header */}
      <div
        className={`text-center py-8 px-6 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <h1
          className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-brand-sage'
          }`}
        >
          DRIVER EMPLOYMENT APPLICATION
        </h1>
        <p
          className={`text-lg ${
            theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'
          }`}
        >
          [COMPANY NAME, ADDRESS, PHONE NUMBER, AND EMAIL]
        </p>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-brand-sage/60'
          }`}
        >
          An Equal Opportunity Employer
        </p>
        <p
          className={`text-sm font-semibold mt-2 ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
          }`}
        >
          COMPLETE IN FULL OR IT WILL NOT BE CONSIDERED.
        </p>

        {/* Save and Test Data Buttons */}
        <div className='mt-4 flex flex-wrap items-center gap-3'>
          <SaveProgressButton
            onSaveProgress={onSaveProgress}
            walletAddress={walletAddress}
          />
          <button
            type='button'
            onClick={fillTestData}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow hover:shadow-md ${
              theme === 'dark'
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
              theme === 'dark' ? 'text-white' : 'text-brand-sage'
            }`}
          >
            Step {currentStep} of {STEPS.length}
          </div>
          <div
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'
            }`}
          >
            {Math.round((currentStep / STEPS.length) * 100)}% Complete
          </div>
        </div>
        <div
          className={`w-full bg-gray-200 rounded-full h-2 ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}
        >
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-brand-mint to-brand-cream'
                : 'bg-gradient-to-r from-brand-sage to-brand-mint'
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
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
            currentStep === 1
              ? 'opacity-50 cursor-not-allowed'
              : theme === 'dark'
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
                  ? theme === 'dark'
                    ? 'bg-brand-mint'
                    : 'bg-brand-sage'
                  : theme === 'dark'
                    ? 'bg-gray-600'
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <button
          onClick={nextStep}
          className={`px-4 py-2 rounded-md font-semibold transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
          }`}
        >
          {currentStep === STEPS.length ? 'Complete Application' : 'Next'}
        </button>
      </div>
    </div>
  )
}
