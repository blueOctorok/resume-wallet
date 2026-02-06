import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recompute developer employment_history from the user's developer_built resumes.
 * Uses the most recent resume that has structured_data.experience.
 * Used when: profile is read (backfill) and when a developer resume is deleted (recompute).
 */
export async function getEmploymentFromResumes(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<Record<string, unknown>>> {
  const { data: resumes } = await supabase
    .from('resumes')
    .select('id, structured_data')
    .eq('user_id', userId)
    .eq('resume_type', 'developer_built')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!resumes?.length) return []

  for (const resume of resumes) {
    const sd = resume.structured_data as {
      experience?: Array<{
        id: string
        company?: string
        title?: string
        location?: string
        startDate?: string
        endDate?: string
        isCurrent?: boolean
        description?: string
      }>
    } | null
    const experience = sd?.experience
    if (!experience?.length) continue

    return experience.map((exp) => ({
      id: exp.id,
      companyName: exp.company ?? '',
      position: exp.title ?? '',
      location: exp.location ?? '',
      startDate: exp.startDate ?? '',
      endDate: exp.isCurrent ? '' : (exp.endDate ?? ''),
      description: exp.description ?? undefined,
    }))
  }

  return []
}
