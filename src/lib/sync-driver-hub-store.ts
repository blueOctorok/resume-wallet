import { useDriverHubStore } from '@/stores/driver-hub-store'

/**
 * Pull /api/driver/hub into driver-hub-store so Stormi journey (and anything else
 * reading this store) sees resume / DOT / MVR truth — not just legacy DriverShell.
 */
export async function syncDriverHubFromApi(walletAddress: string): Promise<void> {
  try {
    const res = await fetch('/api/driver/hub', {
      headers: { 'x-wallet-address': walletAddress },
    })
    if (!res.ok) return
    const data = await res.json()
    useDriverHubStore.getState().loadHubData({
      profile: data.profile ?? null,
      displayNameFallback: data.displayNameFallback ?? null,
      resumes: data.resumes ?? [],
      dotApplications: data.dotApplications ?? [],
      mvrRecords: data.mvrRecords ?? [],
      pspRecords: data.pspRecords ?? [],
      jobApplications: data.jobApplications ?? [],
      stats: data.stats ?? null,
      portfolio: data.portfolio ?? null,
      github: data.github ?? null,
    })
  } catch {
    /* non-fatal */
  }
}
