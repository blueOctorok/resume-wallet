/**
 * What the day-5 touch says. The first sentence discloses that this is an
 * automated message — required before any artificial-voice call. The goal is
 * routing (get them to the email), not collecting verification answers.
 */

export function buildVoiceScript(input: { driverName: string; employerName: string }): string {
  return [
    `This is an automated message from Provven, calling on behalf of ${input.driverName} about an employment verification for ${input.employerName}.`,
    'Please check your inbox for an email from verify.provven.com.',
    'A reply of YES is enough. This was an automated call. Goodbye.',
  ].join(' ')
}

export function buildSmsText(input: {
  driverName: string
  employerName: string
  verificationLink: string
}): string {
  return `Provven automated message on behalf of ${input.driverName}: please verify employment at ${input.employerName}. ${input.verificationLink} Reply STOP to opt out.`
}
