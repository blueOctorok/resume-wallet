/**
 * Block Registry — the single source of truth for every composable hub block.
 *
 * A "block" is a self-contained feature unit that a candidate adds to their hub.
 * Each block owns its own component, its own Zustand store, and its own data.
 * The hub itself is stateless — it just reads this registry and renders blocks.
 *
 * Full checklist for adding a new block: see .cursor/rules/block-development.mdc
 *
 * Quick reference (full checklist in .cursor/rules/block-development.mdc):
 *
 *   ADDING a block:
 *   1.  Add a BlockDefinition + BlockColorSet entry here
 *   2.  Create the block component in src/components/blocks/
 *   3.  Register it in CandidateShell's lazy block map + route case
 *   4.  Gate career card section on installedBlockTypes (CareerCard.tsx)
 *   5.  Set employerRequestable + requestLabel + completionField (CareerCardModal reads this)
 *   6.  Add BLOCK_TO_SLOT in CareerCardModal.tsx if employerRequestable
 *   7.  Add BLOCK_JOURNEY_MAP entry (journey-progress.ts)
 *   8.  Register PageType if block has a full-page route (stores/types.ts)
 *   9.  Add pageRoute to validOnboardPages in page.tsx for deep-link support
 *   10. Surface a file entry in MyFilesSection (CandidateHub.tsx)
 *   11. Add Stormi journey step + context (journey-progress.ts, ava-context.ts)
 *   12. Admin: add a tab if block has admin-manageable data
 *   13. Data: create block_* table migration + block-data.ts helpers
 *
 *   REMOVING a block: see section 13 in .cursor/rules/block-development.mdc
 *   — reverse every step above + check the hardcoded touchpoints table
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface BlockDefinition {
  /** Stable identifier stored in hub_blocks.block_type */
  id: string
  label: string
  description: string
  /** Icon name from lucide-react */
  icon: string
  /** Which category this block appears under in the picker */
  categoryId: string
  /**
   * Keywords Stormi matches against the user's occupation + seeking_reason
   * to suggest this block automatically.
   */
  suggestedFor: string[]
  /**
   * Some blocks are complex multi-step flows (DOT app).
   * Others are simple data displays (skills list).
   * This is informational — used by the picker to show a complexity hint.
   */
  complexity: 'simple' | 'moderate' | 'complex'
  /** Whether this block contributes a section to the career card */
  appearsOnCareerCard: boolean
  /**
   * The page route in CandidateShell when this block is clicked.
   * null means the block has no full-page view yet (future work).
   */
  pageRoute: string | null
  /**
   * The database table(s) this block owns. Each block is responsible for
   * its own data via src/lib/block-data.ts. Blocks that need data from
   * another block query that block's table directly (block-to-block).
   * null means the block doesn't own persistent data (yet).
   */
  dataTables: string[] | null

  // ── Employer outreach ────────────────────────────────────────────────────
  /**
   * Whether employers can request this block from a candidate via talent search.
   * When true, CareerCardModal renders a "Request {requestLabel}" button,
   * the request API auto-installs the block, and the notification deep-links
   * to `pageRoute`.
   */
  employerRequestable: boolean
  /**
   * CTA label shown to employers (e.g. "Resume", "DOT Application", "MVR").
   * Rendered as "Request {requestLabel}". Only meaningful when employerRequestable is true.
   */
  requestLabel: string | null
  /**
   * The career card field that indicates the block's deliverable is complete.
   * Used to hide the request button when the candidate has already finished it.
   * Examples: 'hasResume', 'hasDriverApp', 'hasMvr'.
   * null means the button always shows (rely on block install status only).
   */
  completionField: string | null

  /**
   * Employer block(s) the company must have installed to see this request button.
   * Uses OR logic: if the company has ANY one of these employer blocks, the
   * request is available. null means no gating (not used when employerRequestable
   * is true — every requestable block should list at least one employer block).
   *
   * @example ['employer-mvr-orders', 'employer-psp-mvr-bundle'] — either grants MVR capability
   */
  requiredEmployerBlocks: string[] | null

  /**
   * Omit from Add Blocks picker (legacy aliases). Keeps registry + hub_rows working.
   */
  hiddenFromBlockPicker?: boolean
  /**
   * Core blocks are mandatory for every candidate hub (auto-installed, cannot be removed from the picker flow).
   * Use for STORM Resume — the foundation of the career card, not an optional add-on.
   */
  coreBlock?: boolean
}

