/**
 * The brief is the driver-facing guide: what Provven is, where this driver is
 * in it, and the buttons for what to do next.
 *
 * It rides along on the file review, but it does not repeat that review.
 * Convictions, violations, crashes, and the rest of a driving record stay out
 * of this message. Talking a driver through the contents of a report is a
 * consumer-reporting job, and Provven is not one.
 *
 * Code decides the stage, the steps, the resume lines, and the buttons.
 * - A new driver gets a fixed welcome. Every new driver is in the same spot,
 *   so there is nothing for the model to tailor, and the first explanation of
 *   the product should not vary.
 * - A returning driver gets "Where you are" written by the model from the
 *   progress facts below, with rule-based lines when it cannot.
 */

import { extractJsonObject, type DqCoachSnapshot } from '@/lib/dq-coach'

/** Bump when the brief shape or its prompt changes, so cached reviews get a fresh one. */
export const DQ_BRIEF_VERSION = 5

const MAX_POINTS = 3
/** A bullet longer than this is a paragraph. Drop it instead of cutting it mid-sentence. */
const MAX_POINT_LENGTH = 110

/**
 * new — has not started the DOT application or scanned a license.
 * building — has started, and the DOT application is not finished.
 * ready — the DOT application is finished, so the resume is too.
 */
export type DqBriefStage = 'new' | 'building' | 'ready'

export type DqBriefActionId =
  | 'scan-license'
  | 'confirm-license'
  | 'start-dot'
  | 'finish-dot'
  | 'jobs'
  | 'resume'

export interface DqBriefAction {
  id: DqBriefActionId
  label: string
}

export interface DqBriefSection {
  heading: string
  points: string[]
  /** Numbered steps, in the order the driver does them. */
  ordered?: boolean
}

export interface DqCoachBrief {
  version: number
  /** Stage plus the main button. The popup is new again only when this changes. */
  key: string
  stage: DqBriefStage
  title: string
  sections: DqBriefSection[]
  /** The first one is the main button. */
  actions: DqBriefAction[]
}

/** The model's "Where you are" lines, for the stage it was asked about. */
export interface DqBriefDraft {
  stage: DqBriefStage
  points: string[]
}

/** The only facts about the driver the brief uses. None of them is a report's contents. */
interface DqBriefProgress {
  license: 'missing' | 'in_progress' | 'complete'
  /** An MVR fills the same DOT fields a license scan does. */
  mvrOnFile: boolean
  dotStarted: boolean
  dotComplete: boolean
}

const ACTION_LABELS: Record<DqBriefActionId, string> = {
  'scan-license': 'Scan my license',
  'confirm-license': 'Confirm my license scan',
  'start-dot': 'Start my DOT application',
  'finish-dot': 'Finish my DOT application',
  jobs: 'Look for jobs',
  resume: 'View resume',
}

const TITLES: Record<DqBriefStage, string> = {
  new: 'Welcome to Provven',
  building: 'Pick up where you left off',
  ready: 'You are ready to apply',
}

/**
 * The new-driver map, and the lines a returning driver still has ahead.
 * Written here so every driver gets the same path, in the same words.
 *
 * "Proof" means a chip on the resume. A license proof is the confirmed
 * barcode read. An MVR proof comes from the record a company ordered. An
 * employment-verification proof comes from the employer's reply. The
 * application the driver typed is not a proof.
 */
const APPLY_HERE =
  'Jobs with a Provven mark sit on top. Apply here. The company already has your file.'
const APPLY_ELSEWHERE = 'Other jobs: download your resume and apply on the company site.'

/**
 * Why the card can be found. Fixed, because this is the piece drivers miss
 * and the model must not soften or skip it.
 */
const WHO_CAN_SEE: DqBriefSection = {
  heading: 'Who can see it',
  points: [
    'Carriers on Provven can find this card before you apply.',
    'Hide me, on this card, if you only want a company to see you after you apply.',
    'Share sends a link. Hiding the card does not turn that link off.',
  ],
}

/**
 * Facts the model may use when it writes "Where you are". The path after
 * that (resume, proofs, Apply, documents) is fixed copy, not the model's.
 */
