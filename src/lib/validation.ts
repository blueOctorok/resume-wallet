// Validation utilities for Driver Application

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

// Basic field validators
export const validators = {
  required: (value: any, fieldName: string): ValidationError | null => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return {
        field: fieldName,
        message: `${fieldName} is required`,
        severity: 'error',
      }
    }
    return null
  },

  email: (value: string, fieldName: string): ValidationError | null => {
    if (!value) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return {
        field: fieldName,
        message: 'Please enter a valid email address',
        severity: 'error',
      }
    }
    return null
  },

  phone: (value: string, fieldName: string): ValidationError | null => {
    if (!value) return null
    const phoneRegex = /^\(\d{3}\)\s\d{3}-\d{4}$|^\d{3}-\d{3}-\d{4}$|^\d{10}$/
    if (!phoneRegex.test(value.replace(/\D/g, ''))) {
      return {
        field: fieldName,
        message: 'Please enter a valid phone number (XXX) XXX-XXXX',
        severity: 'error',
      }
    }
    return null
  },

  ssn: (value: string, fieldName: string): ValidationError | null => {
    if (!value) return null
    const ssnRegex = /^\d{3}-\d{2}-\d{4}$|^\d{9}$/
    const cleanSSN = value.replace(/\D/g, '')
    if (!ssnRegex.test(value) || cleanSSN.length !== 9) {
      return {
        field: fieldName,
        message: 'Please enter a valid SSN (XXX-XX-XXXX)',
        severity: 'error',
      }
    }
    return null
  },

  zipCode: (value: string, fieldName: string): ValidationError | null => {
    if (!value) return null
    const zipRegex = /^\d{5}(-\d{4})?$/
    if (!zipRegex.test(value)) {
      return {
        field: fieldName,
        message: 'Please enter a valid ZIP code (XXXXX or XXXXX-XXXX)',
        severity: 'error',
      }
    }
    return null
  },

  date: (value: string, fieldName: string): ValidationError | null => {
    if (!value) return null
    const date = new Date(value)
    if (isNaN(date.getTime())) {
      return {
        field: fieldName,
        message: 'Please enter a valid date',
        severity: 'error',
      }
    }
    return null
  },

  futureDate: (value: string, fieldName: string): ValidationError | null => {
    if (!value) return null
    const date = new Date(value)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date <= today) {
      return {
        field: fieldName,
        message: `${fieldName} must be a future date`,
        severity: 'error',
      }
    }
    return null
  },

  pastDate: (value: string, fieldName: string): ValidationError | null => {
    if (!value) return null
    const date = new Date(value)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (date >= today) {
      return {
        field: fieldName,
        message: `${fieldName} must be a past date`,
        severity: 'error',
      }
    }
    return null
  },

  minLength: (
    value: string,
    minLength: number,
    fieldName: string
  ): ValidationError | null => {
    if (!value) return null
    if (value.length < minLength) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${minLength} characters`,
        severity: 'error',
      }
    }
    return null
  },

  maxLength: (
    value: string,
    maxLength: number,
    fieldName: string
  ): ValidationError | null => {
    if (!value) return null
    if (value.length > maxLength) {
      return {
        field: fieldName,
        message: `${fieldName} must be no more than ${maxLength} characters`,
        severity: 'error',
      }
    }
    return null
  },

  minValue: (
    value: number,
    minValue: number,
    fieldName: string
  ): ValidationError | null => {
    if (value < minValue) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${minValue}`,
        severity: 'error',
      }
    }
    return null
  },

  maxValue: (
    value: number,
    maxValue: number,
    fieldName: string
  ): ValidationError | null => {
    if (value > maxValue) {
      return {
        field: fieldName,
        message: `${fieldName} must be no more than ${maxValue}`,
        severity: 'error',
      }
    }
    return null
  },

  age: (
    dateOfBirth: string,
    minAge: number,
    maxAge: number
  ): ValidationError | null => {
    if (!dateOfBirth) return null
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--
    }

    if (age < minAge) {
      return {
        field: 'dateOfBirth',
        message: `Must be at least ${minAge} years old`,
        severity: 'error',
      }
    }
    if (age > maxAge) {
      return {
        field: 'dateOfBirth',
        message: `Must be no more than ${maxAge} years old`,
        severity: 'warning',
      }
    }
    return null
  },
}

