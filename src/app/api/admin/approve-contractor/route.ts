import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendContractorWelcomeEmail } from '@/lib/mail-utils'
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
    logger.error('Unauthorized contractor approval attempt', { email: adminUser?.email })
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

    logger.info('Starting contractor approval transaction', { admin: adminUser.email, userId, paymentId })

    // Fetch contractor details before approving to get email/fullname
    const { data: contractor, error: fetchError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (fetchError || !contractor) {
      logger.error('Contractor profile not found for approval', { userId })
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

    logger.info('Contractor tables updated successfully in Supabase', { userId, paymentId })

    // 3. Send welcome email to the approved contractor
    try {
      await sendContractorWelcomeEmail({
        contractorName: contractor.full_name,
        emailAddress: contractor.email,
      })
      logger.info('Welcome email sent to contractor', { email: contractor.email })
    } catch (emailError) {
      logger.error('Welcome email failed to send', emailError)
      // Do not fail the API response if email fails, to avoid confusing user
    }

    logger.info('Contractor approval transaction completed successfully', { userId })
    return NextResponse.json({ message: 'Contractor account has been approved and activated.' })
  } catch (error: any) {
    logger.error('Approve contractor error', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}

