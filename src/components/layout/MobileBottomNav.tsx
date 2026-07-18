'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  CalendarCheck, 
  Package, 
  Settings, 
  UserPlus, 
  Zap, 
  MessageCircle, 
  Copy, 
  Clock, 
  Save, 
  Truck, 
  Wallet, 
  Plus, 
  Download, 
  FileText, 
  Filter, 
  Grid, 
  List,
  ChevronRight
} from 'lucide-react'
import { haptic } from '@/lib/haptic'

type Shortcut = {
  label: string
  Icon: any
  href?: string
  action?: () => void
  highlight?: boolean
}

export default function MobileBottomNav() {
  const pathname = usePathname()

  const handleAction = (shortcut: Shortcut) => {
    haptic(25) // premium crisp haptic touch
    if (shortcut.action) {
      shortcut.action()
    }
  }

  // 1. Determine active context based on route path
  let shortcuts: Shortcut[] = []
  let contextName = ''

  if (pathname === '/') {
    contextName = 'Dashboard Shortcuts'
    shortcuts = [
      { label: 'Add Worker', href: '/labour', Icon: UserPlus },
      { label: 'Attendance', href: '/attendance', Icon: CalendarCheck },
      { 
        label: 'Quick Entry', 
        action: () => window.dispatchEvent(new Event('ssc_open_quick_material')), 
        Icon: Zap, 
        highlight: true 
      },
      { label: 'Client Chat', href: '/chat', Icon: MessageCircle }
    ]
  } else if (pathname.startsWith('/attendance')) {
    contextName = 'Attendance Actions'
    shortcuts = [
      { 
        label: 'Copy Prev', 
        action: () => window.dispatchEvent(new Event('ssc_attendance_copy_prev')), 
        Icon: Copy 
      },
      { 
        label: 'Toggle OT', 
        action: () => window.dispatchEvent(new Event('ssc_attendance_toggle_ot')), 
        Icon: Clock 
      },
      { 
        label: 'Add Worker', 
        action: () => window.dispatchEvent(new Event('ssc_attendance_add_worker')), 
        Icon: UserPlus 
      },
      { 
        label: 'Save Week', 
        action: () => window.dispatchEvent(new Event('ssc_attendance_save')), 
        Icon: Save, 
        highlight: true 
      }
    ]
  } else if (pathname.startsWith('/materials')) {
    contextName = 'Material Management'
    shortcuts = [
      { label: 'Suppliers', href: '/contacts', Icon: Truck },
      { label: 'Payouts', href: '/contractor-payments', Icon: Wallet },
      { 
        label: 'Quick Entry', 
        action: () => window.dispatchEvent(new Event('ssc_open_quick_material')), 
        Icon: Zap, 
        highlight: true 
      }
    ]

  } else if (pathname.startsWith('/payments')) {
    contextName = 'Salary & Ledger Payouts'
    shortcuts = [
      { 
        label: 'Toggle View', 
        action: () => window.dispatchEvent(new Event('ssc_payments_toggle_mode')), 
        Icon: Grid 
      },
      { 
        label: 'Download PDF', 
        action: () => window.dispatchEvent(new Event('ssc_payments_download_pdf')), 
        Icon: Download, 
        highlight: true 
      }
    ]
  } else if (pathname.startsWith('/reports')) {
    contextName = 'Export Center'
    shortcuts = [
      { 
        label: 'Export PDF', 
        action: () => window.dispatchEvent(new Event('ssc_reports_pdf')), 
        Icon: FileText 
      },
      { 
        label: 'Export Excel', 
        action: () => window.dispatchEvent(new Event('ssc_reports_excel')), 
        Icon: Download 
      },
      { 
        label: 'Generate', 
        action: () => window.dispatchEvent(new Event('ssc_reports_generate')), 
        Icon: Filter, 
        highlight: true 
      }
    ]
  } else if (pathname.startsWith('/income')) {
    contextName = 'Revenue Actions'
    shortcuts = [
      { 
        label: 'Add Income', 
        action: () => window.dispatchEvent(new Event('ssc_trigger_add_income')), 
        Icon: Plus, 
        highlight: true 
      }
    ]
  } else if (pathname.startsWith('/projects')) {
    contextName = 'Projects module'
    shortcuts = [
      { 
        label: 'New Project', 
        action: () => window.dispatchEvent(new Event('ssc_trigger_add_project')), 
        Icon: Plus, 
        highlight: true 
      }
    ]
  } else {
    // Default system shortcuts
    contextName = 'Quick Navigation'
    shortcuts = [
      { label: 'Dashboard', href: '/', Icon: LayoutDashboard },
      { label: 'Attendance', href: '/attendance', Icon: CalendarCheck },
      { label: 'Materials', href: '/materials', Icon: Package },
      { label: 'Settings', href: '/settings', Icon: Settings }
    ]
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[80] flex flex-col transition-all duration-300"
      style={{
        backgroundColor: '#0d1018',
        borderTop: '1px solid #1e2435',
        height: '72px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Context-aware indicator strip */}
      <div className="h-4 bg-[#0a0c12]/60 px-3 flex items-center justify-between border-b border-[#1e2435]/40 select-none">
        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          {contextName}
        </span>
        <ChevronRight size={7} className="text-zinc-600" />
      </div>

      {/* Shortcuts List */}
      <div className="flex-1 flex items-center justify-around px-2">
        {shortcuts.map((shortcut, idx) => {
          const content = (
            <div className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full select-none">
              <div
                className="flex items-center justify-center rounded-xl transition-all"
                style={{
                  width: shortcut.highlight ? 44 : 36,
                  height: shortcut.highlight ? 32 : 28,
                  background: shortcut.highlight 
                    ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(37,99,235,0.25))' 
                    : 'transparent',
                  border: shortcut.highlight ? '1px solid rgba(59,130,246,0.3)' : 'none',
                  boxShadow: shortcut.highlight ? '0 2px 8px rgba(59,130,246,0.15)' : 'none'
                }}
              >
                <shortcut.Icon
                  size={shortcut.highlight ? 20 : 18}
                  style={{ 
                    color: shortcut.highlight ? '#3b82f6' : '#6b7280', 
                    transition: 'color 0.15s' 
                  }}
                />
              </div>
              <span
                className="font-black uppercase tracking-widest leading-none mt-0.5 text-center"
                style={{
                  fontSize: 7.5,
                  color: shortcut.highlight ? '#3b82f6' : '#6b7280',
                  transition: 'color 0.15s',
                }}
              >
                {shortcut.label}
              </span>
            </div>
          )

          if (shortcut.href) {
            return (
              <Link
                key={`${shortcut.label}-${idx}`}
                href={shortcut.href}
                onClick={() => haptic(15)}
                className="flex-1 h-full flex items-center justify-center active:scale-95 transition-transform"
              >
                {content}
              </Link>
            )
          }

          return (
            <button
              key={`${shortcut.label}-${idx}`}
              onClick={() => handleAction(shortcut)}
              className="flex-1 h-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              {content}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
