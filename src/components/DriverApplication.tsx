'use client'

import React, { useState, useEffect } from 'react'
import {
  saveDriverApplicationClient,
  getDriverApplicationClient,
  completeDriverApplicationClient,
} from '@/lib/supabase-client-db'

interface DriverApplicationData {
  personalInfo: {
    firstName: string
    lastName: string
    middleName: string
    ssn: string
    dateOfBirth: string
    address: string
    city: string
    state: string
    zipCode: string
    phone: string
    email: string
    emergencyContact: {
      name: string
      relationship: string
      phone: string
    }
  }
  cdlInfo: {
    cdlNumber: string
    cdlState: string
    cdlExpiration: string
    cdlClass: string
    endorsements: string[]
    restrictions: string[]
  }
  employmentHistory: {
    company: string
    position: string
    startDate: string
    endDate: string
    reasonForLeaving: string
    supervisorName: string
    supervisorPhone: string
    duties: string
  }[]
  drivingRecord: {
    violations: {
      date: string
      violation: string
      location: string
      fine: string
      points: string
    }[]
    accidents: {
      date: string
      description: string
      fatalities: string
      injuries: string
      propertyDamage: string
    }[]
  }
  medicalInfo: {
    medicalExamDate: string
    medicalExamExpiration: string
    medicalExaminerName: string
    medicalExaminerPhone: string
    medicalConditions: string[]
    medications: string[]
    visionTest: {
      leftEye: string
      rightEye: string
      bothEyes: string
    }
    hearingTest: {
      leftEar: string
      rightEar: string
    }
  }
  drugAlcoholTesting: {
    lastTestDate: string
    testResult: string
    testingCompany: string
    testingCompanyPhone: string
    previousViolations: {
      date: string
      violation: string
      result: string
    }[]
  }
  trainingRecords: {
    trainingType: string
    trainingDate: string
    trainingCompany: string
    certificateNumber: string
    expirationDate: string
  }[]
  references: {
    name: string
    relationship: string
    phone: string
    email: string
    yearsKnown: string
  }[]
  drivingExperience: {
    equipmentTypes: {
      straightTruck: { years: number; miles: number }
      tractorTrailer: { years: number; miles: number }
      tractorTwoTrailers: { years: number; miles: number }
      specializedEquipment: { type: string; years: number; miles: number }[]
    }
    specialSkills: {
      moffettForklift: boolean
      craneOperations: boolean
      hazmatHandling: boolean
      borderCrossing: boolean
    }
  }
  safetyCompliance: {
    accidents: {
      date: string
      type: 'injury' | 'non-injury' | 'fatality'
      commercialVehicle: boolean
      dotRecordable: boolean
      atFault: boolean
      citationIssued: boolean
      description: string
    }[]
    violations: {
      date: string
      charge: string
      state: string
      commercialVehicle: boolean
      fineAmount: number
      licenseImpact: string
    }[]
    complianceQuestions: {
      fmcsrDisqualification: boolean
      licenseSuspension: boolean
      dotClearinghouseProhibitions: boolean
      positiveDrugTest: boolean
      duiDwi: boolean
      felonyCommercialVehicle: boolean
    }
  }
  authorizations: {
    fcraConsent: boolean
    backgroundCheckConsent: boolean
    drugTestingConsent: boolean
    employerContactConsent: boolean
    pspConsent: boolean
    clearinghouseQueryConsent: boolean
  }
}

interface DriverApplicationProps {
  user: any
}

const STEPS = [
  {
    id: 1,
    title: 'Personal Information',
    description: 'Basic personal details',
  },
  {
    id: 2,
    title: 'CDL Information',
    description: 'Commercial Driver License details',
  },
  {
    id: 3,
    title: 'Employment History',
    description: 'Previous employment records',
  },
  { id: 4, title: 'Driving Record', description: 'Violations and accidents' },
  {
    id: 5,
    title: 'Medical Information',
    description: 'Medical exam and conditions',
  },
  {
    id: 6,
    title: 'Drug/Alcohol Testing',
    description: 'Testing history and results',
  },
  {
    id: 7,
    title: 'Training Records',
    description: 'Professional training and certifications',
  },
  {
    id: 8,
    title: 'Driving Experience',
    description: 'Equipment types and special skills',
  },
  {
    id: 9,
    title: 'Safety & Compliance',
    description: 'Accident history and violations',
  },
  {
    id: 10,
    title: 'References',
    description: 'Personal and professional references',
  },
]

