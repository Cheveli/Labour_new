import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
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

  // Security Check: verify requester is Super Admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'saichevelly@gmail.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Select users with their payment records where the status is pending
    const { data: pendingUsers, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        mobile_number,
        email,
        account_status,
        subscription_status,
        created_at,
        payments (
          id,
          amount,
          utr_number,
          screenshot_url,
          payment_status,
          submitted_date
        )
      `)
      .eq('account_status', 'pending')

    if (usersError) throw usersError

    return NextResponse.json(pendingUsers || [])
  } catch (error: any) {
    console.error('Fetch pending requests error:', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}
