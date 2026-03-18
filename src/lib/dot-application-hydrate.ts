/**
 * Normalize driver_applications.application_data.form3 for PersonalInfoForm3.
 * UI expects `employers[]` with optional `type`; older saves may only have employmentHistory.
 */

export function normalizeForm3Data(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  if (Array.isArray(o.employers) && o.employers.length > 0) {
    return o
  }

  const hist = o.employmentHistory
  if (!Array.isArray(hist) || hist.length === 0) {
    return Object.keys(o).length > 0 ? o : null
  }

  const employers = hist.map((e: Record<string, unknown>) => ({
    type: 'employment' as const,
    name: String(e.company ?? e.companyName ?? e.name ?? ''),
    phone: String(e.supervisorPhone ?? e.phone ?? ''),
    email: String(e.supervisorEmail ?? e.email ?? ''),
    address: String(e.location ?? e.address ?? ''),
    positionHeld: String(e.position ?? e.positionHeld ?? ''),
    fromDate: String(e.startDate ?? e.fromDate ?? ''),
    toDate: String(e.endDate ?? e.toDate ?? 'Present'),
    reasonForLeaving: String(e.reasonForLeaving ?? ''),
    salary: String(e.salary ?? ''),
    gapsInEmployment: '',
    subjectToFMCSR: 'no',
    safetySensitiveFunction: 'no',
    isUnemployment: false,
    duties: String(e.duties ?? ''),
  }))

  return { ...o, employers }
}
