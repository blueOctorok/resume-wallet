'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import SaveProgressButton from './SaveProgressButton'

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

interface PersonalInfoForm2Props {
  onNavigateToForm?: (formNumber: number) => void
  onDataChange?: (data: any) => void
  initialData?: any
  walletAddress?: string
  /** Centralized save function - saves ALL forms to driver profile */
  onSaveProgress?: () => Promise<boolean | undefined>
}

export default function PersonalInfoForm2({
  onNavigateToForm,
  onDataChange,
  initialData,
  walletAddress,
  onSaveProgress,
}: PersonalInfoForm2Props) {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    // Driving Experience
    drivingExperience: [
      {
        equipmentType: '',
        yearsOfExperience: '',
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
        atFault: '',
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
        drivingExperience: [
          {
            equipmentType: '',
            yearsOfExperience: '',
          },
        ],
        accidents: [
          {
            date: '',
            nature: '',
            fatalities: '',
            injuries: '',
            chemicalSpills: '',
            atFault: '',
          },
        ],
        hasNoAccidents: false,
        convictions: [
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
      // Driving Experience validation
      formData.drivingExperience.forEach((exp, index) => {
        if (!exp.equipmentType.trim())
          newErrors[`drivingExp${index}Equipment`] =
            'Equipment type is required'
        if (!exp.yearsOfExperience.trim())
          newErrors[`drivingExp${index}Years`] =
            'Years of experience is required'
      })
    } else if (step === 2) {
      // Accident Record validation
      if (!formData.hasNoAccidents) {
        formData.accidents.forEach((accident, index) => {
          if (accident.date.trim() || accident.nature.trim()) {
            if (!accident.date.trim())
              newErrors[`accident${index}Date`] = 'Accident date is required'
            if (!accident.nature.trim())
              newErrors[`accident${index}Nature`] =
                'Accident nature is required'
            if (!accident.atFault)
              newErrors[`accident${index}AtFault`] =
                'Please specify if at fault'
          }
        })
      }
    } else if (step === 3) {
      // Traffic Convictions validation
      formData.convictions.forEach((conviction, index) => {
        if (conviction.dateConvicted?.trim() || conviction.violation?.trim()) {
          if (!conviction.dateConvicted?.trim())
            newErrors[`conviction${index}Date`] = 'Conviction date is required'
          if (!conviction.violation?.trim())
            newErrors[`conviction${index}Violation`] =
              'Violation description is required'
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
        // Form is completed, navigate to Form 3
        onNavigateToForm?.(3)
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

  const addDrivingExperience = () => {
    setFormData((prev) => ({
      ...prev,
      drivingExperience: [
        ...prev.drivingExperience,
        {
          equipmentType: '',
          yearsOfExperience: '',
        },
      ],
    }))
  }

  const removeDrivingExperience = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      drivingExperience: prev.drivingExperience.filter((_, i) => i !== index),
    }))
  }

  const addAccident = () => {
    setFormData((prev) => ({
      ...prev,
      accidents: [
        ...prev.accidents,
        {
          date: '',
          nature: '',
          fatalities: '',
          injuries: '',
          chemicalSpills: '',
          atFault: '',
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

  const addConviction = () => {
    setFormData((prev) => ({
      ...prev,
      convictions: [
        ...prev.convictions,
        {
          dateConvicted: '',
          violation: '',
          stateOfViolation: '',
          penalty: '',
        },
      ],
    }))
  }

  const removeConviction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      convictions: prev.convictions.filter((_, i) => i !== index),
    }))
  }

  const fillTestData = () => {
    // Smart fill: only fill EMPTY fields, preserve existing data
    setFormData((prev) => ({
      // Driving Experience - add test data only if empty
      drivingExperience: prev.drivingExperience?.length > 0 && prev.drivingExperience.some(exp => exp.equipmentType || exp.yearsOfExperience)
        ? prev.drivingExperience
        : [
            {
              equipmentType: 'TRACTOR & SEMI-TRAILER',
              yearsOfExperience: '5',
            },
            {
              equipmentType: 'STRAIGHT TRUCK',
              yearsOfExperience: '2',
            },
          ],
      
      // Accidents - add test data only if empty
      accidents: prev.accidents?.length > 0 && prev.accidents.some(acc => acc.date || acc.nature)
        ? prev.accidents
        : [
            {
              date: '2022-06-15',
              nature: 'Rear-end collision',
              fatalities: '0',
              injuries: '1',
              chemicalSpills: 'N',
              atFault: 'no',
            },
          ],
      hasNoAccidents: prev.hasNoAccidents ?? false,
      
      // Convictions - add test data only if empty
      convictions: prev.convictions?.length > 0 && prev.convictions.some(conv => conv.dateConvicted || conv.violation)
        ? prev.convictions
        : [
            {
              dateConvicted: '03/2023',
              violation: 'Speeding - 15 mph over limit',
              stateOfViolation: 'OH',
              penalty: 'Fine $150, 2 points',
            },
          ],
      hasNoConvictions: prev.hasNoConvictions ?? false,
      
      // License denial/suspension - only fill if empty
      deniedLicense: prev.deniedLicense || 'no',
      deniedLicenseExplain: prev.deniedLicenseExplain || '',
      suspendedLicense: prev.suspendedLicense || 'no',
      suspendedLicenseExplain: prev.suspendedLicenseExplain || '',
    }))
    setErrors({})
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
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          DRIVING EXPERIENCE
        </h2>
      </div>

      {formData.drivingExperience.map((experience, index) => (
        <div key={index} className='space-y-4'>
          <div className='flex justify-between items-center'>
            <h3
              className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              EXPERIENCE {index + 1}
            </h3>
            <button
              type='button'
              onClick={() => removeDrivingExperience(index)}
              className={`px-3 py-1 text-sm rounded-md font-medium transition-all duration-200 ${
                theme === 'dark'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              Remove
            </button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
              >
                TYPE OF EQUIPMENT
              </label>
              <select
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
                    ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                }`}
              >
                <option value=''>Select equipment type...</option>
                <option value='STRAIGHT TRUCK'>Straight Truck</option>
                <option value='TRACTOR & SEMI-TRAILER'>
                  Tractor & Semi-Trailer
                </option>
                <option value='TRACTOR & 2 TRAILERS'>
                  Tractor & 2 Trailers
                </option>
                <option value='TRACTOR & TANKER'>Tractor & Tanker</option>
                <option value='BUS'>Bus</option>
                <option value='MOTORCOACH'>Motorcoach</option>
                <option value='SCHOOL BUS'>School Bus</option>
                <option value='OTHER'>Other</option>
              </select>
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
              >
                YEARS OF EXPERIENCE
              </label>
              <input
                type='text'
                value={experience.yearsOfExperience}
                onChange={(e) =>
                  handleInputChange(
                    'drivingExperience',
                    { yearsOfExperience: e.target.value },
                    index
                  )
                }
                placeholder='e.g., 2.5, 5, 10+'
                className={`w-full px-4 py-3 border-2 rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
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
          onClick={addDrivingExperience}
          className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
          }`}
        >
          + Add Driving Experience
        </button>
      </div>
    </div>
  )

  const renderAccidentRecord = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          ACCIDENT RECORD FOR THE PAST 3 YEARS
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
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
          className={`w-4 h-4 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
        />
        <label
          htmlFor='hasNoAccidents'
          className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Check this box if you have had no accidents in the past 3 years
        </label>
      </div>

      {!formData.hasNoAccidents && (
        <div className='space-y-6'>
          {formData.accidents.map((accident, index) => (
            <div key={index} className='space-y-4'>
              <div className='flex justify-between items-center'>
                <h3
                  className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                >
                  ACCIDENT {index + 1}
                </h3>
                {formData.accidents.length > 1 && (
                  <button
                    type='button'
                    onClick={() => removeAccident(index)}
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
              {/* Label row uses min-h so multi-line labels don't push inputs down; keeps inputs aligned */}
              <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    DATE
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
              </div>

              {/* At Fault Radio Buttons */}
              <div className='space-y-3'>
                <label
                  className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Were you at fault for this accident?
                </label>
                <div className='flex space-x-6'>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      name={`atFault-${index}`}
                      value='yes'
                      checked={accident.atFault === 'yes'}
                      onChange={(e) =>
                        handleInputChange(
                          'accidents',
                          { atFault: e.target.value },
                          index
                        )
                      }
                      className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
                    />
                    <span
                      className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      YES
                    </span>
                  </label>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      name={`atFault-${index}`}
                      value='no'
                      checked={accident.atFault === 'no'}
                      onChange={(e) =>
                        handleInputChange(
                          'accidents',
                          { atFault: e.target.value },
                          index
                        )
                      }
                      className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
                    />
                    <span
                      className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      NO
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ))}

          {/* Add More Button */}
          <div className='flex justify-center pt-4'>
            <button
              type='button'
              onClick={addAccident}
              className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
                theme === 'dark'
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
              }`}
            >
              + Add Accident
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const renderTrafficConvictions = () => (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2
          className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          TRAFFIC CONVICTIONS AND FORFEITURES FOR THE PAST 3 YEARS
        </h2>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
        >
          (OTHER THAN PARKING VIOLATIONS)
        </p>
        <p
          className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
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
          className={`w-4 h-4 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}
        />
        <label
          htmlFor='hasNoConvictions'
          className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Check this box if you have had no convictions in the past 3 years
        </label>
      </div>

      {!formData.hasNoConvictions && (
        <div className='space-y-6'>
          {formData.convictions.map((conviction, index) => (
            <div key={index} className='space-y-4'>
              <div className='flex justify-between items-center'>
                <h3
                  className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                >
                  CONVICTION {index + 1}
                </h3>
                {formData.convictions.length > 1 && (
                  <button
                    type='button'
                    onClick={() => removeConviction(index)}
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
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    DATE CONVICTED
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
                    }`}
                  />
                </div>
                <div className='flex flex-col'>
                  <label
                    className={`block text-sm font-medium mb-2 min-h-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 rounded-lg'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-indigo-500 rounded-lg'
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
              onClick={addConviction}
              className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
                theme === 'dark'
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
              }`}
            >
              + Add Conviction
            </button>
          </div>
        </div>
      )}

      {/* License Questions */}
      <div className='space-y-6'>
        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
              >
                NO
              </span>
            </label>
          </div>
          {formData.deniedLicense === 'yes' && (
            <div className='mt-3'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          )}
        </div>

        <div className='space-y-3'>
          <label
            className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                className={`mr-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} accent-indigo-500`}
              />
              <span
                className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
              >
                NO
              </span>
            </label>
          </div>
          {formData.suspendedLicense === 'yes' && (
            <div className='mt-3'>
              <label
                className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
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
                    ? 'bg-brand-cream border-gray-300 text-gray-900 focus:ring-brand-mint [&::-webkit-calendar-picker-indicator]:bg-gray-800 [&::-webkit-calendar-picker-indicator]:text-white [&::-webkit-calendar-picker-indicator]:rounded'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage'
                }`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const cardClass =
    theme === 'dark'
      ? 'rounded-2xl border border-gray-700 bg-gray-800/50 shadow-lg'
      : 'rounded-2xl border border-gray-200 bg-white/70 shadow-lg'

  return (
    <div className={`max-w-4xl mx-auto relative z-10 ${cardClass}`}>
      {/* Header */}
      <div
        className={`text-center py-8 px-6 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <h1
          className={`text-2xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Driver Employment Application
        </h1>
        <p
          className={`text-base ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          [COMPANY NAME, ADDRESS, PHONE NUMBER, AND EMAIL]
        </p>
        <p
          className={`text-sm mt-1 ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
          }`}
        >
          An Equal Opportunity Employer
        </p>
        <p
          className={`text-sm font-semibold mt-2 ${
            theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
          }`}
        >
          Complete in full or it will not be considered.
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
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Step {currentStep} of {STEPS.length}
          </div>
          <div
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
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
                    ? 'bg-indigo-500'
                    : 'bg-indigo-600'
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
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
          }`}
        >
          {currentStep === STEPS.length ? 'Continue to Form 3' : 'Next'}
        </button>
      </div>
    </div>
  )
}
