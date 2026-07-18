import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyUserRole } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  // 1. Verify caller has client role
  const { user, authorized } = await verifyUserRole(request, ['client'])
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Access denied. Unauthorized role.' }, { status: 403 })
  }

  // 2. Initialize service role client to retrieve details safely
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {},
      },
    }
  )

  try {
    // 3. Find the project linked to this client
    const { data: allProjects, error: projError } = await supabase
      .from('projects')
      .select('*')
      .neq('status', 'SYSTEM')

    if (projError || !allProjects) {
      return NextResponse.json({ error: 'Failed to query projects: ' + projError?.message }, { status: 500 })
    }

    // Find the project where description has client_id matching user.id
    const project = allProjects.find(p => {
      if (p.description && p.description.startsWith('{')) {
        try {
          const parsed = JSON.parse(p.description)
          return parsed.client_id === user.id
        } catch (e) {}
      }
      return false
    })

    if (!project) {
      return NextResponse.json({ error: 'No active project linked to this client account.' }, { status: 404 })
    }

    // Parse the project description metadata
    let meta = {
      address: '',
      project_type: 'Material Contract',
      client_email: '',
      client_mobile: '',
      client_id: null,
      progress_updates: [],
      chat: [],
      money_requests: [],
      material_requests: [],
      pushed_agreement_ids: []
    }
    
    if (project.description && project.description.startsWith('{')) {
      try {
        meta = { ...meta, ...JSON.parse(project.description) }
      } catch (e) {}
    } else {
      meta.address = project.description || ''
    }

    // 4. Fetch Payments (client revenue) from income table for this project
    const { data: payments } = await supabase
      .from('income')
      .select('*')
      .eq('project_id', project.id)
      .order('date', { ascending: false })

    // 5. Fetch Agreements linked to this project
    const { data: agreements } = await supabase
      .from('agreements')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    const pushedIds = (meta as any).pushed_agreement_ids || []
    const filteredAgreements = (agreements || []).filter(a => pushedIds.includes(a.id))

    // 6. Fetch Important Dates for the contractor of this project
    let contractorId = null
    if (agreements && agreements.length > 0) {
      contractorId = agreements[0].user_id
    }
    
    let datesQuery = supabase.from('important_dates').select('*').order('date', { ascending: true })
    if (contractorId) {
      datesQuery = datesQuery.eq('user_id', contractorId)
    }
    const { data: allDates } = await datesQuery

    // Filter in-memory to ensure client only sees dates associated with this specific project (or legacy dates)
    const importantDates = (allDates || []).filter(d => {
      if (d.description && d.description.startsWith('{')) {
        try {
          const parsed = JSON.parse(d.description)
          return parsed.project_id === project.id
        } catch (e) {
          return true
        }
      }
      return true
    }).map(d => {
      // Map it to return clean description text to the client
      if (d.description && d.description.startsWith('{')) {
        try {
          const parsed = JSON.parse(d.description)
          return {
            ...d,
            description: parsed.description || null
          }
        } catch (e) {
          return d
        }
      }
      return d
    })

    // 7. Get contractor company settings (from company_settings table)
    const { data: settings } = await supabase
      .from('company_settings')
      .select('key, value')

    const companyDetails: any = {
      name: 'Sri Sai Constructions',
      phone1: '9550017985',
      contractor: 'Sai Cheveli'
    }

    settings?.forEach(s => {
      if (s.key === 'company_name') companyDetails.name = s.value
      if (s.key === 'phone1') companyDetails.phone1 = s.value
      if (s.key === 'contractor_name') companyDetails.contractor = s.value
    })

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        owner_name: project.owner_name,
        status: project.status,
        ...meta
      },
      payments: payments || [],
      agreements: filteredAgreements,
      importantDates: importantDates || [],
      companyDetails
    })
  } catch (error: any) {
    console.error('Client data-loader API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error occurred' }, { status: 500 })
  }
}