export interface BlockCategory {
  id: string
  label: string
  description: string
  /** Icon name from lucide-react */
  icon: string
  /** Display order in the block picker */
  order: number
}

// ── Categories ───────────────────────────────────────────────────────────────

export const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Blocks that work for any profession',
    icon: 'LayoutGrid',
    order: 0,
  },
  {
    id: 'drivers',
    label: 'Drivers',
    description: 'CDL, DOT compliance, and motor carrier requirements',
    icon: 'Truck',
    order: 1,
  },
  {
    id: 'developers',
    label: 'Developers',
    description: 'Software engineering portfolio and credentials',
    icon: 'Code2',
    order: 2,
  },
]

// ── Block Definitions ─────────────────────────────────────────────────────────
//
// STORM Resume is the single hub entry for upload + career-specific guided builders.
// Legacy block ids (general-resume, driver-resume, developer-resume) remain defined
// for existing installs and data routing; they are hidden from the picker only.

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // ── General ────────────────────────────────────────────────────────────────
  {
    id: 'storm-resume',
    label: 'STORM Resume',
    description:
      'Upload your own file or build a Storm-style resume — Professional, Driver, or Developer paths in one place.',
    icon: 'Sparkles',
    categoryId: 'general',
    suggestedFor: [
      'resume',
      'job',
      'career',
      'work',
      'employment',
      'apply',
      'driver',
      'cdl',
      'trucking',
      'developer',
      'software',
      'engineer',
      'programmer',
      'tech',
      'professional',
      'nurse',
      'retail',
      'warehouse',
    ],
    complexity: 'moderate',
    appearsOnCareerCard: true,
    pageRoute: 'storm-resume',
    dataTables: [
      'block_education',
      'block_skills',
      'block_references',
      'block_driver_cdl',
      'block_driver_employment',
      'block_dev_profile',
    ],
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
    /** Mandatory first step — not pickable; auto-installed for every hub. */
    hiddenFromBlockPicker: true,
    coreBlock: true,
  },
  {
    id: 'general-resume',
    label: 'Professional Resume',
    description:
      'Universal resume for any role — work history, education, skills, certifications, and references. Verifiable on-chain like other resumes.',
    icon: 'FileText',
    categoryId: 'general',
    suggestedFor: [
      'resume',
      'job',
      'career',
      'work',
      'employment',
      'apply',
      'indeed',
      'hiring',
      'professional',
      'nurse',
      'retail',
      'warehouse',
      'office',
      'sales',
      'healthcare',
      'construction',
    ],
    complexity: 'moderate',
    appearsOnCareerCard: true,
    pageRoute: 'general-resume',
    dataTables: ['block_education', 'block_skills', 'block_references'],
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
    hiddenFromBlockPicker: true,
  },
  {
    id: 'general-employment-verification',
    label: 'Employment Verification',
    description:
      'Optional: email past employers to confirm your work dates (from any resume or DOT history). Voluntary for them — boosts trust on your career card.',
    icon: 'ShieldCheck',
    categoryId: 'general',
    suggestedFor: [
      'verify',
      'employment',
      'work history',
      'reference',
      'background',
      'career',
      'employer',
      'hr',
    ],
    complexity: 'simple',
    appearsOnCareerCard: false,
    pageRoute: 'employment-verification',
    dataTables: null,
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
  },
  // ── Drivers ────────────────────────────────────────────────────────────────
  {
    id: 'driver-resume',
    label: 'Driver Resume',
    description: 'CDL-specific resume with endorsements, equipment, and driving experience',
    icon: 'FileText',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'trucking', 'hauling', 'logistics', 'freight', 'commercial'],
    complexity: 'moderate',
    appearsOnCareerCard: true,
    pageRoute: 'resume',
    dataTables: ['block_driver_cdl', 'block_driver_employment', 'block_education', 'block_skills', 'block_references'],
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
    hiddenFromBlockPicker: true,
  },
  {
    id: 'driver-dot-application',
    label: 'DOT Application',
    description: 'Full federal driver qualification file (FMCSA Forms 1–3)',
    icon: 'ClipboardList',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'dot', 'fmcsa', 'trucking', 'commercial', 'motor carrier'],
    complexity: 'complex',
    appearsOnCareerCard: true,
    pageRoute: 'dotapp',
    dataTables: ['block_driver_cdl', 'block_driver_employment', 'block_driver_emergency', 'block_driver_experience', 'block_education', 'block_references'],
    employerRequestable: true,
    requestLabel: 'DOT Application',
    completionField: 'hasDriverApp',
    requiredEmployerBlocks: ['employer-dot-screening'],
  },
  {
    id: 'driver-mvr',
    label: 'Motor Vehicle Record',
    description: 'Order and display your verified MVR for employers',
    icon: 'Car',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'mvr', 'driving record', 'motor vehicle', 'trucking'],
    complexity: 'moderate',
    appearsOnCareerCard: true,
    pageRoute: 'mvr',
    dataTables: ['block_driver_mvr'],
    employerRequestable: true,
    requestLabel: 'MVR',
    completionField: 'hasMvr',
    requiredEmployerBlocks: ['employer-mvr-orders', 'employer-psp-mvr-bundle'],
  },
  {
    id: 'driver-psp',
    label: 'PSP Report',
    description: 'FMCSA Pre-Employment Screening crash and inspection history',
    icon: 'FileWarning',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'psp', 'fmcsa', 'crash', 'inspection', 'trucking', 'safety'],
    complexity: 'moderate',
    appearsOnCareerCard: true,
    pageRoute: 'psp',
    dataTables: ['block_driver_psp'],
    employerRequestable: true,
    requestLabel: 'PSP + MVR',
    completionField: 'hasPsp',
    requiredEmployerBlocks: ['employer-psp-mvr-bundle'],
  },
  {
    id: 'driver-cdl-credentials',
    label: 'CDL Credentials',
    description: 'CDL class, endorsements, expiration, and issuing state',
    icon: 'IdCard',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'license', 'endorsements', 'hazmat', 'tanker'],
    complexity: 'simple',
    appearsOnCareerCard: true,
    pageRoute: null,
    dataTables: ['block_driver_cdl'],
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
  },

  // ── Developers ─────────────────────────────────────────────────────────────
  {
    id: 'developer-resume',
    label: 'Developer Resume',
    description: 'Tech resume with skills, frameworks, and work history',
    icon: 'FileText',
    categoryId: 'developers',
    suggestedFor: ['developer', 'software', 'engineer', 'programmer', 'coder', 'tech', 'web', 'mobile'],
    complexity: 'moderate',
    appearsOnCareerCard: true,
    pageRoute: 'developer-resume',
    dataTables: ['block_dev_profile'],
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
    hiddenFromBlockPicker: true,
  },
  {
    id: 'developer-portfolio',
    label: 'Portfolio',
    description: 'Showcase your best work with links and descriptions',
    icon: 'Globe',
    categoryId: 'developers',
    suggestedFor: ['developer', 'software', 'portfolio', 'projects', 'design', 'frontend', 'fullstack'],
    complexity: 'moderate',
    appearsOnCareerCard: true,
    pageRoute: 'portfolio',
    dataTables: ['block_dev_portfolio'],
    employerRequestable: true,
    requestLabel: 'Portfolio',
    completionField: null,
    requiredEmployerBlocks: ['employer-portfolio-requests'],
  },
  {
    id: 'developer-projects',
    label: 'Projects',
    description: 'Individual project cards with tech stack and outcomes',
    icon: 'FolderGit2',
    categoryId: 'developers',
    suggestedFor: ['developer', 'software', 'projects', 'open source', 'github', 'code'],
    complexity: 'simple',
    appearsOnCareerCard: true,
    pageRoute: null,
    dataTables: null,
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
  },
  {
    id: 'developer-github',
    label: 'GitHub Activity',
    description: 'Contribution graph and repository highlights (public and private)',
    icon: 'Github',
    categoryId: 'developers',
    suggestedFor: ['developer', 'software', 'github', 'open source', 'contributions', 'code'],
    complexity: 'simple',
    appearsOnCareerCard: true,
    pageRoute: 'github',
    dataTables: ['block_dev_github'],
    employerRequestable: false,
    requestLabel: null,
    completionField: null,
    requiredEmployerBlocks: null,
  },
]

