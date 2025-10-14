'use client'

import React, { useState, useEffect } from 'react'
import { DriverApplicationData } from './types/driver-application.types'
import { ValidationResult } from '@/lib/validation'
import { FormInput, FormSelect, FormTextarea, FormCheckbox } from './FormInput'
import { ErrorDisplay } from './ErrorDisplay'

// Training Records Step Component
interface TrainingRecordsStepProps {
  data: DriverApplicationData['trainingRecords']
  onChange: (data: DriverApplicationData['trainingRecords']) => void
  validation?: ValidationResult
}

export const TrainingRecordsStep: React.FC<TrainingRecordsStepProps> = ({
  data,
  onChange,
  validation,
}) => {
  const [localValidation, setLocalValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  })

  // Validate on data change
  useEffect(() => {
    const { validateTrainingRecords } = require('@/lib/validation')
    const validationResult = validateTrainingRecords(data)
    setLocalValidation(validationResult)
  }, [data])

  const currentValidation = validation || localValidation
  const addTraining = () => {
    const newTraining = {
      trainingType: '',
      trainingDate: '',
      trainingCompany: '',
      certificateNumber: '',
      expirationDate: '',
    }
    onChange([...data, newTraining])
  }

  const updateTraining = (index: number, field: string, value: string) => {
    const updated = [...data]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeTraining = (index: number) => {
    const updated = data.filter((_, i) => i !== index)
    onChange(updated)
  }

  return (
    <div className='space-y-6'>
      {/* Validation Summary */}
      <ErrorDisplay validation={currentValidation} />

      <div className='flex justify-between items-center'>
        <h4 className='text-md font-medium text-brand-cream'>
          Training Records & Certifications
        </h4>
        <button
          type='button'
          onClick={addTraining}
          className='px-3 py-1 text-sm px-4 py-2 text-sm font-semibold text-brand-sage bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
        >
          Add Training
        </button>
      </div>

      {data.length === 0 && (
        <div className='text-center py-8 text-brand-cream/50'>
          <p>No training records added yet.</p>
          <p className='text-sm'>Click "Add Training" to get started.</p>
        </div>
      )}

      {Array.isArray(data) &&
        data.map((training, index) => (
          <div key={index} className='border border-gray-200 rounded-lg p-4'>
            <div className='flex justify-between items-center mb-4'>
              <h5 className='font-medium text-brand-cream'>
                Training #{index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeTraining(index)}
                className='text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200'
              >
                Remove
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Training Type *
                </label>
                <select
                  value={training.trainingType}
                  onChange={(e) =>
                    updateTraining(index, 'trainingType', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Select training type</option>
                  <option value='Defensive Driving'>Defensive Driving</option>
                  <option value='Hazmat'>Hazmat</option>
                  <option value='Tanker'>Tanker</option>
                  <option value='Doubles/Triples'>Doubles/Triples</option>
                  <option value='Passenger'>Passenger</option>
                  <option value='School Bus'>School Bus</option>
                  <option value='ELDT'>Entry-Level Driver Training</option>
                  <option value='Other'>Other</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Training Date *
                </label>
                <input
                  type='date'
                  value={training.trainingDate}
                  onChange={(e) =>
                    updateTraining(index, 'trainingDate', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Training Company
                </label>
                <input
                  type='text'
                  value={training.trainingCompany}
                  onChange={(e) =>
                    updateTraining(index, 'trainingCompany', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter training company name'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Certificate Number
                </label>
                <input
                  type='text'
                  value={training.certificateNumber}
                  onChange={(e) =>
                    updateTraining(index, 'certificateNumber', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter certificate number'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Expiration Date
                </label>
                <input
                  type='date'
                  value={training.expirationDate}
                  onChange={(e) =>
                    updateTraining(index, 'expirationDate', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>
        ))}

      <div className='bg-brand-sage-light/10 border border-brand-mint/30 rounded-xl p-4 backdrop-blur-sm'>
        <h5 className='font-medium text-brand-cream mb-2'>
          Training Requirements
        </h5>
        <ul className='text-sm text-brand-cream/70 space-y-1'>
          <li>
            • Entry-Level Driver Training (ELDT) required for new CDL holders
          </li>
          <li>• Hazmat endorsement requires background check and training</li>
          <li>• Some training certificates have expiration dates</li>
          <li>• Keep copies of all training certificates</li>
        </ul>
      </div>
    </div>
  )
}

// Driving Experience Step Component
interface DrivingExperienceStepProps {
  data: DriverApplicationData['drivingExperience']
  onChange: (data: Partial<DriverApplicationData['drivingExperience']>) => void
  validation?: ValidationResult
}

export const DrivingExperienceStep: React.FC<DrivingExperienceStepProps> = ({
  data,
  onChange,
  validation,
}) => {
  const [localValidation, setLocalValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  })

  // Validate on data change
  useEffect(() => {
    const { validateDrivingExperience } = require('@/lib/validation')
    const validationResult = validateDrivingExperience(data)
    setLocalValidation(validationResult)
  }, [data])

  const currentValidation = validation || localValidation
  const addSpecializedEquipment = () => {
    const newEquipment = {
      type: '',
      years: 0,
      miles: 0,
    }
    onChange({
      ...data,
      equipmentTypes: {
        ...data.equipmentTypes,
        specializedEquipment: [
          ...data.equipmentTypes.specializedEquipment,
          newEquipment,
        ],
      },
    })
  }

  const updateSpecializedEquipment = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const updated = [...data.equipmentTypes.specializedEquipment]
    updated[index] = { ...updated[index], [field]: value }
    onChange({
      ...data,
      equipmentTypes: {
        ...data.equipmentTypes,
        specializedEquipment: updated,
      },
    })
  }

  const removeSpecializedEquipment = (index: number) => {
    const updated = data.equipmentTypes.specializedEquipment.filter(
      (_, i) => i !== index
    )
    onChange({
      ...data,
      equipmentTypes: {
        ...data.equipmentTypes,
        specializedEquipment: updated,
      },
    })
  }

  return (
    <div className='space-y-8'>
      {/* Validation Summary */}
      <ErrorDisplay validation={currentValidation} />

      {/* Equipment Types */}
      <div>
        <h4 className='text-md font-medium text-brand-cream mb-6'>
          Equipment Experience
        </h4>

        <div className='space-y-6'>
          {/* Straight Truck */}
          <div className='border border-gray-200 rounded-lg p-4'>
            <h5 className='font-medium text-brand-cream mb-4'>
              Straight Truck
            </h5>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Years of Experience
                </label>
                <input
                  type='number'
                  min='0'
                  value={data.equipmentTypes.straightTruck.years}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      equipmentTypes: {
                        ...data.equipmentTypes,
                        straightTruck: {
                          ...data.equipmentTypes.straightTruck,
                          years: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Total Miles
                </label>
                <input
                  type='number'
                  min='0'
                  value={data.equipmentTypes.straightTruck.miles}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      equipmentTypes: {
                        ...data.equipmentTypes,
                        straightTruck: {
                          ...data.equipmentTypes.straightTruck,
                          miles: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* Tractor-Trailer */}
          <div className='border border-gray-200 rounded-lg p-4'>
            <h5 className='font-medium text-brand-cream mb-4'>
              Tractor-Trailer
            </h5>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Years of Experience
                </label>
                <input
                  type='number'
                  min='0'
                  value={data.equipmentTypes.tractorTrailer.years}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      equipmentTypes: {
                        ...data.equipmentTypes,
                        tractorTrailer: {
                          ...data.equipmentTypes.tractorTrailer,
                          years: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Total Miles
                </label>
                <input
                  type='number'
                  min='0'
                  value={data.equipmentTypes.tractorTrailer.miles}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      equipmentTypes: {
                        ...data.equipmentTypes,
                        tractorTrailer: {
                          ...data.equipmentTypes.tractorTrailer,
                          miles: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* Tractor with Two Trailers */}
          <div className='border border-gray-200 rounded-lg p-4'>
            <h5 className='font-medium text-brand-cream mb-4'>
              Tractor with Two Trailers
            </h5>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Years of Experience
                </label>
                <input
                  type='number'
                  min='0'
                  value={data.equipmentTypes.tractorTwoTrailers.years}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      equipmentTypes: {
                        ...data.equipmentTypes,
                        tractorTwoTrailers: {
                          ...data.equipmentTypes.tractorTwoTrailers,
                          years: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Total Miles
                </label>
                <input
                  type='number'
                  min='0'
                  value={data.equipmentTypes.tractorTwoTrailers.miles}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      equipmentTypes: {
                        ...data.equipmentTypes,
                        tractorTwoTrailers: {
                          ...data.equipmentTypes.tractorTwoTrailers,
                          miles: parseInt(e.target.value) || 0,
                        },
                      },
                    })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* Specialized Equipment */}
          <div className='border border-gray-200 rounded-lg p-4'>
            <div className='flex justify-between items-center mb-4'>
              <h5 className='font-medium text-brand-cream'>
                Specialized Equipment
              </h5>
              <button
                type='button'
                onClick={addSpecializedEquipment}
                className='px-3 py-1 text-sm px-4 py-2 text-sm font-semibold text-brand-sage bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
              >
                Add Equipment
              </button>
            </div>

            {data.equipmentTypes.specializedEquipment.length === 0 && (
              <div className='text-center py-4 text-brand-cream/50'>
                <p>No specialized equipment added yet.</p>
                <p className='text-sm'>Click "Add Equipment" to get started.</p>
              </div>
            )}

            {data.equipmentTypes.specializedEquipment.map(
              (equipment, index) => (
                <div
                  key={index}
                  className='border border-gray-200 rounded p-3 mb-3'
                >
                  <div className='flex justify-between items-center mb-3'>
                    <h6 className='font-medium text-brand-cream'>
                      Equipment #{index + 1}
                    </h6>
                    <button
                      type='button'
                      onClick={() => removeSpecializedEquipment(index)}
                      className='text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200'
                    >
                      Remove
                    </button>
                  </div>
                  <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                    <div>
                      <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                        Equipment Type
                      </label>
                      <input
                        type='text'
                        value={equipment.type}
                        onChange={(e) =>
                          updateSpecializedEquipment(
                            index,
                            'type',
                            e.target.value
                          )
                        }
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                        placeholder='e.g., Flatbed, Reefer, Tanker'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                        Years
                      </label>
                      <input
                        type='number'
                        min='0'
                        value={equipment.years}
                        onChange={(e) =>
                          updateSpecializedEquipment(
                            index,
                            'years',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                        Miles
                      </label>
                      <input
                        type='number'
                        min='0'
                        value={equipment.miles}
                        onChange={(e) =>
                          updateSpecializedEquipment(
                            index,
                            'miles',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                      />
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Special Skills */}
      <div>
        <h4 className='text-md font-medium text-brand-cream mb-4'>
          Special Skills
        </h4>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {Object.entries(data.specialSkills).map(([skill, value]) => (
            <label key={skill} className='flex items-center space-x-3'>
              <input
                type='checkbox'
                checked={value}
                onChange={(e) =>
                  onChange({
                    ...data,
                    specialSkills: {
                      ...data.specialSkills,
                      [skill]: e.target.checked,
                    },
                  })
                }
                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
              />
              <span className='text-sm text-brand-cream/70 capitalize'>
                {skill.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className='bg-brand-sage-light/10 border border-brand-mint/30 rounded-xl p-4 backdrop-blur-sm'>
        <h5 className='font-medium text-brand-cream mb-2'>
          Experience Requirements
        </h5>
        <ul className='text-sm text-brand-cream/70 space-y-1'>
          <li>• Be honest about your experience level</li>
          <li>• Include all relevant equipment experience</li>
          <li>• Special skills can increase job opportunities</li>
          <li>• Employers may verify experience claims</li>
        </ul>
      </div>
    </div>
  )
}

// Safety & Compliance Step Component
interface SafetyComplianceStepProps {
  data: DriverApplicationData['safetyCompliance']
  onChange: (data: Partial<DriverApplicationData['safetyCompliance']>) => void
  validation?: ValidationResult
}

export const SafetyComplianceStep: React.FC<SafetyComplianceStepProps> = ({
  data,
  onChange,
  validation,
}) => {
  const [localValidation, setLocalValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  })

  // Validate on data change
  useEffect(() => {
    const { validateSafetyCompliance } = require('@/lib/validation')
    const validationResult = validateSafetyCompliance(data)
    setLocalValidation(validationResult)
  }, [data])

  const currentValidation = validation || localValidation
  const addAccident = () => {
    const newAccident = {
      date: '',
      type: 'non-injury' as const,
      commercialVehicle: false,
      dotRecordable: false,
      atFault: false,
      citationIssued: false,
      description: '',
    }
    onChange({
      ...data,
      accidents: [...data.accidents, newAccident],
    })
  }

  const addViolation = () => {
    const newViolation = {
      date: '',
      charge: '',
      state: '',
      commercialVehicle: false,
      fineAmount: 0,
      licenseImpact: '',
    }
    onChange({
      ...data,
      violations: [...data.violations, newViolation],
    })
  }

  const updateAccident = (index: number, field: string, value: any) => {
    const updated = [...data.accidents]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ ...data, accidents: updated })
  }

  const updateViolation = (index: number, field: string, value: any) => {
    const updated = [...data.violations]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ ...data, violations: updated })
  }

  const removeAccident = (index: number) => {
    const updated = data.accidents.filter((_, i) => i !== index)
    onChange({ ...data, accidents: updated })
  }

  const removeViolation = (index: number) => {
    const updated = data.violations.filter((_, i) => i !== index)
    onChange({ ...data, violations: updated })
  }

  return (
    <div className='space-y-8'>
      {/* Validation Summary */}
      <ErrorDisplay validation={currentValidation} />

      {/* Accidents */}
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h4 className='text-md font-medium text-brand-cream'>
            Accident History (Last 5 Years)
          </h4>
          <button
            type='button'
            onClick={addAccident}
            className='px-3 py-1 text-sm px-4 py-2 text-sm font-semibold text-brand-sage bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
          >
            Add Accident
          </button>
        </div>

        {data.accidents.length === 0 && (
          <div className='text-center py-4 text-brand-cream/50 border border-gray-200 rounded-md'>
            <p>No accidents to report.</p>
            <p className='text-sm'>
              If you have accidents, click "Add Accident" above.
            </p>
          </div>
        )}

        {data.accidents.map((accident, index) => (
          <div
            key={index}
            className='border border-gray-200 rounded-lg p-4 mb-4'
          >
            <div className='flex justify-between items-center mb-4'>
              <h5 className='font-medium text-brand-cream'>
                Accident #{index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeAccident(index)}
                className='text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200'
              >
                Remove
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Accident Date *
                </label>
                <input
                  type='date'
                  value={accident.date}
                  onChange={(e) =>
                    updateAccident(index, 'date', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Accident Type *
                </label>
                <select
                  value={accident.type}
                  onChange={(e) =>
                    updateAccident(index, 'type', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='non-injury'>Non-Injury</option>
                  <option value='injury'>Injury</option>
                  <option value='fatality'>Fatality</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Commercial Vehicle
                </label>
                <select
                  value={accident.commercialVehicle.toString()}
                  onChange={(e) =>
                    updateAccident(
                      index,
                      'commercialVehicle',
                      e.target.value === 'true'
                    )
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='false'>No</option>
                  <option value='true'>Yes</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  DOT Recordable
                </label>
                <select
                  value={accident.dotRecordable.toString()}
                  onChange={(e) =>
                    updateAccident(
                      index,
                      'dotRecordable',
                      e.target.value === 'true'
                    )
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='false'>No</option>
                  <option value='true'>Yes</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  At Fault
                </label>
                <select
                  value={accident.atFault.toString()}
                  onChange={(e) =>
                    updateAccident(index, 'atFault', e.target.value === 'true')
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='false'>No</option>
                  <option value='true'>Yes</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Citation Issued
                </label>
                <select
                  value={accident.citationIssued.toString()}
                  onChange={(e) =>
                    updateAccident(
                      index,
                      'citationIssued',
                      e.target.value === 'true'
                    )
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='false'>No</option>
                  <option value='true'>Yes</option>
                </select>
              </div>

              <div className='md:col-span-2'>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Description *
                </label>
                <textarea
                  value={accident.description}
                  onChange={(e) =>
                    updateAccident(index, 'description', e.target.value)
                  }
                  rows={3}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Describe what happened in the accident'
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Violations */}
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h4 className='text-md font-medium text-brand-cream'>
            Traffic Violations (Last 3 Years)
          </h4>
          <button
            type='button'
            onClick={addViolation}
            className='px-3 py-1 text-sm px-4 py-2 text-sm font-semibold text-brand-sage bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
          >
            Add Violation
          </button>
        </div>

        {data.violations.length === 0 && (
          <div className='text-center py-4 text-brand-cream/50 border border-gray-200 rounded-md'>
            <p>No violations to report.</p>
            <p className='text-sm'>
              If you have violations, click "Add Violation" above.
            </p>
          </div>
        )}

        {data.violations.map((violation, index) => (
          <div
            key={index}
            className='border border-gray-200 rounded-lg p-4 mb-4'
          >
            <div className='flex justify-between items-center mb-4'>
              <h5 className='font-medium text-brand-cream'>
                Violation #{index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeViolation(index)}
                className='text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200'
              >
                Remove
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Violation Date *
                </label>
                <input
                  type='date'
                  value={violation.date}
                  onChange={(e) =>
                    updateViolation(index, 'date', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Charge *
                </label>
                <input
                  type='text'
                  value={violation.charge}
                  onChange={(e) =>
                    updateViolation(index, 'charge', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., Speeding, Red Light, etc.'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  State *
                </label>
                <input
                  type='text'
                  value={violation.state}
                  onChange={(e) =>
                    updateViolation(index, 'state', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='State abbreviation'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Commercial Vehicle
                </label>
                <select
                  value={violation.commercialVehicle.toString()}
                  onChange={(e) =>
                    updateViolation(
                      index,
                      'commercialVehicle',
                      e.target.value === 'true'
                    )
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value='false'>No</option>
                  <option value='true'>Yes</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  Fine Amount
                </label>
                <input
                  type='number'
                  min='0'
                  step='0.01'
                  value={violation.fineAmount}
                  onChange={(e) =>
                    updateViolation(
                      index,
                      'fineAmount',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='0.00'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-2'>
                  License Impact
                </label>
                <input
                  type='text'
                  value={violation.licenseImpact}
                  onChange={(e) =>
                    updateViolation(index, 'licenseImpact', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., None, Suspended, etc.'
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compliance Questions */}
      <div>
        <h4 className='text-md font-medium text-brand-cream mb-4'>
          Compliance Questions
        </h4>
        <div className='space-y-4'>
          {Object.entries(data.complianceQuestions).map(([question, value]) => (
            <label key={question} className='flex items-start space-x-3'>
              <input
                type='checkbox'
                checked={value}
                onChange={(e) =>
                  onChange({
                    ...data,
                    complianceQuestions: {
                      ...data.complianceQuestions,
                      [question]: e.target.checked,
                    },
                  })
                }
                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1'
              />
              <span className='text-sm text-brand-cream/70'>
                {question
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className='bg-red-500/10 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm'>
        <h5 className='font-medium text-red-300 mb-2'>
          Compliance Requirements
        </h5>
        <ul className='text-sm text-red-300/80 space-y-1'>
          <li>• Answer all questions truthfully</li>
          <li>• False information can result in disqualification</li>
          <li>• DOT violations may affect eligibility</li>
          <li>• Previous positive drug tests must be disclosed</li>
        </ul>
      </div>
    </div>
  )
}

// References Step Component
interface ReferencesStepProps {
  data: DriverApplicationData['references']
  onChange: (data: DriverApplicationData['references']) => void
  validation?: ValidationResult
}

export const ReferencesStep: React.FC<ReferencesStepProps> = ({
  data,
  onChange,
  validation,
}) => {
  const [localValidation, setLocalValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  })

  // Validate on data change
  useEffect(() => {
    const { validateReferences } = require('@/lib/validation')
    const validationResult = validateReferences(data)
    setLocalValidation(validationResult)
  }, [data])

  const currentValidation = validation || localValidation
  const addReference = () => {
    const newReference = {
      name: '',
      relationship: '',
      phone: '',
      email: '',
      yearsKnown: '',
    }
    onChange([...data, newReference])
  }

  const updateReference = (index: number, field: string, value: string) => {
    const updated = [...data]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeReference = (index: number) => {
    const updated = data.filter((_, i) => i !== index)
    onChange(updated)
  }

  return (
    <div className='space-y-6'>
      {/* Validation Summary */}
      <ErrorDisplay validation={currentValidation} />

      <div className='flex justify-between items-center'>
        <h4 className='text-md font-medium text-brand-cream'>
          Personal & Professional References
        </h4>
        <button
          type='button'
          onClick={addReference}
          className='px-4 py-2 text-sm font-semibold text-brand-sage bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
        >
          Add Reference
        </button>
      </div>

      {data.length === 0 && (
        <div className='text-center py-8 text-brand-cream/50'>
          <p>No references added yet.</p>
          <p className='text-sm'>Click "Add Reference" to get started.</p>
        </div>
      )}

      {Array.isArray(data) &&
        data.map((reference, index) => (
          <div
            key={index}
            className='border border-brand-cream/30 rounded-lg p-4 bg-brand-sage-light/5'
          >
            <div className='flex justify-between items-center mb-4'>
              <h5 className='font-medium text-brand-cream'>
                Reference #{index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeReference(index)}
                className='text-red-400 hover:text-red-300 text-sm font-medium transition-colors duration-200'
              >
                Remove
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Full Name *
                </label>
                <input
                  type='text'
                  value={reference.name}
                  onChange={(e) =>
                    updateReference(index, 'name', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter reference name'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Relationship *
                </label>
                <select
                  value={reference.relationship}
                  onChange={(e) =>
                    updateReference(index, 'relationship', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Select relationship</option>
                  <option value='Former Supervisor'>Former Supervisor</option>
                  <option value='Former Colleague'>Former Colleague</option>
                  <option value='Personal Friend'>Personal Friend</option>
                  <option value='Family Member'>Family Member</option>
                  <option value='Neighbor'>Neighbor</option>
                  <option value='Teacher/Instructor'>Teacher/Instructor</option>
                  <option value='Other'>Other</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Phone Number *
                </label>
                <input
                  type='tel'
                  value={reference.phone}
                  onChange={(e) =>
                    updateReference(index, 'phone', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='(XXX) XXX-XXXX'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Email Address
                </label>
                <input
                  type='email'
                  value={reference.email}
                  onChange={(e) =>
                    updateReference(index, 'email', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter email address'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-brand-cream/70 mb-1'>
                  Years Known *
                </label>
                <input
                  type='text'
                  value={reference.yearsKnown}
                  onChange={(e) =>
                    updateReference(index, 'yearsKnown', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., 3, 5, 10+'
                />
              </div>
            </div>
          </div>
        ))}

      <div className='bg-brand-sage-light/10 border border-brand-mint/30 rounded-xl p-4 backdrop-blur-sm'>
        <h5 className='font-medium text-brand-cream mb-2'>
          Reference Requirements
        </h5>
        <ul className='text-sm text-brand-cream/70 space-y-1'>
          <li>• Provide at least 3 professional references</li>
          <li>• Include contact information for verification</li>
          <li>• Choose references who can speak to your character</li>
          <li>• Notify references that they may be contacted</li>
        </ul>
      </div>
    </div>
  )
}
