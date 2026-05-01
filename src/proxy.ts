import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const locales = ['en', 'te']
const defaultLocale = 'en'

function getLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get('lang')?.value
  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale
  }
  return defaultLocale
}

export async function proxy(request: NextRequest) {
  // First run supabase auth middleware
  let response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Ignore /api, /auth, static files, images
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return response
  }

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    // If the path already has a locale, sync the cookie
    const localeInPath = locales.find((locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`)
    if (localeInPath) {
       response.cookies.set('lang', localeInPath, { path: '/' })
    }
    return response
  }

  // Redirect if there is no locale
  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname}`
  
  // Create a new redirect response but copy headers from auth response if needed
  // For simplicity, just redirect and set the cookie
  response = NextResponse.redirect(request.nextUrl)
  response.cookies.set('lang', locale, { path: '/' })
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
