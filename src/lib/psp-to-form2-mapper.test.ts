import { describe, expect, it } from 'vitest'
import { mergeMvrRowsIntoForm2, mergePspRowsIntoForm2 } from '@/lib/dot-field-provenance'
import { mapPspToForm2Rows } from '@/lib/psp-to-form2-mapper'
import type { ParsedPspResult } from '@/lib/accio-psp-parser'

describe('PSP → Form 2', () => {
  it('maps crashes to accident rows and inspections to inspection rows', () => {
    const psp: ParsedPspResult = {
      orderNumber: '1',
      subOrderNumber: '2',
      crashes: [
        {
          date: '20210615',
          city: 'Columbus',
          state: 'OH',
          fatalities: 0,
          injuries: 1,
          towAway: true,
        },
      ],
      inspections: [
        {
          date: '20220301',
          reportNumber: 'INSP-1',
          level: '2',
          state: 'OH',
          outOfService: false,
          violations: [{ code: '393.9', description: 'Inoperative lamp' }],
        },
      ],
      crashCount: 1,
      inspectionCount: 1,
      oosCount: 0,
      rawXml: '',
    }
    const mapped = mapPspToForm2Rows(psp)
    expect(mapped.crashesAsAccidents).toHaveLength(1)
    expect(mapped.crashesAsAccidents[0]._source).toBe('psp')
    expect(mapped.crashesAsAccidents[0].atFault).toBe('') // PSP never assigns fault
    expect(mapped.inspections).toHaveLength(1)
    expect(mapped.inspections[0].violationSummary).toContain('Inoperative lamp')
  })

  it('does not copy MVR or PSP crashes onto the accident list', () => {
    const withMvr = mergeMvrRowsIntoForm2(
      null,
      [
        {
          date: '2020-01-01',
          nature: 'MVR accident',
          fatalities: '',
          injuries: '',
          chemicalSpills: '',
          atFault: 'yes',
          _source: 'mvr',
          _mvrKey: 'a1',
        },
      ],
      [],
      {
        mvrResultId: 'mvr-1',
        asOf: '2026-07-01T00:00:00.000Z',
        accioOrderNumber: 'MVR-1',
      },
    )

    const withBoth = mergePspRowsIntoForm2(
      withMvr,
      [
        {
          date: '2021-06-15',
          nature: 'PSP crash',
          fatalities: '0',
          injuries: '0',
          chemicalSpills: '',
          atFault: '',
          _source: 'psp',
          _pspKey: 'c1',
        },
      ],
      [],
      {
        pspResultId: 'psp-1',
        asOf: '2026-07-12T00:00:00.000Z',
        accioOrderNumber: 'PSP-1',
      },
    )

    const filled = (withBoth.accidents ?? []).filter((row) => row.date || row.nature)
    expect(filled).toEqual([])
    expect(withBoth.hasNoAccidents).toBe(false)
    expect(withBoth._rowProvenance?.mvrResultId).toBe('mvr-1')
    expect(withBoth._rowProvenance?.pspResultId).toBe('psp-1')
    expect(withBoth._rowProvenance?.pspCrashCount).toBe(0)
  })

  it('removes a PSP crash already saved on the application', () => {
    const withAnswer = mergePspRowsIntoForm2(
      {
        accidents: [
          {
            date: '2021-06-15',
            nature: 'PSP crash',
            fatalities: '0',
            injuries: '0',
            chemicalSpills: '',
            atFault: 'yes',
            _source: 'psp',
            _pspKey: 'c1',
          },
        ],
      },
      [
        {
          date: '2021-06-15',
          nature: 'PSP crash',
          fatalities: '0',
          injuries: '0',
          chemicalSpills: '',
          atFault: '',
          _source: 'psp',
          _pspKey: 'c1',
        },
      ],
      [],
      {
        pspResultId: 'psp-1',
        asOf: '2026-10-28T00:00:00.000Z',
        accioOrderNumber: 'PSP-1',
      },
    )
    expect(withAnswer.accidents?.some((row) => row.nature === 'PSP crash')).toBe(false)
    expect(withAnswer.hasNoAccidents).toBe(false)
  })

  it('stamps clean PSP provenance with zero crashes/inspections', () => {
    const clean = mergePspRowsIntoForm2(null, [], [], {
      pspResultId: 'psp-clean',
      asOf: '2026-07-12T00:00:00.000Z',
      accioOrderNumber: 'PSP-C',
    })
    expect(clean.hasNoAccidents).toBe(false)
    expect(clean.hasNoInspections).toBe(true)
    expect(clean._rowProvenance?.pspCrashCount).toBe(0)
    expect(clean._rowProvenance?.pspInspectionCount).toBe(0)
    expect(clean._rowProvenance?.pspResultId).toBe('psp-clean')
  })
})
