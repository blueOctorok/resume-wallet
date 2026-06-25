import { describe, it, expect } from 'vitest'
import { parseAccioMvrResult, mvrResultToJsonb } from './accio-xml-parser'

/**
 * Regression fixture modeled on a real NC Accio fill (PII replaced).
 * It reproduces every June 2026 parser bug in one payload:
 *  - subject tag order with <name_lastmaiden/> and <city_of_birth/> BEFORE
 *    the real <name_last>/<city> tags (prefix-collision bug)
 *  - self-closing <dlexpiration/> before the real <dlexpiration> (self-closing
 *    collision bug that leaked the whole report into parsed fields)
 *  - NC split license format: description in <license_class>, letter in
 *    <license_code>, with &gt; entities
 *  - NC blank personal-characteristics columns adjacent to DOB/Iss/Exp columns
 *  - NC "CDL Medical Information" section (tabular self-cert + inline examiner)
 *  - NC "TOTAL STATE POINTS = 0" line
 */
const NC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ScreeningResults>
  <completeOrder number="17800000000000000" remote_number="60417" isactive="Y" archived="N" reviewed="N" reference_number="">
    <status>unknown</status>
    <time_ordered>2026-06-01 16:15:41</time_ordered>
    <time_filled>2026-06-01 18:23:59</time_filled>
    <subject>
      <name_lastmaiden/>
      <dlexpiration/>
      <country/>
      <city_of_birth/>
      <gender>U</gender>
      <dob>19650126</dob>
      <name_first>John</name_first>
      <name_middle/>
      <name_last>Tester</name_last>
      <email>john@example.com</email>
      <address>1 Test Lane</address>
      <city>Union Mills</city>
      <state>NC</state>
      <zip>28167</zip>
      <dlnum/>
      <dlstate/>
    </subject>
    <subOrder number="" remote_number="913148" description=" Motor Vehicle Report" remote_order="60417" remote_subOrder="913148" held_for_review="N" held_for_release_form="N" filledStatus="filled" filledCode="clear" type="MVR">
      <time_ordered>2026-06-01 16:15:41</time_ordered>
      <time_filled>2026-06-01 18:25:46</time_filled>
      <dlnum>4205109</dlnum>
      <dlstate>NC</dlstate>
      <dlexpiration/>
      <text>
________________________________________________________________________________
NORTH CAROLINA Driver Record - E33 Order Date: 06/01/2026
________________________________________________________________________________
License:  000004205109
Name:     TESTER, JOHN                      Report Clear:YES
As of:
________________________________________________________________________________
Sex :           Weight:             DOB     :                          AGE:
Eyes:           Height:             Iss Date: 10/19/2022
Hair:                               Exp Date: 01/26/2028
________________________________________________________________________________
 License and Permit Information
________________________________________________________________________________
License: COMMERCIAL     Issue:10/19/2022  Expire:01/26/2028  Status:VALID
       Class:A      COMBINE VEH &gt; 26K W/TRAILER &gt; 10K
         ENDORSEMENT: DOUBLE/TRIPLE TRAILERS
________________________________________________________________________________
 CDL Medical Information
________________________________________________________________________________
Self Certificate Type     Issued      Effective   Expiration  Downgraded
NON-EXCEPTED INTERSTATE   10/06/2025              10/06/2027
Status: CERTIFIED
Medical Examiner Name: REBECCA G FISCHER
Phone          License        State
828-652-1400   0010-02229     NC
Speciality: PHYSICIAN ASSISTANT                                        Registry Number: 7783787122
________________________________________________________________________________
 Miscellaneous State Data
________________________________________________________________________________
TOTAL STATE POINTS = 0
END OF DRIVING RECORD</text>
      <mvr_license>
        <license_issue_date>20221019</license_issue_date>
        <license_expiration_date>20280126</license_expiration_date>
        <license_class>COMBINE VEH &gt; 26K W/TRAILER &gt; 10K</license_class>
        <license_code>A</license_code>
        <license_type>COMMERCIAL</license_type>
        <license_status>VALID</license_status>
        <license_endorsements>DOUBLE/TRIPLE TRAILERS</license_endorsements>
        <license_restrictions/>
      </mvr_license>
      <dlexpiration>2028-01-26</dlexpiration>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

