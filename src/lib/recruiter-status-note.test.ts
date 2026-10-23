import { describe, expect, it } from 'vitest'
import { recruiterStatusFallback } from '@/lib/recruiter-status-note'

describe('recruiterStatusFallback', () => {
  it('names the hang-up and the consent line', () => {
    const note = recruiterStatusFallback('Jane Doe', [
      { id: 'cdlis_consent', status: 'requested', line: 'Sent Oct 21, 2026, not opened' },
    ])
    expect(note).toContain('Jane Doe is stuck on this')
    expect(note).toContain('Sent Oct 21, 2026, not opened')
    expect(note).toContain('Screening consent')
  })

  it('says the file is complete when nothing is left', () => {
    const note = recruiterStatusFallback('Jane Doe', [
      { id: 'cdlis_consent', status: 'complete', line: 'Signed Oct 1, 2026' },
    ])
    expect(note.startsWith("Jane Doe's qualification file is complete")).toBe(true)
  })
})