const PRODUCT_FACTS = [
  'The DOT application is filled out once. Every company the driver applies to on Provven gets it.',
  'A license scan fills in the DOT application.',
  'An MVR a company orders fills in the DOT application.',
]

/**
 * A driving record's contents. Naming these to a driver is the line this
 * message does not cross. "points" is the record's points, not a list.
 */
// Stems, with no trailing word boundary: "convict" has to match "conviction".
const REPORT_CONTENTS =
  /\b(convict|violation|accident|crash|points|suspension|suspended|revok|ticket|dui|dwi|felony|misdemeanor|discrepan)/i

function briefProgress(snapshot: DqCoachSnapshot): DqBriefProgress {
  const statusOf = (id: 'dl_images' | 'mvr') =>
    snapshot.dqItems.find((item) => item.id === id)?.status
  const license = statusOf('dl_images')
  return {
    license: license === 'complete' || license === 'in_progress' ? license : 'missing',
    mvrOnFile: statusOf('mvr') === 'complete',
    dotStarted: Boolean(snapshot.dot?.started),
    dotComplete: Boolean(snapshot.dot?.complete),
  }
}

function stageOf(progress: DqBriefProgress): DqBriefStage {
  if (progress.dotComplete) return 'ready'
  // An MVR an employer ordered does not count. The driver has still done
  // nothing here, and that is the person who needs the welcome.
  return progress.dotStarted || progress.license !== 'missing' ? 'building' : 'new'
}

export function dqBriefStage(snapshot: DqCoachSnapshot): DqBriefStage {
  return stageOf(briefProgress(snapshot))
}

/** The buttons, most important first. View resume only shows once there is a resume to view. */
function briefActions(progress: DqBriefProgress): DqBriefActionId[] {
  if (progress.dotComplete) return ['jobs', 'resume']
  if (progress.dotStarted) return ['finish-dot', 'resume']
  if (progress.license === 'complete' || progress.mvrOnFile) return ['start-dot']
  return [progress.license === 'in_progress' ? 'confirm-license' : 'scan-license', 'start-dot']
}

/** The whole path, for a driver who has not started. Fixed, so it never varies. */
function newDriverSections(progress: DqBriefProgress): DqBriefSection[] {
  const fills = progress.mvrOnFile
    ? [
        'A company already ordered your MVR. It fills the application and adds its proofs.',
        'A license scan does the same, and adds a license proof.',
      ]
    : [
        'A license scan fills it in and adds a license proof to your resume.',
        'A company-ordered MVR fills it in and adds its proofs.',
      ]
  return [
    {
      heading: 'One application',
      points: [
        'Fill out the DOT application once.',
        'Every company you apply to here gets it.',
      ],
    },
    { heading: 'What fills it in', points: fills },
    {
      heading: 'Your resume',
      points: [
        'The application builds it, with those proofs on it.',
        'An employment verification later adds more proofs.',
      ],
    },
    { heading: 'Apply', points: [APPLY_HERE, APPLY_ELSEWHERE] },
    { heading: 'Documents', points: ['Upload any other papers on this page.'] },
    WHO_CAN_SEE,
  ]
}

/** Status only. The path still ahead is a separate, fixed section. */
function whereYouAre(progress: DqBriefProgress): string[] {
  if (progress.dotComplete) return ['Your DOT application is done.']
  const lines: string[] = []
  if (progress.license === 'complete') lines.push('Your license is scanned.')
  else if (progress.license === 'in_progress') lines.push('Your license scan needs you to confirm it.')
  lines.push(progress.dotStarted ? 'Your DOT application is started.' : 'Your DOT application is next.')
  return lines
}

/** The rest of the path, from wherever this driver already is. */
function ahead(progress: DqBriefProgress): DqBriefSection {
  if (progress.dotComplete) {
    return {
      heading: 'Apply',
      points: [APPLY_HERE, APPLY_ELSEWHERE, 'An employment verification adds more proofs to the resume.'],
    }
  }
  const resume = progress.license === 'complete'
    ? 'The application builds your resume, with that license proof on it.'
    : 'The application builds your resume. A license scan or a company-ordered MVR adds proofs.'
  return {
    heading: 'Next',
    points: [resume, 'An employment verification later adds more proofs.', APPLY_HERE, APPLY_ELSEWHERE],
  }
}

