import { describe, expect, it } from 'vitest'
import { domainsAlign, emailDomain, sha256Hex } from '@/lib/dkim-verify'

describe('dkim-verify helpers', () => {
  it('extracts the mailbox domain', () => {
    expect(emailDomain('HR@AcmeTrucking.COM')).toBe('acmetrucking.com')
    expect(emailDomain('not-an-email')).toBeNull()
  })

  it('aligns invited mailbox with From / DKIM d=', () => {
    expect(domainsAlign('hr@acmetrucking.com', 'acmetrucking.com')).toBe(true)
    expect(domainsAlign('hr@acmetrucking.com', 'payroll@acmetrucking.com')).toBe(true)
    expect(domainsAlign('hr@acmetrucking.com', 'mail.acmetrucking.com')).toBe(true)
    expect(domainsAlign('hr@mail.acmetrucking.com', 'acmetrucking.com')).toBe(true)
    expect(domainsAlign('hr@acmetrucking.com', 'evil.example')).toBe(false)
  })

  it('hashes inbound body bytes', () => {
    expect(sha256Hex('YES')).toHaveLength(64)
  })
})
