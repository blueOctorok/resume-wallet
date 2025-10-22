'use client'

import React, { useState } from 'react'
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

export default function PersonalInfoForm1() {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
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
    previousAddresses: [
      { street: '', city: '', state: '', zipCode: '', yearsAtAddress: '' },
      { street: '', city: '', state: '', zipCode: '', yearsAtAddress: '' },
      { street: '', city: '', state: '', zipCode: '', yearsAtAddress: '' },
    ],

    // License Information
    currentLicense: {
      state: '',
      licenseNumber: '',
      typeClass: '',
      endorsements: '',
      expirationDate: '',
    },
    previousLicenses: [
      {
        state: '',
        licenseNumber: '',
        typeClass: '',
        endorsements: '',
        expirationDate: '',
      },
      {
        state: '',
        licenseNumber: '',
        typeClass: '',
        endorsements: '',
        expirationDate: '',
      },
    ],
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

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
        </div>
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
          >
            POSITION APPLIED FOR
          </label>
          <input
            type='text'
            value={formData.positionAppliedFor}
            onChange={(e) =>
              handleInputChange('positionAppliedFor', e.target.value)
            }
            className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
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
                ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Previous Addresses */}
      {formData.previousAddresses.map((address, index) => (
        <div key={index} className='space-y-4'>
          <h3
            className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
          >
            PREVIOUS {index + 1}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>
        </div>
      ))}
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

      {/* Current License */}
      <div className='space-y-4'>
        <h3
          className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          CURRENT LICENSE
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
            >
              STATE
            </label>
            <input
              type='text'
              value={formData.currentLicense.state}
              onChange={(e) =>
                handleInputChange('currentLicense', {
                  ...formData.currentLicense,
                  state: e.target.value,
                })
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
              value={formData.currentLicense.licenseNumber}
              onChange={(e) =>
                handleInputChange('currentLicense', {
                  ...formData.currentLicense,
                  licenseNumber: e.target.value,
                })
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
              value={formData.currentLicense.typeClass}
              onChange={(e) =>
                handleInputChange('currentLicense', {
                  ...formData.currentLicense,
                  typeClass: e.target.value,
                })
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
              value={formData.currentLicense.endorsements}
              onChange={(e) =>
                handleInputChange('currentLicense', {
                  ...formData.currentLicense,
                  endorsements: e.target.value,
                })
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
              value={formData.currentLicense.expirationDate}
              onChange={(e) =>
                handleInputChange('currentLicense', {
                  ...formData.currentLicense,
                  expirationDate: e.target.value,
                })
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

      {/* Previously Held Licenses */}
      <div className='space-y-4'>
        <h3
          className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          PREVIOUSLY HELD LICENSES
        </h3>
        {formData.previousLicenses.map((license, index) => (
          <div key={index} className='space-y-4'>
            <h4
              className={`text-md font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
            >
              PREVIOUS LICENSE {index + 1}
            </h4>
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
    </div>
  )

  return (
    <div
      className={`max-w-4xl mx-auto rounded-lg shadow-xl border-t-4 ${
        theme === 'dark'
          ? 'bg-gray-800 border-brand-mint'
          : 'bg-white border-t-brand-sage border-gray-200'
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
        className={`flex justify-between items-center px-6 py-6 border-t-2 ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            currentStep === 1
              ? 'opacity-50 cursor-not-allowed'
              : theme === 'dark'
                ? 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
          }`}
        >
          Previous
        </button>

        <div className='flex space-x-2'>
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
          disabled={currentStep === STEPS.length}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            currentStep === STEPS.length
              ? 'opacity-50 cursor-not-allowed'
              : theme === 'dark'
                ? 'bg-brand-mint text-white hover:bg-brand-mint/90 shadow-lg'
                : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg'
          }`}
        >
          {currentStep === STEPS.length ? 'Complete' : 'Next'}
        </button>
      </div>
    </div>
  )
}
