import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
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

  // Security Check: verify requester is Super Admin
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || adminUser.email !== 'saichevelly@gmail.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { userId, paymentId } = await request.json()

    if (!userId || !paymentId) {
      return NextResponse.json({ error: 'User ID and Payment ID are required' }, { status: 400 })
    }

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
      .from('payments')
      .update({
        payment_status: 'rejected',
      })
      .eq('id', paymentId)

    if (paymentError) throw paymentError

    return NextResponse.json({ message: 'Contractor account has been rejected.' })
  } catch (error: any) {
    console.error('Reject contractor error:', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}
