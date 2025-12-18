'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'
import ResumeUploadWithPrefill from '@/components/ResumeUploadWithPrefill'

const DEFAULT_CARRIER_INFO = {
  name: process.env.NEXT_PUBLIC_CARRIER_NAME ?? 'Your Motor Carrier Name',
  address:
    process.env.NEXT_PUBLIC_CARRIER_ADDRESS ??
    '1234 Logistics Way, City, ST 00000',
  phone: process.env.NEXT_PUBLIC_CARRIER_PHONE ?? '(000) 000-0000',
  email: process.env.NEXT_PUBLIC_CARRIER_EMAIL ?? 'hr@example.com',
}

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
    description: 'Current and previous driver licenses',
  },
]

interface PersonalInfoForm1Props {
  onNavigateToForm?: (formNumber: number) => void
  onDataChange?: (data: any) => void
  initialData?: any
}

export default function PersonalInfoForm1({
  onNavigateToForm,
  onDataChange,
  initialData,
}: PersonalInfoForm1Props) {
  const { theme } = useTheme()
  const { requestHelp } = useAssistantBridge()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    employingCarrier: {
      name: DEFAULT_CARRIER_INFO.name,
      address: DEFAULT_CARRIER_INFO.address,
      phone: DEFAULT_CARRIER_INFO.phone,
      email: DEFAULT_CARRIER_INFO.email,
    },
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
    medicalQualification: {
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
    },
  })

  const handleInputChange = (field: string, value: any, index?: number) => {
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

  const handlePrefillSuccess = (prefillData: any) => {
    console.log('✅ [PREFILL] Prefill success callback called with:', prefillData)
    
    if (prefillData.form1Data) {
      // Update form data with prefill results
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || prefillData.form1Data.firstName || '',
        middleName: prev.middleName || prefillData.form1Data.middleName || '',
        lastName: prev.lastName || prefillData.form1Data.lastName || '',
        phone: prev.phone || prefillData.form1Data.phone || '',
        email: prev.email || prefillData.form1Data.email || '',
        dateOfBirth: prev.dateOfBirth || prefillData.form1Data.dateOfBirth || '',
        currentMailing: {
          ...prev.currentMailing,
          street: prev.currentMailing.street || prefillData.form1Data.currentMailing?.street || '',
          city: prev.currentMailing.city || prefillData.form1Data.currentMailing?.city || '',
          state: prev.currentMailing.state || prefillData.form1Data.currentMailing?.state || '',
          zipCode: prev.currentMailing.zipCode || prefillData.form1Data.currentMailing?.zipCode || '',
        },
      }))
    }
  }

  // Initialize/restore from parent once to avoid loops
  const hasHydratedRef = useRef(false)
  const previousInitialDataRef = useRef<any>(null)
  useEffect(() => {
    // If initialData becomes null/undefined after having data, reset the form
    if (previousInitialDataRef.current && !initialData) {
      hasHydratedRef.current = false
      setFormData({
        employingCarrier: {
          name: DEFAULT_CARRIER_INFO.name,
          address: DEFAULT_CARRIER_INFO.address,
          phone: DEFAULT_CARRIER_INFO.phone,
          email: DEFAULT_CARRIER_INFO.email,
        },
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
        medicalQualification: {
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
        },
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
      // Employing Motor Carrier info (49 CFR 391.21(b)(1))
      if (!formData.employingCarrier?.name?.trim()) {
        newErrors.employingCarrierName = 'Motor carrier name is required (49 CFR 391.21(b)(1)).'
      }
      if (!formData.employingCarrier?.address?.trim()) {
        newErrors.employingCarrierAddress = 'Motor carrier mailing address is required (49 CFR 391.21(b)(1)).'
      }

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

      const medical = formData.medicalQualification || {}

      if (!medical.hasValidMedicalCertificate) {
        newErrors.hasValidMedicalCertificate =
          "Confirm whether you hold a current DOT medical examiner's certificate"
      } else if (medical.hasValidMedicalCertificate === 'yes') {
        if (!medical.medicalCertificateExpiration) {
          newErrors.medicalCertificateExpiration =
            'Provide the medical certificate expiration date'
        }
        if (!medical.hasFiledWithState) {
          newErrors.hasFiledWithState =
            'Tell us if your medical card has been filed with your licensing state'
        }
        if (!medical.medicalExamDate) {
          newErrors.medicalExamDate =
            'Provide the date of your most recent DOT medical examination'
        }
        if (!medical.medicalExaminerName?.trim()) {
          newErrors.medicalExaminerName =
            "Enter the medical examiner's name so we can verify registry status"
        }
        if (!medical.medicalExaminerType) {
          newErrors.medicalExaminerType =
            'Select the type of medical examiner who performed the exam'
        }
        if (
          medical.medicalExaminerType === 'registry' &&
          !medical.medicalExaminerRegistryId?.trim()
        ) {
          newErrors.medicalExaminerRegistryId =
            "Provide the examiner's National Registry ID for verification"
        }
        if (medical.medicalExaminerPhone && !/^[+\d().\-\s]{7,}$/.test(medical.medicalExaminerPhone)) {
          newErrors.medicalExaminerPhone =
            'Enter a valid phone number for the medical examiner'
        }
      }

      if (!medical.hasMedicalVariance) {
        newErrors.hasMedicalVariance =
          'Let us know if you have any FMCSA medical variances or exemptions'
      } else if (
        medical.hasMedicalVariance === 'yes' &&
        !medical.medicalVarianceDetails.trim()
      ) {
        newErrors.medicalVarianceDetails =
          'Describe the variance or exemption so we can verify documentation'
      }

      if (!medical.hasChronicConditions) {
        newErrors.hasChronicConditions =
          'Please indicate if you have chronic conditions we should monitor'
      } else if (
        medical.hasChronicConditions === 'yes' &&
        !medical.chronicConditionsDetails.trim()
      ) {
        newErrors.chronicConditionsDetails =
          'Share details about chronic conditions to ensure ongoing qualification'
      }

      if (!medical.visionHearingCompliance) {
        newErrors.visionHearingCompliance =
          "Confirm you meet the DOT vision and hearing standards or have a waiver"
      }

      if (!medical.medicationDisclosure?.trim()) {
        newErrors.medicationDisclosure =
          'List prescribed medications or state that none impact safe driving'
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
      employingCarrier: {
        name: prev.employingCarrier?.name || DEFAULT_CARRIER_INFO.name,
        address: prev.employingCarrier?.address || DEFAULT_CARRIER_INFO.address,
        phone: prev.employingCarrier?.phone || DEFAULT_CARRIER_INFO.phone,
        email: prev.employingCarrier?.email || DEFAULT_CARRIER_INFO.email,
      },
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
        hasValidMedicalCertificate:
          prev.medicalQualification?.hasValidMedicalCertificate || 'yes',
        medicalCertificateExpiration:
          prev.medicalQualification?.medicalCertificateExpiration ||
          new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            .toISOString()
            .slice(0, 10),
        hasFiledWithState:
          prev.medicalQualification?.hasFiledWithState || 'yes',
        hasMedicalVariance:
          prev.medicalQualification?.hasMedicalVariance || 'no',
        medicalVarianceDetails:
          prev.medicalQualification?.medicalVarianceDetails || '',
        hasChronicConditions:
          prev.medicalQualification?.hasChronicConditions || 'no',
        chronicConditionsDetails:
          prev.medicalQualification?.chronicConditionsDetails || '',
        visionHearingCompliance:
          prev.medicalQualification?.visionHearingCompliance || 'yes',
        medicationDisclosure:
          prev.medicalQualification?.medicationDisclosure || 'No medications that impair safe driving.',
        medicalExamDate:
          prev.medicalQualification?.medicalExamDate || new Date().toISOString().slice(0, 10),
        medicalExaminerName:
          prev.medicalQualification?.medicalExaminerName || 'Dr. Alex Carpenter, MD',
        medicalExaminerPhone:
          prev.medicalQualification?.medicalExaminerPhone || '(555) 987-6543',
        medicalExaminerRegistryId:
          prev.medicalQualification?.medicalExaminerRegistryId || '1234567890',
        medicalExaminerType:
          prev.medicalQualification?.medicalExaminerType || 'registry',
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
      <div className='flex justify-end'>
        <button
          type='button'
          onClick={() =>
            requestHelp({
              section: 'Form 1 – Personal Information',
              question:
                'What details are required for the personal information section of the FMCSA driver application and why does the carrier need them?',
              regulation: '49 CFR 391.21',
              context:
                'Driver is completing PersonalInfoForm1 and wants clarity on the required personal details before proceeding.',
              dataSnapshot: {
                employingCarrier: formData.employingCarrier,
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
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border transition-colors ${
            theme === 'dark'
              ? 'border-brand-mint/40 text-brand-mint hover:bg-brand-mint/10'
              : 'border-brand-sage/40 text-brand-sage hover:bg-brand-sage/10'
          }`}
        >
          <span>🤔</span>
          <span>Ask T about this section</span>
        </button>
      </div>

      {/* Resume Upload with Prefill - Show on step 1 only */}
      {currentStep === 1 && (
        <div className='mb-8'>
          <ResumeUploadWithPrefill
            onPrefillSuccess={handlePrefillSuccess}
            onPrefillError={(error) => {
              console.error('Prefill error:', error)
              alert(error.message || 'Failed to prefill from resume')
            }}
            onIpfsHashReady={(ipfsHash) => {
              console.log('IPFS hash ready:', ipfsHash)
            }}
          />
        </div>
      )}

      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          APPLICANT INFORMATION
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          Complete in full or it will not be considered
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

      {/* Employing Motor Carrier (49 CFR 391.21) */}
      <div
        className={`p-6 rounded-lg border-2 space-y-4 ${
          theme === 'dark'
            ? 'bg-brand-mint/10 border-brand-mint/30'
            : 'bg-brand-sage/10 border-brand-sage/30'
        }`}
      >
        <div className='space-y-2'>
          <h3
            className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-brand-sage'
            }`}
          >
            EMPLOYING MOTOR CARRIER
          </h3>
          <p
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'
            }`}
          >
            Federal rules (49 CFR 391.21) require the application to list the motor carrier's name and mailing address. Update the details below if this application is being used for a different carrier.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
              }`}
            >
              MOTOR CARRIER NAME
            </label>
            <input
              type='text'
              value={formData.employingCarrier.name}
              onChange={(e) =>
                handleInputChange('employingCarrier', {
                  ...formData.employingCarrier,
                  name: e.target.value,
                })
              }
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                errors.employingCarrierName
                  ? 'border-red-500'
                  : theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
            {errors.employingCarrierName && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.employingCarrierName}
              </p>
            )}
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
              }`}
            >
              MOTOR CARRIER PHONE
            </label>
            <input
              type='tel'
              value={formData.employingCarrier.phone}
              onChange={(e) =>
                handleInputChange('employingCarrier', {
                  ...formData.employingCarrier,
                  phone: e.target.value,
                })
              }
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='md:col-span-2'>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
              }`}
            >
              MOTOR CARRIER MAILING ADDRESS
            </label>
            <textarea
              value={formData.employingCarrier.address}
              onChange={(e) =>
                handleInputChange('employingCarrier', {
                  ...formData.employingCarrier,
                  address: e.target.value,
                })
              }
              rows={3}
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                errors.employingCarrierAddress
                  ? 'border-red-500'
                  : theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
            {errors.employingCarrierAddress && (
              <p className='mt-1 text-sm text-red-600'>
                {errors.employingCarrierAddress}
              </p>
            )}
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
              }`}
            >
              MOTOR CARRIER EMAIL
            </label>
            <input
              type='email'
              value={formData.employingCarrier.email}
              onChange={(e) =>
                handleInputChange('employingCarrier', {
                  ...formData.employingCarrier,
                  email: e.target.value,
                })
              }
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Name Section */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
          >
            FIRST NAME
          </label>
          <input
            type='text'
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
          {errors.firstName && (
            <p className='mt-1 text-sm text-red-600'>{errors.firstName}</p>
          )}
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
          >
            MIDDLE NAME
          </label>
          <input
            type='text'
            value={formData.middleName}
            onChange={(e) => handleInputChange('middleName', e.target.value)}
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
            LAST NAME
          </label>
          <input
            type='text'
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
          {errors.lastName && (
            <p className='mt-1 text-sm text-red-600'>{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Contact Section */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
          >
            PHONE
          </label>
          <input
            type='tel'
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
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
            EMAIL
          </label>
          <input
            type='email'
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
        </div>
      </div>

      {/* Date and SSN Section */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
          >
            DATE OF BIRTH
          </label>
          <input
            type='date'
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
          {errors.dateOfBirth && (
            <p className='mt-1 text-sm text-red-600'>{errors.dateOfBirth}</p>
          )}
          {errors.dateOfBirthAge && (
            <p className='mt-1 text-sm text-red-600'>{errors.dateOfBirthAge}</p>
          )}
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
          >
            SOCIAL SECURITY #
          </label>
          <input
            type='text'
            value={formData.socialSecurity}
            onChange={(e) =>
              handleInputChange('socialSecurity', e.target.value)
            }
            placeholder='XXX-XX-XXXX'
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
        </div>
      </div>

      {/* Application Details Section */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
          >
            DATE OF APPLICATION
          </label>
          <input
            type='date'
            value={formData.dateOfApplication}
            onChange={(e) =>
              handleInputChange('dateOfApplication', e.target.value)
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
            DATE AVAILABLE FOR WORK
          </label>
          <input
            type='date'
            value={formData.dateAvailableForWork}
            onChange={(e) =>
              handleInputChange('dateAvailableForWork', e.target.value)
            }
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
        </div>
      </div>

      {/* Legal Right to Work */}
      <div className='space-y-3'>
        <label
          className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
              name='hasLegalRightToWork'
              value='no'
              checked={formData.hasLegalRightToWork === 'no'}
              onChange={(e) =>
                handleInputChange('hasLegalRightToWork', e.target.value)
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
  )

  const renderResidencyHistory = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          PREVIOUS THREE YEARS RESIDENCY
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          Attach additional sheet if more space is needed
        </p>
      </div>

      {/* Current Mailing Address */}
      <div className='space-y-4'>
        <h3
          className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          CURRENT MAILING
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
          <div className='md:col-span-2'>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
            >
              STATE
            </label>
            <input
              type='text'
              value={formData.currentMailing.state}
              onChange={(e) =>
                handleInputChange('currentMailing', {
                  ...formData.currentMailing,
                  state: e.target.value,
                })
              }
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
            >
              ZIP CODE
            </label>
            <input
              type='text'
              value={formData.currentMailing.zipCode}
              onChange={(e) =>
                handleInputChange('currentMailing', {
                  ...formData.currentMailing,
                  zipCode: e.target.value,
                })
              }
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
          <div className='md:col-start-5'>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
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
                ? theme === 'dark'
                  ? 'bg-green-900/20 border-green-500/50'
                  : 'bg-green-50 border-green-200'
                : theme === 'dark'
                  ? 'bg-yellow-900/20 border-yellow-500/50'
                  : 'bg-yellow-50 border-yellow-200'
            }`}>
              <p className={`text-sm font-medium ${
                isValid
                  ? theme === 'dark' ? 'text-green-400' : 'text-green-800'
                  : theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
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
          theme === 'dark'
            ? 'bg-red-900/20 border-red-500/50'
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm font-medium ${
            theme === 'dark' ? 'text-red-400' : 'text-red-800'
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
              className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
            >
              PREVIOUS {index + 1}
            </h3>
            <button
              type='button'
              onClick={() => removePreviousAddress(index)}
              className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                theme === 'dark'
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
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                STATE
              </label>
              <input
                type='text'
                value={address.state}
                onChange={(e) =>
                  handleInputChange(
                    'previousAddresses',
                    { state: e.target.value },
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
                ZIP CODE
              </label>
              <input
                type='text'
                value={address.zipCode}
                onChange={(e) =>
                  handleInputChange(
                    'previousAddresses',
                    { zipCode: e.target.value },
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
          <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
            <div className='md:col-start-5'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
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
          onClick={addPreviousAddress}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
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
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          LICENSE INFORMATION
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          No person who operates a commercial motor vehicle shall at any time
          have more than one driver's license (49 CFR 383.21). I certify that I
          do not have more than one motor vehicle license, the information for
          which is listed below. Include all licenses held for the past 3 years;
          attach additional sheets if needed.
        </p>
      </div>

      {/* Current Licenses */}
      {formData.currentLicenses?.map((license, index) => (
        <div key={index} className='space-y-4'>
          <div className='flex justify-between items-center'>
            <h3
              className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
            >
              CURRENT LICENSE {index + 1}
            </h3>
            {formData.currentLicenses.length > 1 && (
              <button
                type='button'
                onClick={() => removeCurrentLicense(index)}
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
          <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                STATE
              </label>
              <input
                type='text'
                value={license.state}
                onChange={(e) =>
                  handleInputChange(
                    'currentLicenses',
                    { state: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add Current License Button */}
      <div className='flex justify-center pt-4'>
        <button
          type='button'
          onClick={addCurrentLicense}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
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
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
              >
                PREVIOUS LICENSE {index + 1}
              </h3>
              <button
                type='button'
                onClick={() => removePreviousLicense(index)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                  theme === 'dark'
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
                  className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                >
                  STATE
                </label>
                <input
                  type='text'
                  value={license.state}
                  onChange={(e) =>
                    handleInputChange(
                      'previousLicenses',
                      { state: e.target.value },
                      index
                    )
                  }
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
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
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
          }`}
        >
          + Add Previous License
        </button>
      </div>

      <div className='space-y-6 mt-8'>
        <h3
          className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          DISQUALIFICATION HISTORY (49 CFR 391.15)
        </h3>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          These questions help us confirm you meet federal disqualification rules. Answer truthfully; if you select "Yes," provide the required details so compliance can review your record.
        </p>

        {/* License suspension or revocation */}
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  } accent-brand-mint`}
                />
                <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
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
                  theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                className={`w-full min-h-[100px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
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
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  } accent-brand-mint`}
                />
                <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
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
                  theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                className={`w-full min-h-[100px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
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
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  } accent-brand-mint`}
                />
                <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
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
                  theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                className={`w-full min-h-[100px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
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
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                    theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                  } accent-brand-mint`}
                />
                <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}>
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
                  theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
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
                className={`w-full min-h-[100px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
              {errors.mobileDeviceViolationDetails && (
                <p className='mt-1 text-sm text-red-600'>{errors.mobileDeviceViolationDetails}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className={`mt-8 p-4 rounded-lg border-2 ${
          theme === 'dark'
            ? 'bg-brand-mint/10 border-brand-mint/30'
            : 'bg-brand-sage/10 border-brand-sage/30'
        }`}
      >
        <h3
          className={`text-lg font-semibold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-brand-sage'
          }`}
        >
          MEDICAL QUALIFICATION (49 CFR 391.41)
        </h3>
        <div className='flex justify-end'>
          <button
            type='button'
            onClick={() =>
              requestHelp({
                section: 'Form 1 – Medical Qualification',
                question:
                  'Explain what evidence a driver must provide to document DOT medical qualification, including variances and examiner requirements.',
                regulation: '49 CFR 391.41 & 391.43',
                context:
                  'Driver is completing the medical qualification card on PersonalInfoForm1 and wants to ensure they supply compliant documentation.',
                dataSnapshot: formData.medicalQualification,
              })
            }
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              theme === 'dark'
                ? 'border-brand-mint/40 text-brand-mint hover:bg-brand-mint/10'
                : 'border-brand-sage/40 text-brand-sage hover:bg-brand-sage/10'
            }`}
          >
            <span>🩺</span>
            <span>Need help with medical docs?</span>
          </button>
        </div>
        <p
          className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'
          }`}
        >
          DOT requires drivers to maintain a current medical examiner's certificate, meet specific physical standards, and carry variance documentation when applicable. Provide details so we can confirm your qualification status.
        </p>

        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
            }`}
          >
            Do you currently hold a valid DOT medical examiner's certificate?
          </label>
          <div className='flex gap-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasValidMedicalCertificate'
                  value={value}
                  checked={
                    formData.medicalQualification.hasValidMedicalCertificate === value
                  }
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      hasValidMedicalCertificate: e.target.value,
                    })
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
          {errors.hasValidMedicalCertificate && (
            <p className='text-sm text-red-600'>
              {errors.hasValidMedicalCertificate}
            </p>
          )}
        </div>

        {formData.medicalQualification.hasValidMedicalCertificate === 'yes' && (
          <div className='space-y-4 mt-4'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                  }`}
                >
                  Last DOT Medical Exam Date
                </label>
                <input
                  type='date'
                  value={formData.medicalQualification.medicalExamDate}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      medicalExamDate: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    errors.medicalExamDate
                      ? 'border-red-500'
                      : theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
                {errors.medicalExamDate && (
                  <p className='mt-1 text-sm text-red-600'>{errors.medicalExamDate}</p>
                )}
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                  }`}
                >
                  Medical Certificate Expiration Date
                </label>
                <input
                  type='date'
                  value={formData.medicalQualification.medicalCertificateExpiration}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      medicalCertificateExpiration: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    errors.medicalCertificateExpiration
                      ? 'border-red-500'
                      : theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
                {errors.medicalCertificateExpiration && (
                  <p className='mt-1 text-sm text-red-600'>
                    {errors.medicalCertificateExpiration}
                  </p>
                )}
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                  }`}
                >
                  Filed with home licensing State (CDL/CLP exception)
                </label>
                <div className='flex gap-6'>
                  {['yes', 'no'].map((value) => (
                    <label key={value} className='flex items-center gap-2'>
                      <input
                        type='radio'
                        name='hasFiledWithState'
                        value={value}
                        checked={formData.medicalQualification.hasFiledWithState === value}
                        onChange={(e) =>
                          handleInputChange('medicalQualification', {
                            ...formData.medicalQualification,
                            hasFiledWithState: e.target.value,
                          })
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
                {errors.hasFiledWithState && (
                  <p className='mt-1 text-sm text-red-600'>
                    {errors.hasFiledWithState}
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='md:col-span-2'>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                  }`}
                >
                  Medical examiner's name
                </label>
                <input
                  type='text'
                  value={formData.medicalQualification.medicalExaminerName}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      medicalExaminerName: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    errors.medicalExaminerName
                      ? 'border-red-500'
                      : theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
                {errors.medicalExaminerName && (
                  <p className='mt-1 text-sm text-red-600'>
                    {errors.medicalExaminerName}
                  </p>
                )}
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                  }`}
                >
                  Medical examiner phone
                </label>
                <input
                  type='tel'
                  value={formData.medicalQualification.medicalExaminerPhone}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      medicalExaminerPhone: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    errors.medicalExaminerPhone
                      ? 'border-red-500'
                      : theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                />
                {errors.medicalExaminerPhone && (
                  <p className='mt-1 text-sm text-red-600'>
                    {errors.medicalExaminerPhone}
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                  }`}
                >
                  Examiner type
                </label>
                <select
                  value={formData.medicalQualification.medicalExaminerType}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      medicalExaminerType: e.target.value,
                      medicalExaminerRegistryId:
                        e.target.value === 'registry'
                          ? formData.medicalQualification.medicalExaminerRegistryId
                          : '',
                    })
                  }
                  className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                    errors.medicalExaminerType
                      ? 'border-red-500'
                      : theme === 'dark'
                        ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                  }`}
                >
                  <option value=''>Select examiner type…</option>
                  <option value='registry'>National Registry medical examiner</option>
                  <option value='ophthalmologist'>Ophthalmologist (vision only)</option>
                  <option value='optometrist'>Optometrist (vision only)</option>
                  <option value='va'>VA certified examiner</option>
                  <option value='other'>Other specialist</option>
                </select>
                {errors.medicalExaminerType && (
                  <p className='mt-1 text-sm text-red-600'>
                    {errors.medicalExaminerType}
                  </p>
                )}
              </div>
              {formData.medicalQualification.medicalExaminerType === 'registry' && (
                <div className='md:col-span-2'>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                    }`}
                  >
                    National Registry ID (10 digits)
                  </label>
                  <input
                    type='text'
                    value={formData.medicalQualification.medicalExaminerRegistryId}
                    onChange={(e) =>
                      handleInputChange('medicalQualification', {
                        ...formData.medicalQualification,
                        medicalExaminerRegistryId: e.target.value,
                      })
                    }
                    maxLength={10}
                    className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                      errors.medicalExaminerRegistryId
                        ? 'border-red-500'
                        : theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                    }`}
                  />
                  {errors.medicalExaminerRegistryId && (
                    <p className='mt-1 text-sm text-red-600'>
                      {errors.medicalExaminerRegistryId}
                    </p>
                  )}
                </div>
              )}
            </div>
            <p
              className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Ensure your examiner is listed on the FMCSA National Registry unless a permitted specialist performed the applicable portion of the exam (49 CFR 391.43).
            </p>
          </div>
        )}

        <div className='mt-4 space-y-3'>
          <label
            className={`block text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
            }`}
          >
            Do you have any FMCSA medical variances/exemptions (e.g., insulin, SPE certificate)?
          </label>
          <div className='flex gap-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasMedicalVariance'
                  value={value}
                  checked={formData.medicalQualification.hasMedicalVariance === value}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      hasMedicalVariance: e.target.value,
                      medicalVarianceDetails:
                        e.target.value === 'no'
                          ? ''
                          : formData.medicalQualification.medicalVarianceDetails,
                    })
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
          {errors.hasMedicalVariance && (
            <p className='text-sm text-red-600'>{errors.hasMedicalVariance}</p>
          )}
          {formData.medicalQualification.hasMedicalVariance === 'yes' && (
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                }`}
              >
                Describe the variance and keep copies of your documentation with you while on duty
              </label>
              <textarea
                value={formData.medicalQualification.medicalVarianceDetails}
                onChange={(e) =>
                  handleInputChange('medicalQualification', {
                    ...formData.medicalQualification,
                    medicalVarianceDetails: e.target.value,
                  })
                }
                className={`w-full min-h-[80px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  errors.medicalVarianceDetails
                    ? 'border-red-500'
                    : theme === 'dark'
                      ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
              {errors.medicalVarianceDetails && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.medicalVarianceDetails}
                </p>
              )}
            </div>
          )}
        </div>

        <div className='mt-4 space-y-3'>
          <label
            className={`block text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
            }`}
          >
            Do you have chronic conditions (cardiac, respiratory, neurological, etc.) that require monitoring?
          </label>
          <div className='flex gap-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='hasChronicConditions'
                  value={value}
                  checked={formData.medicalQualification.hasChronicConditions === value}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      hasChronicConditions: e.target.value,
                      chronicConditionsDetails:
                        e.target.value === 'no'
                          ? ''
                          : formData.medicalQualification.chronicConditionsDetails,
                    })
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
          {errors.hasChronicConditions && (
            <p className='text-sm text-red-600'>{errors.hasChronicConditions}</p>
          )}
          {formData.medicalQualification.hasChronicConditions === 'yes' && (
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
                }`}
              >
                Provide details (diagnosis, treatment, monitoring frequency)
              </label>
              <textarea
                value={formData.medicalQualification.chronicConditionsDetails}
                onChange={(e) =>
                  handleInputChange('medicalQualification', {
                    ...formData.medicalQualification,
                    chronicConditionsDetails: e.target.value,
                  })
                }
                className={`w-full min-h-[80px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  errors.chronicConditionsDetails
                    ? 'border-red-500'
                    : theme === 'dark'
                      ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
              {errors.chronicConditionsDetails && (
                <p className='mt-1 text-sm text-red-600'>
                  {errors.chronicConditionsDetails}
                </p>
              )}
            </div>
          )}
        </div>

        <div className='mt-4 space-y-3'>
          <label
            className={`block text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
            }`}
          >
            Do you meet the DOT vision and hearing standards or have an FMCSA waiver?
          </label>
          <div className='flex gap-6'>
            {['yes', 'no'].map((value) => (
              <label key={value} className='flex items-center gap-2'>
                <input
                  type='radio'
                  name='visionHearingCompliance'
                  value={value}
                  checked={formData.medicalQualification.visionHearingCompliance === value}
                  onChange={(e) =>
                    handleInputChange('medicalQualification', {
                      ...formData.medicalQualification,
                      visionHearingCompliance: e.target.value,
                    })
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
          {errors.visionHearingCompliance && (
            <p className='text-sm text-red-600'>
              {errors.visionHearingCompliance}
            </p>
          )}
        </div>

        <div className='mt-4'>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'
            }`}
          >
            List medications taken regularly (or state "None that impact safe driving")
          </label>
          <textarea
            value={formData.medicalQualification.medicationDisclosure}
            onChange={(e) =>
              handleInputChange('medicalQualification', {
                ...formData.medicalQualification,
                medicationDisclosure: e.target.value,
              })
            }
            className={`w-full min-h-[80px] px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              errors.medicationDisclosure
                ? 'border-red-500'
                : theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
          {errors.medicationDisclosure && (
            <p className='mt-1 text-sm text-red-600'>
              {errors.medicationDisclosure}
            </p>
          )}
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
          {currentStep === STEPS.length ? 'Continue to Form 2' : 'Next'}
        </button>
      </div>
    </div>
  )
}