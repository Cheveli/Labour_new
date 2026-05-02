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
  Zap,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  FileText,
  HardHat,
  Calculator,
  BarChart3,
  Phone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const menuItems = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Workforce', href: '/labour', icon: Users },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { label: 'Materials', href: '/materials', icon: Package },
  { label: 'Payments', href: '/payments', icon: Wallet },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Export Calculation', href: '/export-calculation', icon: Calculator },
  { label: 'Revenue', href: '/income', icon: TrendingUp },
  { label: 'Extra Work', href: '/extra-work', icon: Zap },
  { label: 'Projects', href: '/projects', icon: Briefcase },
  { label: 'Contacts', href: '/contacts', icon: Phone },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

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
      {/* Mobile header bar */}
      <div
        className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50 border-b"
        style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
            <HardHat className="w-4 h-4 text-[#0a0c12]" />
          </div>
          <span className="font-black text-sm tracking-widest uppercase text-white">Labour MS</span>
        </div>
        <button onClick={() => setIsOpen(true)} className="text-zinc-400 hover:text-white">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        suppressHydrationWarning
        className={cn(
          'fixed inset-y-0 left-0 w-64 z-[70] transition-transform duration-300 lg:translate-x-0 flex flex-col border-r',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-5 py-6 border-b border-[#1e2435]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>
                  <HardHat className="w-5 h-5 text-[#0a0c12]" />
                </div>
                <div>
                  <p className="font-black text-sm tracking-widest uppercase text-white leading-none">Labour</p>
                  <p className="text-[9px] uppercase tracking-[0.18em] font-bold mt-0.5" style={{ color: '#3b82f6' }}>Management System</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="lg:hidden text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
                    'group flex items-center gap-3 px-4 py-[10px] rounded-xl text-sm font-semibold transition-all duration-150',
                    isActive ? 'text-[#0a0c12] font-bold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                  style={isActive ? {
                    background: 'linear-gradient(90deg,#3b82f6,#2563eb)',
                    boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
                  } : undefined}
                >
                  <Icon size={18} className={isActive ? 'text-[#0a0c12]' : 'text-zinc-500 group-hover:text-blue-400'} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Admin */}
          <div className="px-4 py-4 border-t border-[#1e2435]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-[#0a0c12]"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">Admin</p>
                <p className="text-[10px] text-zinc-500 truncate">Site Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
              style={{ background: '#1a1f2e' }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

