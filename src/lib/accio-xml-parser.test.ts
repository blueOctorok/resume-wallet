import { describe, it, expect, vi } from 'vitest'
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

/**
 * Regression fixture for the Sept 2026 "MVRs never show accidents" bug.
 *
 * The parser looked for a dedicated `<mvr_accident>` element that Accio has
 * never sent — 0 of 1,084 stored payloads contained one. Accidents actually
 * arrive as `<mvr_violation>` with violation_type `DRIVER ACCIDENT` or `ACCD`,
 * and the classifier's catch-all filed them under additionalDriverInfo, so
 * every MVR reported accidentCount 0.
 *
 * Every block below is a real production shape, including the ACD-code spread
 * (ACC / U32 / empty / '-') that makes violation_type the only safe signal.
 */
describe('parseAccioMvrResult — accidents arrive as mvr_violation blocks', () => {
  const ACCIDENT_XML = `<ScreeningResults>
  <completeOrder number="17800000000000001" remote_number="61999">
    <subOrder type="MVR" filledStatus="filled" filledCode="discrepancy">
      <dlnum>A12345678</dlnum>
      <dlstate>OH</dlstate>
      <mvr_violation>
        <violation_type>DRIVER ACCIDENT</violation_type>
        <description>ACCIDENT - MOVING</description>
        <violation_date>20210726</violation_date>
        <acd_code>ACC</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER ACCIDENT</violation_type>
        <description>D-CALIFORNIA ACCIDENT (REPORTED BY CHP)</description>
        <violation_date>20220803</violation_date>
        <acd_code>U32</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>ACCD</violation_type>
        <description>** ACCIDENT **</description>
        <violation_date>20241210</violation_date>
        <acd_code>-</acd_code>
      </mvr_violation>
      <mvr_violation>
        <violation_type>ACCD</violation_type>
        <description>INJURY ACCIDENT</description>
        <violation_date>20251113</violation_date>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER VIOLATION</violation_type>
        <description>FAIL TO CONTROL - ACC</description>
        <violation_date>20250301</violation_date>
        <conviction_date>20250402</conviction_date>
        <acd_code>ACC</acd_code>
        <points>2</points>
      </mvr_violation>
      <mvr_violation>
        <violation_type>DRIVER OTHER INFORMATION</violation_type>
        <description>TEMPORARY DRIVER'S LICENSE</description>
        <violation_date>20240424</violation_date>
        <acd_code>INFO</acd_code>
      </mvr_violation>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

  const parsed = parseAccioMvrResult(ACCIDENT_XML)

  it('extracts accidents from DRIVER ACCIDENT and ACCD blocks', () => {
    expect(parsed.accidentCount).toBe(4)
    expect(parsed.accidents).toHaveLength(4)
    expect(parsed.accidents?.map((a) => a.date)).toEqual([
      '20210726',
      '20220803',
      '20241210',
      '20251113',
    ])
    expect(parsed.accidents?.[0].description).toBe('ACCIDENT - MOVING')
    expect(parsed.accidents?.[3].description).toBe('INJURY ACCIDENT')
  })

  it('classifies on violation_type, not the ACD code', () => {
    // A state that codes a crash as a moving violation sends DRIVER VIOLATION
    // with ACD 'ACC' — that stays a violation and keeps its points.
    expect(parsed.violationCount).toBe(1)
    expect(parsed.violations?.[0].description).toBe('FAIL TO CONTROL - ACC')
    expect(parsed.totalPoints).toBe(2)
  })

  it('stops filing accidents under additionalDriverInfo', () => {
    expect(parsed.additionalDriverInfo).toHaveLength(1)
    expect(parsed.additionalDriverInfo?.[0].type).toBe('DRIVER OTHER INFORMATION')
  })

  it('leaves severity and fault unset rather than guessing from description', () => {
    expect(parsed.accidents?.every((a) => a.severity === undefined)).toBe(true)
    expect(parsed.accidents?.every((a) => a.fault === undefined)).toBe(true)
  })

  it('serializes accidents into JSONB for mvr_results', () => {
    const jsonb = mvrResultToJsonb(parsed) as {
      accidents: { count: number; details: unknown[] }
    }
    expect(jsonb.accidents.count).toBe(4)
    expect(jsonb.accidents.details).toHaveLength(4)
  })
})

/**
 * The tripwire that was missing. Accidents sat in the catch-all for two years
 * because an unrecognized `violation_type` and a deliberately-informational one
 * were indistinguishable. These assert the log fires for genuinely new vendor
 * values and stays quiet for the DMV record types we've already triaged.
 */
describe('parseAccioMvrResult — unrecognized violation_type telemetry', () => {
  function xmlWithType(violationType: string): string {
    return `<ScreeningResults>
  <completeOrder number="1" remote_number="1">
    <subOrder type="MVR" filledStatus="filled" filledCode="clear">
      <dlnum>C11111111</dlnum>
      <dlstate>OH</dlstate>
      <text>OHIO Driver Record</text>
      <mvr_violation>
        <violation_type>${violationType}</violation_type>
        <description>SOMETHING THE DMV SENT</description>
        <violation_date>20250101</violation_date>
      </mvr_violation>
    </subOrder>
  </completeOrder>
</ScreeningResults>`
  }

  it('warns when a violation_type matches no branch and no known type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const parsed = parseAccioMvrResult(xmlWithType('DRIVER TELEMATICS EVENT'))

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('DRIVER TELEMATICS EVENT')
    // Still filed conservatively — a new type must not inflate violations.
    expect(parsed.violationCount).toBe(0)
    expect(parsed.additionalDriverInfo).toHaveLength(1)
    warn.mockRestore()
  })

  it('stays quiet for DMV record types already triaged as informational', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const t of ['DRIVER ID CARD', 'DRIVER POINT CREDIT', 'DEPARTMENTAL']) {
      parseAccioMvrResult(xmlWithType(t))
    }
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('stays quiet for types that do match a category', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const t of ['DRIVER ACCIDENT', 'ACCD', 'DRIVER VIOLATION', 'DRIVER SUSPENSION']) {
      parseAccioMvrResult(xmlWithType(t))
    }
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('parseAccioMvrResult — clean records report no accidents', () => {
  const CLEAN_XML = `<ScreeningResults>
  <completeOrder number="17800000000000002" remote_number="62000">
    <subOrder type="MVR" filledStatus="filled" filledCode="clear">
      <dlnum>B87654321</dlnum>
      <dlstate>OH</dlstate>
      <text>
 Violations/Convictions And Failures to Appear And Accidents
 ** NONE TO REPORT ***
      </text>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

  it('does not invent accidents from the report text heading', () => {
    const parsed = parseAccioMvrResult(CLEAN_XML)
    expect(parsed.accidentCount).toBe(0)
    expect(parsed.accidents).toEqual([])
  })
})

