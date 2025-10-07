'use client'

import React, { useState, useEffect } from 'react'
import { DriverApplicationData } from './types/driver-application.types'
import { validatePersonalInfo, ValidationResult } from '@/lib/validation'
import { FormInput, FormSelect } from './FormInput'
import { ErrorDisplay } from './ErrorDisplay'

// Personal Information Step Component
interface PersonalInfoStepProps {
  data: DriverApplicationData['personalInfo']
  onChange: (data: Partial<DriverApplicationData['personalInfo']>) => void
  validation?: ValidationResult
}

export const PersonalInfoStep: React.FC<PersonalInfoStepProps> = ({
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
    const validationResult = validatePersonalInfo(data)
    setLocalValidation(validationResult)
  }, [data])

  const currentValidation = validation || localValidation

  const stateOptions = [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
  ]
  return (
    <div className='space-y-6'>
      {/* Validation Summary */}
      <ErrorDisplay validation={currentValidation} />

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <FormInput
          label='First Name'
          name='firstName'
          type='text'
          value={data.firstName}
          onChange={(value) => onChange({ firstName: value })}
          placeholder='Enter your first name'
          required
          validation={currentValidation}
        />

        <FormInput
          label='Last Name'
          name='lastName'
          type='text'
          value={data.lastName}
          onChange={(value) => onChange({ lastName: value })}
          placeholder='Enter your last name'
          required
          validation={currentValidation}
        />

        <FormInput
          label='Middle Name'
          name='middleName'
          type='text'
          value={data.middleName}
          onChange={(value) => onChange({ middleName: value })}
          placeholder='Enter your middle name'
          validation={currentValidation}
        />

        <FormInput
          label='Social Security Number'
          name='ssn'
          type='text'
          value={data.ssn}
          onChange={(value) => onChange({ ssn: value })}
          placeholder='XXX-XX-XXXX'
          required
          validation={currentValidation}
          helpText='Format: XXX-XX-XXXX'
        />

        <FormInput
          label='Date of Birth'
          name='dateOfBirth'
          type='date'
          value={data.dateOfBirth}
          onChange={(value) => onChange({ dateOfBirth: value })}
          required
          validation={currentValidation}
          helpText='Must be at least 18 years old'
        />

        <FormInput
          label='Phone Number'
          name='phone'
          type='tel'
          value={data.phone}
          onChange={(value) => onChange({ phone: value })}
          placeholder='(XXX) XXX-XXXX'
          required
          validation={currentValidation}
          helpText='Format: (XXX) XXX-XXXX'
        />

        <div className='md:col-span-2'>
          <FormInput
            label='Email Address'
            name='email'
            type='email'
            value={data.email}
            onChange={(value) => onChange({ email: value })}
            placeholder='Enter your email address'
            required
            validation={currentValidation}
          />
        </div>

        <div className='md:col-span-2'>
          <FormInput
            label='Address'
            name='address'
            type='text'
            value={data.address}
            onChange={(value) => onChange({ address: value })}
            placeholder='Enter your street address'
            required
            validation={currentValidation}
          />
        </div>

        <FormInput
          label='City'
          name='city'
          type='text'
          value={data.city}
          onChange={(value) => onChange({ city: value })}
          placeholder='Enter your city'
          required
          validation={currentValidation}
        />

        <FormSelect
          label='State'
          name='state'
          value={data.state}
          onChange={(value) => onChange({ state: value })}
          options={stateOptions}
          placeholder='Select state'
          required
          validation={currentValidation}
        />

        <FormInput
          label='ZIP Code'
          name='zipCode'
          type='text'
          value={data.zipCode}
          onChange={(value) => onChange({ zipCode: value })}
          placeholder='XXXXX'
          required
          validation={currentValidation}
          helpText='Format: XXXXX or XXXXX-XXXX'
        />
      </div>

      {/* Emergency Contact */}
      <div className='border-t pt-6'>
        <h4 className='text-md font-medium text-gray-900 mb-4'>
          Emergency Contact
        </h4>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <FormInput
            label='Contact Name'
            name='emergencyContact.name'
            type='text'
            value={data.emergencyContact.name}
            onChange={(value) =>
              onChange({
                emergencyContact: {
                  ...data.emergencyContact,
                  name: value,
                },
              })
            }
            placeholder='Enter emergency contact name'
            required
            validation={currentValidation}
          />

          <FormInput
            label='Relationship'
            name='emergencyContact.relationship'
            type='text'
            value={data.emergencyContact.relationship}
            onChange={(value) =>
              onChange({
                emergencyContact: {
                  ...data.emergencyContact,
                  relationship: value,
                },
              })
            }
            placeholder='e.g., Spouse, Parent, Sibling'
            required
            validation={currentValidation}
          />

          <FormInput
            label='Contact Phone'
            name='emergencyContact.phone'
            type='tel'
            value={data.emergencyContact.phone}
            onChange={(value) =>
              onChange({
                emergencyContact: {
                  ...data.emergencyContact,
                  phone: value,
                },
              })
            }
            placeholder='(XXX) XXX-XXXX'
            required
            validation={currentValidation}
            helpText='Format: (XXX) XXX-XXXX'
          />
        </div>
      </div>
    </div>
  )
}

