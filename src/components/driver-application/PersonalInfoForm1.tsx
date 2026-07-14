'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'
import SaveProgressButton from './SaveProgressButton'
import { PhoneInput, SSNInput, ZipCodeInput } from '@/components/ui/MaskedInputs'
import { StateSelect } from '@/components/ui/StateSelect'
import AskStormiButton from '@/components/ui/AskStormiButton'
import VerifiedFieldBadge from '@/components/driver-application/VerifiedFieldBadge'
import {
  getLockedPaths,
  type DotFieldPath,
  type DotForm1FieldProvenance,
} from '@/lib/dot-field-provenance'
import type { AttestationBadgeSummary } from '@/lib/dot-attestation-badge'

// Motor carrier (employing carrier) is not collected here — it is injected by the
// specific employer when a driver's application is linked to their company.

const STEPS = [
  {
    id: 1,
    title: 'Personal Information',
    description: 'Basic applicant details and contact information',
  },
  {
    id: 2,
    title: 'Residency History',
    description: 'Address history for the past three years',
  },
  {
    id: 3,
    title: 'License Information',
    description: 'Licenses, med card, and disqualification disclosures',
  },
]

/** Full shape matches `DotForm1Data.medicalQualification` so saves stay compatible with previews/mappers. */
const EMPTY_MEDICAL_QUALIFICATION = {
  hasValidMedicalCertificate: '',
  medicalCertificateExpiration: '',
  hasFiledWithState: '',
  hasMedicalVariance: '',
  medicalVarianceDetails: '',
  hasChronicConditions: '',
  chronicConditionsDetails: '',
  visionHearingCompliance: '',
  medicationDisclosure: '',
  medicalExamDate: '',
  medicalExaminerName: '',
  medicalExaminerPhone: '',
  medicalExaminerRegistryId: '',
  medicalExaminerType: '',
}

interface PersonalInfoForm1Props {
  onNavigateToForm?: (formNumber: number) => void
  onDataChange?: (data: any) => void
  initialData?: any
  sessionUserId?: string
  /** Centralized save function - saves ALL forms to driver profile */
  onSaveProgress?: () => Promise<boolean | undefined>
  /** P3.7 — MVR-projected field locks (identity + primary license). */
  fieldProvenance?: DotForm1FieldProvenance | null
  /** Active attestations for honesty-tier badge upgrades */
  attestations?: AttestationBadgeSummary[]
}