describe('parseAccioMvrResult — NC fixture regressions', () => {
  const parsed = parseAccioMvrResult(NC_XML)

  it('extracts clean subject fields despite prefix-colliding sibling tags', () => {
    expect(parsed.subject?.firstName).toBe('John')
    expect(parsed.subject?.lastName).toBe('Tester')
    expect(parsed.subject?.city).toBe('Union Mills')
    // The old regex captured raw XML walls here — make sure no tags leak.
    expect(parsed.subject?.lastName).not.toContain('<')
    expect(parsed.subject?.city).not.toContain('<')
  })

  it('skips self-closing <dlexpiration/> and finds the real value', () => {
    expect(parsed.licenseExpirationDate).toBe('2028-01-26')
  })

  it('uses license_code as the class letter for NC split format', () => {
    expect(parsed.licenses).toHaveLength(1)
    expect(parsed.licenses?.[0].class).toBe('A')
    expect(parsed.licenses?.[0].classDescription).toBe('COMBINE VEH > 26K W/TRAILER > 10K')
  })

  it('decodes XML entities in extracted values', () => {
    expect(parsed.licenses?.[0].classDescription).not.toContain('&gt;')
  })

  it('leaves blank personal characteristics unset instead of capturing neighbor columns', () => {
    const pc = parsed.personalCharacteristics
    expect(pc?.weight).toBeUndefined()
    expect(pc?.height).toBeUndefined()
    expect(pc?.hair).toBeUndefined()
    expect(pc?.sex).toBeUndefined()
    expect(pc?.eyes).toBeUndefined()
    // age is computed from <dob>, so the block still exists
    expect(typeof pc?.age).toBe('number')
  })

  it('parses the NC "CDL Medical Information" section', () => {
    expect(parsed.medicalCertStatus).toBe('CERTIFIED')
    expect(parsed.medicalCertIssueDate).toBe('10/06/2025')
    expect(parsed.medicalCertExpiration).toBe('10/06/2027')
    expect(parsed.medicalCertSelfCertification).toBe('NON-EXCEPTED INTERSTATE')
  })

  it('parses the NC inline medical examiner block', () => {
    expect(parsed.medicalExaminer?.name).toBe('REBECCA G FISCHER')
    expect(parsed.medicalExaminer?.phone).toBe('828-652-1400')
    expect(parsed.medicalExaminer?.licenseNumber).toBe('0010-02229')
    expect(parsed.medicalExaminer?.licenseJurisdiction).toBe('NC')
    expect(parsed.medicalExaminer?.nationalRegistryNumber).toBe('7783787122')
  })

  it('prefers the state-printed point total over the violation sum', () => {
    expect(parsed.totalPoints).toBe(0)
    expect(parsed.totalPointsSource).toBe('state')
  })

  it('serializes points provenance into JSONB', () => {
    const jsonb = mvrResultToJsonb(parsed) as { violations: { totalPointsSource?: string } }
    expect(jsonb.violations.totalPointsSource).toBe('state')
  })
})

