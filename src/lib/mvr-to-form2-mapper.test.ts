import { describe, expect, it } from 'vitest'
import { parseAccioMvrResult } from '@/lib/accio-xml-parser'
import { mapMvrToForm2Rows } from '@/lib/mvr-to-form2-mapper'

/** Accio IL fixture — DRIVER VIOLATION blocks have no per-row `<state>`. */
const IL_VIOLATIONS_NO_STATE = `<ScreeningResults>
  <completeOrder number="17827455368517406">
    <subOrder type="MVR" filledStatus="filled">
      <dlnum>E36379678160</dlnum>
      <dlstate>IL</dlstate>
      <mvr_violation>
        <violation_type>DRIVER VIOLATION</violation_type>
        <description>SPEED</description>
        <violation_date>20250115</violation_date>
        <conviction_date>20250120</conviction_date>
        <state_points>2.00</state_points>
        <acd_code>S15</acd_code>
      </mvr_violation>
    </subOrder>
  </completeOrder>
</ScreeningResults>`

describe('mapMvrToForm2Rows', () => {
  it('fills stateOfViolation from MVR dlstate when violation has no state', () => {
    const parsed = parseAccioMvrResult(IL_VIOLATIONS_NO_STATE)
    expect(parsed.licenseState).toBe('IL')
    expect(parsed.violations?.[0]?.state).toBeUndefined()

    const { convictions } = mapMvrToForm2Rows(parsed)
    expect(convictions).toHaveLength(1)
    expect(convictions[0].stateOfViolation).toBe('IL')
    expect(convictions[0].violation).toMatch(/SPEED/i)
    expect(convictions[0]._source).toBe('mvr')
  })

  it('prefers per-violation state over license state', () => {
    const parsed = parseAccioMvrResult(IL_VIOLATIONS_NO_STATE)
    const withState = {
      ...parsed,
      violations: [{ ...(parsed.violations?.[0] ?? {}), state: 'OH' }],
    }
    const { convictions } = mapMvrToForm2Rows(withState)
    expect(convictions[0].stateOfViolation).toBe('OH')
  })
})
