/**
 * Exchanges the emailed digits for a session.
 *
 * The browser must not call verify with the raw digits. That door treats a
 * missing expires_at as already expired. The API hashes the code and uses
 * the door that checks when the code was sent.
 */
type SessionClient = {
  auth: {
    setSession: (tokens: {
      access_token: string
      refresh_token: string
    }) => Promise<{ error: { message: string } | null }>
  }
}

export async function verifyEmailOtp(
  supabase: SessionClient,
  email: string,
  token: string,
): Promise<{ error: { message: string } | null }> {
  const res = await fetch('/api/auth/verify-email-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), token }),
  })
  const json = (await res.json()) as {
    error?: string
    access_token?: string
    refresh_token?: string
  }
  if (!res.ok || !json.access_token || !json.refresh_token) {
    return { error: { message: json.error || 'That code does not match. Request a new one.' } }
  }
  const { error } = await supabase.auth.setSession({
    access_token: json.access_token,
    refresh_token: json.refresh_token,
  })
  return { error: error ? { message: error.message } : null }
}
