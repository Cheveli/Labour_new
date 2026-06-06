'use client'

import React, { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import ActiveProjectHeader from '@/components/active-project-header'
import QuickMaterialModal from '@/components/layout/QuickMaterialModal'
import { Zap } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isQuickMaterialOpen, setIsQuickMaterialOpen] = useState(false)

  // Global event listener to trigger Quick Material Modal from any other component
  useEffect(() => {
    const handleOpenModal = () => setIsQuickMaterialOpen(true)
    window.addEventListener('ssc_open_quick_material', handleOpenModal)
    return () => {
      window.removeEventListener('ssc_open_quick_material', handleOpenModal)
    }
  }, [])

  return (
    <div suppressHydrationWarning className="h-screen flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: '#0a0c12' }}>
      <Sidebar />
      <main className="flex-1 lg:pl-64 pt-14 lg:pt-0 overflow-y-auto relative" style={{ backgroundColor: '#0a0c12' }}>
        <div className="p-3 sm:p-4 lg:p-7 max-w-[1400px] mx-auto w-full flex flex-col min-h-full">
          <ActiveProjectHeader />
          <div className="flex-1">
            {children}
          </div>
        </div>

        {/* Global Floating Action Button (FAB) for Quick Material Entry */}
        <button
          onClick={() => setIsQuickMaterialOpen(true)}
          suppressHydrationWarning
          className="fixed bottom-6 right-6 z-[45] flex items-center justify-center w-14 h-14 rounded-full text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 8px 30px rgba(16,185,129,0.4)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
          title="Quick Material Entry / త్వరిత మెటీరియల్ నమోదు"
        >
          <Zap className="w-6 h-6 fill-white text-white animate-pulse group-hover:scale-110 transition-transform" />
          
          {/* Tooltip on hover */}
          <span className="absolute right-16 scale-0 group-hover:scale-100 transition-all duration-150 origin-right bg-[#111520] border border-[#1e2435] px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap shadow-[0_4px_20px_rgba(0,0,0,0.5)] pointer-events-none">
            Quick Entry / మెటీరియల్ నమోదు
          </span>
        </button>

        {/* Global Quick Material Entry Modal */}
        <QuickMaterialModal
          isOpen={isQuickMaterialOpen}
          onClose={() => setIsQuickMaterialOpen(false)}
        />
      </main>
    </div>
  )
}
