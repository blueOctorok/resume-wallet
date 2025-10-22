'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

const STEPS = [
  {
    id: 1,
    title: 'Driving Experience',
    description: 'Equipment types and driving experience',
  },
  {
    id: 2,
    title: 'Accident Record',
    description: 'Accidents from the past 3 years',
  },
  {
    id: 3,
    title: 'Traffic Convictions',
    description: 'Traffic violations and penalties',
  },
]

export default function PersonalInfoForm2() {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Driving Experience
    drivingExperience: [
      {
        equipmentClass: 'STRAIGHT TRUCK',
        equipmentType: '',
        dateFrom: '',
        dateTo: '',
        milesTotal: '',
      },
      {
        equipmentClass: 'TRACTOR & SEMI-TRAILER',
        equipmentType: '',
        dateFrom: '',
        dateTo: '',
        milesTotal: '',
      },
      {
        equipmentClass: 'TRACTOR & 2 TRAILERS',
        equipmentType: '',
        dateFrom: '',
        dateTo: '',
        milesTotal: '',
      },
      {
        equipmentClass: 'TRACTOR & TANKER',
        equipmentType: '',
        dateFrom: '',
        dateTo: '',
        milesTotal: '',
      },
      {
        equipmentClass: 'OTHER',
        equipmentType: '',
        dateFrom: '',
        dateTo: '',
        milesTotal: '',
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
      },
      {
        date: '',
        nature: '',
        fatalities: '',
        injuries: '',
        chemicalSpills: '',
      },
      {
        date: '',
        nature: '',
        fatalities: '',
        injuries: '',
        chemicalSpills: '',
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
      },
      {
        dateConvicted: '',
        violation: '',
        stateOfViolation: '',
        penalty: '',
      },
      {
        dateConvicted: '',
        violation: '',
        stateOfViolation: '',
        penalty: '',
      },
    ],
    hasNoConvictions: false,
    deniedLicense: '',
    deniedLicenseExplain: '',
    suspendedLicense: '',
    suspendedLicenseExplain: '',
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
        return renderDrivingExperience()
      case 2:
        return renderAccidentRecord()
      case 3:
        return renderTrafficConvictions()
      default:
        return null
    }
  }

  const renderDrivingExperience = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          DRIVING EXPERIENCE
        </h2>
      </div>

      {formData.drivingExperience.map((experience, index) => (
        <div key={index} className='space-y-4'>
          <h3
            className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
          >
            {experience.equipmentClass}
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
            <div className='md:col-span-2'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
              >
                TYPE OF EQUIPMENT (VAN, TANK, FLAT, ETC.)
              </label>
              <input
                type='text'
                value={experience.equipmentType}
                onChange={(e) =>
                  handleInputChange(
                    'drivingExperience',
                    { equipmentType: e.target.value },
                    index
                  )
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
                DATE FROM
              </label>
              <input
                type='date'
                value={experience.dateFrom}
                onChange={(e) =>
                  handleInputChange(
                    'drivingExperience',
                    { dateFrom: e.target.value },
                    index
                  )
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
                DATE TO
              </label>
              <input
                type='date'
                value={experience.dateTo}
                onChange={(e) =>
                  handleInputChange(
                    'drivingExperience',
                    { dateTo: e.target.value },
                    index
                  )
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
                APPROX # OF MILES (TOTAL)
              </label>
              <input
                type='text'
                value={experience.milesTotal}
                onChange={(e) =>
                  handleInputChange(
                    'drivingExperience',
                    { milesTotal: e.target.value },
                    index
                  )
                }
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderAccidentRecord = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          ACCIDENT RECORD FOR THE PAST 3 YEARS
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
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
          onChange={(e) =>
            handleInputChange('hasNoAccidents', e.target.checked)
          }
          className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
        />
        <label
          htmlFor='hasNoAccidents'
          className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
        >
          Check this box if you have had no accidents in the past 3 years
        </label>
      </div>

      {!formData.hasNoAccidents && (
        <div className='space-y-6'>
          {formData.accidents.map((accident, index) => (
            <div key={index} className='space-y-4'>
              <h3
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
              >
                ACCIDENT {index + 1}
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    DATES (List most recent first)
                  </label>
                  <input
                    type='date'
                    value={accident.date}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { date: e.target.value },
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
                    NATURE OF ACCIDENT
                  </label>
                  <input
                    type='text'
                    value={accident.nature}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { nature: e.target.value },
                        index
                      )
                    }
                    placeholder='Head-on, rear-end, upset, etc.'
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
                    # FATALITIES
                  </label>
                  <input
                    type='text'
                    value={accident.fatalities}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { fatalities: e.target.value },
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
                    # INJURIES
                  </label>
                  <input
                    type='text'
                    value={accident.injuries}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { injuries: e.target.value },
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
                    CHEMICAL SPILLS (Y/N)
                  </label>
                  <input
                    type='text'
                    value={accident.chemicalSpills}
                    onChange={(e) =>
                      handleInputChange(
                        'accidents',
                        { chemicalSpills: e.target.value },
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
      )}
    </div>
  )

  const renderTrafficConvictions = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
        >
          TRAFFIC CONVICTIONS AND FORFEITURES FOR THE PAST 3 YEARS
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          (OTHER THAN PARKING VIOLATIONS)
        </p>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage/80'}`}
        >
          Attach additional sheet if more space is needed. Check this box if
          none
        </p>
      </div>

      {/* No Convictions Checkbox */}
      <div className='flex items-center space-x-3'>
        <input
          type='checkbox'
          id='hasNoConvictions'
          checked={formData.hasNoConvictions}
          onChange={(e) =>
            handleInputChange('hasNoConvictions', e.target.checked)
          }
          className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
        />
        <label
          htmlFor='hasNoConvictions'
          className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
        >
          Check this box if you have had no convictions in the past 3 years
        </label>
      </div>

      {!formData.hasNoConvictions && (
        <div className='space-y-6'>
          {formData.convictions.map((conviction, index) => (
            <div key={index} className='space-y-4'>
              <h3
                className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-brand-sage'}`}
              >
                CONVICTION {index + 1}
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    DATE CONVICTED (Month/Year)
                  </label>
                  <input
                    type='text'
                    value={conviction.dateConvicted}
                    onChange={(e) =>
                      handleInputChange(
                        'convictions',
                        { dateConvicted: e.target.value },
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
                    className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
                  >
                    VIOLATION
                  </label>
                  <input
                    type='text'
                    value={conviction.violation}
                    onChange={(e) =>
                      handleInputChange(
                        'convictions',
                        { violation: e.target.value },
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
                    STATE OF VIOLATION
                  </label>
                  <input
                    type='text'
                    value={conviction.stateOfViolation}
                    onChange={(e) =>
                      handleInputChange(
                        'convictions',
                        { stateOfViolation: e.target.value },
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
                    PENALTY
                  </label>
                  <input
                    type='text'
                    value={conviction.penalty}
                    onChange={(e) =>
                      handleInputChange(
                        'convictions',
                        { penalty: e.target.value },
                        index
                      )
                    }
                    placeholder='Forfeited bond, collateral and/or points'
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
      )}

      {/* License Questions */}
      <div className='space-y-6'>
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                name='deniedLicense'
                value='no'
                checked={formData.deniedLicense === 'no'}
                onChange={(e) =>
                  handleInputChange('deniedLicense', e.target.value)
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
          {formData.deniedLicense === 'yes' && (
            <div className='mt-3'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          )}
        </div>

        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                name='suspendedLicense'
                value='no'
                checked={formData.suspendedLicense === 'no'}
                onChange={(e) =>
                  handleInputChange('suspendedLicense', e.target.value)
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
          {formData.suspendedLicense === 'yes' && (
            <div className='mt-3'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-brand-sage'}`}
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
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-brand-mint'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          )}
        </div>
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
