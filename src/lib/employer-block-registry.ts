/**
 * Employer Block Registry — composable blocks for industry-specific employer tools.
 *
 * Universal employer features (Kanban, jobs, team, messages, outreach) are permanent.
 * Industry-specific tools live here as blocks that employers add based on what they hire for.
 *
 * Adding a new employer block:
 *   1. Add an EmployerBlockDefinition entry here
 *   2. Wire its page route in EmployerShell
 *   3. No schema changes — employer_hub_blocks.block_type is open text
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmployerBlockDefinition {
  id: string
  label: string
  description: string
  /** Icon name from lucide-react */
  icon: string
  categoryId: string
  /**
   * Keywords matched against the employer's hiring categories
   * to auto-suggest blocks during company setup.
   */
  suggestedFor: string[]
  /** Route in EmployerShell when this block is clicked. null = no page yet. */
  pageRoute: string | null
}

export interface EmployerBlockCategory {
  id: string
  label: string
  description: string
  icon: string
  order: number
}

// ── Categories ───────────────────────────────────────────────────────────────

export const EMPLOYER_BLOCK_CATEGORIES: EmployerBlockCategory[] = [
  {
    id: 'drivers',
    label: 'Drivers',
    description: 'Tools for hiring CDL drivers and DOT compliance',
    icon: 'Truck',
    order: 0,
  },
  {
    id: 'developers',
    label: 'Developers',
    description: 'Tools for hiring software engineers',
    icon: 'Code2',
    order: 1,
  },
  {
    id: 'general',
    label: 'General',
    description: 'Tools that work across any industry',
    icon: 'LayoutGrid',
    order: 2,
  },
]

// ── Block Definitions ────────────────────────────────────────────────────────

export const EMPLOYER_BLOCK_DEFINITIONS: EmployerBlockDefinition[] = [
  // ── Drivers ──────────────────────────────────────────────────────────────
  {
    id: 'employer-mvr-ordering',
    label: 'MVR Ordering',
    description: 'Order and manage motor vehicle records for driver candidates',
    icon: 'Car',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'trucking', 'logistics', 'freight', 'motor carrier'],
    pageRoute: null,
  },
  {
    id: 'employer-dot-compliance',
    label: 'DOT Compliance',
    description: 'Track DOT application completion and FMCSA qualification files',
    icon: 'ClipboardCheck',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'dot', 'fmcsa', 'trucking', 'motor carrier'],
    pageRoute: null,
  },
  {
    id: 'employer-driver-search',
    label: 'Find Drivers',
    description: 'Search candidates by CDL class, endorsements, and DOT status',
    icon: 'Search',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'trucking', 'logistics', 'freight'],
    pageRoute: 'find-drivers',
  },
  {
    id: 'employer-compliance-reports',
    label: 'Compliance Reports',
    description: 'MVR summaries, DOT completion rates, and background check tracking',
    icon: 'FileText',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'compliance', 'dot', 'fmcsa', 'motor carrier'],
    pageRoute: 'reports',
  },
  {
    id: 'employer-employment-verification',
    label: 'Employment Verification',
    description: 'Verify driver employment history with previous employers',
    icon: 'ShieldCheck',
    categoryId: 'drivers',
    suggestedFor: ['driver', 'cdl', 'verification', 'employment', 'trucking'],
    pageRoute: null,
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getEmployerBlockDefinition(blockType: string): EmployerBlockDefinition | undefined {
  return EMPLOYER_BLOCK_DEFINITIONS.find((b) => b.id === blockType)
}

export function getEmployerBlocksByCategory(categoryId: string): EmployerBlockDefinition[] {
  return EMPLOYER_BLOCK_DEFINITIONS.filter((b) => b.categoryId === categoryId)
}

/**
 * Suggest employer blocks based on the company's hiring categories.
 * Returns block ids sorted by relevance.
 */
export function suggestEmployerBlocks(hiringCategories: string[]): string[] {
  const input = hiringCategories.map((c) => c.toLowerCase()).join(' ')

  const scored = EMPLOYER_BLOCK_DEFINITIONS.map((block) => {
    const score = block.suggestedFor.filter((kw) => input.includes(kw.toLowerCase())).length
    return { id: block.id, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id)
}
