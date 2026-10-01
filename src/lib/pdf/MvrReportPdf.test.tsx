import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { MvrReportPdf, type MvrReportPdfMeta } from './MvrReportPdf'
import type { ParsedMvrResult } from '@/lib/accio-xml-parser'

/**
 * Guards the contract behind the Oct 2026 Key-parity fix: the MVR PDF must
 * print the DMV's record verbatim. If someone "tidies" the report and drops
 * the Full DMV Record section, this fails — the summary tables are allowed to
 * be incomplete, the record is not allowed to be missing.
 */

const DMV_TEXT = `MASSACHUSETTS Driver Record - E335 Order Date: 09/30/2026
Name:     DOE, JOHN Q                       Report Clear:NO
ACTIONS     ORD/DATE    EFF/DATE    CLR/DATE    END/DATE    CODE    AVD
SUSPENSION              08/17/26    09/03/26                D56     DE15
A VALID LICENSE INDICATES VALID PRIVILEGES TO DRIVE WITH THAT LICENSE TYPE AND
OVERRIDES ANY REPORTED PRIOR ACTIONS INCLUDING SUSPENSIONS, CANCELLATIONS AND
END OF DRIVING RECORD`

const parsed: ParsedMvrResult = {
  orderNumber: '17908022306810144',
  subOrderNumber: '935098',
  remoteOrderNumber: '67396',
  timeOrdered: '2026-09-30 17:03:00',
  timeFilled: '2026-09-30 17:27:00',
  filledStatus: 'filled',
  filledCode: 'hits',
  subject: { firstName: 'John', lastName: 'Doe', dateOfBirth: '19660801', ssn: '123450654' },
  licenseNumber: 'S12345678',
  licenseState: 'MA',
  licenseExpirationDate: '2029-08-01',
  licenses: [
    {
      issueDate: '20260903',
      expirationDate: '20290801',
      class: 'A',
      classDescription: 'ANY COMBO VEH > 26,001 LBS GVWR.  TOWING A VEH > 10,000 LBS',
      type: 'COMMERCIAL',
      status: 'VALID',
    },
  ],
  violations: [],
  accidents: [],
  suspensions: [
    { date: '20260817', reason: 'FAILURE TO PAY FINES', clearedDate: '20260903', acdCode: 'D56', avdCode: 'DE15' },
  ],
  dmvRecordText: DMV_TEXT,
  dmvRecordName: 'DOE, JOHN Q',
  reportClear: false,
  mismatchAlerts: ['Order parameter Last name (DOE) did not match'],
}

const meta: MvrReportPdfMeta = {
  stormOrderId: '3300d880-0000-0000-0000-000000000000',
  candidateName: 'John Doe',
  generatedAtIso: '2026-10-01T16:03:00.000Z',
  preparedFor: { name: 'Example Carrier Inc', addressLines: ['1 Fleet Way', 'Cleveland, OH 44114'] },
  requestedBy: { name: 'HR Desk', email: 'hr@example.com' },
}

/** Walk the React element tree and collect every string child. */
function collectText(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out))
    return out
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: unknown }>
    // Expand our own function components so their output is visible too.
    if (typeof el.type === 'function') {
      const rendered = (el.type as (p: unknown) => unknown)(el.props)
      return collectText(rendered, out)
    }
    return collectText(el.props.children, out)
  }
  return out
}

describe('MvrReportPdf', () => {
  const text = collectText(<MvrReportPdf parsed={parsed} meta={meta} />).join('\n')

  it('prints every line of the DMV record verbatim', () => {
    for (const line of DMV_TEXT.split('\n')) {
      expect(text).toContain(line)
    }
  })

  it('surfaces the facts the summary used to drop', () => {
    expect(text).toContain('DOE, JOHN Q') // name on DMV record
    expect(text).toContain('Order parameter Last name (DOE) did not match')
    expect(text).toContain('COMMERCIAL')
    expect(text).toContain('A — ANY COMBO VEH > 26,001 LBS GVWR.  TOWING A VEH > 10,000 LBS')
    expect(text).toContain('D56 / DE15')
    expect(text).toContain('09/03/2026') // cleared date
  })

  it('frames the document as a consumer report', () => {
    expect(text).toContain('Example Carrier Inc')
    expect(text).toContain('Key Background Screening, Inc.')
    expect(text).toContain('Motor Vehicle Report in Massachusetts for John Doe')
    expect(text).toContain('Complete — Hits found')
    expect(text).toContain('A Summary of Your Rights Under the Fair Credit Reporting Act')
  })

  it('masks DOB year and SSN, and formats ISO license expiry like the rest of the page', () => {
    expect(text).toContain('08/01/XXXX')
    expect(text).not.toContain('08/01/1966')
    expect(text).toContain('XXX-XX-0654')
    expect(text).not.toContain('123450654')
    expect(text).toContain('08/01/2029')
    expect(text).not.toContain('2029-08-01')
  })

  it('renders to a real PDF without throwing', async () => {
    const element = (<MvrReportPdf parsed={parsed} meta={meta} />) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)
    expect(buffer.byteLength).toBeGreaterThan(10_000)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  }, 30_000)
})
