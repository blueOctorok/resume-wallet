import { DriverApplicationData } from './types/driver-application.types'

/**
 * Auto-complete data for easy testing of driver applications
 * Provides realistic sample data that meets DOT requirements
 */
export const AUTO_COMPLETE_DATA: DriverApplicationData = {
  personalInfo: {
    firstName: 'John',
    lastName: 'Smith',
    middleName: 'Michael',
    ssn: '123-45-6789',
    dateOfBirth: '1985-06-15',
    address: '1234 Main Street',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001',
    phone: '(602) 555-0123',
    email: 'john.smith@email.com',
    emergencyContact: {
      name: 'Jane Smith',
      relationship: 'Spouse',
      phone: '(602) 555-0124',
    },
  },
  cdlInfo: {
    cdlNumber: 'D123456789',
    cdlState: 'AZ',
    cdlExpiration: '2026-06-15',
    cdlClass: 'A',
    endorsements: ['H', 'N', 'T'],
    restrictions: [],
  },
  employmentHistory: [
    {
      company: 'Swift Transportation',
      position: 'Commercial Driver',
      startDate: '2020-01-15',
      endDate: '2023-12-31',
      reasonForLeaving: 'Seeking better opportunities',
      supervisorName: 'Mike Johnson',
      supervisorPhone: '(602) 555-0200',
      duties:
        'Long-haul freight transportation across multiple states. Maintained excellent safety record and on-time delivery performance.',
    },
    {
      company: 'FedEx Ground',
      position: 'Package Delivery Driver',
      startDate: '2018-03-01',
      endDate: '2019-12-15',
      reasonForLeaving: 'Career advancement',
      supervisorName: 'Sarah Davis',
      supervisorPhone: '(602) 555-0300',
      duties:
        'Local package delivery and pickup services. Customer service and route optimization.',
    },
  ],
  drivingRecord: {
    violations: [
      {
        date: '2022-08-15',
        violation: 'Speeding 5 MPH over limit',
        location: 'Phoenix, AZ',
        fine: '$150.00',
        points: '3',
      },
    ],
    accidents: [],
  },
  medicalInfo: {
    medicalExamDate: '2024-01-15',
    medicalExamExpiration: '2025-01-15',
    medicalExaminerName: 'Dr. Robert Williams',
    medicalExaminerPhone: '(602) 555-0400',
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
    lastTestDate: '2024-01-15',
    testResult: 'Negative',
    testingCompany: 'Quest Diagnostics',
    testingCompanyPhone: '(602) 555-0500',
    previousViolations: [],
  },
  trainingRecords: [
    {
      trainingType: 'ELDT',
      trainingDate: '2020-01-01',
      trainingCompany: 'Phoenix CDL Training',
      certificateNumber: 'ELDT2020001',
      expirationDate: '',
    },
    {
      trainingType: 'Hazmat',
      trainingDate: '2020-02-15',
      trainingCompany: 'Safety First Training',
      certificateNumber: 'HAZ2020001',
      expirationDate: '2025-02-15',
    },
    {
      trainingType: 'Defensive Driving',
      trainingDate: '2023-06-01',
      trainingCompany: 'Drive Safe Academy',
      certificateNumber: 'DD2023001',
      expirationDate: '2024-06-01',
    },
  ],
  drivingExperience: {
    equipmentTypes: {
      straightTruck: { years: 2, miles: 150000 },
      tractorTrailer: { years: 4, miles: 450000 },
      tractorTwoTrailers: { years: 0, miles: 0 },
      specializedEquipment: [
        {
          type: 'Flatbed',
          years: 3,
          miles: 200000,
        },
        {
          type: 'Reefer',
          years: 2,
          miles: 100000,
        },
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
    accidents: [],
    violations: [
      {
        date: '2022-08-15',
        charge: 'Speeding',
        state: 'AZ',
        commercialVehicle: true,
        fineAmount: 150.0,
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
  references: [
    {
      name: 'Mike Johnson',
      relationship: 'Former Supervisor',
      phone: '(602) 555-0200',
      email: 'mike.johnson@swift.com',
      yearsKnown: '4',
    },
    {
      name: 'Sarah Davis',
      relationship: 'Former Supervisor',
      phone: '(602) 555-0300',
      email: 'sarah.davis@fedex.com',
      yearsKnown: '6',
    },
    {
      name: 'Tom Wilson',
      relationship: 'Personal Friend',
      phone: '(602) 555-0600',
      email: 'tom.wilson@email.com',
      yearsKnown: '10',
    },
  ],
  authorizations: {
    fcraConsent: true,
    backgroundCheckConsent: true,
    drugTestingConsent: true,
    employerContactConsent: true,
    pspConsent: true,
    clearinghouseQueryConsent: true,
  },
}

/**
 * Auto-complete data with some DOT compliance issues for testing
 */
export const AUTO_COMPLETE_DATA_WITH_ISSUES: DriverApplicationData = {
  ...AUTO_COMPLETE_DATA,
  medicalInfo: {
    ...AUTO_COMPLETE_DATA.medicalInfo,
    medicalExamExpiration: '2023-12-31', // Expired medical exam
  },
  drugAlcoholTesting: {
    ...AUTO_COMPLETE_DATA.drugAlcoholTesting,
    testResult: 'Positive', // Positive drug test
    previousViolations: [
      {
        date: '2021-03-15',
        violation: 'Positive marijuana test',
        result: 'Positive',
      },
    ],
  },
  safetyCompliance: {
    ...AUTO_COMPLETE_DATA.safetyCompliance,
    complianceQuestions: {
      fmcsrDisqualification: true,
      licenseSuspension: false,
      dotClearinghouseProhibitions: true,
      positiveDrugTest: true,
      duiDwi: false,
      felonyCommercialVehicle: false,
    },
  },
}

/**
 * Auto-complete data for a new driver with minimal experience
 */
export const AUTO_COMPLETE_DATA_NEW_DRIVER: DriverApplicationData = {
  ...AUTO_COMPLETE_DATA,
  personalInfo: {
    ...AUTO_COMPLETE_DATA.personalInfo,
    firstName: 'Emily',
    lastName: 'Johnson',
    email: 'emily.johnson@email.com',
  },
  cdlInfo: {
    ...AUTO_COMPLETE_DATA.cdlInfo,
    cdlNumber: 'D987654321',
    cdlClass: 'B',
    endorsements: ['P'],
    restrictions: ['L'],
  },
  employmentHistory: [
    {
      company: 'Local Delivery Co.',
      position: 'Delivery Driver',
      startDate: '2023-06-01',
      endDate: '',
      reasonForLeaving: '',
      supervisorName: 'Lisa Brown',
      supervisorPhone: '(602) 555-0700',
      duties: 'Local package delivery and customer service.',
    },
  ],
  drivingRecord: {
    violations: [],
    accidents: [],
  },
  trainingRecords: [
    {
      trainingType: 'ELDT',
      trainingDate: '2023-05-01',
      trainingCompany: 'Phoenix CDL Training',
      certificateNumber: 'ELDT2023001',
      expirationDate: '',
    },
  ],
  drivingExperience: {
    equipmentTypes: {
      straightTruck: { years: 1, miles: 50000 },
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
}

/**
 * Helper function to fill application data with auto-complete
 */
export function fillApplicationWithAutoComplete(
  data: Partial<DriverApplicationData>,
  preset: 'clean' | 'with-issues' | 'new-driver' = 'clean'
): DriverApplicationData {
  let autoCompleteSource: DriverApplicationData

  switch (preset) {
    case 'with-issues':
      autoCompleteSource = AUTO_COMPLETE_DATA_WITH_ISSUES
      break
    case 'new-driver':
      autoCompleteSource = AUTO_COMPLETE_DATA_NEW_DRIVER
      break
    default:
      autoCompleteSource = AUTO_COMPLETE_DATA
  }

  // Deep merge the auto-complete data with any existing data
  return {
    ...autoCompleteSource,
    ...data,
    // Merge nested objects
    personalInfo: { ...autoCompleteSource.personalInfo, ...data.personalInfo },
    cdlInfo: { ...autoCompleteSource.cdlInfo, ...data.cdlInfo },
    drivingRecord: {
      ...autoCompleteSource.drivingRecord,
      ...data.drivingRecord,
    },
    medicalInfo: { ...autoCompleteSource.medicalInfo, ...data.medicalInfo },
    drugAlcoholTesting: {
      ...autoCompleteSource.drugAlcoholTesting,
      ...data.drugAlcoholTesting,
    },
    drivingExperience: {
      ...autoCompleteSource.drivingExperience,
      ...data.drivingExperience,
    },
    safetyCompliance: {
      ...autoCompleteSource.safetyCompliance,
      ...data.safetyCompliance,
    },
    authorizations: {
      ...autoCompleteSource.authorizations,
      ...data.authorizations,
    },
  }
}

/**
 * Quick fill functions for specific sections
 */
export const QuickFill = {
  personalInfo: () => AUTO_COMPLETE_DATA.personalInfo,
  cdlInfo: () => AUTO_COMPLETE_DATA.cdlInfo,
  employmentHistory: () => AUTO_COMPLETE_DATA.employmentHistory,
  drivingRecord: () => AUTO_COMPLETE_DATA.drivingRecord,
  medicalInfo: () => AUTO_COMPLETE_DATA.medicalInfo,
  drugAlcoholTesting: () => AUTO_COMPLETE_DATA.drugAlcoholTesting,
  trainingRecords: () => AUTO_COMPLETE_DATA.trainingRecords,
  drivingExperience: () => AUTO_COMPLETE_DATA.drivingExperience,
  safetyCompliance: () => AUTO_COMPLETE_DATA.safetyCompliance,
  references: () => AUTO_COMPLETE_DATA.references,
}