// DOT-specific validation rules
export const dotValidators = {
  cdlNumber: (value: string): ValidationError | null => {
    if (!value) return null
    const cdlRegex = /^[A-Z0-9]{8,20}$/
    if (!cdlRegex.test(value.toUpperCase())) {
      return {
        field: 'cdlNumber',
        message: 'CDL number must be 8-20 alphanumeric characters',
        severity: 'error',
      }
    }
    return null
  },

  medicalExamExpiration: (value: string): ValidationError | null => {
    if (!value) return null
    const expirationDate = new Date(value)
    const today = new Date()
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilExpiration <= 0) {
      return {
        field: 'medicalExamExpiration',
        message: 'Medical exam has expired - must be renewed before driving',
        severity: 'error',
      }
    }
    if (daysUntilExpiration <= 30) {
      return {
        field: 'medicalExamExpiration',
        message: 'Medical exam expires within 30 days - consider renewal',
        severity: 'warning',
      }
    }
    return null
  },

  employmentHistoryGap: (employmentHistory: any[]): ValidationError | null => {
    if (employmentHistory.length === 0) {
      return {
        field: 'employmentHistory',
        message: 'Employment history is required - minimum 3 years needed',
        severity: 'error',
      }
    }
    return null
  },

  drugTestResult: (testResult: string): ValidationError | null => {
    if (testResult === 'Positive') {
      return {
        field: 'testResult',
        message:
          'Positive drug test result - may affect employment eligibility',
        severity: 'warning',
      }
    }
    return null
  },
}

