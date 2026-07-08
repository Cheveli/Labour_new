import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  // 1. Create a public anon client to read request cookies and verify session
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {},
      },
    }
  )

  // Security Check: verify requester is Super Admin using the anon client
  const { data: { user } } = await supabaseAnon.auth.getUser()
  if (!user || user.email !== 'saichevelly@gmail.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Create admin client with service role key to perform database operations
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
    // Select all users in public users table except for super admin
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .neq('role', 'superadmin')
      .order('created_at', { ascending: false })

    if (usersError) throw usersError

    return NextResponse.json(allUsers || [])
  } catch (error: any) {
    console.error('Fetch all contractors error:', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}
