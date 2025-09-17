# DriverAppChain Application Requirements Document

## Blockchain-Powered CDL Driver Application System

---

## 1. Core Application Structure

### 1.1 Personal Information Module

**Required Fields:**

- Full Name (First, Middle Initial, Last)
- Current Address
- City, State, ZIP
- Phone Numbers (Primary & Cell)
- Email Address
- Date of Birth
- Social Security Number (encrypted storage)
- Preferred Contact Method
- Emergency Contact Information

**Residence Verification:**

- Current address duration (3+ years requirement)
- Previous addresses if less than 3 years

### 1.2 CDL License Information

**Required Data:**

- CDL License Number
- Issuing State/Authority
- License Class (A, B, or C)
- Expiration Date
- DOT Medical Card Expiration
- Endorsements (Hazmat, Tanker, Doubles/Triples, etc.)
- Restrictions (if any)
- TWIC Card Status & Expiration

### 1.3 Employment History Module

**For Each Employment Record:**

- Company Name
- Start Date / End Date
- Address & Contact Information
- Position Held
- Reason for Leaving
- Termination Status (Yes/No with explanation)
- Equipment Operated
- Areas/Routes Driven
- Weekly Mileage
- Subject to DOT Regulations (Yes/No)
- Drug/Alcohol Testing Program Participation

**Unemployment Gaps:**

- Start/End Dates
- Explanation/Activity during gap

### 1.4 Driving Experience Categories

**Equipment Types to Track:**

- Straight Truck
- Tractor-Trailer
- Tractor with Two Trailers
- Specialized Equipment (flatbed, reefer, tanker, etc.)
- Years of experience per type
- Total miles driven

**Special Skills:**

- Moffett/Forklift Experience
- Crane Operations
- Hazmat Handling
- Border Crossing Experience

### 1.5 Safety & Compliance Records

**Accident History (5-Year Requirement):**

- Date of Accident
- Type (Injury/Non-Injury/Fatality)
- Commercial Vehicle (Yes/No)
- DOT Recordable (Yes/No)
- At Fault Determination
- Citation Issued
- Description

**Traffic Violations (3-Year Requirement):**

- Violation Date
- Charge/Description
- State/Province
- Commercial Vehicle (Yes/No)
- Fine Amount
- License Impact (Suspended/Revoked)

**Compliance Questions:**

- FMCSR 391.15 Disqualification Status
- License Suspension/Revocation History
- DOT Clearinghouse Prohibitions
- Positive Drug/Alcohol Test History
- DUI/DWI Convictions
- Felony Involving Commercial Vehicle

---

## 2. Blockchain Architecture

### 2.1 On-Chain Storage (Smart Contract)

```
- Application Hash (SHA-256 of complete application)
- Verification Timestamps
- Employment Verification Signatures
- License Status Boolean Flags
- Compliance Status Indicators
- Version Control Hash
- Access Control Permissions
```

### 2.2 Off-Chain Storage (IPFS/Database)

```
- Complete Application Details
- Personal Information (Encrypted)
- Detailed Employment Records
- Supporting Documents
- Reference Letters
- Training Certificates
```

### 2.3 Smart Contract Functions

```solidity
Key Functions:
- submitApplication()
- updateApplication()
- requestVerification()
- confirmEmployment()
- toggleVisibility()
- grantAccess()
- revokeAccess()
```

---

## 3. Enhanced Features for Blockchain Implementation

### 3.1 Verification System

**Multi-Party Verification:**

- Previous Employer Attestations
- DOT Compliance Verification
- Reference Confirmations
- Training School Verification
- Background Check Integration

### 3.2 Privacy Controls

**User-Controlled Visibility:**

- Public/Private Toggle
- Selective Disclosure Options
- Time-Limited Access Grants
- Employer-Specific Permissions
- Audit Trail of Access

### 3.3 Automation Features

**AI-Powered Enhancements:**

- Auto-Population from Previous Applications
- Intelligent Job Matching Score
- Compliance Status Monitoring
- Application Completeness Checker
- Real-Time Verification Status

---

## 4. Database Schema Overview

### 4.1 Core Tables