// ── Block accent colors ──────────────────────────────────────────────────────
// Each block gets a unique accent so the hub grid isn't monotone.
// Keys: dark-mode & light-mode Tailwind classes for bg, border, text, and glow.

export interface BlockColorSet {
  /** Icon circle background */
  iconBg: { dark: string; light: string }
  /** Icon text color */
  iconText: { dark: string; light: string }
  /** Hover border glow */
  borderHover: { dark: string; light: string }
  /** Box-shadow glow on hover (raw CSS value) */
  glowColor: string
  /** Status badge accent */
  badgeColor: string
}

export const BLOCK_COLORS: Record<string, BlockColorSet> = {
  'storm-resume': {
    iconBg:      { dark: 'bg-teal-500/15',   light: 'bg-teal-50' },
    iconText:    { dark: 'text-teal-400',     light: 'text-teal-600' },
    borderHover: { dark: 'border-teal-500/40', light: 'border-teal-400/50' },
    glowColor:   'rgba(20,184,166,0.18)',
    badgeColor:  'bg-teal-500',
  },
  'driver-resume': {
    iconBg:      { dark: 'bg-blue-500/15',   light: 'bg-blue-50' },
    iconText:    { dark: 'text-blue-400',     light: 'text-blue-600' },
    borderHover: { dark: 'border-blue-500/40', light: 'border-blue-400/50' },
    glowColor:   'rgba(59,130,246,0.15)',
    badgeColor:  'bg-blue-500',
  },
  'driver-dot-application': {
    iconBg:      { dark: 'bg-amber-500/15',   light: 'bg-amber-50' },
    iconText:    { dark: 'text-amber-400',     light: 'text-amber-600' },
    borderHover: { dark: 'border-amber-500/40', light: 'border-amber-400/50' },
    glowColor:   'rgba(245,158,11,0.15)',
    badgeColor:  'bg-amber-500',
  },
  'driver-mvr': {
    iconBg:      { dark: 'bg-purple-500/15',   light: 'bg-purple-50' },
    iconText:    { dark: 'text-purple-400',     light: 'text-purple-600' },
    borderHover: { dark: 'border-purple-500/40', light: 'border-purple-400/50' },
    glowColor:   'rgba(168,85,247,0.15)',
    badgeColor:  'bg-purple-500',
  },
  'driver-psp': {
    iconBg:      { dark: 'bg-orange-500/15',   light: 'bg-orange-50' },
    iconText:    { dark: 'text-orange-400',     light: 'text-orange-700' },
    borderHover: { dark: 'border-orange-500/40', light: 'border-orange-400/50' },
    glowColor:   'rgba(249,115,22,0.18)',
    badgeColor:  'bg-orange-500',
  },
  'driver-cdl-credentials': {
    iconBg:      { dark: 'bg-emerald-500/15',   light: 'bg-emerald-50' },
    iconText:    { dark: 'text-emerald-400',     light: 'text-emerald-600' },
    borderHover: { dark: 'border-emerald-500/40', light: 'border-emerald-400/50' },
    glowColor:   'rgba(16,185,129,0.15)',
    badgeColor:  'bg-emerald-500',
  },
  'developer-resume': {
    iconBg:      { dark: 'bg-cyan-500/15',   light: 'bg-cyan-50' },
    iconText:    { dark: 'text-cyan-400',     light: 'text-cyan-600' },
    borderHover: { dark: 'border-cyan-500/40', light: 'border-cyan-400/50' },
    glowColor:   'rgba(6,182,212,0.15)',
    badgeColor:  'bg-cyan-500',
  },
  'developer-portfolio': {
    iconBg:      { dark: 'bg-pink-500/15',   light: 'bg-pink-50' },
    iconText:    { dark: 'text-pink-400',     light: 'text-pink-600' },
    borderHover: { dark: 'border-pink-500/40', light: 'border-pink-400/50' },
    glowColor:   'rgba(236,72,153,0.15)',
    badgeColor:  'bg-pink-500',
  },
  'developer-projects': {
    iconBg:      { dark: 'bg-orange-500/15',   light: 'bg-orange-50' },
    iconText:    { dark: 'text-orange-400',     light: 'text-orange-600' },
    borderHover: { dark: 'border-orange-500/40', light: 'border-orange-400/50' },
    glowColor:   'rgba(249,115,22,0.15)',
    badgeColor:  'bg-orange-500',
  },
  'developer-github': {
    iconBg:      { dark: 'bg-gray-500/15',   light: 'bg-gray-100' },
    iconText:    { dark: 'text-gray-300',     light: 'text-gray-700' },
    borderHover: { dark: 'border-gray-400/40', light: 'border-gray-400/50' },
    glowColor:   'rgba(156,163,175,0.15)',
    badgeColor:  'bg-gray-500',
  },
  'general-resume': {
    iconBg:      { dark: 'bg-sky-500/15',   light: 'bg-sky-50' },
    iconText:    { dark: 'text-sky-400',     light: 'text-sky-700' },
    borderHover: { dark: 'border-sky-500/40', light: 'border-sky-400/50' },
    glowColor:   'rgba(14,165,233,0.15)',
    badgeColor:  'bg-sky-500',
  },
  'general-employment-verification': {
    iconBg:      { dark: 'bg-violet-500/15',   light: 'bg-violet-50' },
    iconText:    { dark: 'text-violet-400',     light: 'text-violet-700' },
    borderHover: { dark: 'border-violet-500/40', light: 'border-violet-400/50' },
    glowColor:   'rgba(139,92,246,0.15)',
    badgeColor:  'bg-violet-500',
  },
}

