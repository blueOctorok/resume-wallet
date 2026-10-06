import { createHash } from 'crypto'

/**
 * Auth stores a sign-in code as SHA-224(lowercased email + digits), not the
 * digits themselves. Verify rebuilds that hash. See verify-email-code route.
 */
export function signInCodeHash(email: string, code: string): string {
  return createHash('sha224').update(`${email}${code}`).digest('hex')
}
