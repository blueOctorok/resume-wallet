import { describe, expect, it } from 'vitest'
import { mapMvrToForm1Data } from '@/lib/mvr-to-dot-mapper'
import type { ParsedMvrResult } from '@/lib/accio-xml-parser'

describe('mapMvrToForm1Data names', () => {
  it('stores a state name that arrived in all caps as a normal name', () => {
    const form = mapMvrToForm1Data({
      orderNumber: '1',
      subOrderNumber: '1',
      subject: { firstName: 'BRIAN', middleName: 'ADAM', lastName: 'HARRISON' },
    } as ParsedMvrResult)

    expect(form.firstName).toBe('Brian')
    expect(form.middleName).toBe('Adam')
    expect(form.lastName).toBe('Harrison')
  })
})