/**
 * MA fixture modeled on the Oct 2026 Key-vs-Provven parity incident (PII
 * replaced). Key's report showed the suspension *cleared* on 09/03/26, the
 * state's "VALID LICENSE ... OVERRIDES" disclaimer, the DMV's name-on-record,
 * and "Report Clear: NO" — all of which exist only in the text block Storm was
 * discarding. Our report implied an open suspension on a driver Pace was hiring.
 */
describe('parseAccioMvrResult — verbatim DMV record is preserved (MA parity)', () => {
  const MA_TEXT = `________________________________________________________________________________
MASSACHUSETTS Driver Record - E335 Order Date: 09/30/2026
________________________________________________________________________________
                                            Bill Code:
Host Used: Online                           Reference:REVGRP:67396:935098
License:  S12345678
Name:     DOE, JOHN Q                       Report Clear:NO
Address:
City, St:
As of:
________________________________________________________________________________
Sex :           Weight:             DOB     :                          AGE:
Eyes:           Height:             Iss Date: 09/03/2026
Hair:                               Exp Date: 08/01/2029
________________________________________________________________________________
                                                   STATUS: VALID
________________________________________________________________________________
Violations/Convictions And Failures to Appear And Accidents
________________________________________________________________________________
                              ** NONE TO REPORT ***
________________________________________________________________________________
 Suspensions/Revocations
________________________________________________________________________________
ACTIONS     ORD/DATE    EFF/DATE    CLR/DATE    END/DATE    CODE    AVD
________________________________________________________________________________
SUSPENSION              08/17/26    09/03/26                D56     DE15
            DESCRIPTION: FAILURE TO PAY FINES
________________________________________________________________________________
 License and Permit Information
________________________________________________________________________________
License: COMMERCIAL     Issue:09/03/2026  Expire:08/01/2029  Status:VALID
       Class:A      ANY COMBO VEH &gt; 26,001 LBS GVWR.  TOWING A VEH &gt; 10,000 LBS
________________________________________________________________________________
 Miscellaneous State Data
________________________________________________________________________________
A VALID LICENSE INDICATES VALID PRIVILEGES TO DRIVE WITH THAT LICENSE TYPE AND
OVERRIDES ANY REPORTED PRIOR ACTIONS INCLUDING SUSPENSIONS, CANCELLATIONS AND
DISQUALIFICATIONS.
END OF DRIVING RECORD`

  const MA_XML = `<ScreeningResults>
  <completeOrder number="17908022306810144" remote_number="67396">
    <subOrder remote_number="935098" description=" Motor Vehicle Report" filledStatus="filled" filledCode="hits">
      <dlnum>S12345678</dlnum>
      <dlstate>MA</dlstate>
      <text>
${MA_TEXT}</text>
      <mvr_violation>
        <violation_type>SUSPENSION</violation_type>
        <description>FAILURE TO PAY FINES</description>
        <violation_date>20260817</violation_date>
        <state_code>D56</state_code>
        <avd_code>DE15</avd_code>
        <acd_code>D56</acd_code>
      </mvr_violation>
      <mvr_license>
        <license_issue_date>20260903</license_issue_date>
        <license_expiration_date>20290801</license_expiration_date>
        <license_class>ANY COMBO VEH &gt; 26,001 LBS GVWR.  TOWING A VEH &gt; 10,000 LBS</license_class>
        <license_code>A</license_code>
        <license_type>COMMERCIAL</license_type>
        <license_status>VALID</license_status>
      </mvr_license>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

  const parsed = parseAccioMvrResult(MA_XML)

  it('keeps the entire DMV record verbatim, with entities decoded', () => {
    expect(parsed.dmvRecordText).toBeDefined()
    // Every line the DMV sent is present — including the ones no structured field covers.
    expect(parsed.dmvRecordText).toContain('OVERRIDES ANY REPORTED PRIOR ACTIONS INCLUDING SUSPENSIONS')
    expect(parsed.dmvRecordText).toContain('Reference:REVGRP:67396:935098')
    expect(parsed.dmvRecordText).toContain('END OF DRIVING RECORD')
    expect(parsed.dmvRecordText).toContain('ANY COMBO VEH > 26,001 LBS GVWR')
    expect(parsed.dmvRecordText).not.toContain('&gt;')
    // Layout preserved: the fixed-width suspension table row survives intact.
    expect(parsed.dmvRecordText).toContain(
      'SUSPENSION              08/17/26    09/03/26                D56     DE15',
    )
  })

  it('reads the DMV name-on-record and Report Clear flag from the header', () => {
    expect(parsed.dmvRecordName).toBe('DOE, JOHN Q')
    expect(parsed.reportClear).toBe(false)
  })

  it('attaches the text-table clear date and codes to the structured suspension', () => {
    expect(parsed.suspensions).toHaveLength(1)
    const [s] = parsed.suspensions!
    expect(s.date).toBe('20260817')
    expect(s.clearedDate).toBe('20260903')
    expect(s.endDate).toBeUndefined()
    expect(s.acdCode).toBe('D56')
    expect(s.avdCode).toBe('DE15')
  })

  it('has no mismatch alerts on a clean-identity report', () => {
    expect(parsed.mismatchAlerts).toBeUndefined()
  })

  it('serializes the small header facts but not the full text into JSONB', () => {
    const jsonb = mvrResultToJsonb(parsed) as Record<string, unknown>
    expect(jsonb.reportClear).toBe(false)
    expect(jsonb.dmvRecordName).toBe('DOE, JOHN Q')
    expect(jsonb.mismatchAlerts).toEqual([])
    expect(jsonb).not.toHaveProperty('dmvRecordText')
  })
})

describe('parseAccioMvrResult — mismatch alerts explain a discrepancy', () => {
  const DISCREPANCY_XML = `<ScreeningResults>
  <completeOrder number="17900000000000001" remote_number="66965">
    <subOrder type="MVR" filledStatus="filled" filledCode="discrepancy">
      <dlnum>36358638</dlnum>
      <dlstate>TX</dlstate>
      <text>
____________________________________________________________________________________________________
   NOTES
____________________________________________________________________________________________________
**** MA-Mismatch Alerts: ****
Order parameter Last name (SMITH) did not match
Order parameter Date of Birth (01-01-1987) did not match
____________________________________________________________________________________________________
Report Clear: NO
                                         Bill Code:
Host Used: Online                        Reference:66965-933510
License: 36358638
Name: SMYTHE, JOHN JR
Address: 1 MAIN ST
      </text>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

  const parsed = parseAccioMvrResult(DISCREPANCY_XML)

  it('lists each alert line so the UI can say what did not match', () => {
    expect(parsed.mismatchAlerts).toEqual([
      'Order parameter Last name (SMITH) did not match',
      'Order parameter Date of Birth (01-01-1987) did not match',
    ])
  })

  it('still captures the DMV name-on-record when the header has no column gap', () => {
    expect(parsed.dmvRecordName).toBe('SMYTHE, JOHN JR')
    expect(parsed.reportClear).toBe(false)
  })

  it('withdrawal rows with "-" codes do not get a bogus ACD code', () => {
    const xml = `<ScreeningResults><completeOrder number="2" remote_number="2">
    <subOrder type="MVR" filledStatus="filled" filledCode="hits">
      <dlnum>X1</dlnum><dlstate>IL</dlstate>
      <text>
ACTIONS     ORD/DATE    EFF/DATE    CLR/DATE    END/DATE    CODE    AVD
________________________________________________________________________________
WITHDRAWAL              11/01/23    10/21/25                -       DH02
            DESCRIPTION: FAILED TO MAINTAIN MEDICAL CERTIFIC
WITHDRAWAL              08/05/23    10/21/25                -       DH02
            DESCRIPTION: FAILED TO MAINTAIN MEDICAL CERTIFIC
________________________________________________________________________________
      </text>
      <mvr_violation><violation_type>DRIVER SUSPENSION</violation_type><description>FAILED TO MAINTAIN MEDICAL CERTIFIC</description><violation_date>20231101</violation_date></mvr_violation>
      <mvr_violation><violation_type>DRIVER SUSPENSION</violation_type><description>FAILED TO MAINTAIN MEDICAL CERTIFIC</description><violation_date>20230805</violation_date></mvr_violation>
    </subOrder></completeOrder></ScreeningResults>`
    const p = parseAccioMvrResult(xml)
    expect(p.suspensions).toHaveLength(2)
    expect(p.suspensions!.map((s) => s.clearedDate)).toEqual(['20251021', '20251021'])
    expect(p.suspensions!.every((s) => s.acdCode === undefined)).toBe(true)
    expect(p.suspensions!.every((s) => s.avdCode === 'DH02')).toBe(true)
  })
})
