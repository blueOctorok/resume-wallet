import { describe, expect, it } from 'vitest'
import type { DqCoachSnapshot } from './dq-coach'
import {
  buildDqBrief,
  dqBriefPrompt,
  dqBriefStage,
  isFeatureGuidance,
  parseDqBriefDraft,
  type DqBriefDraft,
} from './dq-coach-brief'

type DqItem = DqCoachSnapshot['dqItems'][number]

function license(status: DqItem['status']): DqItem {
  return { id: 'dl_images', label: 'Driver license (front & back)', status }
}

const MVR_ON_FILE: DqItem = { id: 'mvr', label: 'Motor Vehicle Record', status: 'complete' }

function snapshot(partial: Partial<DqCoachSnapshot> = {}): DqCoachSnapshot {
  return {
    profile: {
      name: 'Barry Burton',
      city: 'Cleveland',
      state: 'OH',
      dateOfBirth: '1982-09-18',
      phone: '(216) 314-6034',
      hasPhone: true,
      hasEmail: true,
    },
    blocks: [],
    dqItems: [license('missing')],
    cdl: null,
    mvr: null,
    psp: null,
    dot: null,
    employment: [],
    ...partial,
  }
}

function dot(complete: boolean): DqCoachSnapshot['dot'] {
  return { started: true, complete } as DqCoachSnapshot['dot']
}

const NEW = snapshot()
const SCANNED = snapshot({ dqItems: [license('complete')] })
const DOT_STARTED = snapshot({ dot: dot(false) })
const DOT_DONE = snapshot({ dot: dot(true) })

function actionIds(input: DqCoachSnapshot): string[] {
  return buildDqBrief(input).actions.map((action) => action.id)
}

function allText(input: DqCoachSnapshot): string {
  return buildDqBrief(input)
    .sections.flatMap((section) => section.points)
    .join(' ')
}

describe('dqBriefStage', () => {
  it('is new until the driver starts the DOT application or scans a license', () => {
    expect(dqBriefStage(NEW)).toBe('new')
  })

  it('stays new when a company ordered an MVR and the driver has done nothing', () => {
    expect(dqBriefStage(snapshot({ dqItems: [license('missing'), MVR_ON_FILE] }))).toBe('new')
  })

  it('is building once the license is scanned or the DOT application is started', () => {
    expect(dqBriefStage(SCANNED)).toBe('building')
    expect(dqBriefStage(DOT_STARTED)).toBe('building')
  })

  it('is ready once the DOT application is finished', () => {
    expect(dqBriefStage(DOT_DONE)).toBe('ready')
  })
})

describe('a new driver', () => {
  const brief = buildDqBrief(NEW)

  it('walks the whole path, and does not mention price', () => {
    expect(brief.title).toBe('Welcome to Provven')
    expect(brief.sections.map((section) => section.heading)).toEqual([
      'One application',
      'What fills it in',
      'Your resume',
      'Apply',
      'Documents',
      'Who can see it',
    ])
    const text = allText(NEW)
    expect(text).toContain('Fill out the DOT application once.')
    expect(text).toContain('license proof')
    expect(text).toContain('company-ordered MVR')
    expect(text).toContain('employment verification')
    expect(text).toContain('Provven mark')
    expect(text).toContain('company site')
    expect(text).toContain('Upload any other papers on this page.')
    expect(text).toContain('Hide me, on this card')
    expect(text).toContain('Hiding the card does not turn that link off.')
    expect(text).not.toMatch(/free/i)
  })

  it('gets the first two steps as buttons, and no resume button', () => {
    expect(brief.actions).toEqual([
      { id: 'scan-license', label: 'Scan my license' },
      { id: 'start-dot', label: 'Start my DOT application' },
    ])
  })

  it('skips the scan when a company already ordered an MVR', () => {
    const invited = snapshot({ dqItems: [license('missing'), MVR_ON_FILE] })
    expect(actionIds(invited)).toEqual(['start-dot'])
    expect(buildDqBrief(invited).sections[1].points[0]).toMatch(/^A company already ordered your MVR/)
  })

  it('ignores a model draft, because the welcome is fixed', () => {
    const draft: DqBriefDraft = { stage: 'new', points: ['One profile holds your info.'] }
    expect(buildDqBrief(NEW, draft).sections).toEqual(brief.sections)
    expect(dqBriefPrompt(NEW)).toBe('')
    expect(parseDqBriefDraft(JSON.stringify({ brief: { first: ['Hi.'] } }), 'new')).toBeNull()
  })
})

