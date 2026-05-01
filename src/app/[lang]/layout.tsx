import type { Metadata } from 'next'
import { Outfit, Noto_Sans_Telugu } from 'next/font/google'
import '../globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { LangProvider } from '@/lib/i18n'

const font = Outfit({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans'
})

const teluguFont = Noto_Sans_Telugu({
  subsets: ['telugu'],
  display: 'swap',
  weight: ['400', '600', '700', '800'],
  variable: '--font-telugu'
})

export const metadata: Metadata = {
  title: 'Labourly Pro | Contractor Management System',
  description: 'Enterprise-grade labour, site, and material management for contractors.',
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ lang: string }>
}>) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang;
  return (
    <html lang={lang} suppressHydrationWarning className={`${font.variable} ${teluguFont.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <LangProvider initialLang={lang as 'en' | 'te'}>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