export default function PersonalInfoForm1({
  onNavigateToForm,
  onDataChange,
  initialData,
  sessionUserId,
  onSaveProgress,
  fieldProvenance = null,
  attestations = [],
}: PersonalInfoForm1Props) {
  const { theme } = useTheme()
  const { requestHelp } = useAssistantBridge()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const lockedPaths = getLockedPaths(fieldProvenance)
  const isLocked = (path: DotFieldPath) => lockedPaths.has(path)
  const lockEntry = (path: DotFieldPath) => fieldProvenance?.fields?.[path] ?? null
  const lockedInputClass = isDarkTheme(theme)
    ? 'bg-gray-800/80 cursor-not-allowed opacity-90'
    : 'bg-gray-100 cursor-not-allowed'
  const [formData, setFormData] = useState({
    // Applicant Information
    firstName: '',
    middleName: '',
    lastName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    socialSecurity: '',
    dateOfApplication: '',
    positionAppliedFor: '',
    dateAvailableForWork: '',
    hasLegalRightToWork: '',

    // Residency History
    currentMailing: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      yearsAtAddress: '',
    },
    previousAddresses: [],

    // License Information
    currentLicenses: [
      {
        state: '',
        licenseNumber: '',
        typeClass: '',
        endorsements: '',
        expirationDate: '',
      },
    ],
    previousLicenses: [],
    medicalQualification: { ...EMPTY_MEDICAL_QUALIFICATION },
    disqualificationHistory: {
      hasLicenseSuspension: '',
      licenseSuspensionDetails: '',
      hasDisqualifyingOffense: '',
      disqualifyingOffenseDetails: '',
      hasOutOfServiceViolation: '',
      outOfServiceViolationDetails: '',
      hasMobileDeviceViolation: '',
      mobileDeviceViolationDetails: '',
    },
  })

  const handleInputChange = (field: string, value: any, index?: number) => {
    // P3.7 — ignore client edits to MVR-locked paths (server also re-projects on save)
    if (index === undefined) {
      if (
        (field === 'firstName' ||
          field === 'middleName' ||
          field === 'lastName' ||
          field === 'dateOfBirth') &&
        isLocked(field)
      ) {
        return
      }
    } else if (field === 'currentLicenses' && index === 0 && typeof value === 'object') {
      const keys = Object.keys(value)
      const filtered: Record<string, unknown> = {}
      for (const k of keys) {
        const path = `currentLicenses.0.${k}` as DotFieldPath
        if (!isLocked(path)) filtered[k] = (value as Record<string, unknown>)[k]
      }
      if (Object.keys(filtered).length === 0) return
      value = filtered
    }

    setFormData((prev) => {
      if (index !== undefined) {
        // Handle array updates with object values
        if (typeof value === 'object') {
          return {
            ...prev,
            [field]: prev[field].map((item: any, i: number) =>
              i === index ? { ...item, ...value } : item
            ),
          }
        }
        // Handle array updates with string values (single field updates)
        const fieldName = Object.keys(value)[0]
        const fieldValue = value[fieldName]
        return {
          ...prev,
          [field]: prev[field].map((item: any, i: number) =>
            i === index ? { ...item, [fieldName]: fieldValue } : item
          ),
        }
      }
      // Handle object updates (like currentMailing)
      if (typeof value === 'object') {
        return {
          ...prev,
          [field]: { ...prev[field], ...value },
        }
      }
      // Handle simple string updates
      return {
        ...prev,
        [field]: value,
      }
    })
  }

  // Sync local edits up to the store. ONLY depend on formData — putting
  // initialData / fieldProvenance here caused React #185 (max update depth):
  // sync → setForm1Data → new initialData → sync → … forever.
  const initialMountRef = useRef(true)
  const onDataChangeRef = useRef(onDataChange)
  const fieldProvenanceRef = useRef(fieldProvenance)
  const initialDataRef = useRef(initialData)
  const lastSyncedJsonRef = useRef<string>('')
  onDataChangeRef.current = onDataChange
  fieldProvenanceRef.current = fieldProvenance
  initialDataRef.current = initialData

  useEffect(() => {
    // On initial mount with no data, don't sync the empty form state
    if (initialMountRef.current && (!initialDataRef.current || Object.keys(initialDataRef.current).length === 0)) {
      initialMountRef.current = false
      return
    }
    initialMountRef.current = false

    const provenance =
      fieldProvenanceRef.current ??
      (initialDataRef.current as { _fieldProvenance?: DotForm1FieldProvenance } | null)
        ?._fieldProvenance
    const payload = provenance ? { ...formData, _fieldProvenance: provenance } : formData

    // Skip if nothing actually changed — stops parent↔child ping-pong
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
    console.log('📋 [FORM1] Hydration effect:', {
      hasHydrated: hasHydratedRef.current,
      hasInitialData: !!initialData,
      initialDataKeys: initialData ? Object.keys(initialData) : [],
      initialDataFirstName: initialData?.firstName,
      hasPreviousData: !!previousInitialDataRef.current,
    })
    
    // If initialData becomes null/undefined after having data, reset the form
    if (previousInitialDataRef.current && !initialData) {
      console.log('📋 [FORM1] Resetting form (initialData became null)')
      hasHydratedRef.current = false
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        socialSecurity: '',
        dateOfApplication: '',
        positionAppliedFor: '',
        dateAvailableForWork: '',
        hasLegalRightToWork: '',
        currentMailing: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          yearsAtAddress: '',
        },
        previousAddresses: [],
        currentLicenses: [
          {
            state: '',
            licenseNumber: '',
            typeClass: '',
            endorsements: '',
            expirationDate: '',
          },
        ],
        previousLicenses: [],
        medicalQualification: { ...EMPTY_MEDICAL_QUALIFICATION },
        disqualificationHistory: {
          hasLicenseSuspension: '',
          licenseSuspensionDetails: '',
          hasDisqualifyingOffense: '',
          disqualifyingOffenseDetails: '',
          hasOutOfServiceViolation: '',
          outOfServiceViolationDetails: '',
          hasMobileDeviceViolation: '',
          mobileDeviceViolationDetails: '',
        },
      })
    }
    previousInitialDataRef.current = initialData
    
    // Check if initialData has MEANINGFUL content (not just empty strings)
    const hasMeaningfulData = initialData && (
      initialData.firstName || 
      initialData.lastName || 
      initialData.currentLicenses?.[0]?.licenseNumber
    )
    
    // Allow re-hydration if:
    // 1. Never hydrated before, OR
    // 2. New data has meaningful content AND current form doesn't have that data
    const shouldHydrate = !hasHydratedRef.current || (
      hasMeaningfulData && 
      !formData.firstName && 
      initialData.firstName
    )
    
    if (!shouldHydrate) {
      if (hasHydratedRef.current) {
        console.log('📋 [FORM1] Already hydrated, skipping')
      }
      return
    }
    
    if (initialData && Object.keys(initialData).length > 0) {
      console.log('📋 [FORM1] Hydrating form with initialData:', initialData.firstName, initialData.lastName)
      hasHydratedRef.current = true
      setFormData((prev) => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      // Personal Information validation
      if (!formData.firstName.trim())
        newErrors.firstName = 'First name is required'
      if (!formData.lastName.trim())
        newErrors.lastName = 'Last name is required'
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required'
      if (!formData.email.trim()) newErrors.email = 'Email is required'
      if (!formData.dateOfBirth) {
        newErrors.dateOfBirth = 'Date of birth is required'
      } else {
        const dob = new Date(formData.dateOfBirth)
        if (Number.isNaN(dob.getTime())) {
          newErrors.dateOfBirth = 'Please enter a valid date of birth'
        } else {
          const now = new Date()
          let age = now.getFullYear() - dob.getFullYear()
          const monthDiff = now.getMonth() - dob.getMonth()
          const dayDiff = now.getDate() - dob.getDate()
          if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            age -= 1
          }
          if (age < 21) {
            newErrors.dateOfBirthAge = 'Driver must be at least 21 years old (49 CFR 391.11).'
          }
        }
      }
      if (!formData.socialSecurity.trim())
        newErrors.socialSecurity = 'Social Security Number is required'
      if (!formData.dateOfApplication)
        newErrors.dateOfApplication = 'Application date is required'
      if (!formData.dateAvailableForWork)
        newErrors.dateAvailableForWork = 'Available date is required'
      if (!formData.hasLegalRightToWork)
        newErrors.hasLegalRightToWork = 'Please specify work authorization'
    } else if (step === 2) {
      // Residency History validation
      if (!formData.currentMailing?.street?.trim())
        newErrors.currentMailingStreet = 'Current street address is required'
      if (!formData.currentMailing?.city?.trim())
        newErrors.currentMailingCity = 'Current city is required'
      if (!formData.currentMailing?.state?.trim())
        newErrors.currentMailingState = 'Current state is required'
      if (!formData.currentMailing?.zipCode?.trim())
        newErrors.currentMailingZip = 'Current ZIP code is required'
      if (!formData.currentMailing?.yearsAtAddress?.trim())
        newErrors.currentMailingYears = 'Years at address is required'

      // Validate previous addresses
      formData.previousAddresses?.forEach((addr, index) => {
        if (
          addr.street?.trim() ||
          addr.city?.trim() ||
          addr.state?.trim() ||
          addr.zipCode?.trim()
        ) {
          if (!addr.street?.trim())
            newErrors[`previousAddress${index}Street`] =
              'Street address is required'
          if (!addr.city?.trim())
            newErrors[`previousAddress${index}City`] = 'City is required'
          if (!addr.state?.trim())
            newErrors[`previousAddress${index}State`] = 'State is required'
          if (!addr.zipCode?.trim())
            newErrors[`previousAddress${index}Zip`] = 'ZIP code is required'
          if (!addr.yearsAtAddress?.trim())
            newErrors[`previousAddress${index}Years`] =
              'Years at address is required'
        }
      })

      // Validate total years must be at least 3
      const currentYears = parseFloat(formData.currentMailing?.yearsAtAddress || '0') || 0
      const previousYears = formData.previousAddresses?.reduce((total, addr) => {
        const years = parseFloat(addr.yearsAtAddress || '0') || 0
        return total + years
      }, 0) || 0
      
      const totalYears = currentYears + previousYears
      
      // Only error if less than 3 years (more than 3 is acceptable)
      if (totalYears > 0 && totalYears < 3) {
        newErrors.totalYears = `You must provide at least 3 years of residency history. Currently showing ${totalYears.toFixed(1)} years total.`
      }
    } else if (step === 3) {
      // License Information validation - validate all current licenses
      formData.currentLicenses?.forEach((license, index) => {
        if (!license.state?.trim())
          newErrors[`currentLicense${index}State`] = 'License state is required'
        if (!license.licenseNumber?.trim())
          newErrors[`currentLicense${index}Number`] =
            'License number is required'
        if (!license.typeClass?.trim())
          newErrors[`currentLicense${index}Class`] = 'License class is required'
        if (!license.expirationDate?.trim())
          newErrors[`currentLicense${index}ExpirationDate`] =
            'Expiration date is required'
      })

      // Validate previous licenses
      formData.previousLicenses?.forEach((license, index) => {
        if (
          license.licenseNumber?.trim() ||
          license.state?.trim() ||
          license.typeClass?.trim()
        ) {
          if (!license.state?.trim())
            newErrors[`previousLicense${index}State`] =
              'License state is required'
          if (!license.licenseNumber?.trim())
            newErrors[`previousLicense${index}Number`] =
              'License number is required'
          if (!license.typeClass?.trim())
            newErrors[`previousLicense${index}Class`] =
              'License class is required'
          if (!license.expirationDate?.trim())
            newErrors[`previousLicense${index}ExpirationDate`] =
              'Expiration date is required'
        }
      })

      const med = formData.medicalQualification || EMPTY_MEDICAL_QUALIFICATION
      if (!med.hasValidMedicalCertificate) {
        newErrors.hasValidMedicalCertificate =
          'Please indicate whether you have a valid med card (medical examiner’s certificate)'
      } else if (
        med.hasValidMedicalCertificate === 'yes' &&
        !med.medicalCertificateExpiration?.trim()
      ) {
        newErrors.medicalCertificateExpiration =
          'Med card expiration date is required when you answer Yes'
      }

      // DOT 49 CFR 391.15 disclosures
      const history = formData.disqualificationHistory || {}

      if (!history.hasLicenseSuspension) {
        newErrors.hasLicenseSuspension =
          'Please confirm if your CDL has ever been suspended or revoked'
      } else if (history.hasLicenseSuspension === 'yes' && !history.licenseSuspensionDetails.trim()) {
        newErrors.licenseSuspensionDetails =
          'Provide details for any license suspension, revocation, withdrawal, or denial'
      }

      if (!history.hasDisqualifyingOffense) {
        newErrors.hasDisqualifyingOffense =
          'Please state whether you have any disqualifying offense convictions'
      } else if (history.hasDisqualifyingOffense === 'yes' && !history.disqualifyingOffenseDetails.trim()) {
        newErrors.disqualifyingOffenseDetails =
          'Describe the disqualifying offense(s) and resolution'
      }

      if (!history.hasOutOfServiceViolation) {
        newErrors.hasOutOfServiceViolation =
          'Please confirm if you have violated an out-of-service order'
      } else if (
        history.hasOutOfServiceViolation === 'yes' &&
        !history.outOfServiceViolationDetails.trim()
      ) {
        newErrors.outOfServiceViolationDetails =
          'Describe any out-of-service order violations'
      }

      if (!history.hasMobileDeviceViolation) {
        newErrors.hasMobileDeviceViolation =
          'Please confirm if you have texting or hand-held mobile violations in a CMV'
      } else if (
        history.hasMobileDeviceViolation === 'yes' &&
        !history.mobileDeviceViolationDetails.trim()
      ) {
        newErrors.mobileDeviceViolationDetails =
          'Describe the mobile device violation(s)'
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
        // Form is completed, navigate to Form 2
        onNavigateToForm?.(2)
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

  const addPreviousAddress = () => {
    setFormData((prev) => ({
      ...prev,
      previousAddresses: [
        ...prev.previousAddresses,
        { street: '', city: '', state: '', zipCode: '', yearsAtAddress: '' },
      ],
    }))
  }

  const removePreviousAddress = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      previousAddresses: prev.previousAddresses.filter((_, i) => i !== index),
    }))
  }

  const addCurrentLicense = () => {
    setFormData((prev) => ({
      ...prev,
      currentLicenses: [
        ...prev.currentLicenses,
        {
          state: '',
          licenseNumber: '',
          typeClass: '',
          endorsements: '',
          expirationDate: '',
        },
      ],
    }))
  }

  const removeCurrentLicense = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      currentLicenses: prev.currentLicenses.filter((_, i) => i !== index),
    }))
  }

  const addPreviousLicense = () => {
    setFormData((prev) => ({
      ...prev,
      previousLicenses: [
        ...prev.previousLicenses,
        {
          state: '',
          licenseNumber: '',
          typeClass: '',
          endorsements: '',
          expirationDate: '',
        },
      ],
    }))
  }

  const removePreviousLicense = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      previousLicenses: prev.previousLicenses.filter((_, i) => i !== index),
    }))
  }

  const fillTestData = () => {
    // Smart fill: only fill EMPTY fields, preserve AI-extracted data
    setFormData((prev) => ({
      // Personal Information - only fill if empty
      firstName: prev.firstName || 'John',
      middleName: prev.middleName || 'Michael',
      lastName: prev.lastName || 'Doe',
      phone: prev.phone || '(555) 123-4567',
      email: prev.email || 'john.doe@email.com',
      dateOfBirth: prev.dateOfBirth || '1985-03-15',
      socialSecurity: prev.socialSecurity || '123-45-6789',
      dateOfApplication: prev.dateOfApplication || new Date().toISOString().slice(0, 10),
      positionAppliedFor: prev.positionAppliedFor || 'Commercial Driver',
      dateAvailableForWork: prev.dateAvailableForWork || new Date().toISOString().slice(0, 10),
      hasLegalRightToWork: prev.hasLegalRightToWork || 'yes',
      
      // Current Mailing - only fill empty fields within the object
      currentMailing: {
        street: prev.currentMailing?.street || '123 Main Street',
        city: prev.currentMailing?.city || 'Columbus',
        state: prev.currentMailing?.state || 'OH',
        zipCode: prev.currentMailing?.zipCode || '43215',
        yearsAtAddress: prev.currentMailing?.yearsAtAddress || '3',
      },
      
      // Previous Addresses - add test address only if none exist
      previousAddresses: prev.previousAddresses?.length > 0 
        ? prev.previousAddresses 
        : [
            {
              street: '456 Oak Avenue',
              city: 'Cleveland',
              state: 'OH',
              zipCode: '44101',
              yearsAtAddress: '2',
            },
          ],
      
      // Current Licenses - fill missing fields in existing licenses, or add test license
      currentLicenses: prev.currentLicenses?.length > 0
        ? prev.currentLicenses.map((license) => ({
            state: license.state || 'OH',
            licenseNumber: license.licenseNumber || 'DL123456789',
            typeClass: license.typeClass || 'CDL-A',
            endorsements: license.endorsements || 'H, N',
            expirationDate: license.expirationDate || '2026-01-15',
          }))
        : [
            {
              state: 'OH',
              licenseNumber: 'DL123456789',
              typeClass: 'CDL-A',
              endorsements: 'H, N',
              expirationDate: '2026-01-15',
            },
          ],
      
      // Previous Licenses - add test license only if none exist
      previousLicenses: prev.previousLicenses?.length > 0
        ? prev.previousLicenses
        : [
            {
              state: 'PA',
              licenseNumber: 'DL987654321',
              typeClass: 'CDL-B',
              endorsements: '',
              expirationDate: '2020-01-14',
            },
          ],

      // Disqualification History - default to compliant "no" responses
      disqualificationHistory: {
        hasLicenseSuspension:
          prev.disqualificationHistory?.hasLicenseSuspension || 'no',
        licenseSuspensionDetails:
          prev.disqualificationHistory?.licenseSuspensionDetails || '',
        hasDisqualifyingOffense:
          prev.disqualificationHistory?.hasDisqualifyingOffense || 'no',
        disqualifyingOffenseDetails:
          prev.disqualificationHistory?.disqualifyingOffenseDetails || '',
        hasOutOfServiceViolation:
          prev.disqualificationHistory?.hasOutOfServiceViolation || 'no',
        outOfServiceViolationDetails:
          prev.disqualificationHistory?.outOfServiceViolationDetails || '',
        hasMobileDeviceViolation:
          prev.disqualificationHistory?.hasMobileDeviceViolation || 'no',
        mobileDeviceViolationDetails:
          prev.disqualificationHistory?.mobileDeviceViolationDetails || '',
      },

      medicalQualification: {
        ...EMPTY_MEDICAL_QUALIFICATION,
        ...prev.medicalQualification,
        hasValidMedicalCertificate:
          prev.medicalQualification?.hasValidMedicalCertificate || 'yes',
        medicalCertificateExpiration:
          prev.medicalQualification?.medicalCertificateExpiration || '2027-06-30',
      },
    }))
    setErrors({})
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderApplicantInformation()
      case 2:
        return renderResidencyHistory()
      case 3:
        return renderLicenseInformation()
      default:
        return null
    }
  }

  const renderApplicantInformation = () => (
    <div className='space-y-8'>
      <AskStormiButton
        label='Ask AI about this section'
        className='justify-end'
        onClick={() =>
          requestHelp({
            section: 'Form 1 – Personal Information',
            question:
              'What details are required for the personal information section of the FMCSA driver application and why does the carrier need them?',
            regulation: '49 CFR 391.21',
            context:
              'Driver is completing PersonalInfoForm1 and wants clarity on the required personal details before proceeding.',
            dataSnapshot: {
              personalDetails: {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                email: formData.email,
                dateOfBirth: formData.dateOfBirth,
              },
            },
          })
        }
      />

      <div className='text-center'>
        <h2
          className={`text-xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          Applicant information
        </h2>
        <p
          className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Complete in full or it will not be considered
        </p>
      </div>

      {/* Name Section */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            FIRST NAME
          </label>
          <input
            type='text'
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            disabled={isLocked('firstName')}
            readOnly={isLocked('firstName')}
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
              isLocked('firstName') ? lockedInputClass : ''
            }`}
          />
          {lockEntry('firstName') && <VerifiedFieldBadge entry={lockEntry('firstName')!} attestations={attestations} />}
          {errors.firstName && (
            <p className='mt-1 text-sm text-red-600'>{errors.firstName}</p>
          )}
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            MIDDLE NAME
          </label>
          <input
            type='text'
            value={formData.middleName}
            onChange={(e) => handleInputChange('middleName', e.target.value)}
            disabled={isLocked('middleName')}
            readOnly={isLocked('middleName')}
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
              isLocked('middleName') ? lockedInputClass : ''
            }`}
          />
          {lockEntry('middleName') && <VerifiedFieldBadge entry={lockEntry('middleName')!} attestations={attestations} />}
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            LAST NAME
          </label>
          <input
            type='text'
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            disabled={isLocked('lastName')}
            readOnly={isLocked('lastName')}
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
              isLocked('lastName') ? lockedInputClass : ''
            }`}
          />
          {lockEntry('lastName') && <VerifiedFieldBadge entry={lockEntry('lastName')!} attestations={attestations} />}
          {errors.lastName && (
            <p className='mt-1 text-sm text-red-600'>{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Contact Section */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            PHONE
          </label>
          <PhoneInput
            value={formData.phone}
            onChange={(value) => handleInputChange('phone', value)}
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
          />
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            EMAIL
          </label>
          <input
            type='email'
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
          />
        </div>
      </div>

      {/* Date and SSN Section */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            DATE OF BIRTH
          </label>
          <input
            type='date'
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            disabled={isLocked('dateOfBirth')}
            readOnly={isLocked('dateOfBirth')}
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
              isLocked('dateOfBirth') ? lockedInputClass : ''
            }`}
          />
          {lockEntry('dateOfBirth') && <VerifiedFieldBadge entry={lockEntry('dateOfBirth')!} attestations={attestations} />}
          {errors.dateOfBirth && (
            <p className='mt-1 text-sm text-red-600'>{errors.dateOfBirth}</p>
          )}
          {errors.dateOfBirthAge && (
            <p className='mt-1 text-sm text-red-600'>{errors.dateOfBirthAge}</p>
          )}
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            SOCIAL SECURITY #
          </label>
          <SSNInput
            value={formData.socialSecurity}
            onChange={(value) => handleInputChange('socialSecurity', value)}
            placeholder='000-00-0000'
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
          />
        </div>
      </div>

      {/* Application Details Section */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            DATE OF APPLICATION
          </label>
          <input
            type='date'
            value={formData.dateOfApplication}
            onChange={(e) =>
              handleInputChange('dateOfApplication', e.target.value)
            }
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
          />
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${labelClass}`}
          >
            DATE AVAILABLE FOR WORK
          </label>
          <input
            type='date'
            value={formData.dateAvailableForWork}
            onChange={(e) =>
              handleInputChange('dateAvailableForWork', e.target.value)
            }
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
          />
        </div>
      </div>

      {/* Legal Right to Work */}
      <div className='space-y-3'>
        <label
          className={`block text-sm font-medium ${labelClass}`}
        >
          Do you have legal right to work in the United States?
        </label>
        <div className='flex space-x-6'>
          <label className='flex items-center'>
            <input
              type='radio'
              name='hasLegalRightToWork'
              value='yes'
              checked={formData.hasLegalRightToWork === 'yes'}
              onChange={(e) =>
                handleInputChange('hasLegalRightToWork', e.target.value)
              }
              className={`mr-2 ${isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'} accent-teal-600`}
            />
            <span
              className={`${labelClass}`}
            >
              YES
            </span>
          </label>
          <label className='flex items-center'>
            <input
              type='radio'
              name='hasLegalRightToWork'
              value='no'
              checked={formData.hasLegalRightToWork === 'no'}
              onChange={(e) =>
                handleInputChange('hasLegalRightToWork', e.target.value)
              }
              className={`mr-2 ${isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'} accent-teal-600`}
            />
            <span
              className={`${labelClass}`}
            >
              NO
            </span>
          </label>
        </div>
      </div>
    </div>
  )

  const renderResidencyHistory = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          PREVIOUS THREE YEARS RESIDENCY
        </h2>
        <p
          className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Attach additional sheet if more space is needed
        </p>
      </div>

      {/* Current Mailing Address */}
      <div className='space-y-4'>
        <h3
          className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          CURRENT MAILING
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
          <div className='md:col-span-2'>
            <label
              className={`block text-sm font-medium mb-2 ${labelClass}`}
            >
              STREET
            </label>
            <input
              type='text'
              value={formData.currentMailing.street}
              onChange={(e) =>
                handleInputChange('currentMailing', {
                  ...formData.currentMailing,
                  street: e.target.value,
                })
              }
                          className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${labelClass}`}
            >
              CITY
            </label>
            <input
              type='text'
              value={formData.currentMailing.city}
              onChange={(e) =>
                handleInputChange('currentMailing', {
                  ...formData.currentMailing,
                  city: e.target.value,
                })
              }
                          className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${labelClass}`}
            >
              STATE
            </label>
            <StateSelect
              value={formData.currentMailing.state}
              onChange={(value) =>
                handleInputChange('currentMailing', {
                  ...formData.currentMailing,
                  state: value,
                })
              }
              className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${labelClass}`}
            >
              ZIP CODE
            </label>
            <ZipCodeInput
              value={formData.currentMailing.zipCode}
              onChange={(value) =>
                handleInputChange('currentMailing', {
                  ...formData.currentMailing,
                  zipCode: value,
                })
              }
              className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
            />
          </div>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
          <div className='md:col-start-5'>
            <label
              className={`block text-sm font-medium mb-2 ${labelClass}`}
            >
              # OF YEARS AT ADDRESS
            </label>
            <input
              type='text'
              value={formData.currentMailing.yearsAtAddress}
              onChange={(e) =>
                handleInputChange('currentMailing', {
                  ...formData.currentMailing,
                  yearsAtAddress: e.target.value,
                })
              }
                          className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
            />
          </div>
        </div>
      </div>

      {/* Total Years Validation Message */}
      {(() => {
        const currentYears = parseFloat(formData.currentMailing?.yearsAtAddress || '0') || 0
        const previousYears = formData.previousAddresses?.reduce((total, addr) => {
          const years = parseFloat(addr.yearsAtAddress || '0') || 0
          return total + years
        }, 0) || 0
        const totalYears = currentYears + previousYears
        
        if (formData.currentMailing?.yearsAtAddress || formData.previousAddresses?.some(addr => addr.yearsAtAddress)) {
          // Show success if >= 3, warning if < 3
          const isValid = totalYears >= 3
          return (
            <div className={`p-4 rounded-lg border-2 ${
              isValid
                ? isDarkTheme(theme)
                  ? 'bg-green-900/20 border-green-500/50'
                  : 'bg-green-50 border-green-200'
                : isDarkTheme(theme)
                  ? 'bg-yellow-900/20 border-yellow-500/50'
                  : 'bg-yellow-50 border-yellow-200'
            }`}>
              <p className={`text-sm font-medium ${
                isValid
                  ? isDarkTheme(theme) ? 'text-green-400' : 'text-green-800'
                  : isDarkTheme(theme) ? 'text-yellow-400' : 'text-yellow-800'
              }`}>
                {isValid
                  ? `✓ Total residency history: ${totalYears.toFixed(1)} years (meets 3+ year requirement)`
                  : `⚠ Total residency history: ${totalYears.toFixed(1)} years. You need at least 3 years total.`
                }
              </p>
            </div>
          )
        }
        return null
      })()}

      {/* Total Years Error Message */}
      {errors.totalYears && (
        <div className={`p-4 rounded-lg border-2 ${
          isDarkTheme(theme)
            ? 'bg-red-900/20 border-red-500/50'
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm font-medium ${
            isDarkTheme(theme) ? 'text-red-400' : 'text-red-800'
          }`}>
            {errors.totalYears}
          </p>
        </div>
      )}

      {/* Previous Addresses */}
      {formData.previousAddresses?.map((address, index) => (
        <div key={index} className='space-y-4'>
          <div className='flex justify-between items-center'>
            <h3
              className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
            >
              PREVIOUS {index + 1}
            </h3>
            <button
              type='button'
              onClick={() => removePreviousAddress(index)}
              className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                isDarkTheme(theme)
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              Remove
            </button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
            <div className='md:col-span-2'>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                STREET
              </label>
              <input
                type='text'
                value={address.street}
                onChange={(e) =>
                  handleInputChange(
                    'previousAddresses',
                    { street: e.target.value },
                    index
                  )
                }
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                CITY
              </label>
              <input
                type='text'
                value={address.city}
                onChange={(e) =>
                  handleInputChange(
                    'previousAddresses',
                    { city: e.target.value },
                    index
                  )
                }
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                STATE
              </label>
              <StateSelect
                value={address.state}
                onChange={(value) =>
                  handleInputChange(
                    'previousAddresses',
                    { state: value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                ZIP CODE
              </label>
              <ZipCodeInput
                value={address.zipCode}
                onChange={(value) =>
                  handleInputChange('previousAddresses', { zipCode: value }, index)
                }
                className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
            </div>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
            <div className='md:col-start-5'>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                # OF YEARS AT ADDRESS
              </label>
              <input
                type='text'
                value={address.yearsAtAddress}
                onChange={(e) =>
                  handleInputChange(
                    'previousAddresses',
                    { yearsAtAddress: e.target.value },
                    index
                  )
                }
            className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add More Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={addPreviousAddress}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            isDarkTheme(theme)
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
          }`}
        >
          + Add Previous Address
        </button>
      </div>
    </div>
  )

  const renderLicenseInformation = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-xl font-bold mb-2 ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
        >
          LICENSE INFORMATION
        </h2>
        <p
          className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
        >
          No person who operates a commercial motor vehicle shall at any time
          have more than one driver's license (49 CFR 383.21). I certify that I
          do not have more than one motor vehicle license, the information for
          which is listed below. Include all licenses held for the past 3 years;
          attach additional sheets if needed.
        </p>
      </div>

      {/* Current Licenses */}
      {formData.currentLicenses?.map((license, index) => {
        const primaryLocked = index === 0 && lockedPaths.size > 0
        return (
        <div key={index} className='space-y-4'>
          <div className='flex justify-between items-center'>
            <h3
              className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
            >
              CURRENT LICENSE {index + 1}
              {primaryLocked && (
                <span
                  className={`ml-2 text-xs font-medium ${
                    isDarkTheme(theme) ? 'text-teal-300' : 'text-teal-700'
                  }`}
                >
                  (from MVR)
                </span>
              )}
            </h3>
            {formData.currentLicenses.length > 1 && index > 0 && (
              <button
                type='button'
                onClick={() => removeCurrentLicense(index)}
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
          <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                STATE
              </label>
              <StateSelect
                value={license.state}
                onChange={(value) =>
                  handleInputChange(
                    'currentLicenses',
                    { state: value },
                    index
                  )
                }
                disabled={index === 0 && isLocked('currentLicenses.0.state')}
                className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
                  index === 0 && isLocked('currentLicenses.0.state') ? lockedInputClass : ''
                }`}
              />
              {index === 0 && lockEntry('currentLicenses.0.state') && (
                <VerifiedFieldBadge entry={lockEntry('currentLicenses.0.state')!} attestations={attestations} />
              )}
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                LICENSE #
              </label>
              <input
                type='text'
                value={license.licenseNumber}
                onChange={(e) =>
                  handleInputChange(
                    'currentLicenses',
                    { licenseNumber: e.target.value },
                    index
                  )
                }
                disabled={index === 0 && isLocked('currentLicenses.0.licenseNumber')}
                readOnly={index === 0 && isLocked('currentLicenses.0.licenseNumber')}
                className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
                  index === 0 && isLocked('currentLicenses.0.licenseNumber')
                    ? lockedInputClass
                    : ''
                }`}
              />
              {index === 0 && lockEntry('currentLicenses.0.licenseNumber') && (
                <VerifiedFieldBadge entry={lockEntry('currentLicenses.0.licenseNumber')!} attestations={attestations} />
              )}
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                TYPE/CLASS
              </label>
              <input
                type='text'
                value={license.typeClass}
                onChange={(e) =>
                  handleInputChange(
                    'currentLicenses',
                    { typeClass: e.target.value },
                    index
                  )
                }
                disabled={index === 0 && isLocked('currentLicenses.0.typeClass')}
                readOnly={index === 0 && isLocked('currentLicenses.0.typeClass')}
                className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
                  index === 0 && isLocked('currentLicenses.0.typeClass')
                    ? lockedInputClass
                    : ''
                }`}
              />
              {index === 0 && lockEntry('currentLicenses.0.typeClass') && (
                <VerifiedFieldBadge entry={lockEntry('currentLicenses.0.typeClass')!} attestations={attestations} />
              )}
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                ENDORSEMENTS
              </label>
              <input
                type='text'
                value={license.endorsements}
                onChange={(e) =>
                  handleInputChange(
                    'currentLicenses',
                    { endorsements: e.target.value },
                    index
                  )
                }
                disabled={index === 0 && isLocked('currentLicenses.0.endorsements')}
                readOnly={index === 0 && isLocked('currentLicenses.0.endorsements')}
                className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
                  index === 0 && isLocked('currentLicenses.0.endorsements')
                    ? lockedInputClass
                    : ''
                }`}
              />
              {index === 0 && lockEntry('currentLicenses.0.endorsements') && (
                <VerifiedFieldBadge entry={lockEntry('currentLicenses.0.endorsements')!} attestations={attestations} />
              )}
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${labelClass}`}
              >
                EXPIRATION DATE
              </label>
              <input
                type='date'
                value={license.expirationDate}
                onChange={(e) =>
                  handleInputChange(
                    'currentLicenses',
                    { expirationDate: e.target.value },
                    index
                  )
                }
                disabled={index === 0 && isLocked('currentLicenses.0.expirationDate')}
                readOnly={index === 0 && isLocked('currentLicenses.0.expirationDate')}
                className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass} ${
                  index === 0 && isLocked('currentLicenses.0.expirationDate')
                    ? lockedInputClass
                    : ''
                }`}
              />
              {index === 0 && lockEntry('currentLicenses.0.expirationDate') && (
                <VerifiedFieldBadge entry={lockEntry('currentLicenses.0.expirationDate')!} attestations={attestations} />
              )}
            </div>
          </div>
        </div>
        )
      })}

      {/* Add Current License Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={addCurrentLicense}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            isDarkTheme(theme)
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
          }`}
        >
          + Add Current License
        </button>
      </div>

      {/* Previously Held Licenses */}
      <div className='space-y-4'>
        {formData.previousLicenses?.map((license, index) => (
          <div key={index} className='space-y-4'>
            <div className='flex justify-between items-center'>
              <h3
                className={`text-lg font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-gray-900'}`}
              >
                PREVIOUS LICENSE {index + 1}
              </h3>
              <button
                type='button'
                onClick={() => removePreviousLicense(index)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                  isDarkTheme(theme)
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Remove
              </button>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${labelClass}`}
                >
                  STATE
                </label>
                <StateSelect
                  value={license.state}
                  onChange={(value) =>
                    handleInputChange(
                      'previousLicenses',
                      { state: value },
                      index
                    )
                  }
                  className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${labelClass}`}
                >
                  LICENSE #
                </label>
                <input
                  type='text'
                  value={license.licenseNumber}
                  onChange={(e) =>
                    handleInputChange(
                      'previousLicenses',
                      { licenseNumber: e.target.value },
                      index
                    )
                  }
className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${labelClass}`}
                >
                  TYPE/CLASS
                </label>
                <input
                  type='text'
                  value={license.typeClass}
                  onChange={(e) =>
                    handleInputChange(
                      'previousLicenses',
                      { typeClass: e.target.value },
                      index
                    )
                  }
className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${labelClass}`}
                >
                  ENDORSEMENTS
                </label>
                <input
                  type='text'
                  value={license.endorsements}
                  onChange={(e) =>
                    handleInputChange(
                      'previousLicenses',
                      { endorsements: e.target.value },
                      index
                    )
                  }
className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${labelClass}`}
                >
                  EXPIRATION DATE
                </label>
                <input
                  type='date'
                  value={license.expirationDate}
                  onChange={(e) =>
                    handleInputChange(
                      'previousLicenses',
                      { expirationDate: e.target.value },
                      index
                    )
                  }
className={`w-full px-4 py-3 border rounded-lg ${inputBaseClass}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Previous License Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={addPreviousLicense}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            isDarkTheme(theme)
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
          }`}
        >
          + Add Previous License
        </button>
      </div>

      {/* Med card — uses DotForm1Data.medicalQualification (same fields as career card preview) */}
      <div
        className={`mt-10 pt-8 border-t space-y-4 ${
          isDarkTheme(theme) ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div>
          <h3
            className={`text-xl font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-teal-800 dark:text-teal-300'}`}
          >
            MED CARD (DOT MEDICAL CERTIFICATE)
          </h3>
          <p
            className={`text-sm mt-2 ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
          >
            CDL holders operating in interstate commerce must have a valid medical examiner&rsquo;s
            certificate. Answer below; if you have a current med card, enter its expiration date.
          </p>
        </div>
        <div className='space-y-3'>
          <span className={`block text-sm font-medium ${labelClass}`}>
            Do you currently have a valid med card?
          </span>
          <div className='flex flex-wrap gap-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='radio'
                  name='hasValidMedicalCertificate'
                  value={value}
                  checked={
                    (formData.medicalQualification || EMPTY_MEDICAL_QUALIFICATION)
                      .hasValidMedicalCertificate === value
                  }
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      hasValidMedicalCertificate: e.target.value,
                      medicalCertificateExpiration:
                        e.target.value === 'no'
                          ? ''
                          : (formData.medicalQualification || EMPTY_MEDICAL_QUALIFICATION)
                              .medicalCertificateExpiration,
                    })
                  }
                  className={`accent-teal-600 ${
                    isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
                  }`}
                />
                <span className={labelClass}>{value.toUpperCase()}</span>
              </label>
            ))}
          </div>
          {errors.hasValidMedicalCertificate && (
            <p className='text-sm text-red-600 dark:text-red-400'>
              {errors.hasValidMedicalCertificate}
            </p>
          )}
        </div>
        {(formData.medicalQualification || EMPTY_MEDICAL_QUALIFICATION).hasValidMedicalCertificate ===
          'yes' && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${labelClass}`}>
              MED CARD EXPIRATION DATE
            </label>
            <input
              type='date'
              value={
                (formData.medicalQualification || EMPTY_MEDICAL_QUALIFICATION)
                  .medicalCertificateExpiration || ''
              }
              onChange={(e) =>
                handleInputChange('medicalQualification', {
                  medicalCertificateExpiration: e.target.value,
                })
              }
              className={`w-full max-w-xs px-4 py-3 border rounded-lg ${inputBaseClass}`}
            />
            {errors.medicalCertificateExpiration && (
              <p className='mt-2 text-sm text-red-600 dark:text-red-400'>
                {errors.medicalCertificateExpiration}
              </p>
            )}
          </div>
        )}
      </div>

      <div className='space-y-6 mt-8'>
        <h3
          className={`text-xl font-semibold ${isDarkTheme(theme) ? 'text-white' : 'text-teal-800 dark:text-teal-300'}`}
        >
          DISQUALIFICATION HISTORY (49 CFR 391.15)
        </h3>
        <p
          className={`text-sm ${isDarkTheme(theme) ? 'text-gray-400' : 'text-gray-600'}`}
        >
          These questions help us confirm you meet federal disqualification rules. Answer truthfully; if you select "Yes," provide the required details so compliance can review your record.
        </p>

        {/* License suspension or revocation */}
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${
              labelClass
            }`}
          >
            Have you ever had your CDL or driving privileges revoked, suspended, withdrawn, or denied?
          </label>
          <div className='flex space-x-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasLicenseSuspension'
                  value={value}
                  checked={formData.disqualificationHistory.hasLicenseSuspension === value}
                  onChange={(e) =>
                    handleInputChange('disqualificationHistory', {
                      hasLicenseSuspension: e.target.value,
                      licenseSuspensionDetails:
                        e.target.value === 'no'
                          ? ''
                          : formData.disqualificationHistory.licenseSuspensionDetails,
                    })
                  }
                  className={`mr-1 ${
                    isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
                  } accent-teal-600`}
                />
                <span className={`${labelClass}`}>
                  {value.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          {errors.hasLicenseSuspension && (
            <p className='text-sm text-red-600'>{errors.hasLicenseSuspension}</p>
          )}
          {formData.disqualificationHistory.hasLicenseSuspension === 'yes' && (
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  labelClass
                }`}
              >
                Describe the suspension, revocation, withdrawal, or denial (include dates and issuing state)
              </label>
              <textarea
                value={formData.disqualificationHistory.licenseSuspensionDetails}
                onChange={(e) =>
                  handleInputChange('disqualificationHistory', {
                    licenseSuspensionDetails: e.target.value,
                  })
                }
                className={`w-full min-h-[100px] px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
              {errors.licenseSuspensionDetails && (
                <p className='mt-1 text-sm text-red-600'>{errors.licenseSuspensionDetails}</p>
              )}
            </div>
          )}
        </div>

        {/* Disqualifying offenses */}
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${
              labelClass
            }`}
          >
            Have you ever been convicted of a disqualifying offense (DUI in a CMV, controlled substances, leaving an accident, or a felony involving a CMV)?
          </label>
          <div className='flex space-x-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasDisqualifyingOffense'
                  value={value}
                  checked={formData.disqualificationHistory.hasDisqualifyingOffense === value}
                  onChange={(e) =>
                    handleInputChange('disqualificationHistory', {
                      hasDisqualifyingOffense: e.target.value,
                      disqualifyingOffenseDetails:
                        e.target.value === 'no'
                          ? ''
                          : formData.disqualificationHistory.disqualifyingOffenseDetails,
                    })
                  }
                  className={`mr-1 ${
                    isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
                  } accent-teal-600`}
                />
                <span className={`${labelClass}`}>
                  {value.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          {errors.hasDisqualifyingOffense && (
            <p className='text-sm text-red-600'>{errors.hasDisqualifyingOffense}</p>
          )}
          {formData.disqualificationHistory.hasDisqualifyingOffense === 'yes' && (
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  labelClass
                }`}
              >
                Provide offense details, including dates, locations, and outcomes
              </label>
              <textarea
                value={formData.disqualificationHistory.disqualifyingOffenseDetails}
                onChange={(e) =>
                  handleInputChange('disqualificationHistory', {
                    disqualifyingOffenseDetails: e.target.value,
                  })
                }
                className={`w-full min-h-[100px] px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
              {errors.disqualifyingOffenseDetails && (
                <p className='mt-1 text-sm text-red-600'>{errors.disqualifyingOffenseDetails}</p>
              )}
            </div>
          )}
        </div>

        {/* Out-of-service violations */}
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${
              labelClass
            }`}
          >
            Have you ever been cited for violating an out-of-service order while operating a CMV?
          </label>
          <div className='flex space-x-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasOutOfServiceViolation'
                  value={value}
                  checked={formData.disqualificationHistory.hasOutOfServiceViolation === value}
                  onChange={(e) =>
                    handleInputChange('disqualificationHistory', {
                      hasOutOfServiceViolation: e.target.value,
                      outOfServiceViolationDetails:
                        e.target.value === 'no'
                          ? ''
                          : formData.disqualificationHistory.outOfServiceViolationDetails,
                    })
                  }
                  className={`mr-1 ${
                    isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
                  } accent-teal-600`}
                />
                <span className={`${labelClass}`}>
                  {value.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          {errors.hasOutOfServiceViolation && (
            <p className='text-sm text-red-600'>{errors.hasOutOfServiceViolation}</p>
          )}
          {formData.disqualificationHistory.hasOutOfServiceViolation === 'yes' && (
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  labelClass
                }`}
              >
                Describe the out-of-service violation(s), including dates, locations, and cargo type if applicable
              </label>
              <textarea
                value={formData.disqualificationHistory.outOfServiceViolationDetails}
                onChange={(e) =>
                  handleInputChange('disqualificationHistory', {
                    outOfServiceViolationDetails: e.target.value,
                  })
                }
                className={`w-full min-h-[100px] px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
              {errors.outOfServiceViolationDetails && (
                <p className='mt-1 text-sm text-red-600'>{errors.outOfServiceViolationDetails}</p>
              )}
            </div>
          )}
        </div>

        {/* Mobile device violations */}
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${
              labelClass
            }`}
          >
            Have you been convicted of texting or using a hand-held mobile phone while driving a CMV in the past 3 years?
          </label>
          <div className='flex space-x-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasMobileDeviceViolation'
                  value={value}
                  checked={formData.disqualificationHistory.hasMobileDeviceViolation === value}
                  onChange={(e) =>
                    handleInputChange('disqualificationHistory', {
                      hasMobileDeviceViolation: e.target.value,
                      mobileDeviceViolationDetails:
                        e.target.value === 'no'
                          ? ''
                          : formData.disqualificationHistory.mobileDeviceViolationDetails,
                    })
                  }
                  className={`mr-1 ${
                    isDarkTheme(theme) ? 'text-teal-600 dark:text-teal-400' : 'text-teal-800 dark:text-teal-300'
                  } accent-teal-600`}
                />
                <span className={`${labelClass}`}>
                  {value.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
          {errors.hasMobileDeviceViolation && (
            <p className='text-sm text-red-600'>{errors.hasMobileDeviceViolation}</p>
          )}
          {formData.disqualificationHistory.hasMobileDeviceViolation === 'yes' && (
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  labelClass
                }`}
              >
                Describe the violation(s), including citation dates and jurisdictions
              </label>
              <textarea
                value={formData.disqualificationHistory.mobileDeviceViolationDetails}
                onChange={(e) =>
                  handleInputChange('disqualificationHistory', {
                    mobileDeviceViolationDetails: e.target.value,
                  })
                }
                className={`w-full min-h-[100px] px-4 py-3 border rounded-lg ${inputBaseClass}`}
              />
              {errors.mobileDeviceViolationDetails && (
                <p className='mt-1 text-sm text-red-600'>{errors.mobileDeviceViolationDetails}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const cardClass =
    isDarkTheme(theme)
      ? 'rounded-2xl border border-gray-700 bg-gray-800/50 shadow-lg'
      : 'rounded-2xl border border-gray-200 bg-white/70 shadow-lg'
  const sectionClass =
    isDarkTheme(theme)
      ? 'rounded-xl border border-gray-700/50 bg-gray-700/30 p-6'
      : 'rounded-xl border border-gray-200 bg-gray-50/80 p-6'
  const labelClass =
    isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
  const inputBaseClass =
    isDarkTheme(theme)
      ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
      : 'bg-white border-gray-200 text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

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
              isDarkTheme(theme) ? 'text-white' : 'text-teal-800 dark:text-teal-300'
            }`}
          >
            Step {currentStep} of {STEPS.length}
          </div>
          <div
            className={`text-sm ${
              isDarkTheme(theme) ? 'text-gray-300' : 'text-teal-800 dark:text-teal-300/80'
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
          {currentStep === STEPS.length ? 'Continue to Form 2' : 'Next'}
        </button>
      </div>
    </div>
  )
}