'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface EmploymentVerificationData {
  // Section 1 - Driver/Applicant Authorization
  driverName: string
  ssn: string
  dateOfBirth: string
  previousEmployer: string
  employerAddress: string
  employmentDatesFrom: string
  employmentDatesTo: string
  positionHeld: string
  driverSignature: string
  signatureDate: string

  // Section 2 - To Be Completed by Previous Employer
  companyName: string
  companyAddress: string
  phone: string
  personCompletingForm: string
  title: string
  completionDate: string

  // Employment Verification
  verificationEmploymentFrom: string
  verificationEmploymentTo: string
  positionsHeld: string
  eligibleForRehire: 'yes' | 'no' | 'discuss' | ''
  reasonForLeaving: string

  // Accident History
  accidents: Array<{
    date: string
    location: string
    injuries: string
    fatalities: string
    hazmatSpill: string
    comments: string
  }>
  noAccidentsReported: boolean

  // Certification
  employerSignature: string
  printedName: string
  employerTitle: string
  certificationDate: string

  // Section 3 - Record of Attempts
  attempts: Array<{
    date: string
    method: string
    contactPerson: string
    result: string
  }>
}

const EmploymentVerificationForm = () => {
  const { theme } = useTheme()
  const [formData, setFormData] = useState<EmploymentVerificationData>({
    driverName: '',
    ssn: '',
    dateOfBirth: '',
    previousEmployer: '',
    employerAddress: '',
    employmentDatesFrom: '',
    employmentDatesTo: '',
    positionHeld: '',
    driverSignature: '',
    signatureDate: '',
    companyName: '',
    companyAddress: '',
    phone: '',
    personCompletingForm: '',
    title: '',
    completionDate: '',
    verificationEmploymentFrom: '',
    verificationEmploymentTo: '',
    positionsHeld: '',
    eligibleForRehire: '',
    reasonForLeaving: '',
    accidents: [
      {
        date: '',
        location: '',
        injuries: '',
        fatalities: '',
        hazmatSpill: '',
        comments: '',
      },
    ],
    noAccidentsReported: false,
    employerSignature: '',
    printedName: '',
    employerTitle: '',
    certificationDate: '',
    attempts: [{ date: '', method: '', contactPerson: '', result: '' }],
  })

  // Submission state and result
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<
    Partial<Record<keyof EmploymentVerificationData, string>>
  >({})

  async function hashJson(payload: unknown): Promise<string> {
    const json = JSON.stringify(payload)
    const encoder = new TextEncoder()
    const view = encoder.encode(json)
    const digest = await crypto.subtle.digest(
      'SHA-256',
      view.buffer as ArrayBuffer
    )
    const bytes = Array.from(new Uint8Array(digest))
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  const validateForm = (): Partial<
    Record<keyof EmploymentVerificationData, string>
  > => {
    const e: Partial<Record<keyof EmploymentVerificationData, string>> = {}
    const required: Array<keyof EmploymentVerificationData> = [
      'driverName',
      'previousEmployer',
      'employerAddress',
      'employmentDatesFrom',
      'employmentDatesTo',
      'positionHeld',
      'driverSignature',
      'signatureDate',
      'companyName',
      'companyAddress',
      'phone',
      'personCompletingForm',
      'title',
      'completionDate',
    ]

    required.forEach((field) => {
      const value = (formData as any)[field]
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        e[field] = 'This field is required.'
      }
    })

    if (
      formData.employmentDatesFrom &&
      formData.employmentDatesTo &&
      formData.employmentDatesFrom > formData.employmentDatesTo
    ) {
      e.employmentDatesTo = 'End date must be after start date.'
    }

    return e
  }

  const fillTestData = () => {
    setFormData({
      driverName: 'Jane Doe',
      ssn: '***-**-1234',
      dateOfBirth: '1990-05-12',
      previousEmployer: 'Acme Logistics LLC',
      employerAddress: '123 Industrial Way, Columbus, OH 43004',
      employmentDatesFrom: '2022-01-01',
      employmentDatesTo: '2024-09-30',
      positionHeld: 'CDL-A Driver',
      driverSignature: 'Jane Doe',
      signatureDate: new Date().toISOString().slice(0, 10),
      companyName: 'Acme Logistics LLC',
      companyAddress: '123 Industrial Way, Columbus, OH 43004',
      phone: '(555) 123-4567',
      personCompletingForm: 'John Manager',
      title: 'Safety Manager',
      completionDate: new Date().toISOString().slice(0, 10),
      verificationEmploymentFrom: '2022-01-01',
      verificationEmploymentTo: '2024-09-30',
      positionsHeld: 'CDL-A Regional Driver',
      eligibleForRehire: 'yes',
      reasonForLeaving: 'Relocation',
      accidents: [
        {
          date: '2023-03-10',
          location: 'I-70, OH',
          injuries: '0',
          fatalities: '0',
          hazmatSpill: 'No',
          comments: 'Minor fender bender, not at fault',
        },
      ],
      noAccidentsReported: false,
      employerSignature: 'John Manager',
      printedName: 'John Manager',
      employerTitle: 'Safety Manager',
      certificationDate: new Date().toISOString().slice(0, 10),
      attempts: [
        {
          date: new Date().toISOString().slice(0, 10),
          method: 'Phone',
          contactPerson: 'HR Desk',
          result: 'Completed',
        },
      ],
    })
    setErrors({})
  }

  const handleSubmitToBlockchain = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)
      setTxHash(null)
      setExplorerUrl(null)

      const validation = validateForm()
      setErrors(validation)
      if (Object.keys(validation).length > 0) {
        setSubmitError('Please fix the highlighted fields before submitting.')
        setSubmitting(false)
        return
      }

      // Create deterministic hash of the DOT Employment Verification form data
      const applicationHash = await hashJson(formData)

      // For now, use the same hash placeholder for ipfsHash until IPFS storage is added
      const ipfsHash = applicationHash

      const res = await fetch('/api/blockchain/submit-driver-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationHash, ipfsHash }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to submit application')
      }

      const data = await res.json()
      setTxHash(data.transactionHash)
      setExplorerUrl(data.explorerUrl)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (
    field: keyof EmploymentVerificationData,
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleArrayChange = (
    field: 'accidents' | 'attempts',
    index: number,
    subField: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) =>
        i === index ? { ...item, [subField]: value } : item
      ),
    }))
  }

  const addAccident = () => {
    setFormData((prev) => ({
      ...prev,
      accidents: [
        ...prev.accidents,
        {
          date: '',
          location: '',
          injuries: '',
          fatalities: '',
          hazmatSpill: '',
          comments: '',
        },
      ],
    }))
  }

  const removeAccident = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      accidents: prev.accidents.filter((_, i) => i !== index),
    }))
  }

  const addAttempt = () => {
    setFormData((prev) => ({
      ...prev,
      attempts: [
        ...prev.attempts,
        { date: '', method: '', contactPerson: '', result: '' },
      ],
    }))
  }

  const removeAttempt = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attempts: prev.attempts.filter((_, i) => i !== index),
    }))
  }

  return (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl'
          : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
      }`}
    >
      {/* Header */}
      <div className='text-center mb-8'>
        <h1
          className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Safety Performance History Records Request
        </h1>
        <p
          className={`text-lg ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          (Employment Verification)
        </p>
        <p
          className={`text-sm mt-2 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Required by 49 CFR § 391.23
        </p>

        {/* Test Data (Lightning) */}
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

      {/* Section 1 - Driver/Applicant Authorization */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Section 1 – Driver/Applicant Authorization
        </h2>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Driver Name:
            </label>
            <input
              type='text'
              value={formData.driverName}
              onChange={(e) => handleInputChange('driverName', e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              SSN (optional):
            </label>
            <input
              type='text'
              value={formData.ssn}
              onChange={(e) => handleInputChange('ssn', e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Date of Birth:
            </label>
            <input
              type='date'
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Previous Employer:
            </label>
            <input
              type='text'
              value={formData.previousEmployer}
              onChange={(e) =>
                handleInputChange('previousEmployer', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>
        </div>

        <div className='mb-4'>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Employer Address:
          </label>
          <textarea
            value={formData.employerAddress}
            onChange={(e) =>
              handleInputChange('employerAddress', e.target.value)
            }
            rows={3}
            className={`w-full px-3 py-2 rounded-md border ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-4'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Employment Dates From:
            </label>
            <input
              type='date'
              value={formData.employmentDatesFrom}
              onChange={(e) =>
                handleInputChange('employmentDatesFrom', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Employment Dates To:
            </label>
            <input
              type='date'
              value={formData.employmentDatesTo}
              onChange={(e) =>
                handleInputChange('employmentDatesTo', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Position Held:
            </label>
            <input
              type='text'
              value={formData.positionHeld}
              onChange={(e) =>
                handleInputChange('positionHeld', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>
        </div>

        <div
          className={`p-4 rounded-lg mb-4 ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
          }`}
        >
          <p
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            I hereby authorize you to release to Pace Drivers, Inc. all
            information on my employment, accident, and safety performance
            history, including any alcohol and controlled substances testing
            information, in accordance with 49 CFR § 391.23. I understand that I
            have the right to review this information, request correction of
            errors, and have a copy furnished to me.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Driver Signature:
            </label>
            <input
              type='text'
              value={formData.driverSignature}
              onChange={(e) =>
                handleInputChange('driverSignature', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Date:
            </label>
            <input
              type='date'
              value={formData.signatureDate}
              onChange={(e) =>
                handleInputChange('signatureDate', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>
        </div>
      </div>

      {/* Section 2 - To Be Completed by Previous Employer */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Section 2 – To Be Completed by Previous Employer
        </h2>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Company Name:
            </label>
            <input
              type='text'
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Phone:
            </label>
            <input
              type='text'
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>
        </div>

        <div className='mb-4'>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            Address:
          </label>
          <textarea
            value={formData.companyAddress}
            onChange={(e) =>
              handleInputChange('companyAddress', e.target.value)
            }
            rows={3}
            className={`w-full px-3 py-2 rounded-md border ${
              theme === 'dark'
                ? 'bg-brand-cream border-gray-300 text-gray-900'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Person Completing Form:
            </label>
            <input
              type='text'
              value={formData.personCompletingForm}
              onChange={(e) =>
                handleInputChange('personCompletingForm', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Title:
            </label>
            <input
              type='text'
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Date:
            </label>
            <input
              type='date'
              value={formData.completionDate}
              onChange={(e) =>
                handleInputChange('completionDate', e.target.value)
              }
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>
        </div>

        {/* Employment Verification */}
        <div className='mb-6'>
          <h3
            className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Employment Verification:
          </h3>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Employment Dates From:
              </label>
              <input
                type='date'
                value={formData.verificationEmploymentFrom}
                onChange={(e) =>
                  handleInputChange(
                    'verificationEmploymentFrom',
                    e.target.value
                  )
                }
                className={`w-full px-3 py-2 rounded-md border ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Employment Dates To:
              </label>
              <input
                type='date'
                value={formData.verificationEmploymentTo}
                onChange={(e) =>
                  handleInputChange('verificationEmploymentTo', e.target.value)
                }
                className={`w-full px-3 py-2 rounded-md border ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
              />
            </div>
          </div>

          <div className='mb-4'>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Position(s) Held:
            </label>
            <textarea
              value={formData.positionsHeld}
              onChange={(e) =>
                handleInputChange('positionsHeld', e.target.value)
              }
              rows={3}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>

          <div className='mb-4'>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Eligible for Rehire?
            </label>
            <div className='flex space-x-4'>
              {['yes', 'no', 'discuss'].map((option) => (
                <label key={option} className='flex items-center'>
                  <input
                    type='radio'
                    name='eligibleForRehire'
                    value={option}
                    checked={formData.eligibleForRehire === option}
                    onChange={(e) =>
                      handleInputChange('eligibleForRehire', e.target.value)
                    }
                    className='mr-2'
                  />
                  <span
                    className={`capitalize ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {option === 'discuss' ? 'Would Discuss' : option}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Reason for Leaving:
            </label>
            <textarea
              value={formData.reasonForLeaving}
              onChange={(e) =>
                handleInputChange('reasonForLeaving', e.target.value)
              }
              rows={3}
              className={`w-full px-3 py-2 rounded-md border ${
                theme === 'dark'
                  ? 'bg-brand-cream border-gray-300 text-gray-900'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
            />
          </div>
        </div>

        {/* Accident History */}
        <div className='mb-6'>
          <h3
            className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Accident History (Past 3 Years):
          </h3>

          <div className='overflow-x-auto'>
            <table className='w-full border-collapse border border-gray-300'>
              <thead>
                <tr
                  className={`${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <th
                    className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Date
                  </th>
                  <th
                    className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Location
                  </th>
                  <th
                    className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Injuries
                  </th>
                  <th
                    className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Fatalities
                  </th>
                  <th
                    className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Hazmat Spill
                  </th>
                  <th
                    className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Comments
                  </th>
                  <th
                    className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {formData.accidents.map((accident, index) => (
                  <tr key={index}>
                    <td className='border border-gray-300 px-3 py-2'>
                      <input
                        type='date'
                        value={accident.date}
                        onChange={(e) =>
                          handleArrayChange(
                            'accidents',
                            index,
                            'date',
                            e.target.value
                          )
                        }
                        className={`w-full px-2 py-1 rounded border ${
                          theme === 'dark'
                            ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </td>
                    <td className='border border-gray-300 px-3 py-2'>
                      <input
                        type='text'
                        value={accident.location}
                        onChange={(e) =>
                          handleArrayChange(
                            'accidents',
                            index,
                            'location',
                            e.target.value
                          )
                        }
                        className={`w-full px-2 py-1 rounded border ${
                          theme === 'dark'
                            ? 'bg-brand-cream border-gray-300 text-gray-900'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </td>
                    <td className='border border-gray-300 px-3 py-2'>
                      <input
                        type='text'
                        value={accident.injuries}
                        onChange={(e) =>
                          handleArrayChange(
                            'accidents',
                            index,
                            'injuries',
                            e.target.value
                          )
                        }
                        className={`w-full px-2 py-1 rounded border ${
                          theme === 'dark'
                            ? 'bg-brand-cream border-gray-300 text-gray-900'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </td>
                    <td className='border border-gray-300 px-3 py-2'>
                      <input
                        type='text'
                        value={accident.fatalities}
                        onChange={(e) =>
                          handleArrayChange(
                            'accidents',
                            index,
                            'fatalities',
                            e.target.value
                          )
                        }
                        className={`w-full px-2 py-1 rounded border ${
                          theme === 'dark'
                            ? 'bg-brand-cream border-gray-300 text-gray-900'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </td>
                    <td className='border border-gray-300 px-3 py-2'>
                      <input
                        type='text'
                        value={accident.hazmatSpill}
                        onChange={(e) =>
                          handleArrayChange(
                            'accidents',
                            index,
                            'hazmatSpill',
                            e.target.value
                          )
                        }
                        className={`w-full px-2 py-1 rounded border ${
                          theme === 'dark'
                            ? 'bg-brand-cream border-gray-300 text-gray-900'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </td>
                    <td className='border border-gray-300 px-3 py-2'>
                      <input
                        type='text'
                        value={accident.comments}
                        onChange={(e) =>
                          handleArrayChange(
                            'accidents',
                            index,
                            'comments',
                            e.target.value
                          )
                        }
                        className={`w-full px-2 py-1 rounded border ${
                          theme === 'dark'
                            ? 'bg-brand-cream border-gray-300 text-gray-900'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </td>
                    <td className='border border-gray-300 px-3 py-2'>
                      <button
                        type='button'
                        onClick={() => removeAccident(index)}
                        className={`px-2 py-1 text-xs rounded ${
                          theme === 'dark'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-red-500 text-white hover:bg-red-600'
                        }`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className='mt-4 flex space-x-4'>
            <button
              type='button'
              onClick={addAccident}
              className={`px-4 py-2 rounded-md font-medium ${
                theme === 'dark'
                  ? 'bg-brand-sage text-white hover:bg-brand-sage/90'
                  : 'bg-brand-sage text-white hover:bg-brand-sage/90'
              }`}
            >
              Add Accident
            </button>

            <label className='flex items-center'>
              <input
                type='checkbox'
                checked={formData.noAccidentsReported}
                onChange={(e) =>
                  handleInputChange('noAccidentsReported', e.target.checked)
                }
                className='mr-2'
              />
              <span
                className={`${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                No DOT-recordable accidents reported.
              </span>
            </label>
          </div>
        </div>

        {/* Certification */}
        <div className='mb-6'>
          <h3
            className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Certification by Previous Employer:
          </h3>

          <div
            className={`p-4 rounded-lg mb-4 ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            }`}
          >
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              This information is provided in accordance with 49 CFR § 391.23(d)
              and § 40.25(h).
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Signature:
              </label>
              <input
                type='text'
                value={formData.employerSignature}
                onChange={(e) =>
                  handleInputChange('employerSignature', e.target.value)
                }
                className={`w-full px-3 py-2 rounded-md border ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Printed Name:
              </label>
              <input
                type='text'
                value={formData.printedName}
                onChange={(e) =>
                  handleInputChange('printedName', e.target.value)
                }
                className={`w-full px-3 py-2 rounded-md border ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Title:
              </label>
              <input
                type='text'
                value={formData.employerTitle}
                onChange={(e) =>
                  handleInputChange('employerTitle', e.target.value)
                }
                className={`w-full px-3 py-2 rounded-md border ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                Date:
              </label>
              <input
                type='date'
                value={formData.certificationDate}
                onChange={(e) =>
                  handleInputChange('certificationDate', e.target.value)
                }
                className={`w-full px-3 py-2 rounded-md border ${
                  theme === 'dark'
                    ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-brand-sage focus:border-transparent`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 - Record of Attempts */}
      <div className='mb-8'>
        <h2
          className={`text-xl font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Section 3 – Record of Attempts (for Employer Use)
        </h2>

        <div className='overflow-x-auto'>
          <table className='w-full border-collapse border border-gray-300'>
            <thead>
              <tr
                className={`${
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                }`}
              >
                <th
                  className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Date
                </th>
                <th
                  className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Method
                </th>
                <th
                  className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Contact Person
                </th>
                <th
                  className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Result
                </th>
                <th
                  className={`border border-gray-300 px-3 py-2 text-left text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {formData.attempts.map((attempt, index) => (
                <tr key={index}>
                  <td className='border border-gray-300 px-3 py-2'>
                    <input
                      type='date'
                      value={attempt.date}
                      onChange={(e) =>
                        handleArrayChange(
                          'attempts',
                          index,
                          'date',
                          e.target.value
                        )
                      }
                      className={`w-full px-2 py-1 rounded border ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900 [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </td>
                  <td className='border border-gray-300 px-3 py-2'>
                    <input
                      type='text'
                      value={attempt.method}
                      onChange={(e) =>
                        handleArrayChange(
                          'attempts',
                          index,
                          'method',
                          e.target.value
                        )
                      }
                      className={`w-full px-2 py-1 rounded border ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </td>
                  <td className='border border-gray-300 px-3 py-2'>
                    <input
                      type='text'
                      value={attempt.contactPerson}
                      onChange={(e) =>
                        handleArrayChange(
                          'attempts',
                          index,
                          'contactPerson',
                          e.target.value
                        )
                      }
                      className={`w-full px-2 py-1 rounded border ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </td>
                  <td className='border border-gray-300 px-3 py-2'>
                    <input
                      type='text'
                      value={attempt.result}
                      onChange={(e) =>
                        handleArrayChange(
                          'attempts',
                          index,
                          'result',
                          e.target.value
                        )
                      }
                      className={`w-full px-2 py-1 rounded border ${
                        theme === 'dark'
                          ? 'bg-brand-cream border-gray-300 text-gray-900'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </td>
                  <td className='border border-gray-300 px-3 py-2'>
                    <button
                      type='button'
                      onClick={() => removeAttempt(index)}
                      className={`px-2 py-1 text-xs rounded ${
                        theme === 'dark'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='mt-4'>
          <button
            type='button'
            onClick={addAttempt}
            className={`px-4 py-2 rounded-md font-medium ${
              theme === 'dark'
                ? 'bg-brand-sage text-white hover:bg-brand-sage/90'
                : 'bg-brand-sage text-white hover:bg-brand-sage/90'
            }`}
          >
            Add Attempt
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className='text-center'>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Form complies with 49 CFR § 391.23 — Revised 2025 Edition.
        </p>
      </div>

      {/* Submit to Blockchain */}
      <div className='mt-8'>
        <div
          className={`mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          <h3 className='text-xl font-semibold'>Submit to Blockchain</h3>
          <p
            className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
          >
            We store a SHA-256 hash of this form on Base Sepolia for
            tamper-proof verification. No personal details are stored on-chain.
          </p>
        </div>

        <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center'>
          <button
            type='button'
            onClick={handleSubmitToBlockchain}
            disabled={submitting}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'dark'
                ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                : 'bg-brand-sage text-white hover:bg-brand-sage/90'
            }`}
          >
            {submitting ? 'Submitting…' : 'Submit Verification Hash'}
          </button>

          {txHash && (
            <div
              className={`px-4 py-3 rounded-lg border ${
                theme === 'dark'
                  ? 'border-green-500/50 bg-green-900/20 text-green-300'
                  : 'border-green-200 bg-green-50 text-green-800'
              }`}
            >
              <div className='font-semibold'>Submitted!</div>
              <div className='text-sm break-all'>Tx: {txHash}</div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={`${
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  } underline text-sm`}
                >
                  View on BaseScan
                </a>
              )}
            </div>
          )}

          {submitError && (
            <div
              className={`px-4 py-3 rounded-lg border ${
                theme === 'dark'
                  ? 'border-red-500/50 bg-red-900/20 text-red-300'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {submitError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmploymentVerificationForm
