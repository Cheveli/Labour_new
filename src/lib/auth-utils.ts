import { type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function verifyUserRole(request: NextRequest, allowedRoles: string[]) {
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

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { user: null, profile: null, authorized: false }
  }

  const { data: profile, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (dbError || !profile) {
    return { user, profile: null, authorized: false }
  }

  const authorized = allowedRoles.includes(profile.role)
  return { user, profile, authorized }
}
export type UserProfile = {
  id: string
  full_name: string
  mobile_number: string
  email: string
  role: 'superadmin' | 'admin' | 'contractor' | 'client'
  account_status: 'pending' | 'approved' | 'rejected'
  subscription_status: 'active' | 'inactive'
}
