'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'

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
}

export default function PersonalInfoForm3({
  onComplete,
  onDataChange,
  initialData,
}: PersonalInfoForm3Props) {
  const { theme } = useTheme()
  const { requestHelp } = useAssistantBridge()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    // Employment History
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

      formData.employers.forEach((employer, index) => {
        if (!employer.isUnemployment) {
          // DOT § 383.35(c) Requirements
          if (!employer.name.trim())
            newErrors[`employer${index}Name`] = 'Employer name is required (DOT § 383.35)'
          if (!employer.address.trim()) {
            // Address is especially critical for last 3 years (verification required)
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
            newErrors[`employer${index}FMCSR`] =
              'Please specify FMCSR compliance'
          if (!employer.safetySensitiveFunction)
            newErrors[`employer${index}Safety`] =
              'Please specify safety-sensitive function'

          // Calculate years covered (only if dates are valid)
          // Parse MM/YYYY format dates
          if (employer.fromDate && employer.toDate) {
            const parseDate = (dateStr: string): Date | null => {
              if (!dateStr || dateStr === 'Present') return today
              // Handle MM/YYYY format
              const parts = dateStr.split('/')
              if (parts.length === 2) {
                const month = parseInt(parts[0]) - 1 // Month is 0-indexed
                const year = parseInt(parts[1])
                if (!isNaN(month) && !isNaN(year) && month >= 0 && month < 12) {
                  return new Date(year, month, 1)
                }
              }
              // Try ISO format as fallback
              const isoDate = new Date(dateStr)
              return isNaN(isoDate.getTime()) ? null : isoDate
            }

            const fromDate = parseDate(employer.fromDate)
            const toDate = parseDate(employer.toDate)
            
            if (fromDate && toDate) {
              // Only count years within the 10-year window
              const periodStart = fromDate > tenYearsAgo ? fromDate : tenYearsAgo
              const periodEnd = toDate < today ? toDate : today
              
              if (periodStart <= periodEnd) {
                const years = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
                totalYearsCovered += Math.max(0, years)
              }
            }
          }
        }
      })

      // DOT § 383.35: Must cover 10 years
      if (totalYearsCovered < 10) {
        const yearsMissing = (10 - totalYearsCovered).toFixed(1)
        newErrors.employmentYearsCoverage = 
          `DOT § 383.35 requires 10 years of employment history. You currently have ${totalYearsCovered.toFixed(1)} years covered. Please add ${yearsMissing} more years.`
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

  const addEmployer = () => {
    setFormData((prev) => ({
      ...prev,
      employers: [
        ...prev.employers,
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
    }))
  }

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

  const fillTestData = () => {
    // Smart fill: only fill EMPTY fields, preserve existing data (especially AI-extracted employment history)
    setFormData((prev) => ({
      // Employment History - preserve if exists, especially from AI
      employers: prev.employers?.length > 0 && prev.employers.some(emp => emp.name || emp.positionHeld)
        ? prev.employers.map((employer) => ({
            // Fill missing fields within existing employers
            name: employer.name || '',
            phone: employer.phone || '',
            address: employer.address || '',
            positionHeld: employer.positionHeld || '',
            fromDate: employer.fromDate || '',
            toDate: employer.toDate || '',
            reasonForLeaving: employer.reasonForLeaving || '',
            salary: employer.salary || '',
            gapsInEmployment: employer.gapsInEmployment || '',
            subjectToFMCSR: employer.subjectToFMCSR || 'yes',
            safetySensitiveFunction: employer.safetySensitiveFunction || 'yes',
            isUnemployment: employer.isUnemployment ?? false,
          }))
        : [
            {
              name: 'ABC Trucking Company',
              phone: '(555) 123-4567',
              address: '123 Highway Road, Columbus, OH 43215',
              positionHeld: 'Commercial Driver',
              fromDate: '01/2022',
              toDate: 'Present',
              reasonForLeaving: '',
              salary: '$55,000',
              gapsInEmployment: 'None',
              subjectToFMCSR: 'yes',
              safetySensitiveFunction: 'yes',
              isUnemployment: false,
            },
            {
              name: 'XYZ Logistics',
              phone: '(555) 987-6543',
              address: '456 Freight Lane, Cleveland, OH 44101',
              positionHeld: 'Delivery Driver',
              fromDate: '06/2019',
              toDate: '12/2021',
              reasonForLeaving: 'Better opportunity',
              salary: '$48,000',
              gapsInEmployment: 'None',
              subjectToFMCSR: 'yes',
              safetySensitiveFunction: 'yes',
              isUnemployment: false,
            },
          ],
      
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
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              theme === 'dark'
                ? 'border-brand-mint/40 text-brand-mint hover:bg-brand-mint/10'
                : 'border-brand-sage/40 text-brand-sage hover:bg-brand-sage/10'
            }`}
          >
            <span>📋</span>
            <span>Ask T about 10-year history</span>
          </button>
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
            
            formData.employers.forEach((employer) => {
              if (!employer.isUnemployment && employer.fromDate && employer.toDate) {
                const parseDate = (dateStr: string): Date | null => {
                  if (!dateStr || dateStr === 'Present') return today
                  const parts = dateStr.split('/')
                  if (parts.length === 2) {
                    const month = parseInt(parts[0]) - 1
                    const year = parseInt(parts[1])
                    if (!isNaN(month) && !isNaN(year) && month >= 0 && month < 12) {
                      return new Date(year, month, 1)
                    }
                  }
                  const isoDate = new Date(dateStr)
                  return isNaN(isoDate.getTime()) ? null : isoDate
                }
                
                const fromDate = parseDate(employer.fromDate)
                const toDate = parseDate(employer.toDate)
                
                if (fromDate && toDate) {
                  const periodStart = fromDate > tenYearsAgo ? fromDate : tenYearsAgo
                  const periodEnd = toDate < today ? toDate : today
                  if (periodStart <= periodEnd) {
                    const years = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
                    totalYears += Math.max(0, years)
                  }
                }
              }
            })
            return totalYears
          }
          
          const yearsCovered = calculateYearsCovered()
          const isComplete = yearsCovered >= 10
          
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
                <p className={`text-sm font-medium ${
                  isComplete
                    ? theme === 'dark' ? 'text-green-400' : 'text-green-800'
                    : theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
                }`}>
                  {isComplete
                    ? `✓ ${yearsCovered.toFixed(1)} years covered (meets DOT § 383.35 requirement)`
                    : `⚠ ${yearsCovered.toFixed(1)} of 10 years covered. Add ${(10 - yearsCovered).toFixed(1)} more years to meet DOT § 383.35 requirement.`
                  }
                </p>
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

      {formData.employers.map((employer, index) => (
        <div key={index} className='space-y-6'>
          <div className='flex justify-between items-center'>
            <div className='flex items-center space-x-3'>
              <h3
                className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
              >
                {index === 0
                  ? 'CURRENT (MOST RECENT) EMPLOYER'
                  : `EMPLOYER ${index + 1}`}
              </h3>
              {index < 3 && (
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    theme === 'dark'
                      ? 'bg-brand-mint text-gray-900'
                      : 'bg-brand-sage text-white'
                  }`}
                >
                  VERIFICATION REQUIRED
                </span>
              )}
              {index >= 3 && (
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    theme === 'dark'
                      ? 'bg-gray-600 text-gray-300'
                      : 'bg-gray-400 text-gray-700'
                  }`}
                >
                  SELF-REPORTED
                </span>
              )}
            </div>
            {formData.employers.length > 1 && (
              <button
                type='button'
                onClick={() => removeEmployer(index)}
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

          {/* Company Name and Phone */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='md:col-span-2'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                NAME
              </label>
              <input
                type='text'
                value={employer.name}
                onChange={(e) =>
                  handleInputChange(
                    'employers',
                    { name: e.target.value },
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
                PHONE
              </label>
              <input
                type='tel'
                value={employer.phone}
                onChange={(e) =>
                  handleInputChange(
                    'employers',
                    { phone: e.target.value },
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

          {/* Unemployment Checkbox */}
          <div className='flex items-center space-x-3'>
            <input
              type='checkbox'
              id={`isUnemployment-${index}`}
              checked={employer.isUnemployment}
              onChange={(e) =>
                handleInputChange(
                  'employers',
                  { isUnemployment: e.target.checked },
                  index
                )
              }
              className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'} accent-brand-mint`}
            />
            <label
              htmlFor={`isUnemployment-${index}`}
              className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
            >
              Check this box if this period was unemployment
            </label>
          </div>

          {/* Address */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
            >
              ADDRESS
            </label>
            <textarea
              value={employer.address}
              onChange={(e) =>
                handleInputChange(
                  'employers',
                  { address: e.target.value },
                  index
                )
              }
              rows={3}
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>

          {/* Position and Dates */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                POSITION HELD
              </label>
              <input
                type='text'
                value={employer.positionHeld}
                onChange={(e) =>
                  handleInputChange(
                    'employers',
                    { positionHeld: e.target.value },
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
                FROM (MO/YR) <span className="text-red-500">*</span>
              </label>
              <input
                type='text'
                value={employer.fromDate}
                onChange={(e) =>
                  handleInputChange(
                    'employers',
                    { fromDate: e.target.value },
                    index
                  )
                }
                placeholder='MM/YYYY'
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  errors[`employer${index}FromDate`]
                    ? 'border-red-500'
                    : theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
              {errors[`employer${index}FromDate`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`employer${index}FromDate`]}</p>
              )}
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                TO (MO/YR) <span className="text-red-500">*</span>
              </label>
              <input
                type='text'
                value={employer.toDate}
                onChange={(e) =>
                  handleInputChange(
                    'employers',
                    { toDate: e.target.value },
                    index
                  )
                }
                placeholder='MM/YYYY or "Present"'
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  errors[`employer${index}ToDate`]
                    ? 'border-red-500'
                    : theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
              {errors[`employer${index}ToDate`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`employer${index}ToDate`]}</p>
              )}
            </div>
          </div>

          {/* Reason for Leaving and Salary */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                REASON FOR LEAVING <span className="text-red-500">*</span>
                <span className="text-xs ml-2 text-gray-500">(DOT § 383.35(c)(3))</span>
              </label>
              <input
                type='text'
                value={employer.reasonForLeaving}
                onChange={(e) =>
                  handleInputChange(
                    'employers',
                    { reasonForLeaving: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  errors[`employer${index}Reason`]
                    ? 'border-red-500'
                    : theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
              {errors[`employer${index}Reason`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`employer${index}Reason`]}</p>
              )}
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                SALARY
              </label>
              <input
                type='text'
                value={employer.salary}
                onChange={(e) =>
                  handleInputChange(
                    'employers',
                    { salary: e.target.value },
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

          {/* Gaps in Employment */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
            >
              EXPLAIN ANY GAPS IN EMPLOYMENT (Include month/year & reason)
            </label>
            <textarea
              value={employer.gapsInEmployment}
              onChange={(e) =>
                handleInputChange(
                  'employers',
                  { gapsInEmployment: e.target.value },
                  index
                )
              }
              rows={3}
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>

          {/* DOT Questions */}
          <div className='space-y-4'>
            <div className='space-y-3'>
              <label
                className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                While employed here, were you subject to the Federal Motor
                Carrier Safety Regulations?
              </label>
              <div className='flex space-x-6'>
                <label className='flex items-center'>
                  <input
                    type='radio'
                    name={`subjectToFMCSR_${index}`}
                    value='yes'
                    checked={employer.subjectToFMCSR === 'yes'}
                    onChange={(e) =>
                      handleInputChange(
                        'employers',
                        { subjectToFMCSR: e.target.value },
                        index
                      )
                    }
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'} accent-brand-mint`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    YES
                  </span>
                </label>
                <label className='flex items-center'>
                  <input
                    type='radio'
                    name={`subjectToFMCSR_${index}`}
                    value='no'
                    checked={employer.subjectToFMCSR === 'no'}
                    onChange={(e) =>
                      handleInputChange(
                        'employers',
                        { subjectToFMCSR: e.target.value },
                        index
                      )
                    }
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'} accent-brand-mint`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    NO
                  </span>
                </label>
              </div>
            </div>

            <div className='space-y-3'>
              <label
                className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                Was the job designated as a safety-sensitive function in any
                Department of Transportation-regulated mode subject to alcohol
                and controlled substances testing as required by 49 CFR, part
                40?
              </label>
              <div className='flex space-x-6'>
                <label className='flex items-center'>
                  <input
                    type='radio'
                    name={`safetySensitiveFunction_${index}`}
                    value='yes'
                    checked={employer.safetySensitiveFunction === 'yes'}
                    onChange={(e) =>
                      handleInputChange(
                        'employers',
                        { safetySensitiveFunction: e.target.value },
                        index
                      )
                    }
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'} accent-brand-mint`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    YES
                  </span>
                </label>
                <label className='flex items-center'>
                  <input
                    type='radio'
                    name={`safetySensitiveFunction_${index}`}
                    value='no'
                    checked={employer.safetySensitiveFunction === 'no'}
                    onChange={(e) =>
                      handleInputChange(
                        'employers',
                        { safetySensitiveFunction: e.target.value },
                        index
                      )
                    }
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'} accent-brand-mint`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    NO
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Add More Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={addEmployer}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
          }`}
        >
          + Add Employer
        </button>
      </div>
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

        {/* Test Data Button */}
        <div className='mt-4'>
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