/** Fallback color set for unknown block types */
const DEFAULT_BLOCK_COLOR: BlockColorSet = {
  iconBg:      { dark: 'bg-teal-500/15',   light: 'bg-teal-50' },
  iconText:    { dark: 'text-teal-400',     light: 'text-teal-600' },
  borderHover: { dark: 'border-teal-500/40', light: 'border-teal-400/50' },
  glowColor:   'rgba(20,184,166,0.15)',
  badgeColor:  'bg-teal-500',
}

export function getBlockColor(blockType: string): BlockColorSet {
  return BLOCK_COLORS[blockType] ?? DEFAULT_BLOCK_COLOR
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Get a block definition by its id. Returns undefined for unknown types. */
export function getBlockDefinition(blockType: string): BlockDefinition | undefined {
  return BLOCK_DEFINITIONS.find((b) => b.id === blockType)
}

/** True when the block is mandatory and must not be removed from the hub. */
export function isCoreBlock(blockType: string): boolean {
  return getBlockDefinition(blockType)?.coreBlock === true
}

/** All blocks that employers can request from candidates via talent search. */
export function getRequestableBlocks(): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((b) => b.employerRequestable)
}

/**
 * Check if a company's installed employer blocks satisfy a candidate block's
 * outreach requirement. Returns true when:
 * - The block has no `requiredEmployerBlocks` (null — no gating), OR
 * - The company has installed at least one of the required employer blocks (OR logic).
 */
