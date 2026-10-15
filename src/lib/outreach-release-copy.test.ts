import { describe, expect, it } from 'vitest'
import { buildMvrReleaseEmail, buildMvrReleaseSms } from '@/lib/outreach-release-copy'

describe('buildMvrReleaseSms', () => {
  it('uses the recruiter, the company, and the release link', () => {
    const text = buildMvrReleaseSms({
      candidateName: 'Barry Burton',
      recruiterName: 'Sam Blake',
      companyName: 'Pace Drivers',
      releaseLink: 'https://provven.com/apply/abc',
    })
    expect(text).toBe(
      "Hi Barry, it's Sam Blake with Pace Drivers. As we discussed, please sign your MVR release here: https://provven.com/apply/abc. Once you're done, you'll land in your Provven Career Hub, where you can also fill out your DOT application. Fill it out once and reuse it for future jobs. Reply STOP to opt out.",
    )
  })

  it('still reads cleanly when the recruiter has no name on file', () => {
    const text = buildMvrReleaseSms({
      candidateName: null,
      recruiterName: null,
      companyName: 'Pace Drivers',
      releaseLink: 'https://provven.com/apply/abc',
    })
    expect(text.startsWith("Hi, it's Pace Drivers. As we discussed")).toBe(true)
  })
})

describe('buildMvrReleaseEmail', () => {
  it('keeps the letter order: role, release button, then the Career Hub', () => {
    const email = buildMvrReleaseEmail({
      candidateName: 'Barry Burton',
      recruiterName: 'Sam Blake',
      recruiterPhone: '555-0100',
      companyName: 'Pace Drivers',
      jobTitle: 'OTR Driver',
      releaseLink: 'https://provven.com/apply/abc',
    })
    expect(email.subject).toBe('Next step for your Pace Drivers job: sign your MVR release')
    expect(email.greeting).toBe('Hi Barry,')
    expect(email.bodyHtml).toContain('about the OTR Driver role')
    expect(email.bodyHtml).toContain('Sign your release form')
    expect(email.bodyHtml).toContain('After you sign: your Career Hub')
    expect(email.bodyHtml).toContain('call me at 555-0100')
    expect(email.bodyHtml).toContain('Sam Blake<br>Pace Drivers')
  })
})
