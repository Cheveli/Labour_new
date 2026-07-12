import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyUserRole } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  // 1. Verify caller has client role
  const { user, authorized } = await verifyUserRole(request, ['client'])
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Access denied. Unauthorized role.' }, { status: 403 })
  }

  // 2. Initialize service role client to perform updates safely
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
    const { text, projectId } = await request.json()

    if (!text || !projectId) {
      return NextResponse.json({ error: 'Message text and projectId are required' }, { status: 400 })
    }

    // Load current project
    const { data: project, error: getError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (getError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify this client is authorized to message on this project
    let meta = {
      address: '',
      project_type: 'Material Contract',
      client_email: '',
      client_mobile: '',
      client_id: null,
      progress_updates: [],
      chat: [],
      money_requests: [],
      material_requests: []
    }

    if (project.description && project.description.startsWith('{')) {
      try {
        meta = { ...meta, ...JSON.parse(project.description) }
      } catch (e) {}
    }

    if (meta.client_id !== user.id) {
      return NextResponse.json({ error: 'Access denied. Client not linked to this project.' }, { status: 403 })
    }

    // Append message
    const newMessage = {
      sender: 'client',
      text: text.trim(),
      timestamp: new Date().toISOString()
    }

    const updatedPayload = JSON.stringify({
      ...meta,
      chat: [...(meta.chat || []), newMessage]
    })

    const { error: updateError } = await supabase
      .from('projects')
      .update({ description: updatedPayload })
      .eq('id', projectId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to send message: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Message sent successfully', chat: [...(meta.chat || []), newMessage] })
  } catch (error: any) {
    console.error('Send client message error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