describe('parseAccioMvrResult — combined-format licenses still work', () => {
  const COMBINED_XML = `<ScreeningResults>
  <completeOrder number="123" remote_number="9" reference_number="">
    <subOrder number="" remote_number="1" filledStatus="filled" filledCode="clear" type="MVR">
      <dlnum>AB123456</dlnum>
      <dlstate>OH</dlstate>
      <mvr_license>
        <license_issue_date>20250113</license_issue_date>
        <license_expiration_date>20271001</license_expiration_date>
        <license_class>B - CDL SINGLE VEH GVWR 26,001 OR MORE,UNDER 10K TOW</license_class>
        <license_code>REGULAR CDL LICENSE</license_code>
        <license_type>COMMERCIAL</license_type>
        <license_status>VALID</license_status>
      </mvr_license>
      <mvr_violation>
        <violation_type>DRIVER VIOLATION</violation_type>
        <description>SPEED</description>
        <violation_date>20260521</violation_date>
        <state_points>2.00</state_points>
        <acd_code>S93</acd_code>
        <vendor_points/>
      </mvr_violation>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

  const parsed = parseAccioMvrResult(COMBINED_XML)

  it('keeps the letter from a combined "B - DESCRIPTION" class field', () => {
    expect(parsed.licenses?.[0].class).toBe('B')
    expect(parsed.licenses?.[0].classDescription).toBe(
      'CDL SINGLE VEH GVWR 26,001 OR MORE,UNDER 10K TOW',
    )
  })

  it('falls back to summed violation points when no state total is printed', () => {
    expect(parsed.totalPoints).toBe(2)
    expect(parsed.totalPointsSource).toBe('computed')
    expect(parsed.violations?.[0].points).toBe(2)
  })
})

/**
 * IL fixture modeled on Shane Edwards (Key order 61667 / Storm 0934a4be).
 * Accio nests violations, suspensions, and admin notices in `<mvr_violation>`
 * with different violation_type values — only DRIVER VIOLATION is a true violation.
 */
describe('parseAccioMvrResult — IL violation_type routing (Edwards)', () => {
  const IL_EDWARDS_XML = `<ScreeningResults>
  <completeOrder number="17816985245894063" remote_number="61667">
    <subOrder type="MVR" filledStatus="filled" filledCode="discrepancy">
      <dlnum>E36379678160</dlnum>
      <dlstate>IL</dlstate>
      <mvr_violation>
        <violation_type>DRIVER VIOLATION</violation_type>
        <description>SPEEDING 15-25 MPH ABOVE LIMIT</description>
        <violation_date>20200207</violation_date>
        <conviction_date>20200305</conviction_date>
        <acd_code>S15</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER VIOLATION</violation_type>
        <description>SPEEDING 15-25 MPH ABOVE LIMIT</description>
        <violation_date>20200814</violation_date>
        <conviction_date>20210315</conviction_date>
        <acd_code>S15</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER VIOLATION</violation_type>
        <description>SPEEDING 15-25 MPH ABOVE LIMIT</description>
        <violation_date>20210708</violation_date>
        <conviction_date>20210809</conviction_date>
        <acd_code>S15</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER VIOLATION</violation_type>
        <description>SPEEDING 15-25 MPH ABOVE LIMIT</description>
        <violation_date>20211027</violation_date>
        <conviction_date>20220110</conviction_date>
        <acd_code>S15</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER SUSPENSION</violation_type>
        <description>DOCUMENT TO CLEAR, FR FILED</description>
        <violation_date>20220909</violation_date>
        <reinstatement_date>20230518</reinstatement_date>
        <acd_code>ACCA</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER OTHER INFORMATION</violation_type>
        <description>TEMPORARY DRIVER'S LICENSE</description>
        <violation_date>20200617</violation_date>
        <reinstatement_date>20200915</reinstatement_date>
        <acd_code>INFO</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER OTHER INFORMATION</violation_type>
        <description>TEMPORARY DRIVER'S LICENSE</description>
        <violation_date>20230720</violation_date>
        <reinstatement_date>20231018</reinstatement_date>
        <acd_code>INFO</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER OTHER INFORMATION</violation_type>
        <description>TEMPORARY DRIVER'S LICENSE</description>
        <violation_date>20240424</violation_date>
        <reinstatement_date>20240723</reinstatement_date>
        <acd_code>INFO</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER FR FUTURE PROOF REQUIRED</violation_type>
        <description>F.R. FUTURE PROOF FILINGS COMPLETED</description>
        <violation_date>20260511</violation_date>
        <acd_code>INFO</acd_code>
      </mvr_violation>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

  const parsed = parseAccioMvrResult(IL_EDWARDS_XML)

  it('counts only DRIVER VIOLATION blocks as violations (Key: 4)', () => {
    expect(parsed.violationCount).toBe(4)
    expect(parsed.violations).toHaveLength(4)
    expect(parsed.violations?.every((v) => v.type === 'DRIVER VIOLATION')).toBe(true)
  })

  it('routes suspensions and FR filings out of violations (Key: 2)', () => {
    expect(parsed.suspensionCount).toBe(2)
    expect(parsed.suspensions?.map((s) => s.reason)).toEqual([
      'DOCUMENT TO CLEAR, FR FILED',
      'F.R. FUTURE PROOF FILINGS COMPLETED',
    ])
    expect(parsed.suspensions?.[0].endDate).toBe('20230518')
  })

  it('keeps temp-license admin notices in additionalDriverInfo, not violations', () => {
    expect(parsed.additionalDriverInfo).toHaveLength(3)
    expect(parsed.additionalDriverInfo?.every((i) => i.type === 'DRIVER OTHER INFORMATION')).toBe(
      true,
    )
  })

  it('serializes the corrected counts into JSONB', () => {
    const jsonb = mvrResultToJsonb(parsed) as {
      violations: { count: number }
      suspensions: { count: number }
      additionalDriverInfo: unknown[]
    }
    expect(jsonb.violations.count).toBe(4)
    expect(jsonb.suspensions.count).toBe(2)
    expect(jsonb.additionalDriverInfo).toHaveLength(3)
  })
})
