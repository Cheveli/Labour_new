import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
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
  const { data: { user: adminUser } } = await supabaseAnon.auth.getUser()
  if (!adminUser || adminUser.email !== 'saichevelly@gmail.com') {
    logger.error('Unauthorized contractor rejection attempt', { email: adminUser?.email })
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
    const { userId, paymentId } = await request.json()

    if (!userId || !paymentId) {
      return NextResponse.json({ error: 'User ID and Payment ID are required' }, { status: 400 })
    }

    logger.info('Starting contractor rejection transaction', { admin: adminUser.email, userId, paymentId })

    // 1. Update user account status
    const { error: userError } = await supabase
      .from('users')
      .update({
        account_status: 'rejected',
        subscription_status: 'inactive',
      })
      .eq('id', userId)

    if (userError) throw userError

    // 2. Update payment record status
    const { error: paymentError } = await supabase
      .from('subscription_payments')
      .update({
        payment_status: 'rejected',
      })
      .eq('id', paymentId)

    if (paymentError) throw paymentError

    logger.info('Contractor rejection completed successfully', { userId, paymentId })
    return NextResponse.json({ message: 'Contractor account has been rejected.' })
  } catch (error: any) {
    logger.error('Reject contractor error', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}
