import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'

const font = Outfit({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans'
})

export const metadata: Metadata = {
  title: 'Labourly Pro | Contractor Management System',
  description: 'Enterprise-grade labour, site, and material management for contractors.',
}

export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={font.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
