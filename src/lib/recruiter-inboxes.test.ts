import { describe, expect, it } from 'vitest'
import { isRecruiterInbox, recruiterInboxLabel } from '@/lib/recruiter-inboxes'

describe('recruiter inboxes', () => {
  it('turns the mailbox into a short name', () => {
    expect(recruiterInboxLabel('t.mangus@pacedrivers.com')).toBe('T. Mangus')
  })

  it('accepts only an address on the list', () => {
    expect(isRecruiterInbox('A.Hodge@pacedrivers.com')).toBe(true)
    expect(isRecruiterInbox('someone@example.com')).toBe(false)
  })
})
