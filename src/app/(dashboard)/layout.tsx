'use client'

import React, { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import ActiveProjectHeader from '@/components/active-project-header'
import QuickMaterialModal from '@/components/layout/QuickMaterialModal'
import { Zap } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { haptic } from '@/lib/haptic'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isQuickMaterialOpen, setIsQuickMaterialOpen] = useState(false)
  const pathname = usePathname()
  const isDashboard = pathname === '/'

  // ── Global Reminders & Haptic Listeners ────────────────────
  useEffect(() => {
    // 1. Global Haptic Feedback click listener
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target) return
      
      const isInteractive = 
        target.closest('button') || 
        target.closest('a') || 
        target.closest('select') || 
        target.closest('input') || 
        target.closest('[role="button"]') ||
        target.classList.contains('cursor-pointer')

      if (isInteractive) {
        haptic(15) // brief 15ms vibrate on touch/click
      }
    }

    window.addEventListener('click', handleGlobalClick, { capture: true })

    // 2. Global Notification Scheduler
    let attendanceTimeout: NodeJS.Timeout
    let weeklyTimeout: NodeJS.Timeout

    const scheduleWeekly = () => {
      const enabled = localStorage.getItem('ssc_notif_weekly_report') === 'true'
      if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      const now = new Date()
      const target = new Date()
      // Saturday at 7:00 PM (19:00)
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7
      target.setDate(now.getDate() + daysUntilSaturday)
      target.setHours(19, 0, 0, 0)
      
      let delay = target.getTime() - now.getTime()
      if (delay <= 0) {
        // Schedule for next Saturday if it already passed this week
        target.setDate(target.getDate() + 7)
        delay = target.getTime() - now.getTime()
      }

      clearTimeout(weeklyTimeout)
      weeklyTimeout = setTimeout(() => {
        const notif = new Notification('Weekly Report Reminder 📊', {
          body: "It's Saturday evening! Don't forget to export this week's calculation report.",
          icon: '/favicon.ico'
        })
        notif.onclick = () => {
          window.focus()
        }
        scheduleWeekly() // reschedule
      }, delay)
    }

    const scheduleAttendance = () => {
      const enabled = localStorage.getItem('ssc_notif_attendance') === 'true'
      const timeStr = localStorage.getItem('ssc_notif_attendance_time') || '08:00'
      if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      const [h, m] = timeStr.split(':').map(Number)
      const now = new Date()
      const target = new Date()
      target.setHours(h, m, 0, 0)
      
      let delay = target.getTime() - now.getTime()
      if (delay <= 0) {
        // Schedule for tomorrow if it already passed today
        target.setDate(target.getDate() + 1)
        delay = target.getTime() - now.getTime()
      }

      clearTimeout(attendanceTimeout)
      attendanceTimeout = setTimeout(() => {
        const notif = new Notification('Attendance Reminder 📋', {
          body: "Don't forget to fill in today's attendance!",
          icon: '/favicon.ico'
        })
        notif.onclick = () => {
          window.focus()
        }
        scheduleAttendance() // reschedule
      }, delay)
    }

    scheduleWeekly()
    scheduleAttendance()

    const handleSettingsUpdate = () => {
      scheduleWeekly()
      scheduleAttendance()
    }
    window.addEventListener('ssc_settings_updated', handleSettingsUpdate)

    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true })
      window.removeEventListener('ssc_settings_updated', handleSettingsUpdate)
      clearTimeout(attendanceTimeout)
      clearTimeout(weeklyTimeout)
    }
  }, [])

  useEffect(() => {
    const handleOpenModal = () => setIsQuickMaterialOpen(true)
    window.addEventListener('ssc_open_quick_material', handleOpenModal)
    return () => window.removeEventListener('ssc_open_quick_material', handleOpenModal)
  }, [])

  return (
    <div suppressHydrationWarning className="h-screen flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: '#0a0c12' }}>

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile fixed top header (logo + dashboard action buttons) */}
      <MobileHeader onQuickAdd={() => setIsQuickMaterialOpen(true)} />

      {/* Main content */}
      <main
        className="flex-1 lg:pl-64 overflow-y-auto relative"
        style={{ backgroundColor: '#0a0c12' }}
      >
        {/*
          Mobile: pt-[52px] for fixed top header height, pb-[62px] for fixed bottom nav height
          Desktop: pt-0, pb-0
        */}
        <div className="pt-[52px] pb-[62px] lg:pt-0 lg:pb-0 p-3 sm:p-4 lg:p-7 max-w-[1400px] mx-auto w-full flex flex-col min-h-full">
          <ActiveProjectHeader />
          <div className="flex-1">
            {children}
          </div>
        </div>

        {/* Desktop FAB — hidden on mobile (mobile uses MobileHeader button on dashboard) */}
        {isDashboard && (
          <button
            onClick={() => setIsQuickMaterialOpen(true)}
            suppressHydrationWarning
            className="hidden lg:flex fixed bottom-6 right-6 z-[45] items-center justify-center w-14 h-14 rounded-full text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 8px 30px rgba(16,185,129,0.4)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            title="Quick Material Entry"
          >
            <Zap className="w-6 h-6 fill-white text-white animate-pulse group-hover:scale-110 transition-transform" />
            <span className="absolute right-16 scale-0 group-hover:scale-100 transition-all duration-150 origin-right bg-[#111520] border border-[#1e2435] px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap shadow-[0_4px_20px_rgba(0,0,0,0.5)] pointer-events-none">
              Quick Entry
            </span>
          </button>
        )}

        {/* Global Quick Material Modal */}
        <QuickMaterialModal
          isOpen={isQuickMaterialOpen}
          onClose={() => setIsQuickMaterialOpen(false)}
        />
      </main>

      {/* Mobile fixed bottom navigation */}
      <MobileBottomNav />
    </div>
  )
}
