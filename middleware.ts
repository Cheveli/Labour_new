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

  try {
    await supabase.auth.getUser()
  } catch (err: any) {
    // If refresh token is invalid/expired, clear auth cookies and redirect to login
    if (err?.code === 'refresh_token_not_found' || err?.status === 400) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectResponse = NextResponse.redirect(url)
      // Clear all supabase auth cookies
      request.cookies.getAll().forEach(cookie => {
        if (cookie.name.startsWith('sb-')) {
          redirectResponse.cookies.delete(cookie.name)
        }
      })
      return redirectResponse
    }
  }

  // --- i18n Logic ---
  const locales = ['en', 'te']
  const defaultLocale = 'en'
  const { pathname } = request.nextUrl

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    const localeInPath = locales.find((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`)
    if (localeInPath) {
       supabaseResponse.cookies.set('lang', localeInPath, { path: '/' })
    }
    return supabaseResponse
  }

  // Redirect if there is no locale
  const cookieLocale = request.cookies.get('lang')?.value
  const locale = (cookieLocale && locales.includes(cookieLocale)) ? cookieLocale : defaultLocale
  
  request.nextUrl.pathname = `/${locale}${pathname}`
  const redirectResponse = NextResponse.redirect(request.nextUrl)
  
  // Set lang cookie
  redirectResponse.cookies.set('lang', locale, { path: '/' })
  
  // We need to carry over the auth cookies that were refreshed by supabase
  const allSetCookies = supabaseResponse.headers.get('set-cookie')
  if (allSetCookies) {
    redirectResponse.headers.set('set-cookie', allSetCookies)
  }

  return redirectResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
