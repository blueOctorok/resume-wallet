/**
 * Mock data for the Employer Hub layout mockups.
 *
 * These are intentionally lightweight, self-contained shapes (NOT the real
 * `Invite` / `ScreeningRow` wire types) so the layout sketches stay portable
 * and readable. When porting a chosen layout onto the real hub, swap these for
 * the live `useEmployerScreenings` / `/api/employer/*` payloads.
 */

export type DqStatus = 'complete' | 'in_progress' | 'started' | 'not_started'
export type OutreachStatus = 'pending' | 'viewed' | 'in_progress' | 'completed' | 'expired'
export type FileStatus = 'ready' | 'processing' | 'missing'

export interface MockFile {
  label: string
  status: FileStatus
}

export interface MockAttention {
  /** Short label, e.g. "Consent stalled" */
  label: string
  /** One-line reason for the recruiter */
  reason: string
  /** Primary recovery action label */
  cta: string
}

export interface MockOutreach {
  id: string
  name: string
  email: string
  /** Target block label, e.g. "Screening consent" */
  block: string
  status: OutreachStatus
  agedLabel: string
  files: MockFile[]
  attention?: MockAttention
  jobTitle?: string
}

export interface MockDriver {
  id: string
  name: string
  activity: string
  status: DqStatus
  done: number
  total: number
  files: MockFile[]
}

export const MOCK_OUTREACH: MockOutreach[] = [
  {
    id: 'o1',
    name: 'Marcus Webb',
    email: 'm.webb@example.com',
    block: 'Screening consent',
    status: 'in_progress',
    agedLabel: '2d ago',
    jobTitle: 'OTR Company Driver',
    files: [
      { label: 'Consent', status: 'ready' },
      { label: 'MVR', status: 'processing' },
      { label: 'PSP', status: 'missing' },
    ],
    attention: {
      label: 'MVR stalled',
      reason: 'Consent signed 2 days ago but the MVR order has not been submitted.',
      cta: 'Order MVR',
    },
  },
  {
    id: 'o2',
    name: 'Danielle Foster',
    email: 'd.foster@example.com',
    block: 'DOT application',
    status: 'viewed',
    agedLabel: '5h ago',
    jobTitle: 'Regional Reefer',
    files: [{ label: 'Consent', status: 'missing' }],
    attention: {
      label: 'Invite viewed, not started',
      reason: 'Opened the link 5 hours ago but has not signed consent yet.',
      cta: 'Send reminder',
    },
  },
  {
    id: 'o3',
    name: 'Ray Ortiz',
    email: 'ray.ortiz@example.com',
    block: 'MVR order',
    status: 'completed',
    agedLabel: '1w ago',
    jobTitle: 'Local P&D',
    files: [
      { label: 'Consent', status: 'ready' },
      { label: 'MVR', status: 'ready' },
    ],
  },
  {
    id: 'o4',
    name: 'Tanya Brooks',
    email: 't.brooks@example.com',
    block: 'Screening consent',
    status: 'pending',
    agedLabel: 'Today',
    jobTitle: 'OTR Company Driver',
    files: [{ label: 'Consent', status: 'missing' }],
  },
  {
    id: 'o5',
    name: 'Victor Nunez',
    email: 'v.nunez@example.com',
    block: 'PSP order',
    status: 'expired',
    agedLabel: '3w ago',
    jobTitle: 'Regional Dry Van',
    files: [{ label: 'Consent', status: 'ready' }],
    attention: {
      label: 'Invite expired',
      reason: 'The consent link expired before PSP was ordered. Re-send to continue.',
      cta: 'Resend consent',
    },
  },
]

export const MOCK_DRIVERS: MockDriver[] = [
  {
    id: 'd1',
    name: 'Marcus Webb',
    activity: 'Active today',
    status: 'in_progress',
    done: 1,
    total: 3,
    files: [
      { label: 'FCRA / FMCSA consent', status: 'ready' },
      { label: 'MVR report', status: 'processing' },
      { label: 'PSP report', status: 'missing' },
    ],
  },
  {
    id: 'd2',
    name: 'Ray Ortiz',
    activity: 'Active 2d ago',
    status: 'complete',
    done: 3,
    total: 3,
    files: [
      { label: 'FCRA / FMCSA consent', status: 'ready' },
      { label: 'MVR report', status: 'ready' },
      { label: 'PSP report', status: 'ready' },
    ],
  },
  {
    id: 'd3',
    name: 'Danielle Foster',
    activity: 'Active 5h ago',
    status: 'started',
    done: 0,
    total: 3,
    files: [
      { label: 'FCRA / FMCSA consent', status: 'missing' },
      { label: 'MVR report', status: 'missing' },
      { label: 'PSP report', status: 'missing' },
    ],
  },
  {
    id: 'd4',
    name: 'Sonia Patel',
    activity: 'Active 1w ago',
    status: 'in_progress',
    done: 2,
    total: 3,
    files: [
      { label: 'FCRA / FMCSA consent', status: 'ready' },
      { label: 'MVR report', status: 'ready' },
      { label: 'PSP report', status: 'processing' },
    ],
  },
  {
    id: 'd5',
    name: 'Curtis Hale',
    activity: 'No activity yet',
    status: 'not_started',
    done: 0,
    total: 3,
    files: [
      { label: 'FCRA / FMCSA consent', status: 'missing' },
      { label: 'MVR report', status: 'missing' },
      { label: 'PSP report', status: 'missing' },
    ],
  },
  {
    id: 'd6',
    name: 'Tanya Brooks',
    activity: 'Active today',
    status: 'started',
    done: 0,
    total: 3,
    files: [
      { label: 'FCRA / FMCSA consent', status: 'missing' },
      { label: 'MVR report', status: 'missing' },
      { label: 'PSP report', status: 'missing' },
    ],
  },
]

export interface MockStat {
  label: string
  value: number
  sub?: string
  highlight?: boolean
}

export const MOCK_STATS: MockStat[] = [
  { label: 'In pipeline', value: 24, sub: '4 need review', highlight: true },
  { label: 'Active jobs', value: 6, sub: '9 total' },
  { label: 'Contacted', value: 11 },
  { label: 'Archived', value: 7, sub: '2 this month' },
]

export const MOCK_JOBS = [
  { id: 'j1', title: 'OTR Company Driver', applicants: 12, isActive: true },
  { id: 'j2', title: 'Regional Reefer', applicants: 7, isActive: true },
  { id: 'j3', title: 'Local P&D', applicants: 3, isActive: false },
]

export const MOCK_BLOCKS = [
  { id: 'b1', label: 'Screening consent' },
  { id: 'b2', label: 'MVR orders' },
  { id: 'b3', label: 'PSP orders' },
  { id: 'b4', label: 'DOT screening' },
]

/** Derived: outreach rows that need recruiter action right now. */
export const MOCK_ATTENTION = MOCK_OUTREACH.filter((o) => o.attention)
