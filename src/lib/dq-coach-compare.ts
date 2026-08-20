/**
 * Deterministic DQ discrepancy floor.
 * Only flags when both sides have a value (or an issuer event vs a started DOT
 * that says "none" / lists nothing). Empty fields are holes, not mismatches.
 */

import type { DqCoachFlag, DqCoachReview, DqCoachSnapshot, DqCoachTarget } from '@/lib/dq-coach'

export const PROFILE_MVR_NAME_FLAG = 'Profile name vs MVR'

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv'])

const DISCREPANCY_TARGET: Record<string, DqCoachTarget> = {
  [PROFILE_MVR_NAME_FLAG]: 'profile',
  'DOT name vs MVR': 'dotapp',
  'Profile name vs DOT': 'profile',
  'Date of birth vs MVR': 'profile',
  'DOT date of birth vs MVR': 'dotapp',
  'Phone vs MVR': 'profile',
  'DOT phone vs MVR': 'dotapp',
  'License number vs MVR': 'dotapp',
  'CDL number vs MVR': 'mvr',
  'License state vs MVR': 'dotapp',
  'CDL state vs MVR': 'mvr',
  'License class vs MVR': 'dotapp',
  'CDL class vs MVR': 'mvr',
  'License expiration vs MVR': 'dotapp',
  'CDL expiration vs MVR': 'mvr',
  'MVR accidents missing on DOT': 'dotapp',
  'MVR convictions missing on DOT': 'dotapp',
  'PSP crashes missing on DOT': 'dotapp',
  'Accio marked this MVR a discrepancy': 'mvr',
}

/** First + last after dropping Jr/Sr. Null if we cannot compare two tokens. */
export function personNameParts(raw: string): { first: string; last: string } | null {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  const tokens = cleaned
    .split(' ')
    .map((t) => t.replace(/\./g, ''))
    .filter((t) => t && !NAME_SUFFIXES.has(t))
  if (tokens.length < 2) return null
  return { first: tokens[0], last: tokens[tokens.length - 1] }
}

function firstNamesAlign(a: string, b: string): boolean {
  if (a === b) return true
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return shorter.length >= 3 && longer.startsWith(shorter)
}

/** True when two display names look like different people. */
export function personNamesConflict(a: string, b: string): boolean {
  const left = personNameParts(a)
  const right = personNameParts(b)
  if (!left || !right) return false
  if (left.last !== right.last) return true
  return !firstNamesAlign(left.first, right.first)
}

export function normalizeIsoDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return raw.trim().slice(0, 10)
  return null
}

export function normalizeMonthYear(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const iso = normalizeIsoDate(raw)
  if (iso) return iso.slice(0, 7)
  const slash = raw.trim().match(/^(\d{1,2})\/(\d{4})$/)
  if (slash) return `${slash[2]}-${String(parseInt(slash[1], 10)).padStart(2, '0')}`
  return null
}

export function normalizeState(raw: string | null | undefined): string | null {
  const s = raw?.trim().toUpperCase() ?? ''
  return /^[A-Z]{2}$/.test(s) ? s : null
}

export function normalizeLicense(raw: string | null | undefined): string | null {
  const s = (raw ?? '').replace(/[\s-]/g, '').toUpperCase()
  return s.length >= 4 ? s : null
}

export function normalizeLicenseClass(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const stripped = compact.replace(/CLASS/g, '').replace(/CDL/g, '')
  return stripped === 'A' || stripped === 'B' || stripped === 'C' ? stripped : null
}

export function normalizePhoneDigits(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten.length === 10 ? ten : null
}

function bothDiffer(
  a: string | null | undefined,
  b: string | null | undefined,
  normalize: (v: string | null | undefined) => string | null,
): { left: string; right: string } | null {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right || left === right) return null
  return { left, right }
}

function warn(title: string, detail: string): DqCoachFlag {
  return {
    severity: 'warn',
    title,
    detail,
    target: DISCREPANCY_TARGET[title] ?? null,
  }
}

function issuerDatesMissingFromDot(
  issuer: string[],
  disclosed: string[],
  asMonthYear: boolean,
): string[] {
  const norm = asMonthYear ? normalizeMonthYear : normalizeIsoDate
  const have = new Set(disclosed.map((d) => norm(d)).filter((d): d is string => Boolean(d)))
  const missing: string[] = []
  for (const raw of issuer) {
    const key = norm(raw)
    if (key && !have.has(key)) missing.push(raw)
  }
  return missing
}

