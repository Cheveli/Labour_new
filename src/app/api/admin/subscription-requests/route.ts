import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { logger } from '@/lib/logger'

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
    logger.error('Unauthorized subscription requests fetch attempt', { email: user?.email })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  logger.info('Fetching pending subscription requests', { admin: user.email })

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
        subscription_payments (
          id,
          amount,
          utr_number,
          screenshot_url,
          payment_status,
          created_at
        )
      `)
      .eq('account_status', 'pending')

    if (usersError) throw usersError

    logger.info(`Successfully fetched ${pendingUsers?.length || 0} pending requests`)
    return NextResponse.json(pendingUsers || [])
  } catch (error: any) {
    logger.error('Fetch pending requests error', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}