// Form section validators
export const validatePersonalInfo = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Required fields
  const requiredFields = [
    'firstName',
    'lastName',
    'ssn',
    'dateOfBirth',
    'address',
    'city',
    'state',
    'zipCode',
    'phone',
    'email',
  ]

  requiredFields.forEach((field) => {
    const error = validators.required(
      data[field],
      field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
    )
    if (error) errors.push(error)
  })

  // Emergency contact required fields
  const emergencyFields = ['name', 'relationship', 'phone']
  emergencyFields.forEach((field) => {
    const error = validators.required(
      data.emergencyContact?.[field],
      `Emergency Contact ${field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}`
    )
    if (error) errors.push(error)
  })

  // Format validations
  if (data.email) {
    const error = validators.email(data.email, 'Email')
    if (error) errors.push(error)
  }

  if (data.phone) {
    const error = validators.phone(data.phone, 'Phone')
    if (error) errors.push(error)
  }

  if (data.emergencyContact?.phone) {
    const error = validators.phone(
      data.emergencyContact.phone,
      'Emergency Contact Phone'
    )
    if (error) errors.push(error)
  }

  if (data.ssn) {
    const error = validators.ssn(data.ssn, 'SSN')
    if (error) errors.push(error)
  }

  if (data.zipCode) {
    const error = validators.zipCode(data.zipCode, 'ZIP Code')
    if (error) errors.push(error)
  }

  if (data.dateOfBirth) {
    const ageError = validators.age(data.dateOfBirth, 18, 80)
    if (ageError) {
      if (ageError.severity === 'error') errors.push(ageError)
      else warnings.push(ageError)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateCDLInfo = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Required fields
  const requiredFields = ['cdlNumber', 'cdlState', 'cdlExpiration', 'cdlClass']
  requiredFields.forEach((field) => {
    const error = validators.required(
      data[field],
      field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
    )
    if (error) errors.push(error)
  })

  // CDL-specific validations
  if (data.cdlNumber) {
    const error = dotValidators.cdlNumber(data.cdlNumber)
    if (error) errors.push(error)
  }

  if (data.cdlExpiration) {
    const expirationDate = new Date(data.cdlExpiration)
    const today = new Date()
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilExpiration <= 0) {
      errors.push({
        field: 'cdlExpiration',
        message: 'CDL has expired - must be renewed before driving',
        severity: 'error',
      })
    } else if (daysUntilExpiration <= 60) {
      warnings.push({
        field: 'cdlExpiration',
        message: 'CDL expires within 60 days - consider renewal',
        severity: 'warning',
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateEmploymentHistory = (data: any[]): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (data.length === 0) {
    errors.push({
      field: 'employmentHistory',
      message: 'At least one employment record is required',
      severity: 'error',
    })
    return { isValid: false, errors, warnings }
  }

  data.forEach((employment, index) => {
    const prefix = `Employment #${index + 1}`

    // Required fields for each employment
    const requiredFields = ['company', 'position', 'startDate']
    requiredFields.forEach((field) => {
      const error = validators.required(
        employment[field],
        `${prefix} ${field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}`
      )
      if (error) errors.push(error)
    })

    // Date validations
    if (employment.startDate && employment.endDate) {
      const startDate = new Date(employment.startDate)
      const endDate = new Date(employment.endDate)

      if (startDate >= endDate) {
        errors.push({
          field: `employmentHistory[${index}].startDate`,
          message: 'Start date must be before end date',
          severity: 'error',
        })
      }
    }

    if (employment.startDate) {
      const error = validators.pastDate(
        employment.startDate,
        `${prefix} Start Date`
      )
      if (error) errors.push(error)
    }

    if (employment.endDate) {
      const error = validators.pastDate(
        employment.endDate,
        `${prefix} End Date`
      )
      if (error) errors.push(error)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateMedicalInfo = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Required fields
  const requiredFields = [
    'medicalExamDate',
    'medicalExamExpiration',
    'medicalExaminerName',
    'medicalExaminerPhone',
  ]
  requiredFields.forEach((field) => {
    const error = validators.required(
      data[field],
      field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
    )
    if (error) errors.push(error)
  })

  // Medical exam expiration validation
  if (data.medicalExamExpiration) {
    const error = dotValidators.medicalExamExpiration(
      data.medicalExamExpiration
    )
    if (error) {
      if (error.severity === 'error') errors.push(error)
      else warnings.push(error)
    }
  }

  // Date validations
  if (data.medicalExamDate && data.medicalExamExpiration) {
    const examDate = new Date(data.medicalExamDate)
    const expirationDate = new Date(data.medicalExamExpiration)

    if (examDate >= expirationDate) {
      errors.push({
        field: 'medicalExamDate',
        message: 'Exam date must be before expiration date',
        severity: 'error',
      })
    }
  }

  if (data.medicalExamDate) {
    const error = validators.pastDate(data.medicalExamDate, 'Medical Exam Date')
    if (error) errors.push(error)
  }

  if (data.medicalExaminerPhone) {
    const error = validators.phone(
      data.medicalExaminerPhone,
      'Medical Examiner Phone'
    )
    if (error) errors.push(error)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateDrivingRecord = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Validate violations if any exist
  if (data.violations && data.violations.length > 0) {
    data.violations.forEach((violation: any, index: number) => {
      const prefix = `Violation #${index + 1}`

      // Required fields for violations
      if (violation.date) {
        const error = validators.pastDate(violation.date, `${prefix} Date`)
        if (error) errors.push(error)
      }

      if (violation.violation) {
        const error = validators.required(
          violation.violation,
          `${prefix} Violation`
        )
        if (error) errors.push(error)
      }
    })
  }

  // Validate accidents if any exist
  if (data.accidents && data.accidents.length > 0) {
    data.accidents.forEach((accident: any, index: number) => {
      const prefix = `Accident #${index + 1}`

      if (accident.date) {
        const error = validators.pastDate(accident.date, `${prefix} Date`)
        if (error) errors.push(error)
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateDrugAlcoholTesting = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Required fields
  const requiredFields = ['lastTestDate', 'testResult', 'testingCompany']
  requiredFields.forEach((field) => {
    const error = validators.required(
      data[field],
      field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
    )
    if (error) errors.push(error)
  })

  // Date validation
  if (data.lastTestDate) {
    const error = validators.pastDate(data.lastTestDate, 'Last Test Date')
    if (error) errors.push(error)
  }

  // Test result validation
  if (data.testResult === 'Positive') {
    warnings.push({
      field: 'testResult',
      message: 'Positive drug test result - may affect employment eligibility',
      severity: 'warning',
    })
  }

  // Phone validation
  if (data.testingCompanyPhone) {
    const error = validators.phone(
      data.testingCompanyPhone,
      'Testing Company Phone'
    )
    if (error) errors.push(error)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateTrainingRecords = (data: any[]): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // If training records exist, validate them
  if (data && data.length > 0) {
    data.forEach((training, index) => {
      const prefix = `Training #${index + 1}`

      // Required fields
      const requiredFields = ['trainingType', 'trainingDate', 'trainingCompany']
      requiredFields.forEach((field) => {
        const error = validators.required(
          training[field],
          `${prefix} ${field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}`
        )
        if (error) errors.push(error)
      })

      // Date validation
      if (training.trainingDate) {
        const error = validators.pastDate(
          training.trainingDate,
          `${prefix} Training Date`
        )
        if (error) errors.push(error)
      }

      if (training.expirationDate) {
        const expirationDate = new Date(training.expirationDate)
        const today = new Date()

        if (expirationDate <= today) {
          warnings.push({
            field: `trainingRecords[${index}].expirationDate`,
            message: `${prefix} has expired - may need renewal`,
            severity: 'warning',
          })
        }
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateDrivingExperience = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Validate equipment experience
  if (data.equipmentTypes) {
    const equipment = data.equipmentTypes

    // Check for reasonable experience values
    if (equipment.straightTruck?.years > 50) {
      warnings.push({
        field: 'equipmentTypes.straightTruck.years',
        message: 'Straight truck experience seems unusually high',
        severity: 'warning',
      })
    }

    if (equipment.tractorTrailer?.years > 50) {
      warnings.push({
        field: 'equipmentTypes.tractorTrailer.years',
        message: 'Tractor trailer experience seems unusually high',
        severity: 'warning',
      })
    }

    // Validate mileage values
    if (equipment.straightTruck?.miles > 2000000) {
      warnings.push({
        field: 'equipmentTypes.straightTruck.miles',
        message: 'Straight truck mileage seems unusually high',
        severity: 'warning',
      })
    }

    if (equipment.tractorTrailer?.miles > 2000000) {
      warnings.push({
        field: 'equipmentTypes.tractorTrailer.miles',
        message: 'Tractor trailer mileage seems unusually high',
        severity: 'warning',
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateSafetyCompliance = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Validate accidents
  if (data.accidents && data.accidents.length > 0) {
    data.accidents.forEach((accident: any, index: number) => {
      const prefix = `Accident #${index + 1}`

      if (accident.date) {
        const error = validators.pastDate(accident.date, `${prefix} Date`)
        if (error) errors.push(error)
      }

      // Check for serious violations
      if (accident.type === 'fatality') {
        warnings.push({
          field: `safetyCompliance.accidents[${index}].type`,
          message: `${prefix} involves fatality - may affect employment eligibility`,
          severity: 'warning',
        })
      }
    })
  }

  // Validate violations
  if (data.violations && data.violations.length > 0) {
    data.violations.forEach((violation: any, index: number) => {
      const prefix = `Violation #${index + 1}`

      if (violation.date) {
        const error = validators.pastDate(violation.date, `${prefix} Date`)
        if (error) errors.push(error)
      }

      // Check for high fines
      if (violation.fineAmount > 10000) {
        warnings.push({
          field: `safetyCompliance.violations[${index}].fineAmount`,
          message: `${prefix} has high fine amount - may indicate serious violation`,
          severity: 'warning',
        })
      }
    })
  }

  // Check compliance questions
  if (data.complianceQuestions) {
    const compliance = data.complianceQuestions

    // Flag serious compliance issues
    if (compliance.fmcsrDisqualification) {
      warnings.push({
        field: 'complianceQuestions.fmcsrDisqualification',
        message: 'FMCSR disqualification may prevent employment',
        severity: 'warning',
      })
    }

    if (compliance.duiDwi) {
      warnings.push({
        field: 'complianceQuestions.duiDwi',
        message: 'DUI/DWI history may affect employment eligibility',
        severity: 'warning',
      })
    }

    if (compliance.positiveDrugTest) {
      warnings.push({
        field: 'complianceQuestions.positiveDrugTest',
        message: 'Positive drug test history may affect employment',
        severity: 'warning',
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateReferences = (data: any[]): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Require at least 2 references
  if (!data || data.length < 2) {
    errors.push({
      field: 'references',
      message: 'At least 2 references are required',
      severity: 'error',
    })
    return { isValid: false, errors, warnings }
  }

  data.forEach((reference, index) => {
    const prefix = `Reference #${index + 1}`

    // Required fields
    const requiredFields = ['name', 'relationship', 'phone', 'email']
    requiredFields.forEach((field) => {
      const error = validators.required(
        reference[field],
        `${prefix} ${field.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}`
      )
      if (error) errors.push(error)
    })

    // Email validation
    if (reference.email) {
      const error = validators.email(reference.email, `${prefix} Email`)
      if (error) errors.push(error)
    }

    // Phone validation
    if (reference.phone) {
      const error = validators.phone(reference.phone, `${prefix} Phone`)
      if (error) errors.push(error)
    }

    // Years known validation
    if (reference.yearsKnown) {
      const years = parseInt(reference.yearsKnown)
      if (isNaN(years) || years < 0 || years > 100) {
        errors.push({
          field: `references[${index}].yearsKnown`,
          message: `${prefix} years known must be a valid number (0-100)`,
          severity: 'error',
        })
      }
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// Complete application validation
export const validateCompleteApplication = (data: any): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Validate each section
  const personalInfoValidation = validatePersonalInfo(data.personalInfo)
  const cdlInfoValidation = validateCDLInfo(data.cdlInfo)
  const employmentValidation = validateEmploymentHistory(data.employmentHistory)
  const drivingRecordValidation = validateDrivingRecord(data.drivingRecord)
  const medicalValidation = validateMedicalInfo(data.medicalInfo)
  const drugTestingValidation = validateDrugAlcoholTesting(
    data.drugAlcoholTesting
  )
  const trainingValidation = validateTrainingRecords(data.trainingRecords)
  const experienceValidation = validateDrivingExperience(data.drivingExperience)
  const safetyValidation = validateSafetyCompliance(data.safetyCompliance)
  const referencesValidation = validateReferences(data.references)

  // Combine all errors and warnings
  errors.push(...personalInfoValidation.errors)
  errors.push(...cdlInfoValidation.errors)
  errors.push(...employmentValidation.errors)
  errors.push(...drivingRecordValidation.errors)
  errors.push(...medicalValidation.errors)
  errors.push(...drugTestingValidation.errors)
  errors.push(...trainingValidation.errors)
  errors.push(...experienceValidation.errors)
  errors.push(...safetyValidation.errors)
  errors.push(...referencesValidation.errors)

  warnings.push(...personalInfoValidation.warnings)
  warnings.push(...cdlInfoValidation.warnings)
  warnings.push(...employmentValidation.warnings)
  warnings.push(...drivingRecordValidation.warnings)
  warnings.push(...medicalValidation.warnings)
  warnings.push(...drugTestingValidation.warnings)
  warnings.push(...trainingValidation.warnings)
  warnings.push(...experienceValidation.warnings)
  warnings.push(...safetyValidation.warnings)
  warnings.push(...referencesValidation.warnings)

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
