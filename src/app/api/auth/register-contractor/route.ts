import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendAdminNotificationEmail } from '@/lib/mail-utils'

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

  try {
    const { fullName, email, mobileNumber, utrNumber, screenshotUrl, amount } = await request.json()

    // 1. Validation: check required fields
    if (!fullName || !email || !mobileNumber || !utrNumber || !screenshotUrl) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // 2. Validation: check duplicate mobile number or email in users
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email, mobile_number')
      .or(`email.eq.${email},mobile_number.eq.${mobileNumber}`)

    if (checkError) {
      console.error('Duplicate checks failed:', checkError)
    }

    if (existingUser && existingUser.length > 0) {
      const matched = existingUser[0]
      if (matched.email.toLowerCase() === email.toLowerCase()) {
        return NextResponse.json({ error: 'Email address already exists' }, { status: 400 })
      }
      if (matched.mobile_number === mobileNumber) {
        return NextResponse.json({ error: 'Mobile number already registered' }, { status: 400 })
      }
    }

    // 3. Validation: check duplicate UTR in payments
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('utr_number')
      .eq('utr_number', utrNumber)
      .maybeSingle()

    if (existingPayment) {
      return NextResponse.json({ error: 'This UTR number has already been submitted' }, { status: 400 })
    }

    // 4. Create user in Supabase Auth (we use random password as they log in with phone OTP)
    const tempPassword = 'TEMP_PW_' + Math.random().toString(36).slice(-10) + '!'
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: {
          full_name: fullName,
          mobile_number: mobileNumber,
        },
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create auth credentials' }, { status: 400 })
    }

    const userId = authData.user.id

    // 5. Insert public user profile record
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: userId,
        full_name: fullName,
        mobile_number: mobileNumber,
        email: email,
        role: 'contractor',
        account_status: 'pending',
        subscription_status: 'inactive',
      })

    if (profileError) {
      console.error('DB Profile insert failed:', profileError)
      return NextResponse.json({ error: 'Failed to create database profile: ' + profileError.message }, { status: 500 })
    }

    // 6. Insert payment verification record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: Number(amount) || 1,
        utr_number: utrNumber,
        screenshot_url: screenshotUrl,
        payment_status: 'pending_verification',
      })

    if (paymentError) {
      console.error('DB Payment insert failed:', paymentError)
      return NextResponse.json({ error: 'Failed to record payment transaction: ' + paymentError.message }, { status: 500 })
    }

    // 7. Send SMTP email notification to Super Admin
    try {
      await sendAdminNotificationEmail({
        contractorName: fullName,
        mobileNumber,
        emailAddress: email,
        utrNumber,
        screenshotUrl,
        registrationDate: new Date().toLocaleDateString(),
      })
    } catch (emailErr) {
      console.error('SMTP notification email failed to send:', emailErr)
      // Do not block registration success if email fails, but log the warning
    }

    return NextResponse.json({ message: 'Registration submitted successfully!' })
  } catch (error: any) {
    console.error('Registration API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error occurred' }, { status: 500 })
  }
}
