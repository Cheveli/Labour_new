'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import ClientSidebar from '@/components/layout/ClientSidebar'
import ClientMobileHeader from '@/components/layout/ClientMobileHeader'
import ClientMobileBottomNav from '@/components/layout/ClientMobileBottomNav'
import { cn } from '@/lib/utils'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/client/login'

  const [mobileTheme, setMobileTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ssc_mobile_theme') as 'dark' | 'light' || 'dark'
      setMobileTheme(saved)

      const handleThemeChange = () => {
        const updated = localStorage.getItem('ssc_mobile_theme') as 'dark' | 'light' || 'dark'
        setMobileTheme(updated)
      }
      window.addEventListener('ssc_mobile_theme_changed', handleThemeChange)
      return () => window.removeEventListener('ssc_mobile_theme_changed', handleThemeChange)
    }
  }, [])

  if (isLoginPage) {
    return (
      <div className="h-screen w-screen overflow-hidden" style={{ backgroundColor: '#0a0c12' }}>
        <main className="h-full w-full overflow-y-auto">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className={cn("h-screen flex flex-col lg:flex-row overflow-hidden", mobileTheme === 'light' && "mobile-light-clay")} style={{ backgroundColor: '#0a0c12' }}>
      
      {/* Client Sidebar */}
      <ClientSidebar />

      {/* Mobile top header */}
      <ClientMobileHeader />

      {/* Main content */}
      <main
        className="flex-1 lg:pl-64 overflow-y-auto relative"
        style={{ backgroundColor: '#0a0c12' }}
      >
        <div className="pt-4 pb-4 lg:pt-8 lg:pb-8 p-3 sm:p-4 lg:p-7 max-w-[1400px] mx-auto w-full flex flex-col min-h-full">
          <div className="flex-1 text-white">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
