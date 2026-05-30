import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * GET /api/driver/leads
 * 
 * Fetches all leads (employer connections) for the authenticated driver.
 * These are employers who scanned the driver's QR code and clicked "Connect".
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Fetch leads for this driver
    const { data: leads, error: leadsError } = await supabase
      .from('driver_leads')
      .select(`
        id,
        employer_name,
        employer_email,
        employer_phone,
        employer_company_name,
        event_name,
        notes,
        source,
        status,
        created_at,
        contacted_at,
        employer_user_id,
        company_id,
        companies (
          company_name,
          logo_url,
          verified
        )
      `)
      .eq('driver_user_id', userId)
      .order('created_at', { ascending: false })

    if (leadsError) {
      console.error('[LEADS] Error fetching leads:', leadsError)
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      )
    }

    // Process leads
    const processedLeads = (leads || []).map(lead => {
      const company = lead.companies as any
      return {
        id: lead.id,
        // Use company name if available, otherwise use provided info
        name: company?.company_name || lead.employer_company_name || lead.employer_name || 'Anonymous',
        contactName: lead.employer_name,
        email: lead.employer_email,
        phone: lead.employer_phone,
        companyName: company?.company_name || lead.employer_company_name,
        companyLogo: company?.logo_url,
        companyVerified: company?.verified || false,
        eventName: lead.event_name,
        notes: lead.notes,
        source: lead.source,
        status: lead.status,
        createdAt: lead.created_at,
        contactedAt: lead.contacted_at,
        isRegistered: !!lead.employer_user_id, // Whether employer has a Storm account
      }
    })

    // Count by status
    const stats = {
      total: processedLeads.length,
      new: processedLeads.filter(l => l.status === 'new').length,
      contacted: processedLeads.filter(l => l.status === 'contacted').length,
      interviewing: processedLeads.filter(l => l.status === 'interviewing').length,
      hired: processedLeads.filter(l => l.status === 'hired').length,
    }

    return NextResponse.json({
      success: true,
      leads: processedLeads,
      stats,
    })

  } catch (error) {
    console.error('[LEADS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/driver/leads
 * 
 * Updates a lead's status (e.g., mark as contacted).
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { leadId, status } = body

    if (!leadId || !status) {
      return NextResponse.json(
        { error: 'leadId and status are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['new', 'contacted', 'interviewing', 'hired', 'archived']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Update lead (only if driver owns it)
    const updateData: Record<string, string> = { status }
    if (status === 'contacted' || status === 'interviewing' || status === 'hired') {
      updateData.contacted_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('driver_leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('driver_user_id', userId)

    if (updateError) {
      console.error('[LEADS] Error updating lead:', updateError)
      return NextResponse.json(
        { error: 'Failed to update lead' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully',
    })

  } catch (error) {
    console.error('[LEADS] Error updating:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
