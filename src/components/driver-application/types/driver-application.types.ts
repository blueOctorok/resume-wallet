// Shared types for Driver Application components

export interface DriverApplicationData {
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

export interface DriverApplicationRecord {
  id: string
  user_address: string
  application_data: DriverApplicationData
  current_step: number
  is_complete: boolean
  created_at: string
  updated_at: string
}

export interface DriverApplicationProps {
  user: any
}

export const STEPS = [
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