// CDL Information Step Component
interface CDLInfoStepProps {
  data: DriverApplicationData['cdlInfo']
  onChange: (data: Partial<DriverApplicationData['cdlInfo']>) => void
}

export const CDLInfoStep: React.FC<CDLInfoStepProps> = ({ data, onChange }) => {
  const cdlClasses = ['A', 'B', 'C']
  const endorsements = ['H', 'N', 'P', 'S', 'T', 'X']
  const restrictions = ['E', 'K', 'L', 'M', 'N', 'O', 'P', 'V', 'Z']

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            CDL Number *
          </label>
          <input
            type='text'
            value={data.cdlNumber}
            onChange={(e) => onChange({ cdlNumber: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter your CDL number'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            CDL State *
          </label>
          <select
            value={data.cdlState}
            onChange={(e) => onChange({ cdlState: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          >
            <option value=''>Select state</option>
            <option value='AL'>Alabama</option>
            <option value='AK'>Alaska</option>
            <option value='AZ'>Arizona</option>
            <option value='AR'>Arkansas</option>
            <option value='CA'>California</option>
            <option value='CO'>Colorado</option>
            <option value='CT'>Connecticut</option>
            <option value='DE'>Delaware</option>
            <option value='FL'>Florida</option>
            <option value='GA'>Georgia</option>
            <option value='HI'>Hawaii</option>
            <option value='ID'>Idaho</option>
            <option value='IL'>Illinois</option>
            <option value='IN'>Indiana</option>
            <option value='IA'>Iowa</option>
            <option value='KS'>Kansas</option>
            <option value='KY'>Kentucky</option>
            <option value='LA'>Louisiana</option>
            <option value='ME'>Maine</option>
            <option value='MD'>Maryland</option>
            <option value='MA'>Massachusetts</option>
            <option value='MI'>Michigan</option>
            <option value='MN'>Minnesota</option>
            <option value='MS'>Mississippi</option>
            <option value='MO'>Missouri</option>
            <option value='MT'>Montana</option>
            <option value='NE'>Nebraska</option>
            <option value='NV'>Nevada</option>
            <option value='NH'>New Hampshire</option>
            <option value='NJ'>New Jersey</option>
            <option value='NM'>New Mexico</option>
            <option value='NY'>New York</option>
            <option value='NC'>North Carolina</option>
            <option value='ND'>North Dakota</option>
            <option value='OH'>Ohio</option>
            <option value='OK'>Oklahoma</option>
            <option value='OR'>Oregon</option>
            <option value='PA'>Pennsylvania</option>
            <option value='RI'>Rhode Island</option>
            <option value='SC'>South Carolina</option>
            <option value='SD'>South Dakota</option>
            <option value='TN'>Tennessee</option>
            <option value='TX'>Texas</option>
            <option value='UT'>Utah</option>
            <option value='VT'>Vermont</option>
            <option value='VA'>Virginia</option>
            <option value='WA'>Washington</option>
            <option value='WV'>West Virginia</option>
            <option value='WI'>Wisconsin</option>
            <option value='WY'>Wyoming</option>
          </select>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            CDL Expiration Date *
          </label>
          <input
            type='date'
            value={data.cdlExpiration}
            onChange={(e) => onChange({ cdlExpiration: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            CDL Class *
          </label>
          <select
            value={data.cdlClass}
            onChange={(e) => onChange({ cdlClass: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          >
            <option value=''>Select CDL class</option>
            {cdlClasses.map((cls) => (
              <option key={cls} value={cls}>
                Class {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Endorsements */}
      <div>
        <label className='block text-sm font-medium text-gray-700 mb-3'>
          Endorsements
        </label>
        <div className='grid grid-cols-3 md:grid-cols-6 gap-3'>
          {endorsements.map((endorsement) => (
            <label key={endorsement} className='flex items-center'>
              <input
                type='checkbox'
                checked={data.endorsements.includes(endorsement)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({
                      endorsements: [...data.endorsements, endorsement],
                    })
                  } else {
                    onChange({
                      endorsements: data.endorsements.filter(
                        (e) => e !== endorsement
                      ),
                    })
                  }
                }}
                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
              />
              <span className='ml-2 text-sm text-gray-700'>{endorsement}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Restrictions */}
      <div>
        <label className='block text-sm font-medium text-gray-700 mb-3'>
          Restrictions
        </label>
        <div className='grid grid-cols-3 md:grid-cols-6 gap-3'>
          {restrictions.map((restriction) => (
            <label key={restriction} className='flex items-center'>
              <input
                type='checkbox'
                checked={data.restrictions.includes(restriction)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({
                      restrictions: [...data.restrictions, restriction],
                    })
                  } else {
                    onChange({
                      restrictions: data.restrictions.filter(
                        (r) => r !== restriction
                      ),
                    })
                  }
                }}
                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
              />
              <span className='ml-2 text-sm text-gray-700'>{restriction}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// Employment History Step Component
interface EmploymentHistoryStepProps {
  data: DriverApplicationData['employmentHistory']
  onChange: (data: DriverApplicationData['employmentHistory']) => void
}

export const EmploymentHistoryStep: React.FC<EmploymentHistoryStepProps> = ({
  data,
  onChange,
}) => {
  const addEmployment = () => {
    const newEmployment = {
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      reasonForLeaving: '',
      supervisorName: '',
      supervisorPhone: '',
      duties: '',
    }
    onChange([...data, newEmployment])
  }

  const updateEmployment = (index: number, field: string, value: string) => {
    const updated = [...data]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeEmployment = (index: number) => {
    const updated = data.filter((_, i) => i !== index)
    onChange(updated)
  }

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h4 className='text-md font-medium text-gray-900'>
          Employment History (Last 3 Years Required)
        </h4>
        <button
          type='button'
          onClick={addEmployment}
          className='px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700'
        >
          Add Employment
        </button>
      </div>

      {data.length === 0 && (
        <div className='text-center py-8 text-gray-500'>
          <p>No employment history added yet.</p>
          <p className='text-sm'>Click "Add Employment" to get started.</p>
        </div>
      )}

      {Array.isArray(data) &&
        data.map((employment, index) => (
          <div key={index} className='border border-gray-200 rounded-lg p-4'>
            <div className='flex justify-between items-center mb-4'>
              <h5 className='font-medium text-gray-900'>
                Employment #{index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeEmployment(index)}
                className='text-red-600 hover:text-red-800 text-sm'
              >
                Remove
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Company Name *
                </label>
                <input
                  type='text'
                  value={employment.company}
                  onChange={(e) =>
                    updateEmployment(index, 'company', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter company name'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Position *
                </label>
                <input
                  type='text'
                  value={employment.position}
                  onChange={(e) =>
                    updateEmployment(index, 'position', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter position title'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Start Date *
                </label>
                <input
                  type='date'
                  value={employment.startDate}
                  onChange={(e) =>
                    updateEmployment(index, 'startDate', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  End Date
                </label>
                <input
                  type='date'
                  value={employment.endDate}
                  onChange={(e) =>
                    updateEmployment(index, 'endDate', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Supervisor Name
                </label>
                <input
                  type='text'
                  value={employment.supervisorName}
                  onChange={(e) =>
                    updateEmployment(index, 'supervisorName', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter supervisor name'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Supervisor Phone
                </label>
                <input
                  type='tel'
                  value={employment.supervisorPhone}
                  onChange={(e) =>
                    updateEmployment(index, 'supervisorPhone', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='(XXX) XXX-XXXX'
                />
              </div>

              <div className='md:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Reason for Leaving
                </label>
                <input
                  type='text'
                  value={employment.reasonForLeaving}
                  onChange={(e) =>
                    updateEmployment(index, 'reasonForLeaving', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter reason for leaving'
                />
              </div>

              <div className='md:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Job Duties
                </label>
                <textarea
                  value={employment.duties}
                  onChange={(e) =>
                    updateEmployment(index, 'duties', e.target.value)
                  }
                  rows={3}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Describe your job duties and responsibilities'
                />
              </div>
            </div>
          </div>
        ))}

      <div className='bg-blue-50 border border-blue-200 rounded-md p-4'>
        <h5 className='font-medium text-blue-900 mb-2'>DOT Requirements</h5>
        <ul className='text-sm text-blue-800 space-y-1'>
          <li>• Minimum 3 years of employment history required</li>
          <li>• All employment gaps over 30 days must be explained</li>
          <li>• Include all employers, even non-driving positions</li>
          <li>• Previous employer contact information is required</li>
        </ul>
      </div>
    </div>
  )
}
