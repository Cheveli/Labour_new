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

  try {
    const { mobileNumber } = await request.json()

    if (!mobileNumber) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 })
    }

    // Query user by mobile number in public users table
    const { data: user, error } = await supabase
      .from('users')
      .select('email, account_status, subscription_status')
      .eq('mobile_number', mobileNumber)
      .maybeSingle()

    if (error || !user) {
      return NextResponse.json({ error: 'Mobile number not registered. Please create a new registration.' }, { status: 404 })
    }

    return NextResponse.json({ email: user.email, status: user.account_status, subscription: user.subscription_status })
  } catch (error: any) {
    console.error('Lookup mobile API error:', error)
    return NextResponse.json({ error: 'Internal server error occurred' }, { status: 500 })
  }
}
