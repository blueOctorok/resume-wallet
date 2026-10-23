import { describe, expect, it } from 'vitest'
import { offerableAskTasks } from '@/lib/recruiter-ask'

describe('offerableAskTasks', () => {
  it('offers only the driver steps that are not finished', () => {
    expect(
      offerableAskTasks([
        { id: 'cdlis_consent', status: 'requested' },
        { id: 'mvr', status: 'missing' },
        { id: 'dl_images', status: 'missing' },
        { id: 'dot_application', status: 'complete' },
        { id: 'psp', status: 'processing' },
        { id: 'employment_verification', status: 'missing' },
      ]),
    ).toEqual(['consent', 'license'])
  })

  it('offers nothing when those three steps are done', () => {
    expect(
      offerableAskTasks([
        { id: 'cdlis_consent', status: 'complete' },
        { id: 'dl_images', status: 'complete' },
        { id: 'dot_application', status: 'complete' },
      ]),
    ).toEqual([])
  })
})
