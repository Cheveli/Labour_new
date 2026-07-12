'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import ClientSidebar from '@/components/layout/ClientSidebar'
import ClientMobileHeader from '@/components/layout/ClientMobileHeader'
import ClientMobileBottomNav from '@/components/layout/ClientMobileBottomNav'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/client/login'

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
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: '#0a0c12' }}>
      
      {/* Client Sidebar */}
      <ClientSidebar />

      {/* Mobile top header */}
      <ClientMobileHeader />

      {/* Main content */}
      <main
        className="flex-1 lg:pl-64 overflow-y-auto relative"
        style={{ backgroundColor: '#0a0c12' }}
      >
        <div className="pt-4 pb-20 lg:pt-8 lg:pb-8 p-3 sm:p-4 lg:p-7 max-w-[1400px] mx-auto w-full flex flex-col min-h-full">
          <div className="flex-1 text-white">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <ClientMobileBottomNav />
    </div>
  )
}