```sql
Users Table:
- id (Primary Key)
- wallet_address (Unique)
- email
- created_at
- updated_at

Applications Table:
- id (Primary Key)
- user_id (Foreign Key)
- ipfs_hash
- blockchain_tx_hash
- version
- status
- visibility

Employment_Records Table:
- id (Primary Key)
- application_id (Foreign Key)
- company_name
- start_date
- end_date
- position
- verified_status
- verification_tx_hash

Compliance_Records Table:
- id (Primary Key)
- user_id (Foreign Key)
- clearinghouse_status
- last_check_date
- cdl_valid
- medical_card_expiry
```

---

## 5. User Experience Improvements

### 5.1 Application Flow

1. **Account Creation**
   - Wallet connection or email signup
   - Basic profile setup
   - Privacy preferences

2. **Progressive Form Completion**
   - Save and continue functionality
   - Section-by-section validation
   - Progress indicator
   - Auto-save every 30 seconds

3. **Document Management**
   - Drag-and-drop upload
   - OCR for automatic field population
   - Document versioning
   - Secure storage with encryption

4. **Verification Process**
   - One-click verification requests
   - Real-time status updates
   - Notification system
   - Verification dashboard

### 5.2 Mobile-First Design

- Responsive forms
- Touch-optimized inputs
- Offline capability with sync
- Camera integration for documents
- Biometric authentication

---

## 6. Compliance & Legal Requirements

### 6.1 Required Authorizations

- FCRA Disclosure and Authorization
- Background Check Consent
- Drug/Alcohol Testing Consent
- Previous Employer Contact Authorization
- PSP (Pre-Employment Screening Program) Consent
- Clearinghouse Query Consent

### 6.2 Data Protection

- GDPR/CCPA Compliance
- Right to Delete
- Data Portability
- Encryption at Rest and in Transit
- Access Logs and Audit Trails

---

## 7. Integration Points

### 7.1 External Systems

- DOT Clearinghouse API
- FMCSA PSP System
- State DMV Systems
- Background Check Providers
- Drug Testing Laboratories
- Previous Employer Verification Systems

### 7.2 Blockchain Integrations

- Polygon Network for Low Gas Fees
- IPFS for Distributed Storage
- ENS for Human-Readable Addresses
- Chainlink for Oracle Services
- TheGraph for Indexing

---

## 8. Revenue Model Considerations

### 8.1 Driver Services

- Free Basic Profile
- Premium Features ($5-15/month)
  - Priority Verification
  - Advanced Analytics
  - Multiple Active Applications
  - AI Job Matching

### 8.2 Employer Services

- Per-Verification Fee ($1-5)
- Monthly Subscription ($29-199)
  - Bulk Verification
  - Advanced Search
  - API Access
  - Analytics Dashboard

### 8.3 Transaction Fees

- Minimal Gas Fees (Polygon)
- Verification Processing ($0.50-2.00)
- Document Storage (IPFS Pinning)

---

## 9. Development Priorities

### Phase 1 (MVP)

- Basic application submission
- IPFS storage integration
- Simple verification workflow
- Wallet authentication

### Phase 2

- Employer dashboard
- Verification system
- Privacy controls
- Mobile optimization

### Phase 3

- AI features
- Advanced analytics
- Multi-chain support
- API marketplace

---

## 10. Success Metrics

### Key Performance Indicators

- Application Completion Rate
- Verification Turnaround Time
- User Acquisition Cost
- Platform Adoption Rate
- Verification Accuracy
- User Satisfaction Score
- Cost Per Transaction
- Revenue Per User

---

## Appendix A: Field Validation Rules

### Personal Information

- Name: Required, 2-50 characters
- Email: Valid email format
- Phone: 10-digit US format
- SSN: 9 digits, encrypted storage
- DOB: Must be 21+ years old for CDL

### Employment Records

- Dates: No future dates, no overlaps
- Gaps: Explanation required for gaps > 30 days
- Minimum: 3 years history required

### License Information

- CDL Number: State-specific format validation
- Expiration: Must be current or within 30 days
- Medical Card: Cannot expire before CDL

---

## Appendix B: Error Messages & User Guidance

### Common Validation Messages

- "Please provide at least 3 years of employment history"
- "Medical card expiration cannot be before CDL expiration"
- "This field is required for DOT compliance"
- "Please explain any employment gaps longer than 30 days"

### Help Text Examples

- "Your CDL number can be found on your commercial driver's license"
- "List all employers for the past 3 years, even if not driving positions"
- "Include month and year for all dates"

---

_This document serves as the foundation for building the DriverAppChain blockchain-based application system. All personal identifying information has been removed and replaced with generic field requirements._