export function employerCanRequest(
  blockDef: BlockDefinition,
  installedEmployerBlocks: string[],
): boolean {
  if (!blockDef.requiredEmployerBlocks) return true
  return blockDef.requiredEmployerBlocks.some((eb) => installedEmployerBlocks.includes(eb))
}

/** Blocks shown in Add Blocks (excludes legacy aliases). */
export function getPickerBlockDefinitions(): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((b) => !b.hiddenFromBlockPicker)
}

/** Get all block definitions for a category, sorted by complexity (simple first). */
export function getBlocksByCategory(categoryId: string): BlockDefinition[] {
  const order = { simple: 0, moderate: 1, complex: 2 }
  return BLOCK_DEFINITIONS
    .filter((b) => b.categoryId === categoryId && !b.hiddenFromBlockPicker)
    .sort((a, b) => order[a.complexity] - order[b.complexity])
}

/**
 * Suggest relevant block types based on free-text occupation and reason.
 * Returns block ids sorted by match score (most relevant first).
 *
 * This is a lightweight keyword match — Stormi can use the full LLM path
 * for richer suggestions, but this covers the fast/offline path.
 */
export function suggestBlocks(occupation: string, seekingReason: string): string[] {
  const input = `${occupation} ${seekingReason}`.toLowerCase()

  const scored = BLOCK_DEFINITIONS.filter((b) => !b.hiddenFromBlockPicker).map((block) => {
    const score = block.suggestedFor.filter((keyword) =>
      input.includes(keyword.toLowerCase())
    ).length
    return { id: block.id, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id)
}

/**
 * Suggest relevant category ids based on free-text input.
 * Used to pre-filter the block picker when Stormi populates suggested_categories.
 */
export function suggestCategories(occupation: string, seekingReason: string): string[] {
  const suggestedBlockIds = suggestBlocks(occupation, seekingReason)
  const categories = new Set<string>()

  for (const id of suggestedBlockIds) {
    const block = getBlockDefinition(id)
    if (block) categories.add(block.categoryId)
  }

  // General category is always included — it applies to everyone
  categories.add('general')

  return Array.from(categories)
}