function cleanPoints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((point): point is string => typeof point === 'string')
    .map((point) => point.replace(/^[\s\-•*]+/, '').trim())
    .filter((point) => point.length > 0 && point.length <= MAX_POINT_LENGTH)
    .slice(0, MAX_POINTS)
}

/** A feature line. A line about what a report contains is not one. */
export function isFeatureGuidance(point: string): boolean {
  return !REPORT_CONTENTS.test(point)
}

/**
 * Reads `brief.first` out of the same JSON object the review came in.
 * Null when it is missing, empty, or any line is about a report.
 * A new driver's welcome is fixed, so there is no draft to read for it.
 */
export function parseDqBriefDraft(text: string, stage: DqBriefStage): DqBriefDraft | null {
  if (stage === 'new') return null
  const blob = extractJsonObject(text)
  if (!blob) return null
  try {
    const raw = JSON.parse(blob) as { brief?: { first?: unknown } | null }
    const points = cleanPoints(raw.brief?.first)
    if (points.length === 0 || points.some((point) => !isFeatureGuidance(point))) return null
    return { stage, points }
  } catch {
    return null
  }
}

export function buildDqBrief(
  snapshot: DqCoachSnapshot,
  draft: DqBriefDraft | null = null,
): DqCoachBrief {
  const progress = briefProgress(snapshot)
  const stage = stageOf(progress)
  const actions = briefActions(progress)

  const sections: DqBriefSection[] =
    stage === 'new'
      ? newDriverSections(progress)
      : [
          {
            heading: 'Where you are',
            points:
              draft && draft.stage === stage && draft.points.every(isFeatureGuidance)
                ? draft.points
                : whereYouAre(progress),
          },
          ahead(progress),
          WHO_CAN_SEE,
        ]

  return {
    version: DQ_BRIEF_VERSION,
    key: `${stage}|${actions[0]}`,
    stage,
    title: TITLES[stage],
    sections,
    actions: actions.map((id) => ({ id, label: ACTION_LABELS[id] })),
  }
}

const LICENSE_PROGRESS: Record<DqBriefProgress['license'], string> = {
  missing: 'not done',
  in_progress: 'started, waiting for the driver to confirm it',
  complete: 'done',
}

/**
 * Added to the review prompt for a returning driver. Empty for a new driver,
 * whose welcome is fixed. The model is handed the progress facts in words, so
 * it does not go looking in the snapshot for something to say.
 */
export function dqBriefPrompt(snapshot: DqCoachSnapshot): string {
  const progress = briefProgress(snapshot)
  if (stageOf(progress) === 'new') return ''

  const dot = progress.dotComplete
    ? 'finished'
    : progress.dotStarted
      ? 'started, not finished'
      : 'not started'
  const nextButton = ACTION_LABELS[briefActions(progress)[0]]

  return `Also include in the same JSON object:
- brief: { first: string[] }

The brief tells a returning driver where they are on Provven. It is not a review of the file. Write 2 or 3 points. Each point is one plain sentence of 12 words or fewer, to the driver as "you". Sound glad to help. No greetings, headings, markdown, or emoji inside a point.

Where this driver is. These are the only facts about the driver the brief may use:
- License scan: ${LICENSE_PROGRESS[progress.license]}
- DOT application: ${dot}

Product facts. These are the only things you may say Provven does:
${PRODUCT_FACTS.map((fact) => `- ${fact}`).join('\n')}

Say what they have already done, then one line on what "${nextButton}" gets them. Do not repeat that button as an instruction.

Do not write about the resume, proofs, Apply, or documents. Those lines are added for you. Do not say Provven is free.

Brief rules:
- Guide the features. Do not review the file, and do not tell the driver to fix, add, or match anything.
- Never mention a conviction, violation, accident, crash, points, suspension, ticket, or any date or event from a driving record. The snapshot is for the review, not for the brief.
- No statistics, percentages, or promises about getting hired.
- Do not mention AI, blockchain, or how Provven works inside.`
}
