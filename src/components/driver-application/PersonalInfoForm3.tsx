'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

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

export default function PersonalInfoForm3() {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
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
      },
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
      },
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
      },
    ],

    // Education
    education: [
      {
        school: 'High School',
        nameAndLocation: '',
        courseOfStudy: '',
        yearsCompleted: '',
        graduated: '',
        details: '',
      },
      {
        school: 'College',
        nameAndLocation: '',
        courseOfStudy: '',
        yearsCompleted: '',
        graduated: '',
        details: '',
      },
      {
        school: 'Other',
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
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
        >
          EMPLOYMENT HISTORY
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-brand-cream/80' : 'text-brand-sage/80'}`}
        >
          The Federal Motor Carrier Safety Regulations (49 CFR 391.21) require
          that all applicants wishing to drive a commercial vehicle list all
          employment for the last three (3) years. In addition, if you have
          driven a commercial vehicle previously, you must provide employment
          history for an additional seven (7) years (for a total of ten (10)
          years). Any gaps in employment in excess of one (1) month must be
          explained.
        </p>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-brand-cream/80' : 'text-brand-sage/80'}`}
        >
          Start with the last or current position, including any military
          experience, and work backwards (attach separate sheets if necessary).
          You are required to list the complete mailing address, including
          street number, city, state, zip; and complete all other information.
        </p>
      </div>

      {formData.employers.map((employer, index) => (
        <div key={index} className='space-y-6'>
          <h3
            className={`text-xl font-semibold ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
          >
            {index === 0
              ? 'CURRENT (MOST RECENT) EMPLOYER'
              : index === 1
                ? 'SECOND (MOST RECENT) EMPLOYER'
                : 'THIRD (MOST RECENT) EMPLOYER'}
          </h3>

          {/* Company Name and Phone */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='md:col-span-2'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>

          {/* Position and Dates */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
              >
                FROM (MO/YR)
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
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
              >
                TO (MO/YR)
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
                placeholder='MM/YYYY'
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>

          {/* Reason for Leaving and Salary */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
              >
                REASON FOR LEAVING
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
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>

          {/* Gaps in Employment */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>

          {/* DOT Questions */}
          <div className='space-y-4'>
            <div className='space-y-3'>
              <label
                className={`block text-sm font-medium ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
                  >
                    NO
                  </span>
                </label>
              </div>
            </div>

            <div className='space-y-3'>
              <label
                className={`block text-sm font-medium ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                  />
                  <span
                    className={`${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
                  >
                    NO
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderEducation = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
        >
          EDUCATION
        </h2>
      </div>

      {formData.education.map((edu, index) => (
        <div key={index} className='space-y-4'>
          <h3
            className={`text-lg font-semibold ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
          >
            {edu.school.toUpperCase()}
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-6 gap-4'>
            <div className='md:col-span-2'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
              >
                YEARS COMPLETED
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                  />
                  <span
                    className={`text-sm ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    className={`mr-2 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
                  />
                  <span
                    className={`text-sm ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
                  >
                    N
                  </span>
                </label>
              </div>
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                    ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Other Qualifications */}
      <div className='space-y-4'>
        <h3
          className={`text-lg font-semibold ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
        >
          OTHER QUALIFICATIONS
        </h3>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-brand-cream/80' : 'text-brand-sage/80'}`}
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
              ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
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
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
        >
          TO BE READ AND SIGNED BY APPLICANT
        </h2>
      </div>

      <div
        className={`p-6 rounded-lg border-2 ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-600'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div
          className={`text-sm space-y-4 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
            This certifies that I completed this application, and that all
            entries on it and information in it are true and complete to the
            best of my knowledge. Note: A motor carrier may require an applicant
            to provide more information than that required by the Federal Motor
            Carrier Safety Regulations.
          </p>
        </div>
      </div>

      {/* Signature Fields */}
      <div className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
            >
              Date
            </label>
            <input
              type='date'
              value={formData.signatureDate}
              onChange={(e) =>
                handleInputChange('signatureDate', e.target.value)
              }
              className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
              }`}
            />
          </div>
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'}`}
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
                ? 'bg-gray-800 border-gray-600 text-white focus:ring-brand-mint'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
            }`}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`max-w-4xl mx-auto rounded-lg shadow-xl border-t-4 ${
        theme === 'dark'
          ? 'bg-gray-900 border-brand-mint'
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
            theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'
          }`}
        >
          DRIVER EMPLOYMENT APPLICATION
        </h1>
        <p
          className={`text-lg ${
            theme === 'dark' ? 'text-brand-cream/80' : 'text-brand-sage/80'
          }`}
        >
          [COMPANY NAME, ADDRESS, PHONE NUMBER, AND EMAIL]
        </p>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-brand-cream/60' : 'text-brand-sage/60'
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
              theme === 'dark' ? 'text-brand-cream' : 'text-brand-sage'
            }`}
          >
            Step {currentStep} of {STEPS.length}
          </div>
          <div
            className={`text-sm ${
              theme === 'dark' ? 'text-brand-cream/80' : 'text-brand-sage/80'
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
          {currentStep === STEPS.length ? 'Complete Application' : 'Next'}
        </button>
      </div>
    </div>
  )
}
