import { BLOCK_DEFINITIONS, employerCanRequest, type BlockDefinition } from '@/lib/block-registry'

/**
 * Blocks an employer can send to a candidate as an invite link.
 *
 * Derived from the registry rather than a hard-coded list so a new block
 * shows up in the outreach picker the day it is registered. Three signals
 * already on `BlockDefinition` do all the work:
 *
 *   - `employerRequestable`         — the block is something employers ask for at all
 *   - `coreBlock`                   — auto-installed on every driver hub (DOT application);
 *                                     the driver already has it as a to-do, so no invite
 *   - `employerOrderEvidenceTable`  — a paid order (MVR / PSP) placed by the employer after
 *                                     consent is signed, never an invite
 *
 * Today this returns only `driver-screening-consent`. That is the point: signing the
 * consent bundle is what triggers the MVR + PSP orders, so it is the one thing a
 * recruiter needs to send.
 */
export function getSendableOutreachBlocks(installedEmployerBlockTypes: string[]): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter(
    (b) =>
      b.employerRequestable &&
      !b.coreBlock &&
      !b.employerOrderEvidenceTable &&
      employerCanRequest(b, installedEmployerBlockTypes),
  )
}
