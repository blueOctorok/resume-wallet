/** Client helper — fetch a short-lived signed URL for a resume the caller may access. */
export async function fetchResumeSignedUrl(resumeId: string): Promise<string | null> {
  const res = await fetch('/api/documents/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ resumeId }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { url?: string }
  return data.url ?? null
}
