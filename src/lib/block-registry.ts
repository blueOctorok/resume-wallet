/**
 * Block Registry — the single source of truth for every composable hub block.
 *
 * A "block" is a self-contained feature unit that a candidate adds to their hub.
 * Each block owns its own component, its own Zustand store, and its own data.
 * The hub itself is stateless — it just reads this registry and renders blocks.
 *
 * Adding a new block type in the future:
 *   1. Add a BlockDefinition entry here
 *   2. Create the block component in src/components/blocks/
 *   3. Create the block's Zustand store in src/stores/
 *   4. Register it in the lazy block map in CandidateShell
 *   5. No schema changes needed — hub_blocks.block_type is open text
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
   * Keywords AvA matches against the user's occupation + seeking_reason
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
// Resume is intentionally role-specific. A driver resume has CDL fields,
// endorsements, and trucking experience sections. A developer resume has
// skills, frameworks, and project links. They share the resume concept
// but present completely different data — so they are separate block types.

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // ── General ────────────────────────────────────────────────────────────────
  {
    id: 'general-skills',
    label: 'Skills',
    description: 'A list of your skills, tools, and certifications',
    icon: 'Wrench',
    categoryId: 'general',
    suggestedFor: ['skills', 'certifications', 'tools', 'experience'],
    complexity: 'simple',
    appearsOnCareerCard: true,
  },
  {
    id: 'general-work-history',
    label: 'Work History',
    description: 'Your employment history across any industry',
    icon: 'Briefcase',
    categoryId: 'general',
    suggestedFor: ['work', 'jobs', 'employment', 'history', 'experience'],
    complexity: 'moderate',
    appearsOnCareerCard: true,
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
  },
  {
    id: 'developer-github',
    label: 'GitHub Activity',
    description: 'Contribution graph and public repository highlights',
    icon: 'Github',
    categoryId: 'developers',
    suggestedFor: ['developer', 'software', 'github', 'open source', 'contributions', 'code'],
    complexity: 'simple',
    appearsOnCareerCard: true,
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Get a block definition by its id. Returns undefined for unknown types. */
export function getBlockDefinition(blockType: string): BlockDefinition | undefined {
  return BLOCK_DEFINITIONS.find((b) => b.id === blockType)
}

/** Get all block definitions for a category, sorted by complexity (simple first). */
export function getBlocksByCategory(categoryId: string): BlockDefinition[] {
  const order = { simple: 0, moderate: 1, complex: 2 }
  return BLOCK_DEFINITIONS
    .filter((b) => b.categoryId === categoryId)
    .sort((a, b) => order[a.complexity] - order[b.complexity])
}

/**
 * Suggest relevant block types based on free-text occupation and reason.
 * Returns block ids sorted by match score (most relevant first).
 *
 * This is a lightweight keyword match — AvA can use the full LLM path
 * for richer suggestions, but this covers the fast/offline path.
 */
export function suggestBlocks(occupation: string, seekingReason: string): string[] {
  const input = `${occupation} ${seekingReason}`.toLowerCase()

  const scored = BLOCK_DEFINITIONS.map((block) => {
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
 * Used to pre-filter the block picker when AvA populates suggested_categories.
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
