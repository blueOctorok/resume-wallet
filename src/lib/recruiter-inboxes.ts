/**
 * Recruiters do not log in. HR picks one of these inboxes from the status board.
 * One list, shared by the picker and the send route, so they cannot drift.
 * Not keyed on a company name — when another company needs its own list, this is the spot.
 */
export const RECRUITER_INBOXES = [
  't.mangus@pacedrivers.com',
  'a.foersterconnolly@pacedrivers.com',
  'a.hodge@pacedrivers.com',
  'j.riverabelgodere@pacedrivers.com',
  'a.towalski@pacedrivers.com',
  'a.malosh@pacedrivers.com',
] as const

export type RecruiterInbox = (typeof RECRUITER_INBOXES)[number]

/** "t.mangus@…" → "T. Mangus". The address stays the value she sends to. */
export function recruiterInboxLabel(email: RecruiterInbox): string {
  const local = email.split('@')[0] ?? email
  const [initial, rest] = local.split('.')
  if (!initial || !rest) return email
  return `${initial.toUpperCase()}. ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`
}

export function isRecruiterInbox(email: string): email is RecruiterInbox {
  return (RECRUITER_INBOXES as readonly string[]).includes(email.trim().toLowerCase())
}
