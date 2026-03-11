import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * DELETE /api/employer/jobs/[id]
 * Permanently deletes a job posting.
 * Only the company that owns the job can delete it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get employer's user ID
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get employer's company (via membership or legacy)
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    // Verify the job belongs to this company
    const { data: job } = await supabase
      .from('job_postings')
      .select('id, company_id, title')
      .eq('id', jobId)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.company_id !== companyId) {
      return NextResponse.json({ error: 'Not authorized to delete this job' }, { status: 403 })
    }

    // Hard delete: permanently remove the job
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', jobId)

    if (error) {
      console.error('[EMPLOYER JOBS DELETE] Error:', error)
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }

    console.log(`[EMPLOYER JOBS DELETE] Deleted job "${job.title}" (${jobId}) by employer ${employer.id}`)

    return NextResponse.json({ success: true, message: 'Job posting deleted' })
  } catch (error) {
    console.error('[EMPLOYER JOBS DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/employer/jobs/[id]
 * Updates a job posting (toggle active status, edit fields).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      isActive,
      title,
      description,
      targetRole,
      locationCity,
      locationState,
      salaryMin,
      salaryMax,
      jobType,
      routeType,
      experienceRequired,
      remoteAllowed,
    } = body

    const supabase = await getAdminSupabaseClient()

    // Get employer's user ID
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get employer's company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    // Verify ownership
    const { data: job } = await supabase
      .from('job_postings')
      .select('id, company_id')
      .eq('id', jobId)
      .single()

    if (!job || job.company_id !== companyId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Build update payload from only provided fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof isActive === 'boolean') updates.is_active = isActive
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (targetRole !== undefined) updates.target_role = targetRole
    if (locationCity !== undefined) updates.location_city = locationCity
    if (locationState !== undefined) updates.location_state = locationState
    if (salaryMin !== undefined) updates.salary_min = salaryMin === '' ? null : Number(salaryMin)
    if (salaryMax !== undefined) updates.salary_max = salaryMax === '' ? null : Number(salaryMax)
    if (jobType !== undefined) updates.job_type = jobType
    if (routeType !== undefined) updates.route_type = routeType
    if (experienceRequired !== undefined) updates.experience_required = experienceRequired === '' ? null : Number(experienceRequired)
    if (typeof remoteAllowed === 'boolean') updates.remote_allowed = remoteAllowed

    const { data: updated, error } = await supabase
      .from('job_postings')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('[EMPLOYER JOBS PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    return NextResponse.json({ success: true, job: updated })
  } catch (error) {
    console.error('[EMPLOYER JOBS PATCH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
