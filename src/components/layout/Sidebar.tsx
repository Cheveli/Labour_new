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
  ChevronRight,
  LayoutDashboard,
  Settings2,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const menuItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: Briefcase },
  { label: 'Workers', href: '/labour', icon: Users },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { label: 'Attendance Reports', href: '/attendance/reports', icon: FileText },
  { label: 'Labour Types', href: '/labour-types', icon: Settings2 },
  { label: 'Payments', href: '/payments', icon: Wallet },
  { label: 'Materials', href: '/materials', icon: Package },
  { label: 'Revenue', href: '/income', icon: TrendingUp },
  { label: 'Extra Work', href: '/extra-work', icon: Zap },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    window.location.href = '/login'
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Briefcase className="text-white w-5 h-5" />
          </div>
          <span className="font-black text-xl tracking-tight uppercase">Labour Admin</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
          <Menu className="w-6 h-6" />
        </Button>
      </div>

      {/* Main Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 w-72 bg-white dark:bg-zinc-950 border-r border-gray-100 dark:border-zinc-900 z-[70] transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo Area */}
          <div className="p-8 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00A3FF] flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Briefcase className="text-white w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-xl leading-tight uppercase tracking-tight">Labour Admin</span>
                  <span className="text-[10px] uppercase tracking-widest text-[#00A3FF] font-bold">Projects • Workers • Payroll</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
            {menuItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200",
                    isActive 
                      ? "bg-[#00A3FF] text-white shadow-xl shadow-blue-500/20" 
                      : "text-gray-500 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:text-[#00A3FF] dark:hover:text-[#00A3FF]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className={cn(isActive ? "text-white" : "group-hover:scale-110 transition-transform")} />
                    <span className="font-bold text-sm tracking-tight">{item.label}</span>
                  </div>
                  {isActive && (
                    <motion.div layoutId="active-nav">
                      <ChevronRight size={14} className="opacity-50" />
                    </motion.div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-6 mt-auto border-t border-gray-100 dark:border-zinc-900">
            <Button 
              variant="outline" 
              className="w-full justify-center gap-3 h-12 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 dark:hover:bg-white dark:hover:text-black border-gray-100 dark:border-zinc-800 transition-all font-black uppercase text-xs tracking-widest"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
