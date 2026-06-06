/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client'


import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Users, 
  Briefcase, 
  CalendarCheck, 
  Wallet, 
  TrendingUp, 
  Package, 
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  HardHat,
  Calculator,
  BarChart3,
  Phone,
  Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useEffect } from 'react'

const menuItems = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Workforce', href: '/labour', icon: Users },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { label: 'Materials', href: '/materials', icon: Package },
  { label: 'Payments', href: '/payments', icon: Wallet },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Export Calculation', href: '/export-calculation', icon: Calculator },
  { label: 'Revenue', href: '/income', icon: TrendingUp },
  { label: 'Subcontracts', href: '/contractor-payments', icon: HardHat },
  { label: 'Projects', href: '/projects', icon: Briefcase },
  { label: 'Contacts', href: '/contacts', icon: Phone },
  { label: 'Personal Expenses', href: '/personal-expenses', icon: Wallet },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

  // Collapsed State (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString())
  }, [isCollapsed])

  const showExpanded = !isCollapsed || isOpen

  const handleLogout = async () => {
    // 1. Supabase SignOut
    await supabase.auth.signOut()
    
    // 2. Clear all auth cookies manually just in case
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';')
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim()
        if (cookie.startsWith('sb-')) {
          const name = cookie.split('=')[0]
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        }
      }
      
      // 3. Clear local/session storage
      localStorage.clear()
      sessionStorage.clear()
    }

    toast.success('Logged out completely')
    window.location.href = '/login'
  }

  return (
    <>


      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Stylesheet injection for sidebar utilities */}
      <style dangerouslySetInnerHTML={{ __html: `
        ${isCollapsed ? `
          @media (min-width: 1024px) {
            main {
              padding-left: 5rem !important;
            }
          }
        ` : ''}
        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}} />

      {/* Sidebar panel */}
      <div
        suppressHydrationWarning
        className={cn(
          'fixed inset-y-0 left-0 z-[70] transition-all duration-300 lg:translate-x-0 flex flex-col border-r',
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:w-auto'
        )}
        style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Toggle Header */}
          <div className={cn("py-5 border-b border-[#1e2435]", !showExpanded ? "px-2 flex justify-center" : "px-5")}>
            <div className="flex items-center justify-between w-full">
              {showExpanded ? (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>
                      <HardHat className="w-5 h-5 text-[#0a0c12]" />
                    </div>
                    <div className="truncate">
                      <p className="font-black text-sm tracking-widest uppercase text-white leading-none">Nirmana</p>
                      <p className="text-[9px] uppercase tracking-[0.18em] font-bold mt-0.5 truncate" style={{ color: '#3b82f6' }}>Site Management Hub</p>
                    </div>
                  </div>
                  {/* Desktop Collapse Button */}
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border border-[#1e2435] shrink-0"
                    title="Collapse Menu"
                  >
                    <Menu size={16} />
                  </button>
                  {/* Mobile Close Button */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="lg:hidden text-zinc-400 hover:text-white shrink-0"
                    suppressHydrationWarning
                  >
                    <X size={20} />
                  </button>
                </>
              ) : (
                /* Collapsed Mode - Show only Hamburger Menu button to expand */
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="hidden lg:flex items-center justify-center w-10 h-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border border-[#1e2435]"
                  title="Expand Menu"
                >
                  <Menu size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
            {menuItems.map((item, idx) => {
              const isActive = item.href !== '#' && (
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              )
              const Icon = item.icon
              return (
                <Link
                  key={`${item.label}-${idx}`}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 py-[10px] rounded-xl text-sm font-semibold transition-all duration-150',
                    !showExpanded ? 'justify-center px-0 w-10 h-10 mx-auto' : 'px-4',
                    isActive ? 'text-[#0a0c12] font-bold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                  style={isActive ? {
                    background: 'linear-gradient(90deg,#3b82f6,#2563eb)',
                    boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
                  } : undefined}
                >
                  <Icon size={18} className={cn(isActive ? 'text-[#0a0c12]' : 'text-zinc-500 group-hover:text-blue-400', "shrink-0")} />
                  {showExpanded && <span>{item.label}</span>}
                  {!showExpanded && (
                    <div className="absolute left-20 hidden group-hover:block bg-[#111520] border border-[#1e2435] px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white z-50 pointer-events-none shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                      {item.label}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Admin Profile & Logout */}
          <div className="px-3 py-4 border-t border-[#1e2435] space-y-3">
            {/* Admin Profile */}
            <div className={cn("flex items-center gap-3", !showExpanded ? "justify-center" : "px-2")}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-[#0a0c12] shrink-0"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
                A
              </div>
              {showExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">Admin</p>
                  <p className="text-[10px] text-zinc-500 truncate">Site Administrator</p>
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              suppressHydrationWarning
              className={cn(
                "group relative w-full flex items-center gap-2 h-10 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors cursor-pointer",
                !showExpanded ? "justify-center" : "justify-center lg:justify-start lg:px-4"
              )}
              style={{ background: '#1a1f2e' }}
            >
              <LogOut size={14} className="shrink-0" />
              {showExpanded && <span>Logout</span>}
              {!showExpanded && (
                <div className="absolute left-20 hidden group-hover:block bg-[#111520] border border-[#1e2435] px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white z-50 pointer-events-none shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  Logout
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