export function collectDiscrepancyFlags(snapshot: DqCoachSnapshot): DqCoachFlag[] {
  const flags: DqCoachFlag[] = []
  const profile = snapshot.profile
  const mvr = snapshot.mvr
  const dot = snapshot.dot
  const cdl = snapshot.cdl
  const psp = snapshot.psp

  if (profile.name && mvr?.subjectName && personNamesConflict(profile.name, mvr.subjectName)) {
    flags.push(
      warn(
        PROFILE_MVR_NAME_FLAG,
        `Profile says ${profile.name}. The MVR is for ${mvr.subjectName}. Carriers treat that as two people.`,
      ),
    )
  }
  if (dot?.name && mvr?.subjectName && personNamesConflict(dot.name, mvr.subjectName)) {
    flags.push(
      warn(
        'DOT name vs MVR',
        `DOT Form 1 says ${dot.name}. The MVR is for ${mvr.subjectName}.`,
      ),
    )
  }
  if (profile.name && dot?.name && personNamesConflict(profile.name, dot.name)) {
    flags.push(
      warn(
        'Profile name vs DOT',
        `Profile says ${profile.name}. DOT Form 1 says ${dot.name}.`,
      ),
    )
  }

  const dobProfileMvr = bothDiffer(profile.dateOfBirth, mvr?.dateOfBirth, normalizeIsoDate)
  if (dobProfileMvr) {
    flags.push(
      warn(
        'Date of birth vs MVR',
        `Profile DOB ${dobProfileMvr.left} does not match MVR ${dobProfileMvr.right}.`,
      ),
    )
  }
  const dobDotMvr = bothDiffer(dot?.dateOfBirth, mvr?.dateOfBirth, normalizeIsoDate)
  if (dobDotMvr) {
    flags.push(
      warn(
        'DOT date of birth vs MVR',
        `DOT Form 1 DOB ${dobDotMvr.left} does not match MVR ${dobDotMvr.right}.`,
      ),
    )
  }

  const phoneProfileMvr = bothDiffer(profile.phone, mvr?.phone, normalizePhoneDigits)
  if (phoneProfileMvr) {
    flags.push(warn('Phone vs MVR', 'Profile phone does not match the number on the MVR.'))
  }
  const phoneDotMvr = bothDiffer(dot?.phone, mvr?.phone, normalizePhoneDigits)
  if (phoneDotMvr) {
    flags.push(warn('DOT phone vs MVR', 'DOT Form 1 phone does not match the number on the MVR.'))
  }

  const licDotMvr = bothDiffer(dot?.licenseNumber, mvr?.licenseNumber, normalizeLicense)
  if (licDotMvr) {
    flags.push(
      warn(
        'License number vs MVR',
        `DOT lists ${dot?.licenseNumber}. MVR lists ${mvr?.licenseNumber}.`,
      ),
    )
  }
  const licCdlMvr = bothDiffer(cdl?.number, mvr?.licenseNumber, normalizeLicense)
  if (licCdlMvr) {
    flags.push(
      warn(
        'CDL number vs MVR',
        `CDL block lists ${cdl?.number}. MVR lists ${mvr?.licenseNumber}.`,
      ),
    )
  }

  const stDotMvr = bothDiffer(dot?.licenseState, mvr?.licenseState, normalizeState)
  if (stDotMvr) {
    flags.push(
      warn(
        'License state vs MVR',
        `DOT license state is ${stDotMvr.left}. MVR is ${stDotMvr.right}.`,
      ),
    )
  }
  const stCdlMvr = bothDiffer(cdl?.state, mvr?.licenseState, normalizeState)
  if (stCdlMvr) {
    flags.push(
      warn(
        'CDL state vs MVR',
        `CDL block is ${stCdlMvr.left}. MVR license state is ${stCdlMvr.right}.`,
      ),
    )
  }

  const classDotMvr = bothDiffer(dot?.licenseClass, mvr?.licenseClass, normalizeLicenseClass)
  if (classDotMvr) {
    flags.push(
      warn(
        'License class vs MVR',
        `DOT class ${dot?.licenseClass} vs MVR ${mvr?.licenseClass}.`,
      ),
    )
  }
  const classCdlMvr = bothDiffer(cdl?.class, mvr?.licenseClass, normalizeLicenseClass)
  if (classCdlMvr) {
    flags.push(
      warn(
        'CDL class vs MVR',
        `CDL block ${cdl?.class} vs MVR ${mvr?.licenseClass}.`,
      ),
    )
  }

  const expDotMvr = bothDiffer(dot?.licenseExpiration, mvr?.licenseExpiration, normalizeIsoDate)
  if (expDotMvr) {
    flags.push(
      warn(
        'License expiration vs MVR',
        `DOT expiration ${expDotMvr.left} vs MVR ${expDotMvr.right}.`,
      ),
    )
  }
  const expCdlMvr = bothDiffer(cdl?.expiration, mvr?.licenseExpiration, normalizeIsoDate)
  if (expCdlMvr) {
    flags.push(
      warn(
        'CDL expiration vs MVR',
        `CDL block ${expCdlMvr.left} vs MVR ${expCdlMvr.right}.`,
      ),
    )
  }

  const filled = mvr?.filledCode?.trim().toLowerCase()
  if (filled === 'discrepancy') {
    flags.push(
      warn(
        'Accio marked this MVR a discrepancy',
        'The CRA returned filledCode=discrepancy (hits and/or identity alerts). Open the report before a carrier does.',
      ),
    )
  }

  // Residence state ≠ license state is often legal. Only note CDL vs profile as info.
  const home = normalizeState(profile.state)
  const cdlState = normalizeState(cdl?.state)
  if (home && cdlState && home !== cdlState) {
    flags.push({
      severity: 'info',
      title: 'Residence vs CDL state',
      detail: `Profile residence is ${home}, CDL is ${cdlState}. Fine if you live in one state and are licensed in another — carriers will ask.`,
    })
  }

  if (dot?.started && mvr) {
    const missingAccidents = issuerDatesMissingFromDot(
      mvr.accidents.map((a) => a.date),
      dot.hasNoAccidents ? [] : dot.accidentDates,
      false,
    )
    if (mvr.accidents.length > 0 && (dot.hasNoAccidents || missingAccidents.length > 0)) {
      flags.push(
        warn(
          'MVR accidents missing on DOT',
          dot.hasNoAccidents
            ? `MVR lists ${mvr.accidents.length} accident(s). Form 2 says none.`
            : `MVR has accident dates Form 2 does not: ${missingAccidents.slice(0, 3).join(', ')}.`,
        ),
      )
    }
    const missingConvictions = issuerDatesMissingFromDot(
      mvr.convictions.map((c) => c.date),
      dot.hasNoConvictions ? [] : dot.convictionDates,
      true,
    )
    if (mvr.convictions.length > 0 && (dot.hasNoConvictions || missingConvictions.length > 0)) {
      flags.push(
        warn(
          'MVR convictions missing on DOT',
          dot.hasNoConvictions
            ? `MVR lists ${mvr.convictions.length} conviction(s). Form 2 says none.`
            : `MVR has conviction dates Form 2 does not: ${missingConvictions.slice(0, 3).join(', ')}.`,
        ),
      )
    }
  }

  if (dot?.started && psp && psp.crashDates.length > 0) {
    const missingCrashes = issuerDatesMissingFromDot(
      psp.crashDates,
      dot.hasNoAccidents ? [] : dot.accidentDates,
      false,
    )
    if (dot.hasNoAccidents || missingCrashes.length > 0) {
      flags.push(
        warn(
          'PSP crashes missing on DOT',
          dot.hasNoAccidents
            ? `PSP lists ${psp.crashDates.length} crash(es). Form 2 says no accidents.`
            : `PSP has crash dates Form 2 does not: ${missingCrashes.slice(0, 3).join(', ')}.`,
        ),
      )
    }
  }

  return flags
}

export function nextFromDiscrepancies(
  flags: DqCoachFlag[],
): NonNullable<DqCoachReview['next']> | null {
  const hit = flags.find((f) => f.severity === 'warn' && DISCREPANCY_TARGET[f.title])
  if (!hit) return null
  const target = DISCREPANCY_TARGET[hit.title] ?? null
  if (hit.title === PROFILE_MVR_NAME_FLAG) {
    return {
      title: 'Profile name does not match your MVR',
      detail: hit.detail,
      target,
    }
  }
  return { title: hit.title, detail: hit.detail, target }
}
