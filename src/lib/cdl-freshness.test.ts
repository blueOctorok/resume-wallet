import { describe, expect, it } from 'vitest'
import { cdlClassLetter, cdlStaleSentence, readCdlFreshness } from './cdl-freshness'

describe('cdlClassLetter', () => {
  it('reads CDL-A, Class A, and a bare letter as A', () => {
    expect(cdlClassLetter('CDL-A')).toBe('A')
    expect(cdlClassLetter('Class B')).toBe('B')
    expect(cdlClassLetter('c')).toBe('C')
  })
})

describe('readCdlFreshness', () => {
  const now = new Date('2026-10-16T16:00:00Z')

  it('marks Barry’s Class A hazmat and tanker license expired', () => {
    const freshness = readCdlFreshness(
      { cdlClass: 'CDL-A', expiration: '2026-01-15', endorsements: ['H', 'N'] },
      now,
    )
    expect(freshness.classLabel).toBe('Class A')
    expect(freshness.expired).toBe(true)
    expect(freshness.expirationLabel).toBe('January 15, 2026')
    expect(freshness.endorsementPhrase).toBe('hazmat and tanker')
    expect(cdlStaleSentence(freshness)).toBe(
      'The Class A CDL date on this resume is January 15, 2026. Hazmat and tanker sit on that license. Update it so employers see a current license.',
    )
  })

  it('leaves a future date current', () => {
    const freshness = readCdlFreshness({ cdlClass: 'A', expiration: '2027-04-01', endorsements: [] }, now)
    expect(freshness.expired).toBe(false)
    expect(cdlStaleSentence(freshness)).toBeNull()
  })
})
