/**
 * Supabase JS uses fetch() under the hood. When the project URL is wrong,
 * DNS/SSL/firewall blocks the host, or Node cannot resolve IPv6, errors often
 * surface as `TypeError: fetch failed` (wrapped in our helpers as longer messages).
 */
export function isSupabaseNetworkError(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  return (
    m === 'fetch failed' ||
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('etimedout') ||
    m.includes('eai_again') ||
    m.includes('socket hang up') ||
    m.includes('network error') ||
    m.includes('getaddrinfo')
  )
}
