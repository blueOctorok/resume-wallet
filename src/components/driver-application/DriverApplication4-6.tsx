'use client'

import React from 'react'
import { DriverApplicationData } from './types/driver-application.types'

// Driving Record Step Component
interface DrivingRecordStepProps {
  data: DriverApplicationData['drivingRecord']
  onChange: (data: DriverApplicationData['drivingRecord']) => void
}

export const DrivingRecordStep: React.FC<DrivingRecordStepProps> = ({
  data,
  onChange,
}) => {
  const addViolation = () => {
    const newViolation = {
      date: '',
      violation: '',
      location: '',
      fine: '',
      points: '',
    }
    onChange({
      ...data,
      violations: [...data.violations, newViolation],
    })
  }

  const addAccident = () => {
    const newAccident = {
      date: '',
      description: '',
      fatalities: '',
      injuries: '',
      propertyDamage: '',
    }
    onChange({
      ...data,
      accidents: [...data.accidents, newAccident],
    })
  }

  const updateViolation = (index: number, field: string, value: string) => {
    const updated = [...data.violations]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ ...data, violations: updated })
  }

  const updateAccident = (index: number, field: string, value: string) => {
    const updated = [...data.accidents]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ ...data, accidents: updated })
  }

  const removeViolation = (index: number) => {
    const updated = data.violations.filter((_, i) => i !== index)
    onChange({ ...data, violations: updated })
  }

  const removeAccident = (index: number) => {
    const updated = data.accidents.filter((_, i) => i !== index)
    onChange({ ...data, accidents: updated })
  }

  return (
    <div className='space-y-8'>
      {/* Traffic Violations Section */}
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h4 className='text-md font-medium text-gray-900'>
            Traffic Violations (Last 3 Years)
          </h4>
          <button
            type='button'
            onClick={addViolation}
            className='px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Add Violation
          </button>
        </div>

        {data.violations.length === 0 && (
          <div className='text-center py-4 text-gray-500 border border-gray-200 rounded-md'>
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
              <h5 className='font-medium text-gray-900'>
                Violation #{index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeViolation(index)}
                className='text-red-600 hover:text-red-800 text-sm'
              >
                Remove
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
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
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Violation Type *
                </label>
                <input
                  type='text'
                  value={violation.violation}
                  onChange={(e) =>
                    updateViolation(index, 'violation', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., Speeding, Red Light, etc.'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Location
                </label>
                <input
                  type='text'
                  value={violation.location}
                  onChange={(e) =>
                    updateViolation(index, 'location', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='City, State'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Fine Amount
                </label>
                <input
                  type='text'
                  value={violation.fine}
                  onChange={(e) =>
                    updateViolation(index, 'fine', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='$0.00'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Points
                </label>
                <input
                  type='text'
                  value={violation.points}
                  onChange={(e) =>
                    updateViolation(index, 'points', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='0'
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Accidents Section */}
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h4 className='text-md font-medium text-gray-900'>
            Accidents (Last 5 Years)
          </h4>
          <button
            type='button'
            onClick={addAccident}
            className='px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Add Accident
          </button>
        </div>

        {data.accidents.length === 0 && (
          <div className='text-center py-4 text-gray-500 border border-gray-200 rounded-md'>
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
              <h5 className='font-medium text-gray-900'>
                Accident #{index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeAccident(index)}
                className='text-red-600 hover:text-red-800 text-sm'
              >
                Remove
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
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
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Fatalities
                </label>
                <input
                  type='text'
                  value={accident.fatalities}
                  onChange={(e) =>
                    updateAccident(index, 'fatalities', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='0'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Injuries
                </label>
                <input
                  type='text'
                  value={accident.injuries}
                  onChange={(e) =>
                    updateAccident(index, 'injuries', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='0'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Property Damage
                </label>
                <input
                  type='text'
                  value={accident.propertyDamage}
                  onChange={(e) =>
                    updateAccident(index, 'propertyDamage', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='$0.00'
                />
              </div>

              <div className='md:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
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

      <div className='bg-yellow-50 border border-yellow-200 rounded-md p-4'>
        <h5 className='font-medium text-yellow-900 mb-2'>DOT Requirements</h5>
        <ul className='text-sm text-yellow-800 space-y-1'>
          <li>• Report all violations from the last 3 years</li>
          <li>• Report all accidents from the last 5 years</li>
          <li>• Include both commercial and personal vehicle incidents</li>
          <li>
            • Be accurate - falsifying information can result in
            disqualification
          </li>
        </ul>
      </div>
    </div>
  )
}

// Medical Information Step Component
interface MedicalInfoStepProps {
  data: DriverApplicationData['medicalInfo']
  onChange: (data: Partial<DriverApplicationData['medicalInfo']>) => void
}

export const MedicalInfoStep: React.FC<MedicalInfoStepProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Medical Exam Date *
          </label>
          <input
            type='date'
            value={data.medicalExamDate}
            onChange={(e) => onChange({ medicalExamDate: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Medical Exam Expiration *
          </label>
          <input
            type='date'
            value={data.medicalExamExpiration}
            onChange={(e) =>
              onChange({ medicalExamExpiration: e.target.value })
            }
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Medical Examiner Name
          </label>
          <input
            type='text'
            value={data.medicalExaminerName}
            onChange={(e) => onChange({ medicalExaminerName: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter examiner name'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Medical Examiner Phone
          </label>
          <input
            type='tel'
            value={data.medicalExaminerPhone}
            onChange={(e) => onChange({ medicalExaminerPhone: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='(XXX) XXX-XXXX'
          />
        </div>
      </div>

      {/* Vision Test */}
      <div className='border-t pt-6'>
        <h4 className='text-md font-medium text-gray-900 mb-4'>Vision Test</h4>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Left Eye
            </label>
            <input
              type='text'
              value={data.visionTest.leftEye}
              onChange={(e) =>
                onChange({
                  visionTest: { ...data.visionTest, leftEye: e.target.value },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='20/20'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Right Eye
            </label>
            <input
              type='text'
              value={data.visionTest.rightEye}
              onChange={(e) =>
                onChange({
                  visionTest: { ...data.visionTest, rightEye: e.target.value },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='20/20'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Both Eyes
            </label>
            <input
              type='text'
              value={data.visionTest.bothEyes}
              onChange={(e) =>
                onChange({
                  visionTest: { ...data.visionTest, bothEyes: e.target.value },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='20/20'
            />
          </div>
        </div>
      </div>

      {/* Hearing Test */}
      <div className='border-t pt-6'>
        <h4 className='text-md font-medium text-gray-900 mb-4'>Hearing Test</h4>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Left Ear
            </label>
            <input
              type='text'
              value={data.hearingTest.leftEar}
              onChange={(e) =>
                onChange({
                  hearingTest: { ...data.hearingTest, leftEar: e.target.value },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Normal'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Right Ear
            </label>
            <input
              type='text'
              value={data.hearingTest.rightEar}
              onChange={(e) =>
                onChange({
                  hearingTest: {
                    ...data.hearingTest,
                    rightEar: e.target.value,
                  },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Normal'
            />
          </div>
        </div>
      </div>

      <div className='bg-green-50 border border-green-200 rounded-md p-4'>
        <h5 className='font-medium text-green-900 mb-2'>DOT Requirements</h5>
        <ul className='text-sm text-green-800 space-y-1'>
          <li>• Medical exam must be current (not expired)</li>
          <li>• Vision: 20/40 acuity in each eye with or without correction</li>
          <li>• Hearing: Must be able to hear a forced whisper at 5 feet</li>
          <li>• Medical certificate must be carried while driving</li>
        </ul>
      </div>
    </div>
  )
}

// Drug/Alcohol Testing Step Component
interface DrugAlcoholTestingStepProps {
  data: DriverApplicationData['drugAlcoholTesting']
  onChange: (data: Partial<DriverApplicationData['drugAlcoholTesting']>) => void
}

export const DrugAlcoholTestingStep: React.FC<DrugAlcoholTestingStepProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Last Test Date *
          </label>
          <input
            type='date'
            value={data.lastTestDate}
            onChange={(e) => onChange({ lastTestDate: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Test Result *
          </label>
          <select
            value={data.testResult}
            onChange={(e) => onChange({ testResult: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>Select result</option>
            <option value='Negative'>Negative</option>
            <option value='Positive'>Positive</option>
            <option value='Refused'>Refused</option>
            <option value='Other'>Other</option>
          </select>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Testing Company
          </label>
          <input
            type='text'
            value={data.testingCompany}
            onChange={(e) => onChange({ testingCompany: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter testing company name'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Testing Company Phone
          </label>
          <input
            type='tel'
            value={data.testingCompanyPhone}
            onChange={(e) => onChange({ testingCompanyPhone: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='(XXX) XXX-XXXX'
          />
        </div>
      </div>

      <div className='bg-red-50 border border-red-200 rounded-md p-4'>
        <h5 className='font-medium text-red-900 mb-2'>DOT Requirements</h5>
        <ul className='text-sm text-red-800 space-y-1'>
          <li>• Drug test must be negative for employment</li>
          <li>• Random testing is required while employed</li>
          <li>• Refusal to test is treated as positive result</li>
          <li>• Previous positive tests must be disclosed</li>
        </ul>
      </div>
    </div>
  )
}
