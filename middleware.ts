import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // --- Auth Check ---
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  
  const isLoginPage = pathname === '/login'
  const isRegisterPage = pathname === '/register'
  const isPendingPage = pathname === '/pending-verification'
  const isAuthPage = pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')

  // If not logged in, only allow login, register, auth callback, or API endpoints
  if (!user) {
    if (!isLoginPage && !isRegisterPage && !isAuthPage && !isApiRoute && !isPendingPage) {
      const url = new URL('/login', request.url)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // If logged in, handle roles and subscription access
  if (user) {
    // 1. Super Admin Hardcoded Exception Rules
    if (user.email === 'saichevelly@gmail.com') {
      if (isLoginPage || isRegisterPage || isPendingPage) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      return supabaseResponse
    }

    // 2. Regular User Verification
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('role, account_status, subscription_status')
        .eq('id', user.id)
        .single()

      const isApproved = 
        profile && 
        profile.account_status === 'approved' && 
        profile.subscription_status === 'active'

      if (!isApproved) {
        // Redirection to pending verification page if not approved
        if (!isPendingPage && !isLoginPage && !isRegisterPage && !isAuthPage && !isApiRoute) {
          return NextResponse.redirect(new URL('/pending-verification', request.url))
        }
      } else {
        // If approved and on auth/pending pages, redirect to dashboard
        if (isLoginPage || isRegisterPage || isPendingPage) {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    } catch (err) {
      console.error('Middleware database check failed:', err)
      // Fallback: block on error to be safe, except on login/auth routes
      if (!isPendingPage && !isLoginPage && !isRegisterPage && !isAuthPage && !isApiRoute) {
        return NextResponse.redirect(new URL('/pending-verification', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

