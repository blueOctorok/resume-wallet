import type { SupabaseClient } from '@supabase/supabase-js'
import { loadMvrDotProjection } from '@/lib/mvr-form1-projection'
import { applyProjectionToApplicationData } from '@/lib/apply-mvr-to-dot-application'
import { loadPspDotProjection } from '@/lib/psp-form2-projection'
import { applyPspProjectionToApplicationData } from '@/lib/apply-psp-to-dot-application'
import {
  loadEmploymentForm3Projection,
  applyEmploymentProjectionToForm3,
} from '@/lib/employment-form3-projection'
import type { Form1WithProvenance, Form2WithProvenance } from '@/lib/dot-field-provenance'
import type { Form3WithProvenance } from '@/lib/employment-form3-provenance'

export interface DotApplicationData {
  form1: Form1WithProvenance | null
  form2: Form2WithProvenance | null
  form3: Form3WithProvenance | null
}

/**
 * Overwrite issuer-sourced DOT rows (MVR → PSP → EVR, order preserves prior
 * stamps) from live screening results before any persist. Shared by progress
 * saves and the final submit so a client can never write over a locked row.
 */
export async function reprojectScreeningOntoApp(
  supabase: SupabaseClient,
  userId: string,
  applicationData: Partial<DotApplicationData>,
): Promise<DotApplicationData> {
  const [mvr, psp, employment] = await Promise.all([
    loadMvrDotProjection(supabase, userId),
    loadPspDotProjection(supabase, userId),
    loadEmploymentForm3Projection(supabase, userId),
  ])

  let form1 = applicationData.form1 ?? null
  let form2 = applicationData.form2 ?? null
  let form3 = applicationData.form3 ?? null

  if (mvr && (form1 || form2)) {
    const next = applyProjectionToApplicationData({ form1, form2, form3 }, mvr)
    form1 = next.form1
    form2 = next.form2
  }
  if (psp && (form1 || form2)) {
    const next = applyPspProjectionToApplicationData({ form1, form2, form3 }, psp)
    form1 = next.form1 as Form1WithProvenance | null
    form2 = next.form2
  }
  // Form 3 EVR projection runs even when form3 is empty — injects verified rows
  if (employment) {
    form3 = applyEmploymentProjectionToForm3(form3, employment)
  }
  return { form1, form2, form3 }
}
