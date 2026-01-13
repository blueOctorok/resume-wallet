'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  DriverApplicationData,
  DriverApplicationRecord,
  DriverApplicationProps,
  STEPS,
} from './driver-application/types/driver-application.types'
import {
  PersonalInfoStep,
  CDLInfoStep,
  EmploymentHistoryStep,
} from './driver-application/DriverApplication1-3'
import {
  DrivingRecordStep,
  MedicalInfoStep,
  DrugAlcoholTestingStep,
} from './driver-application/DriverApplication4-6'
import {
  TrainingRecordsStep,
  DrivingExperienceStep,
  SafetyComplianceStep,
  ReferencesStep,
} from './driver-application/DriverApplication7-10'
import {
  saveDriverApplicationClient,
  getDriverApplicationClient,
  completeDriverApplicationClient,
} from '@/lib/supabase-client-db'
import { validateCompleteApplication, ValidationResult } from '@/lib/validation'
import {
  getDriverContractService,
  generateApplicationHashAsync,
  uploadDriverApplicationToIPFS,
} from '@/lib/driver-contract'
import AutoCompletePanel from './driver-application/AutoCompletePanel'

const DriverApplication: React.FC<DriverApplicationProps> = ({ user }) => {
  const [currentStep, setCurrentStep] = useState(1)
  const { theme } = useTheme()
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
      references: [],
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAutoComplete, setShowAutoComplete] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [blockchainApplicationId, setBlockchainApplicationId] = useState<
    number | null
  >(null)
  const [blockchainStatus, setBlockchainStatus] = useState<
    'pending' | 'submitted' | 'verified' | 'rejected' | 'error'
  >('pending')
  const [ipfsHash, setIpfsHash] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  })

  useEffect(() => {
    if (user?.address) {
      loadExistingApplication()
      checkBlockchainApplications()
      checkResumeAndMvr()
    }
  }, [user?.address])

  const checkResumeAndMvr = async () => {
    if (!user?.address) return

    try {
      // Check for resume via API (fetch resumes list)
      try {
        const resumeResponse = await fetch('/api/resumes', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': user.address,
          },
        })
        if (resumeResponse.ok) {
          const resumes = await resumeResponse.json()
          setHasResume(Array.isArray(resumes) && resumes.length > 0)
        } else {
          setHasResume(false)
        }
      } catch {
        setHasResume(false)
      }

      // Check for MVR by trying prefill API (it will return 404 if no MVR)
      try {
        const mvrResponse = await fetch('/api/driver/prefill-from-mvr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: user.address }),
        })
        setHasMvr(mvrResponse.ok)
      } catch {
        setHasMvr(false)
      }
    } catch (error) {
      console.error('Error checking resume/MVR:', error)
    }
  }

  const checkBlockchainApplications = async () => {
    try {
      const contractService = getDriverContractService()
      const applications = await contractService.getUserApplications(
        user!.address
      )

      if (applications.length > 0) {
        // Get the most recent application
        const latestAppId = applications[applications.length - 1]
        const app = await contractService.getApplication(latestAppId)

        setBlockchainApplicationId(latestAppId)

        if (app.isVerified) {
          setBlockchainStatus('verified')
        } else if (app.isRejected) {
          setBlockchainStatus('rejected')
        } else {
          setBlockchainStatus('submitted')
        }
      }
    } catch (error) {
      console.log('Could not check blockchain applications:', error)
      // Not critical - just means no blockchain apps or wallet not connected
    }
  }

  const loadExistingApplication = async () => {
    try {
      setIsLoading(true)
      const existingApp = await getDriverApplicationClient(user.address)

      if (existingApp) {
        console.log('📖 Found existing application:', existingApp)
        setApplicationData(existingApp.application_data)
        setCurrentStep(existingApp.current_step)
      } else {
        console.log('📝 No existing application found, starting fresh')
      }
    } catch (error) {
      console.error('Error loading application:', error)
      setError('Failed to load existing application')
    } finally {
      setIsLoading(false)
    }
  }

  const updateApplicationData = (
    section: keyof DriverApplicationData,
    data: any
  ) => {
    setApplicationData((prev) => {
      // Handle array fields differently
      if (
        section === 'references' ||
        section === 'employmentHistory' ||
        section === 'trainingRecords'
      ) {
        return {
          ...prev,
          [section]: data, // Direct assignment for arrays
        }
      }

      // Handle object fields with spread syntax
      return {
        ...prev,
        [section]: { ...prev[section], ...data },
      }
    })

    // Clear error message when user starts making changes
    if (error) {
      setError(null)
    }
  }

  const handleAutoFillData = (data: Partial<DriverApplicationData>) => {
    setApplicationData((prev) => ({
      ...prev,
      ...data,
    }))
    setSuccess('Application data filled successfully!')
    setTimeout(() => setSuccess(null), 3000)
  }

  const saveApplication = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!user?.address) {
        throw new Error('User not authenticated')
      }

      await saveDriverApplicationClient(
        user.address,
        applicationData,
        currentStep
      )
      console.log('💾 Saved application data for step', currentStep)
      setSuccess('Application saved successfully!')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      console.error('Error saving application:', error)
      setError('Failed to save application')
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => {
    // Validate current step before proceeding
    const currentValidation = validateCurrentStep()
    setValidation(currentValidation)

    if (!currentValidation.isValid) {
      const errorCount = currentValidation.errors.length
      const errorText = errorCount === 1 ? 'error' : 'errors'
      setError(
        `Please fix ${errorCount} ${errorText} before proceeding to the next step.`
      )
      return
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
      saveApplication()
    }
  }

  const validateCurrentStep = (): ValidationResult => {
    // Import validation functions as needed
    const {
      validatePersonalInfo,
      validateCDLInfo,
      validateEmploymentHistory,
      validateDrivingRecord,
      validateMedicalInfo,
      validateDrugAlcoholTesting,
      validateTrainingRecords,
      validateDrivingExperience,
      validateSafetyCompliance,
      validateReferences,
    } = require('@/lib/validation')

    let result: ValidationResult

    switch (currentStep) {
      case 1:
        result = validatePersonalInfo(applicationData.personalInfo)
        break
      case 2:
        result = validateCDLInfo(applicationData.cdlInfo)
        break
      case 3:
        result = validateEmploymentHistory(applicationData.employmentHistory)
        break
      case 4:
        result = validateDrivingRecord(applicationData.drivingRecord)
        break
      case 5:
        result = validateMedicalInfo(applicationData.medicalInfo)
        break
      case 6:
        result = validateDrugAlcoholTesting(applicationData.drugAlcoholTesting)
        break
      case 7:
        result = validateTrainingRecords(applicationData.trainingRecords)
        break
      case 8:
        result = validateDrivingExperience(applicationData.drivingExperience)
        break
      case 9:
        result = validateSafetyCompliance(applicationData.safetyCompliance)
        break
      case 10:
        result = validateReferences(applicationData.references)
        break
      default:
        result = { isValid: true, errors: [], warnings: [] }
    }

    // Debug logging for all steps
    console.log(`🔍 Step ${currentStep} Validation:`, {
      step: currentStep,
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings,
    })

    return result
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const completeApplication = async () => {
    // Prevent duplicate submissions
    if (isLoading || isCompleted) {
      console.log(
        '🔄 Application completion already in progress or completed, skipping...'
      )
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      if (!user?.address) {
        throw new Error('User not authenticated')
      }

      // Validate complete application
      const completeValidation = validateCompleteApplication(applicationData)
      setValidation(completeValidation)

      if (!completeValidation.isValid) {
        const errorCount = completeValidation.errors.length
        const errorText = errorCount === 1 ? 'error' : 'errors'
        setError(
          `Please fix ${errorCount} ${errorText} before completing the application.`
        )
        return
      }

      // DOT Compliance Check
      const complianceIssues = checkDOTCompliance()

      if (complianceIssues.length > 0) {
        console.warn('⚠️ DOT compliance issues found:', complianceIssues)
        // Still allow completion but warn user
      }

      console.log('🎯 Starting application completion...')

      // 1. Generate application hash
      const applicationHash =
        await generateApplicationHashAsync(applicationData)
      console.log('🔐 Generated application hash:', applicationHash)

      // 2. Check for duplicates
      console.log('🔍 Checking for duplicate applications...')
      const duplicateCheckResponse = await fetch(
        '/api/driver-applications/check-duplicate-global',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: user.address,
            applicationHash: applicationHash,
          }),
        }
      )

      if (!duplicateCheckResponse.ok) {
        throw new Error('Failed to check for duplicates')
      }

      const duplicateCheck = await duplicateCheckResponse.json()
      if (duplicateCheck.exists) {
        setError(
          `Duplicate application found (${duplicateCheck.duplicateType} level). This application has already been submitted. Please modify your application data before resubmitting.`
        )
        setIsLoading(false)
        return
      }

      console.log('✅ No duplicates found, proceeding with submission')

      // 3. Upload to IPFS
      console.log('📤 Uploading application to IPFS...')
      const ipfsHash = await uploadDriverApplicationToIPFS(applicationData)
      console.log('✅ Application uploaded to IPFS:', ipfsHash)
      setIpfsHash(ipfsHash)

      // 4. Save to database with IPFS hash
      await completeDriverApplicationClient(
        user.address,
        applicationData,
        ipfsHash
      )
      console.log('✅ Application saved to database with IPFS hash')

      // 5. Submit to blockchain via API route
      try {
        setBlockchainStatus('pending')
        console.log('📝 Submitting to blockchain via API...')

        const blockchainResponse = await fetch(
          '/api/blockchain/submit-driver-application',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicationHash,
              ipfsHash,
            }),
          }
        )

        const blockchainResult = await blockchainResponse.json()
        console.log('📝 Blockchain API response:', blockchainResult)

        if (!blockchainResponse.ok) {
          console.error('❌ Blockchain API error details:', blockchainResult)
          throw new Error(
            blockchainResult.details ||
              blockchainResult.error ||
              'Blockchain API request failed'
          )
        }

        console.log('✅ Blockchain submission result:', blockchainResult)

        if (blockchainResult.success) {
          setBlockchainApplicationId(blockchainResult.applicationId)
          setBlockchainStatus('submitted')
          setIsCompleted(true)
          setSuccess(
            `Application completed successfully! IPFS: ${ipfsHash}, Blockchain ID: ${blockchainResult.applicationId}`
          )
        } else {
          throw new Error(
            blockchainResult.error || 'Blockchain submission failed'
          )
        }
      } catch (blockchainError) {
        console.error('❌ Blockchain submission failed:', blockchainError)
        setBlockchainStatus('error')

        // Still mark as completed since database save succeeded
        setIsCompleted(true)
        setSuccess(
          `Application completed and saved to database (IPFS: ${ipfsHash}). Blockchain submission failed - you can retry later.`
        )
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (error) {
      console.error('Error completing application:', error)
      setError('Failed to complete application')
    } finally {
      setIsLoading(false)
    }
  }

  const checkDOTCompliance = (): string[] => {
    const issues: string[] = []

    // Check medical exam expiration
    if (applicationData.medicalInfo.medicalExamExpiration) {
      const expirationDate = new Date(
        applicationData.medicalInfo.medicalExamExpiration
      )
      const today = new Date()

      if (expirationDate <= today) {
        issues.push('Medical exam has expired - must be renewed before driving')
      }
    }

    // Check employment history (minimum 3 years)
    if (applicationData.employmentHistory.length === 0) {
      issues.push('Employment history is required - minimum 3 years needed')
    }

    // Check drug test result
    if (applicationData.drugAlcoholTesting.testResult === 'Positive') {
      issues.push(
        'Positive drug test result - may affect employment eligibility'
      )
    }

    return issues
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalInfoStep
            data={applicationData.personalInfo}
            onChange={(data) => updateApplicationData('personalInfo', data)}
            validation={validation}
          />
        )
      case 2:
        return (
          <CDLInfoStep
            data={applicationData.cdlInfo}
            onChange={(data) => updateApplicationData('cdlInfo', data)}
          />
        )
      case 3:
        return (
          <EmploymentHistoryStep
            data={applicationData.employmentHistory}
            onChange={(data) =>
              updateApplicationData('employmentHistory', data)
            }
          />
        )
      case 4:
        return (
          <DrivingRecordStep
            data={applicationData.drivingRecord}
            onChange={(data) => updateApplicationData('drivingRecord', data)}
            validation={validation}
          />
        )
      case 5:
        return (
          <MedicalInfoStep
            data={applicationData.medicalInfo}
            onChange={(data) => updateApplicationData('medicalInfo', data)}
            validation={validation}
          />
        )
      case 6:
        return (
          <DrugAlcoholTestingStep
            data={applicationData.drugAlcoholTesting}
            onChange={(data) =>
              updateApplicationData('drugAlcoholTesting', data)
            }
            validation={validation}
          />
        )
      case 7:
        return (
          <TrainingRecordsStep
            data={applicationData.trainingRecords}
            onChange={(data) => updateApplicationData('trainingRecords', data)}
            validation={validation}
          />
        )
      case 8:
        return (
          <DrivingExperienceStep
            data={applicationData.drivingExperience}
            onChange={(data) =>
              updateApplicationData('drivingExperience', data)
            }
            validation={validation}
          />
        )
      case 9:
        return (
          <SafetyComplianceStep
            data={applicationData.safetyCompliance}
            onChange={(data) => updateApplicationData('safetyCompliance', data)}
            validation={validation}
          />
        )
      case 10:
        return (
          <ReferencesStep
            data={applicationData.references}
            onChange={(data) => updateApplicationData('references', data)}
            validation={validation}
          />
        )
      default:
        return <div>Invalid step</div>
    }
  }

  if (!user?.address) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-red-500/30'>
            <svg
              className='w-8 h-8 text-red-300'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
              />
            </svg>
          </div>
          <h3
            className={`text-lg font-medium mb-2 ${
              theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
            }`}
          >
            Authentication Required
          </h3>
          <p
            className={`${
              theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
            }`}
          >
            Please log in to access the driver application.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading && !applicationData.personalInfo.firstName) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-brand-mint mx-auto mb-4'></div>
          <p
            className={`${
              theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
            }`}
          >
            Loading application...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-6xl mx-auto p-3 sm:p-6'>
      {/* Application Container with Border */}
      <div
        className={`backdrop-blur-xl rounded-3xl shadow-2xl border-2 p-4 sm:p-6 lg:p-8 relative ${
          theme === 'light'
            ? 'bg-white/90 border-brand-sage/40'
            : 'bg-brand-sage-light/10 border-brand-cream/30'
        }`}
      >
        {/* Inner shadow for depth */}
        <div
          className={`absolute inset-0 rounded-3xl pointer-events-none ${
            theme === 'light'
              ? 'shadow-[inset_0_2px_20px_rgba(0,0,0,0.1)]'
              : 'shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)]'
          }`}
        />

        {/* Outer glow */}
        <div
          className={`absolute -inset-[2px] rounded-3xl opacity-50 blur-sm -z-10 ${
            theme === 'light'
              ? 'bg-gradient-to-b from-brand-sage/20 to-transparent'
              : 'bg-gradient-to-b from-brand-cream/20 to-transparent'
          }`}
        />

        {/* Header */}
        <div className='text-center mb-6 sm:mb-8 relative'>
          <h1
            className={`text-2xl sm:text-3xl font-bold mb-2 ${
              theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
            }`}
          >
            DOT Driver Application
          </h1>
          <p
            className={`text-sm sm:text-base ${
              theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
            }`}
          >
            Complete all sections to submit your commercial driver application
          </p>
        </div>

        {/* Progress Bar */}
        <div className='mb-8'>
          <div className='flex items-center justify-between mb-2'>
            <span
              className={`text-sm font-medium ${
                theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
              }`}
            >
              Step {currentStep} of {STEPS.length}
            </span>
            <span
              className={`text-sm ${
                theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
              }`}
            >
              {Math.round((currentStep / STEPS.length) * 100)}% Complete
            </span>
          </div>
          <div
            className={`w-full rounded-full h-2 ${
              theme === 'light' ? 'bg-gray-200' : 'bg-brand-sage-light/20'
            }`}
          >
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                theme === 'light' ? 'bg-brand-sage' : 'bg-brand-mint'
              }`}
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Step Navigation */}
        <div className='mb-8'>
          {/* Mobile: Stack Previous/Next above step buttons */}
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            {/* Previous Button */}
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`px-4 py-2 sm:px-6 sm:py-3 text-sm font-semibold rounded-xl border transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto ${
                theme === 'light'
                  ? 'text-white bg-brand-sage border-brand-sage hover:bg-brand-sage-dark hover:border-brand-sage-dark'
                  : 'text-brand-cream bg-brand-sage-light/20 border-brand-mint/30 hover:bg-brand-sage-light/30 hover:border-brand-mint/50'
              }`}
            >
              Previous
            </button>

            {/* Step Buttons - Mobile optimized */}
            <div className='flex justify-center'>
              <div className='flex flex-wrap justify-center gap-1 sm:gap-2 max-w-full'>
                {STEPS.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    className={`w-10 h-10 sm:w-8 sm:h-8 rounded-full text-sm font-medium transition-all duration-300 ${
                      currentStep === step.id
                        ? theme === 'light'
                          ? 'bg-brand-sage text-white shadow-lg shadow-brand-sage/30'
                          : 'bg-brand-cream text-brand-sage shadow-lg shadow-brand-cream/30'
                        : currentStep > step.id
                          ? theme === 'light'
                            ? 'bg-brand-sage text-white'
                            : 'bg-brand-mint text-brand-sage'
                          : theme === 'light'
                            ? 'bg-gray-200 text-gray-600 border border-gray-300'
                            : 'bg-brand-sage-light/30 text-brand-cream/50 border border-brand-cream/20'
                    }`}
                  >
                    {step.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Next/Complete Button */}
            {currentStep === STEPS.length ? (
              <div>
                <button
                  onClick={completeApplication}
                  disabled={isLoading || isCompleted}
                  className={`px-4 py-2 sm:px-6 sm:py-3 text-sm font-semibold border border-transparent rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl w-full sm:w-auto ${
                    isCompleted
                      ? theme === 'light'
                        ? 'bg-brand-sage text-white cursor-not-allowed shadow-brand-sage/30'
                        : 'bg-brand-cream text-brand-sage cursor-not-allowed shadow-brand-cream/30'
                      : theme === 'light'
                        ? 'bg-brand-sage text-white hover:bg-brand-sage-dark'
                        : 'bg-brand-mint text-brand-sage hover:bg-brand-mint/80'
                  }`}
                >
                  {isCompleted
                    ? 'Application Completed!'
                    : isLoading
                      ? 'Completing...'
                      : 'Complete Application'}
                </button>

                {/* Blockchain Status Indicator */}
                {isCompleted && (
                  <div
                    className={`mt-4 p-4 rounded-xl border backdrop-blur-sm ${
                      theme === 'light'
                        ? 'bg-gray-50 border-brand-sage/30'
                        : 'bg-brand-sage-light/10 border-brand-mint/20'
                    }`}
                  >
                    <h3
                      className={`text-sm font-medium mb-2 ${
                        theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
                      }`}
                    >
                      Blockchain Status
                    </h3>
                    <div className='flex items-center space-x-2'>
                      {blockchainStatus === 'pending' && (
                        <>
                          <div className='w-3 h-3 bg-yellow-400 rounded-full animate-pulse'></div>
                          <span
                            className={`text-sm ${
                              theme === 'light'
                                ? 'text-yellow-600'
                                : 'text-yellow-300'
                            }`}
                          >
                            Submitting to blockchain...
                          </span>
                        </>
                      )}
                      {blockchainStatus === 'submitted' && (
                        <>
                          <div
                            className={`w-3 h-3 rounded-full ${
                              theme === 'light'
                                ? 'bg-brand-sage'
                                : 'bg-brand-mint'
                            }`}
                          ></div>
                          <span
                            className={`text-sm ${
                              theme === 'light'
                                ? 'text-brand-sage'
                                : 'text-brand-mint'
                            }`}
                          >
                            Submitted to blockchain (ID:{' '}
                            {blockchainApplicationId})
                          </span>
                        </>
                      )}
                      {blockchainStatus === 'verified' && (
                        <>
                          <div className='w-3 h-3 bg-green-400 rounded-full'></div>
                          <span className='text-sm text-green-300'>
                            Verified by DOT inspector
                          </span>
                        </>
                      )}
                      {blockchainStatus === 'rejected' && (
                        <>
                          <div className='w-3 h-3 bg-red-400 rounded-full'></div>
                          <span className='text-sm text-red-300'>
                            Rejected by DOT inspector
                          </span>
                        </>
                      )}
                      {blockchainStatus === 'error' && (
                        <>
                          <div className='w-3 h-3 bg-red-400 rounded-full'></div>
                          <span className='text-sm text-red-300'>
                            Blockchain submission failed
                          </span>
                        </>
                      )}
                    </div>
                    <p
                      className={`text-xs mt-1 ${
                        theme === 'light'
                          ? 'text-gray-500'
                          : 'text-brand-cream/70'
                      }`}
                    >
                      Your application is stored immutably on the blockchain for
                      verification.
                      {ipfsHash && (
                        <span className='block mt-1'>
                          IPFS Hash:{' '}
                          <code
                            className={`px-2 py-1 rounded text-xs font-mono ${
                              theme === 'light'
                                ? 'bg-brand-sage/20 text-gray-700'
                                : 'bg-brand-sage/30 text-brand-cream'
                            }`}
                          >
                            {ipfsHash}
                          </code>
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={nextStep}
                disabled={isLoading}
                className={`px-4 py-2 sm:px-6 sm:py-3 text-sm font-semibold border border-transparent rounded-xl hover:transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto ${
                  theme === 'light'
                    ? 'text-white bg-brand-sage hover:bg-brand-sage-dark'
                    : 'text-brand-sage bg-brand-mint hover:bg-brand-mint/80'
                }`}
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* Current Step Title */}
        <div className='mb-6'>
          <h2
            className={`text-xl font-semibold ${
              theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
            }`}
          >
            {STEPS[currentStep - 1].title}
          </h2>
          <p
            className={`${
              theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
            }`}
          >
            {STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className='mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm'>
            <p className='text-red-300 font-medium'>{error}</p>
          </div>
        )}

        {success && (
          <div className='mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl backdrop-blur-sm'>
            <p className='text-green-300 font-medium'>{success}</p>
          </div>
        )}

        {/* Step Content */}
        <div
          className={`backdrop-blur-sm border rounded-2xl p-6 mb-8 shadow-xl ${
            theme === 'light'
              ? 'bg-white/90 border-brand-sage/30'
              : 'bg-brand-sage-light/10 border-brand-mint/20'
          }`}
        >
          {renderStep()}
        </div>

        {/* Save Button */}
        <div className='text-center'>
          <button
            onClick={saveApplication}
            disabled={isLoading}
            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'light'
                ? 'text-white bg-brand-sage border border-brand-sage hover:bg-brand-sage-dark hover:border-brand-sage-dark'
                : 'text-brand-cream bg-brand-sage-light/20 border border-brand-mint/30 hover:bg-brand-sage-light/30 hover:border-brand-mint/50'
            }`}
          >
            {isLoading ? 'Saving...' : 'Save Progress'}
          </button>
        </div>

        {/* Auto-Complete Panel */}
        <AutoCompletePanel
          onFillData={handleAutoFillData}
          currentStep={currentStep}
          isVisible={showAutoComplete}
          onToggle={() => setShowAutoComplete(!showAutoComplete)}
        />
      </div>
    </div>
  )
}

export default DriverApplication
