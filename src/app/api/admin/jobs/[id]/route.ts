import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const ADMIN_WALLETS = [
  '0x7682d6a5b1f3988f85de72a721e72c8e6279cb07',
]

function isAdmin(walletAddress: string): boolean {
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase())
}

/**
 * DELETE /api/admin/jobs/[id]
 * Hard deletes a job posting (admin only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress || !isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get job info for logging
    const { data: job } = await supabase
      .from('job_postings')
      .select('title, company_id')
      .eq('id', jobId)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Hard delete the job
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', jobId)

    if (error) {
      console.error('[ADMIN JOBS DELETE] Error:', error)
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }

    console.log(`[ADMIN JOBS DELETE] Deleted job "${job.title}" (${jobId}) by admin ${walletAddress}`)

    return NextResponse.json({ success: true, message: 'Job deleted permanently' })
  } catch (error) {
    console.error('[ADMIN JOBS DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/jobs/[id]
 * Updates a job posting (admin can toggle active, etc.).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const walletAddress = request.headers.get('x-wallet-address')
    
    if (!walletAddress || !isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { isActive } = body

    const supabase = await getAdminSupabaseClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof isActive === 'boolean') {
      updates.is_active = isActive
    }

    const { data: job, error } = await supabase
      .from('job_postings')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN JOBS PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    console.log(`[ADMIN JOBS PATCH] Updated job "${job.title}" (${jobId}) by admin ${walletAddress}`)

    return NextResponse.json({ success: true, job })
  } catch (error) {
    console.error('[ADMIN JOBS PATCH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
