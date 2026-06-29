/**
 * Client-side helpers for the driver-initiated MVR + PSP order flow (P3.4-C).
 * Called after screening consent is saved — places two driver-owned Accio orders.
 */

export interface ScreeningConsentPayload {
  requestId: string
  companyName: string
  deferredBgConsent: { signedName: string; formData: Record<string, string> }
  deferredPspConsent: { signedName: string; formData: Record<string, string> }
  cdlisWrittenConsent: Record<string, unknown>
  formData: Record<string, string>
  /** Defer employer bell/email — fulfill-screening notifies after orders land. */
  skipEmployerNotify?: boolean
}

export interface DriverOwnedOrderFormData {
  firstName: string
  lastName: string
  middleName: string
  dob: string
  ssn: string
  dlNumber: string
  dlState: string
  address: string
  city: string
  state: string
  zip: string
  email?: string
  phone: string
}

async function parseApiError(res: Response, fallback: string): Promise<never> {
  const d = await res.json().catch(() => ({}))
  throw new Error(typeof d.error === 'string' ? d.error : fallback)
}

/** Persist the three-step consent bundle (no vendor order). */
export async function saveScreeningConsentBundle(payload: ScreeningConsentPayload): Promise<void> {
  const res = await fetch('/api/candidate/screening-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    await parseApiError(res, 'Failed to save screening consent')
  }
}

/** Place a single driver-owned MVR or PSP order via fulfill-screening. */
export async function placeDriverOwnedScreeningOrder(
  requestId: string,
  type: 'mvr' | 'psp',
  formData: DriverOwnedOrderFormData,
): Promise<void> {
  const res = await fetch('/api/candidate/fulfill-screening', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, type, formData }),
  })
  if (!res.ok) {
    const label = type === 'mvr' ? 'MVR' : 'PSP'
    await parseApiError(res, `Failed to submit ${label} order`)
  }
}

/**
 * Save consent then place driver-owned MVR + PSP (ownership follows who clicks order).
 * MVR first — if PSP fails, consent + MVR are already on file; surface the error to retry PSP.
 */
export async function saveConsentAndPlaceDriverOwnedOrders(
  consentPayload: ScreeningConsentPayload,
  orderFormData: DriverOwnedOrderFormData,
): Promise<void> {
  await saveScreeningConsentBundle({ ...consentPayload, skipEmployerNotify: true })
  await placeDriverOwnedScreeningOrder(consentPayload.requestId, 'mvr', orderFormData)
  await placeDriverOwnedScreeningOrder(consentPayload.requestId, 'psp', orderFormData)
}
