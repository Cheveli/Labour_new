import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
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
    const { data, error } = await supabase
      .from('company_settings')
      .select('value')
      .eq('key', 'subscription_amount')
      .single()

    if (error || !data) {
      return NextResponse.json({ amount: 1 })
    }

    const amount = Number(data.value) || 1
    return NextResponse.json({ amount })
  } catch (error) {
    console.error('Failed to fetch subscription amount:', error)
    return NextResponse.json({ amount: 1 })
  }
}

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'saichevelly@gmail.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { amount } = await request.json()
    
    if (amount === undefined || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 })
    }

    const { error } = await supabase
      .from('company_settings')
      .upsert({
        key: 'subscription_amount',
        value: Number(amount)
      })

    if (error) throw error

    return NextResponse.json({ message: 'Subscription fee updated successfully', amount: Number(amount) })
  } catch (error: any) {
    console.error('Failed to update subscription amount:', error)
    return NextResponse.json({ error: error.message || 'Internal server error occurred' }, { status: 500 })
  }
}

