import { describe, it, expect } from 'vitest'
import { calculateBlockJourney, type BlockProgressData } from '@/lib/journey-progress'
import { buildCandidateTodo, type PendingEmployerRequest } from '@/lib/candidate-todo'

/** Signed-in driver with nothing done yet. */
function baseData(overrides: Partial<BlockProgressData> = {}): BlockProgressData {
  return {
    isWalletConnected: true,
    profileCompleteness: 100,
    hasResume: false,
    hasDriverResume: false,
    hasDeveloperResume: false,
    hasGeneralResume: false,
    resumeCount: 0,
    dotAppComplete: false,
    dotAppVerified: false,
    dotAppInProgress: false,
    mvrComplete: false,
    hasMvrOrder: false,
    pspComplete: false,
    hasPspOrder: false,
    hasAppliedToJobs: false,
    jobApplicationCount: 0,
    hasPortfolioUrl: false,
    hasPortfolioProjects: false,
    portfolioProjectCount: 0,
    hasConnectedGithub: false,
    hasScreeningConsentBundle: false,
    hasVerifiedAttestation: false,
    ...overrides,
  }
}

const DRIVER_BLOCKS = ['driver-dot-application', 'driver-screening-consent', 'driver-mvr', 'driver-psp']

const paceRequest: PendingEmployerRequest = {
  id: 'req-1',
  companyName: 'Pace Drivers',
  targetBlockType: 'driver-screening-consent',
  requestType: 'block_request',
}

describe('buildCandidateTodo', () => {
  it('invited driver sees "Finish screening for {Company}" pinned first and as the primary CTA', () => {
    const journey = calculateBlockJourney(DRIVER_BLOCKS, baseData())
    const todo = buildCandidateTodo(journey, paceRequest, true)

    expect(todo.invitedBy).toBe('Pace Drivers')
    expect(todo.items[0].label).toBe('Finish screening consent for Pace Drivers')
    expect(todo.primary).toBe(todo.items[0])
    // The journey twin must not appear twice
    expect(todo.items.filter((i) => i.id.includes('screening-consent') || i.id === 'req-1' || i.id === 'request-req-1')).toHaveLength(1)
  })

  it('consent already signed → pinned item becomes Waiting on the company and primary falls to the next task', () => {
    const journey = calculateBlockJourney(DRIVER_BLOCKS, baseData({ hasScreeningConsentBundle: true }))
    const todo = buildCandidateTodo(journey, paceRequest, true)

    expect(todo.items[0].status).toBe('waiting')
    expect(todo.items[0].waitingOn).toBe('Waiting on Pace Drivers')
    expect(todo.primary?.id).not.toBe(todo.items[0].id)
    expect(todo.primary?.status).toBe('todo')
  })

  it('MVR order in flight shows an honest Waiting row, never the primary CTA', () => {
    const journey = calculateBlockJourney(DRIVER_BLOCKS, baseData({ hasMvrOrder: true }))
    const todo = buildCandidateTodo(journey, null, true)

    const mvr = todo.items.find((i) => i.id === 'driver-mvr')
    expect(mvr?.status).toBe('waiting')
    expect(mvr?.label).toBe('MVR processing')
    expect(todo.primary?.id).not.toBe('driver-mvr')
  })

  it('organic user with zero blocks gets one obvious step — add a block', () => {
    const journey = calculateBlockJourney([], baseData())
    const todo = buildCandidateTodo(journey, null, false)

    expect(todo.primary?.id).toBe('add-block')
  })

  it('everything settled → no primary (panel shows the share nudge instead)', () => {
    const journey = calculateBlockJourney(
      ['driver-mvr'],
      baseData({ mvrComplete: true, hasMvrOrder: true }),
    )
    const todo = buildCandidateTodo(journey, null, true)

    expect(todo.primary).toBeNull()
    expect(todo.items.every((i) => i.status === 'done' || i.status === 'waiting')).toBe(true)
  })

  it('never surfaces wallet, referral, or find-jobs rows; caps the list at 7', () => {
    const journey = calculateBlockJourney(
      [...DRIVER_BLOCKS, 'storm-resume', 'developer-portfolio', 'developer-github', 'general-employment-verification'],
      baseData({ profileCompleteness: 10 }),
    )
    const todo = buildCandidateTodo(journey, paceRequest, true)

    expect(todo.items.length).toBeLessThanOrEqual(7)
    const ids = todo.items.map((i) => i.id)
    expect(ids).not.toContain('wallet')
    expect(ids).not.toContain('referral')
    expect(ids).not.toContain('find-jobs')
  })
})
