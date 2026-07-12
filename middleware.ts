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

  // --- Auth & Paths Check ---
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  
  const isLoginPage = pathname === '/login'
  const isRegisterPage = pathname === '/register'
  const isPendingPage = pathname === '/pending-verification'
  const isAuthPage = pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')

  const isClientPath = pathname.startsWith('/client')
  const isClientLoginPage = pathname === '/client/login'

  // 1. If not logged in, redirect based on path segment
  if (!user) {
    if (isClientPath) {
      if (!isClientLoginPage && !isAuthPage && !isApiRoute) {
        return NextResponse.redirect(new URL('/client/login', request.url))
      }
    } else {
      if (!isLoginPage && !isRegisterPage && !isAuthPage && !isApiRoute && !isPendingPage) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
    return supabaseResponse
  }

  // 2. If logged in, handle roles and subscriptions access
  if (user) {
    // Super Admin Hardcoded Exception Rules
    if (user.email === 'saichevelly@gmail.com') {
      if (isLoginPage || isRegisterPage || isPendingPage || isClientLoginPage) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      if (isClientPath) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      return supabaseResponse
    }

    try {
      const { data: profile } = await supabase
        .from('users')
        .select('role, account_status, subscription_status')
        .eq('id', user.id)
        .single()

      if (!profile) {
        return supabaseResponse
      }

      // Check client portal access first
      if (profile.role === 'client') {
        if (!isClientPath && !isAuthPage && !isApiRoute) {
          return NextResponse.redirect(new URL('/client/dashboard', request.url))
        }
        if (isClientLoginPage) {
          return NextResponse.redirect(new URL('/client/dashboard', request.url))
        }
        return supabaseResponse
      }

      // Contractor/Supervisor/Admin access controls
      if (isClientPath) {
        return NextResponse.redirect(new URL('/', request.url))
      }

      const isApproved = 
        profile.account_status === 'approved' && 
        profile.subscription_status === 'active'

      if (!isApproved) {
        if (!isPendingPage && !isLoginPage && !isRegisterPage && !isAuthPage && !isApiRoute) {
          return NextResponse.redirect(new URL('/pending-verification', request.url))
        }
      } else {
        if (isLoginPage || isRegisterPage || isPendingPage) {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    } catch (err) {
      console.error('Middleware database check failed:', err)
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
