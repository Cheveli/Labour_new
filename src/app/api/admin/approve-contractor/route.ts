import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendContractorWelcomeEmail } from '@/lib/mail-utils'

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

    // Fetch contractor details before approving to get email/fullname
    const { data: contractor, error: fetchError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (fetchError || !contractor) {
      return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 })
    }

    // 1. Update user account status and subscription
    const { error: userError } = await supabase
      .from('users')
      .update({
        account_status: 'approved',
        subscription_status: 'active',
      })
      .eq('id', userId)

    if (userError) throw userError

    // 2. Update payment record
    const { error: paymentError } = await supabase
      .from('subscription_payments')
      .update({
        payment_status: 'approved',
        approved_date: new Date().toISOString(),
        approved_by: adminUser.id,
      })
      .eq('id', paymentId)

    if (paymentError) throw paymentError

    // 3. Send welcome email to the approved contractor
    try {
      await sendContractorWelcomeEmail({
        contractorName: contractor.full_name,
        emailAddress: contractor.email,
      })
    } catch (emailError) {
      console.error('Welcome email failed to send:', emailError)
      // Do not fail the API response if email fails, to avoid confusing user
    }

    return NextResponse.json({ message: 'Contractor account has been approved and activated.' })
  } catch (error: any) {
    console.error('Approve contractor error:', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}

