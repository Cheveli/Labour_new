import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  // Use service role to perform admin auth actions
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
    const { fullName, email, mobileNumber, password } = await request.json()

    if (!fullName || !email || !mobileNumber || !password) {
      return NextResponse.json({ error: 'All client fields are required' }, { status: 400 })
    }

    // 1. Check if user already exists in users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, mobile_number')
      .or(`email.eq.${email},mobile_number.eq.${mobileNumber}`)
      .limit(1)

    if (existingUser && existingUser.length > 0) {
      const match = existingUser[0]
      // If client exists, update the auth password and user profile
      const userId = match.id

      // Update password in Auth
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, {
        password: password,
        email: email,
        user_metadata: {
          full_name: fullName,
          mobile_number: mobileNumber,
        }
      })

      if (updateAuthError) {
        console.error('Update Auth user failed:', updateAuthError)
      }

      // Update details in users profile table
      const { error: updateProfileError } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          mobile_number: mobileNumber,
          role: 'client',
          account_status: 'approved',
          subscription_status: 'active'
        })
        .eq('id', userId)

      if (updateProfileError) {
        return NextResponse.json({ error: 'Failed to update client profile: ' + updateProfileError.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Client updated successfully', userId })
    }

    // 2. Create the new client user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        mobile_number: mobileNumber,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create client auth credentials' }, { status: 400 })
    }

    const userId = authData.user.id

    // 3. Insert into public.users
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: userId,
        full_name: fullName,
        mobile_number: mobileNumber,
        email: email,
        role: 'client',
        account_status: 'approved',
        subscription_status: 'active',
      })

    if (profileError) {
      console.error('DB Client Profile insert failed:', profileError)
      // Cleanup auth user if DB profile insert failed
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Failed to record database profile: ' + profileError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Client registered successfully!', userId })
  } catch (error: any) {
    console.error('Register client API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error occurred' }, { status: 500 })
  }
}
