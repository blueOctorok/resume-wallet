'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

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
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
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
  useEffect(() => {
    onDataChange?.(formData)
  }, [formData, onDataChange])

  // Initialize/restore from parent once to avoid loops
  const hasHydratedRef = useRef(false)
  useEffect(() => {
    if (hasHydratedRef.current) return
    if (initialData && Object.keys(initialData).length > 0) {
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
      if (!formData.dateOfBirth)
        newErrors.dateOfBirth = 'Date of birth is required'
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
    setFormData({
      firstName: 'John',
      middleName: 'Michael',
      lastName: 'Doe',
      phone: '(555) 123-4567',
      email: 'john.doe@email.com',
      dateOfBirth: '1985-03-15',
      socialSecurity: '123-45-6789',
      dateOfApplication: new Date().toISOString().slice(0, 10),
      positionAppliedFor: 'Commercial Driver',
      dateAvailableForWork: new Date().toISOString().slice(0, 10),
      hasLegalRightToWork: 'yes',
      currentMailing: {
        street: '123 Main Street',
        city: 'Columbus',
        state: 'OH',
        zipCode: '43215',
        yearsAtAddress: '3',
      },
      previousAddresses: [
        {
          street: '456 Oak Avenue',
          city: 'Cleveland',
          state: 'OH',
          zipCode: '44101',
          yearsAtAddress: '2',
        },
      ],
      currentLicenses: [
        {
          state: 'OH',
          licenseNumber: 'DL123456789',
          typeClass: 'CDL-A',
          endorsements: 'H, N',
          expirationDate: '2026-01-15',
        },
      ],
      previousLicenses: [
        {
          state: 'PA',
          licenseNumber: 'DL987654321',
          typeClass: 'CDL-B',
          endorsements: '',
          expirationDate: '2020-01-14',
        },
      ],
    })
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