export const DriverApplication: React.FC<DriverApplicationProps> = ({
  user,
}) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDevMode, setIsDevMode] = useState(
    process.env.NODE_ENV === 'development'
  )
  const [applicationData, setApplicationData] = useState<DriverApplicationData>(
    {
      personalInfo: {
        firstName: '',
        lastName: '',
        middleName: '',
        ssn: '',
        dateOfBirth: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        email: '',
        emergencyContact: {
          name: '',
          relationship: '',
          phone: '',
        },
      },
      cdlInfo: {
        cdlNumber: '',
        cdlState: '',
        cdlExpiration: '',
        cdlClass: '',
        endorsements: [],
        restrictions: [],
      },
      employmentHistory: [],
      drivingRecord: {
        violations: [],
        accidents: [],
      },
      medicalInfo: {
        medicalExamDate: '',
        medicalExamExpiration: '',
        medicalExaminerName: '',
        medicalExaminerPhone: '',
        medicalConditions: [],
        medications: [],
        visionTest: {
          leftEye: '',
          rightEye: '',
          bothEyes: '',
        },
        hearingTest: {
          leftEar: '',
          rightEar: '',
        },
      },
      drugAlcoholTesting: {
        lastTestDate: '',
        testResult: '',
        testingCompany: '',
        testingCompanyPhone: '',
        previousViolations: [],
      },
      trainingRecords: [],
      references: [],
      drivingExperience: {
        equipmentTypes: {
          straightTruck: { years: 0, miles: 0 },
          tractorTrailer: { years: 0, miles: 0 },
          tractorTwoTrailers: { years: 0, miles: 0 },
          specializedEquipment: [],
        },
        specialSkills: {
          moffettForklift: false,
          craneOperations: false,
          hazmatHandling: false,
          borderCrossing: false,
        },
      },
      safetyCompliance: {
        accidents: [],
        violations: [],
        complianceQuestions: {
          fmcsrDisqualification: false,
          licenseSuspension: false,
          dotClearinghouseProhibitions: false,
          positiveDrugTest: false,
          duiDwi: false,
          felonyCommercialVehicle: false,
        },
      },
      authorizations: {
        fcraConsent: false,
        backgroundCheckConsent: false,
        drugTestingConsent: false,
        employerContactConsent: false,
        pspConsent: false,
        clearinghouseQueryConsent: false,
      },
    }
  )

  // Load existing application data on component mount
  useEffect(() => {
    if (user?.address) {
      loadApplicationData()
    }
  }, [user?.address])

  const loadApplicationData = async () => {
    try {
      setIsLoading(true)
      const existingApplication = await getDriverApplicationClient(user.address)

      if (existingApplication) {
        setApplicationData(existingApplication.application_data)
        setCurrentStep(existingApplication.current_step)
        console.log('✅ Loaded existing application data')
      } else {
        console.log('📝 No existing application found, starting fresh')
      }
    } catch (error) {
      console.error('❌ Failed to load application data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveApplication = async (step?: number) => {
    if (!user?.address) return

    try {
      setIsSaving(true)
      const stepToSave = step || currentStep

      await saveDriverApplicationClient(
        user.address,
        applicationData,
        stepToSave
      )
      console.log(`💾 Saved application data for step ${stepToSave}`)
    } catch (error) {
      console.error('❌ Failed to save application:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const completeApplication = async () => {
    if (!user?.address) return

    try {
      setIsSaving(true)

      // Validate DOT compliance before completion
      const complianceErrors = validateDOTCompliance(applicationData)
      if (complianceErrors.length > 0) {
        console.warn('⚠️ DOT compliance issues found:', complianceErrors)
        const proceed = confirm(
          `DOT Compliance Issues Found:\n\n${complianceErrors.join('\n')}\n\nDo you want to proceed anyway?`
        )
        if (!proceed) {
          setIsSaving(false)
          return
        }
      }

      const result = await completeDriverApplicationClient(
        user.address,
        applicationData
      )

      if (result.success) {
        console.log('✅ Application completed successfully')
        // TODO: Generate DQ file and blockchain verification
        alert(
          '🎉 Application completed! DQ file generation and blockchain verification coming soon.'
        )
      } else {
        console.error('❌ Failed to complete application:', result.error)
        alert(`Failed to complete application: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Failed to complete application:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      const newStep = currentStep + 1
      setCurrentStep(newStep)
      saveApplication(newStep)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const updateApplicationData = (
    section: keyof DriverApplicationData,
    data: any
  ) => {
    setApplicationData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...data },
    }))
  }

  // DOT Compliance Validation
  const validateDOTCompliance = (data: DriverApplicationData): string[] => {
    const errors: string[] = []

    // Age verification (21+ for interstate)
    if (data.personalInfo.dateOfBirth) {
      const age =
        new Date().getFullYear() -
        new Date(data.personalInfo.dateOfBirth).getFullYear()
      if (age < 21) {
        errors.push(
          'Driver must be at least 21 years old for interstate commercial driving'
        )
      }
    }

    // CDL expiration check
    if (data.cdlInfo.cdlExpiration) {
      const expirationDate = new Date(data.cdlInfo.cdlExpiration)
      const today = new Date()
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysUntilExpiration < 0) {
        errors.push('CDL has expired - must be renewed before driving')
      } else if (daysUntilExpiration < 30) {
        errors.push(
          `CDL expires in ${daysUntilExpiration} days - renewal recommended`
        )
      }
    }

    // Medical exam expiration check
    if (data.medicalInfo.medicalExamExpiration) {
      const expirationDate = new Date(data.medicalInfo.medicalExamExpiration)
      const today = new Date()
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysUntilExpiration < 0) {
        errors.push('Medical exam has expired - must be renewed before driving')
      } else if (daysUntilExpiration < 30) {
        errors.push(
          `Medical exam expires in ${daysUntilExpiration} days - renewal recommended`
        )
      }
    }

    // Drug test expiration check (typically 2 years)
    if (data.drugAlcoholTesting.lastTestDate) {
      const testDate = new Date(data.drugAlcoholTesting.lastTestDate)
      const today = new Date()
      const daysSinceTest = Math.ceil(
        (today.getTime() - testDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceTest > 730) {
        // 2 years
        errors.push('Drug test is older than 2 years - new test required')
      }
    }

    // Employment history gaps (DOT requires explanation of gaps > 30 days)
    if (data.employmentHistory && data.employmentHistory.length > 0) {
      // This would need more complex logic to check for gaps
      // For now, just validate that employment history exists
      if (data.employmentHistory.length === 0) {
        errors.push('Employment history is required for DOT compliance')
      }
    }

    return errors
  }

  // Development mode functions
  const fillWithTestData = () => {
    const testData: DriverApplicationData = {
      personalInfo: {
        firstName: 'John',
        lastName: 'Driver',
        middleName: 'Test',
        ssn: '123-45-6789',
        dateOfBirth: '1985-01-01',
        address: '123 Test Street',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        phone: '(555) 123-4567',
        email: 'john.driver@test.com',
        emergencyContact: {
          name: 'Jane Driver',
          relationship: 'Spouse',
          phone: '(555) 987-6543',
        },
      },
      cdlInfo: {
        cdlNumber: 'CDL123456789',
        cdlState: 'TX',
        cdlExpiration: '2025-12-31',
        cdlClass: 'A',
        endorsements: ['H', 'N'],
        restrictions: [],
      },
      employmentHistory: [
        {
          company: 'Test Trucking Co',
          position: 'Long Haul Driver',
          startDate: '2020-01-01',
          endDate: '2023-12-31',
          reasonForLeaving: 'Better opportunity',
          supervisorName: 'Bob Manager',
          supervisorPhone: '(555) 111-2222',
          duties: 'Long haul freight transportation',
        },
      ],
      drivingRecord: {
        violations: [],
        accidents: [],
      },
      medicalInfo: {
        medicalExamDate: '2024-01-01',
        medicalExamExpiration: '2025-01-01',
        medicalExaminerName: 'Dr. Smith',
        medicalExaminerPhone: '(555) 333-4444',
        medicalConditions: [],
        medications: [],
        visionTest: {
          leftEye: '20/20',
          rightEye: '20/20',
          bothEyes: '20/20',
        },
        hearingTest: {
          leftEar: 'Normal',
          rightEar: 'Normal',
        },
      },
      drugAlcoholTesting: {
        lastTestDate: '2024-01-01',
        testResult: 'Negative',
        testingCompany: 'Test Labs',
        testingCompanyPhone: '(555) 555-5555',
        previousViolations: [],
      },
      trainingRecords: [
        {
          trainingType: 'Defensive Driving',
          trainingDate: '2023-06-01',
          trainingCompany: 'Safety First Training',
          certificateNumber: 'DD123456',
          expirationDate: '2024-06-01',
        },
      ],
      references: [
        {
          name: 'Mike Reference',
          relationship: 'Former Supervisor',
          phone: '(555) 777-8888',
          email: 'mike@test.com',
          yearsKnown: '3',
        },
      ],
      drivingExperience: {
        equipmentTypes: {
          straightTruck: { years: 2, miles: 50000 },
          tractorTrailer: { years: 5, miles: 200000 },
          tractorTwoTrailers: { years: 1, miles: 15000 },
          specializedEquipment: [
            { type: 'Flatbed', years: 3, miles: 75000 },
            { type: 'Reefer', years: 2, miles: 40000 },
          ],
        },
        specialSkills: {
          moffettForklift: true,
          craneOperations: false,
          hazmatHandling: true,
          borderCrossing: true,
        },
      },
      safetyCompliance: {
        accidents: [
          {
            date: '2022-06-15',
            type: 'non-injury',
            commercialVehicle: true,
            dotRecordable: false,
            atFault: false,
            citationIssued: false,
            description: 'Rear-ended at traffic light, no injuries',
          },
        ],
        violations: [
          {
            date: '2021-03-20',
            charge: 'Speeding',
            state: 'TX',
            commercialVehicle: true,
            fineAmount: 150,
            licenseImpact: 'None',
          },
        ],
        complianceQuestions: {
          fmcsrDisqualification: false,
          licenseSuspension: false,
          dotClearinghouseProhibitions: false,
          positiveDrugTest: false,
          duiDwi: false,
          felonyCommercialVehicle: false,
        },
      },
      authorizations: {
        fcraConsent: true,
        backgroundCheckConsent: true,
        drugTestingConsent: true,
        employerContactConsent: true,
        pspConsent: true,
        clearinghouseQueryConsent: true,
      },
    }

    setApplicationData(testData)
    setCurrentStep(10)
    console.log('🧪 Filled with test data and jumped to step 10')
  }

  const jumpToStep = (step: number) => {
    setCurrentStep(step)
    console.log(`🧪 Jumped to step ${step}`)
  }

  // Keyboard shortcuts for development
  useEffect(() => {
    if (!isDevMode) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        jumpToStep(parseInt(e.key))
      }
      if (e.ctrlKey && e.key === '0') {
        jumpToStep(10)
      }
      if (e.ctrlKey && e.key === 't') {
        fillWithTestData()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isDevMode])

  if (!user) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <div className='text-center'>
          <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-8 h-8 text-gray-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              />
            </svg>
          </div>
          <h3 className='text-lg font-medium text-gray-900 mb-2'>
            Sign in to Start Application
          </h3>
          <p className='text-gray-600'>
            Please sign in with your wallet to begin your DOT driver
            application.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <div className='flex items-center justify-center'>
          <div className='w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
          <span className='ml-3 text-gray-600'>
            Loading your application...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className='bg-white rounded-lg shadow-sm border border-gray-200'>
      {/* Header */}
      <div className='px-6 py-4 border-b border-gray-200'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-xl font-semibold text-gray-900'>
              DOT Driver Application
            </h2>
            <p className='text-sm text-gray-600 mt-1'>
              Complete your application once, use everywhere
            </p>
          </div>
          <div className='flex items-center space-x-2'>
            {isSaving && (
              <div className='flex items-center text-sm text-blue-600'>
                <div className='w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2'></div>
                Saving...
              </div>
            )}
            <div className='text-sm text-gray-500'>
              Step {currentStep} of {STEPS.length}
            </div>

            {/* DOT Compliance Status */}
            {user && (
              <div className='ml-4'>
                {(() => {
                  const complianceErrors =
                    validateDOTCompliance(applicationData)
                  if (complianceErrors.length === 0) {
                    return (
                      <div className='flex items-center text-sm text-green-600'>
                        <div className='w-2 h-2 bg-green-500 rounded-full mr-2'></div>
                        DOT Compliant
                      </div>
                    )
                  } else {
                    return (
                      <div className='flex items-center text-sm text-red-600'>
                        <div className='w-2 h-2 bg-red-500 rounded-full mr-2'></div>
                        {complianceErrors.length} Issue
                        {complianceErrors.length > 1 ? 's' : ''}
                      </div>
                    )
                  }
                })()}
              </div>
            )}

            {/* Development Mode Controls */}
            {isDevMode && (
              <div className='flex items-center space-x-2 ml-4 pl-4 border-l border-gray-200'>
                <span className='text-xs text-orange-600 font-medium'>
                  DEV MODE
                </span>
                <button
                  onClick={() => fillWithTestData()}
                  className='px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200'
                >
                  Fill Test Data
                </button>
                <div className='flex space-x-1'>
                  {STEPS.map((step) => (
                    <button
                      key={step.id}
                      onClick={() => jumpToStep(step.id)}
                      className={`w-6 h-6 text-xs rounded ${
                        step.id === currentStep
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                    >
                      {step.id}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className='px-6 py-3 bg-gray-50 border-b border-gray-200'>
        <div className='flex items-center space-x-2'>
          {STEPS.map((step) => (
            <div key={step.id} className='flex items-center'>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.id <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step.id}
              </div>
              {step.id < STEPS.length && (
                <div
                  className={`w-8 h-0.5 mx-1 ${
                    step.id < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className='p-6'>
        <div className='mb-6'>
          <h3 className='text-lg font-medium text-gray-900 mb-1'>
            {STEPS[currentStep - 1].title}
          </h3>
          <p className='text-sm text-gray-600'>
            {STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <PersonalInfoStep
            data={applicationData.personalInfo}
            onChange={(data) => updateApplicationData('personalInfo', data)}
          />
        )}

        {/* Step 2: CDL Information */}
        {currentStep === 2 && (
          <CDLInfoStep
            data={applicationData.cdlInfo}
            onChange={(data) => updateApplicationData('cdlInfo', data)}
          />
        )}

        {/* Placeholder for other steps */}
        {currentStep > 2 && (
          <div className='text-center py-12'>
            <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-blue-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                />
              </svg>
            </div>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              {STEPS[currentStep - 1].title}
            </h3>
            <p className='text-gray-600 mb-4'>
              This step is coming soon! We're building the complete DOT
              application form.
            </p>
            <div className='text-sm text-gray-500'>
              Step {currentStep} of {STEPS.length}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className='px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between'>
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          Previous
        </button>

        <div className='flex space-x-3'>
          <button
            onClick={() => saveApplication()}
            disabled={isSaving}
            className='px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50'
          >
            {isSaving ? 'Saving...' : 'Save Progress'}
          </button>

          {currentStep < STEPS.length ? (
            <button
              onClick={nextStep}
              className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700'
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={completeApplication}
              disabled={isSaving}
              className='px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50'
            >
              {isSaving ? 'Completing...' : 'Complete Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Personal Information Step Component
interface PersonalInfoStepProps {
  data: DriverApplicationData['personalInfo']
  onChange: (data: Partial<DriverApplicationData['personalInfo']>) => void
}

const PersonalInfoStep: React.FC<PersonalInfoStepProps> = ({
  data,
  onChange,
}) => {
  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            First Name *
          </label>
          <input
            type='text'
            value={data.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter your first name'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Last Name *
          </label>
          <input
            type='text'
            value={data.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter your last name'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Middle Name
          </label>
          <input
            type='text'
            value={data.middleName}
            onChange={(e) => onChange({ middleName: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter your middle name'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Social Security Number *
          </label>
          <input
            type='text'
            value={data.ssn}
            onChange={(e) => onChange({ ssn: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='XXX-XX-XXXX'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Date of Birth *
          </label>
          <input
            type='date'
            value={data.dateOfBirth}
            onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Phone Number *
          </label>
          <input
            type='tel'
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='(XXX) XXX-XXXX'
          />
        </div>

        <div className='md:col-span-2'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Email Address *
          </label>
          <input
            type='email'
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter your email address'
          />
        </div>

        <div className='md:col-span-2'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Address *
          </label>
          <input
            type='text'
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter your street address'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            City *
          </label>
          <input
            type='text'
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter your city'
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            State *
          </label>
          <select
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value })}
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
            ZIP Code *
          </label>
          <input
            type='text'
            value={data.zipCode}
            onChange={(e) => onChange({ zipCode: e.target.value })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='XXXXX'
          />
        </div>
      </div>

      {/* Emergency Contact */}
      <div className='border-t pt-6'>
        <h4 className='text-md font-medium text-gray-900 mb-4'>
          Emergency Contact
        </h4>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Contact Name *
            </label>
            <input
              type='text'
              value={data.emergencyContact.name}
              onChange={(e) =>
                onChange({
                  emergencyContact: {
                    ...data.emergencyContact,
                    name: e.target.value,
                  },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='Enter emergency contact name'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Relationship *
            </label>
            <input
              type='text'
              value={data.emergencyContact.relationship}
              onChange={(e) =>
                onChange({
                  emergencyContact: {
                    ...data.emergencyContact,
                    relationship: e.target.value,
                  },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='e.g., Spouse, Parent, Sibling'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Contact Phone *
            </label>
            <input
              type='tel'
              value={data.emergencyContact.phone}
              onChange={(e) =>
                onChange({
                  emergencyContact: {
                    ...data.emergencyContact,
                    phone: e.target.value,
                  },
                })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='(XXX) XXX-XXXX'
            />
          </div>
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

const CDLInfoStep: React.FC<CDLInfoStepProps> = ({ data, onChange }) => {
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

export default DriverApplication
