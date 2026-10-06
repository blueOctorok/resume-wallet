import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * The 6-digit code's type depends on how it was minted (signup, invite,
 * magic link, recovery). A lookup with the wrong type returns otp_expired
 * and does not consume the real code, so try each until one matches.
 */
const OTP_TYPES: EmailOtpType[] = ['magiclink', 'email', 'invite', 'signup', 'recovery']

type OtpClient = {
  auth: {
    verifyOtp: (args: {
      email: string
      token: string
      type: EmailOtpType
    }) => Promise<{ error: { code?: string; message: string } | null }>
  }
}

function isWrongType(error: { code?: string; message: string }): boolean {
  return error.code === 'otp_expired' || /expired or is invalid/i.test(error.message)
}

export async function verifyEmailOtp(
  supabase: OtpClient,
  email: string,
  token: string,
): Promise<{ error: { message: string } | null }> {
  let last: { message: string } | null = null
  for (const type of OTP_TYPES) {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type,
    })
    if (!error) return { error: null }
    last = error
    if (!isWrongType(error)) break
  }
  return { error: last }
}