describe('a returning driver', () => {
  it('who scanned a license is sent to start the DOT application', () => {
    const brief = buildDqBrief(SCANNED)
    expect(brief.title).toBe('Pick up where you left off')
    expect(brief.sections[0].points[0]).toBe('Your license is scanned.')
    expect(brief.sections[1].heading).toBe('Next')
    expect(actionIds(SCANNED)).toEqual(['start-dot'])
    expect(allText(SCANNED)).toContain('with that license proof on it')
  })

  it('with an unconfirmed scan is sent to confirm it first', () => {
    const scanning = snapshot({ dqItems: [license('in_progress')] })
    expect(actionIds(scanning)).toEqual(['confirm-license', 'start-dot'])
  })

  it('who started the DOT application is sent to finish it, with the resume beside it', () => {
    expect(actionIds(DOT_STARTED)).toEqual(['finish-dot', 'resume'])
    expect(allText(DOT_STARTED)).toContain('builds your resume')
  })

  it('who finished the DOT application is sent to jobs, with the resume beside it', () => {
    const brief = buildDqBrief(DOT_DONE)
    expect(brief.title).toBe('You are ready to apply')
    expect(actionIds(DOT_DONE)).toEqual(['jobs', 'resume'])
    expect(brief.sections[1].heading).toBe('Apply')
    expect(allText(DOT_DONE)).toContain('download your resume and apply on the company site')
  })

  it('never hears about a driving record, whatever the file holds', () => {
    const withRecord = snapshot({
      dot: dot(false),
      mvr: {
        convictions: [{ date: '2023-11-02', violation: 'Speeding', state: 'OH' }],
      } as DqCoachSnapshot['mvr'],
    })
    expect(allText(withRecord)).not.toMatch(/convict|violation|speeding|2023/i)
  })

  it('gets a new key when the main button changes, so the popup comes back', () => {
    const keys = [NEW, SCANNED, DOT_STARTED, DOT_DONE].map((input) => buildDqBrief(input).key)
    expect(keys).toEqual([
      'new|scan-license',
      'building|start-dot',
      'building|finish-dot',
      'ready|jobs',
    ])
  })
})

describe('the model draft', () => {
  const draft: DqBriefDraft = {
    stage: 'building',
    points: ['You started your DOT application.', 'Finish it once and every company gets it.'],
  }

  it('replaces "Where you are" and leaves the resume lines alone', () => {
    const brief = buildDqBrief(DOT_STARTED, draft)
    expect(brief.sections[0].points).toEqual(draft.points)
    expect(brief.sections[1].heading).toBe('Next')
  })

  it('is dropped when it talks about a report', () => {
    const brief = buildDqBrief(DOT_STARTED, {
      ...draft,
      points: ['Add the conviction from your MVR.'],
    })
    expect(brief.sections[0].points[0]).toBe('Your DOT application is started.')
  })

  it('is dropped when it was written for a different stage', () => {
    const brief = buildDqBrief(DOT_DONE, draft)
    expect(brief.sections[0].points[0]).toBe('Your DOT application is done.')
  })

  it('is told the progress in words and the button it sits above', () => {
    const prompt = dqBriefPrompt(DOT_STARTED)
    expect(prompt).toContain('DOT application: started, not finished')
    expect(prompt).toContain('"Finish my DOT application"')
  })
})

describe('isFeatureGuidance', () => {
  it('allows a feature line', () => {
    expect(isFeatureGuidance('Employers message you here, and you write back.')).toBe(true)
  })

  it('rejects a line about what a driving record contains', () => {
    expect(isFeatureGuidance('Add your November 2023 conviction to your DOT application.')).toBe(
      false,
    )
    expect(isFeatureGuidance('Your MVR shows an accident the application does not.')).toBe(false)
  })
})

describe('parseDqBriefDraft', () => {
  it('reads the lines for a returning driver', () => {
    const text = JSON.stringify({ brief: { first: ['- Your license is scanned.'] } })
    expect(parseDqBriefDraft(text, 'building')).toEqual({
      stage: 'building',
      points: ['Your license is scanned.'],
    })
  })

  it('rejects a draft that mentions a conviction', () => {
    const text = JSON.stringify({ brief: { first: ['Add your conviction to the application.'] } })
    expect(parseDqBriefDraft(text, 'building')).toBeNull()
  })

  it('drops paragraphs and keeps three bullets at most', () => {
    const text = JSON.stringify({
      brief: { first: ['One.', 'x'.repeat(200), 'Two.', 'Three.', 'Four.'] },
    })
    expect(parseDqBriefDraft(text, 'ready')?.points).toEqual(['One.', 'Two.', 'Three.'])
  })

  it('returns null when the model left the brief out', () => {
    expect(parseDqBriefDraft(JSON.stringify({ next: null }), 'ready')).toBeNull()
    expect(parseDqBriefDraft('not json', 'ready')).toBeNull()
  })
})
