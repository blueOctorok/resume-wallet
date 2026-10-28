import { describe, expect, it } from 'vitest'
import {
  pickSignatureAnchor,
  signatureFieldError,
  signatureMatchesName,
} from './signature-name-check'

const LICENSE = 'Samuel Christian Blaha'

describe('signature name check', () => {
  it('uses the motor vehicle report when both names are on file', () => {
    expect(pickSignatureAnchor('Samuel Blaha', LICENSE)).toEqual({
      name: 'Samuel Blaha',
      source: 'mvr',
    })
  })

  it('uses the license barcode when no report is on file', () => {
    expect(pickSignatureAnchor(null, LICENSE)).toEqual({
      name: LICENSE,
      source: 'license',
    })
  })

  it('accepts the report name with or without the middle name', () => {
    expect(signatureMatchesName('Samuel Blaha', LICENSE)).toBe(true)
    expect(signatureMatchesName('Sam Blaha', LICENSE)).toBe(true)
    expect(signatureMatchesName(LICENSE, LICENSE)).toBe(true)
  })

  it('rejects a different person and a one-word signature', () => {
    expect(signatureMatchesName('Barry Burton', LICENSE)).toBe(false)
    expect(signatureMatchesName('Samuel', LICENSE)).toBe(false)
  })

  it('does not block when there is nothing on file to compare', () => {
    expect(signatureFieldError('Barry Burton', null, 'signature')).toBeNull()
  })

  it('names the source the signature missed', () => {
    expect(signatureFieldError('Barry Burton', { name: LICENSE, source: 'mvr' }, 'signature')).toBe(
      `Sign with the name on your motor vehicle report (${LICENSE}).`,
    )
    expect(
      signatureFieldError('Barry Burton', { name: LICENSE, source: 'license' }, 'printed'),
    ).toBe(`Printed name has to match the name read from your license barcode (${LICENSE}).`)
  })
})
