'use client'

import React, { useState, useEffect } from 'react'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  FileText,
  MessageCircle,
  Menu,
  X,
  LogOut,
  HardHat,
  TrendingUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const clientMenuItems = [
  { label: 'Overview', href: '/client/dashboard', icon: LayoutDashboard },
  { label: 'Project Progress', href: '/client/progress', icon: TrendingUp },
  { label: 'Payments', href: '/client/payments', icon: Wallet },
  { label: 'Agreement', href: '/client/agreement', icon: FileText },
  { label: 'Important Dates', href: '/client/important-dates', icon: CalendarDays },
  { label: 'Chat', href: '/client/chat', icon: MessageCircle },
]

export default function ClientSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const supabase = createClient()

  // Collapsed State (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('client-sidebar-collapsed') === 'true'
    }
    return false
  })

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')
      }
    }
    getUser()
  }, [])

  useEffect(() => {
    localStorage.setItem('client-sidebar-collapsed', isCollapsed.toString())
  }, [isCollapsed])

  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  // Listen for mobile hamburger trigger
  useEffect(() => {
    const openSidebar = () => setIsOpen(true)
    window.addEventListener('ssc_open_client_sidebar', openSidebar)
    return () => window.removeEventListener('ssc_open_client_sidebar', openSidebar)
  }, [])

  useEffect(() => {
    const updateUnreadCount = async () => {
      try {
        const res = await fetch('/api/client/project-data')
        if (!res.ok) return
        const resData = await res.json()
        
        if (resData.project) {
          const p = resData.project
          const chat = p.chat || []
          const lastReadStr = localStorage.getItem(`ssc_client_chat_last_read_${p.id}`)
          const lastRead = lastReadStr ? new Date(lastReadStr).getTime() : 0
          
          const unread = chat.filter((msg: any) => msg.sender === 'contractor' && new Date(msg.timestamp).getTime() > lastRead)
          setChatUnreadCount(unread.length)
        }
      } catch (e) {}
    }
    
    updateUnreadCount()

    // Realtime channel
    const channel = supabase
      .channel('client-sidebar-chat-badge')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, () => {
        updateUnreadCount()
      })
      .subscribe()

    // Custom local reset listener
    window.addEventListener('ssc_client_chat_read_reset', updateUnreadCount)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('ssc_client_chat_read_reset', updateUnreadCount)
    }
  }, [])

  const showExpanded = !isCollapsed || isOpen

  const handleLogout = async () => {
    await supabase.auth.signOut()
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';')
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim()
        if (cookie.startsWith('sb-')) {
          const name = cookie.split('=')[0]
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        }
      }
    }
    toast.success('Logged out successfully')
    window.location.href = '/client/login'
  }

  const GOLD = '#3b82f6'
  const BG_COLOR = '#111520'
  const BORDER_COLOR = '#1e2435'

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-all duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          backgroundColor: BG_COLOR,
          borderColor: BORDER_COLOR,
        }}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r transition-all duration-300",
          isCollapsed ? "w-20" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header Branding */}
        <div className="flex h-16 items-center justify-between px-4 border-b" style={{ borderColor: BORDER_COLOR }}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/25 grid place-items-center shrink-0">
              <HardHat className="h-4.5 w-4.5 text-blue-400" />
            </div>
            {showExpanded && (
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-wide text-white uppercase">Nirmana</span>
                <span className="text-[8px] uppercase tracking-widest text-zinc-500">Client Portal</span>
              </div>
            )}
          </div>
          {isOpen && (
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto custom-scrollbar">
          {clientMenuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <NextLink
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-black uppercase transition-all duration-200 cursor-pointer group",
                  isActive
                    ? "text-[#0a0c12]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                )}
                style={isActive ? { backgroundColor: GOLD } : undefined}
              >
                <div className="relative flex items-center shrink-0">
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                      isActive ? "text-[#0a0c12]" : "text-zinc-500 group-hover:text-white"
                    )}
                  />
                  {!showExpanded && item.label === 'Chat' && chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#111520]" />
                  )}
                </div>
                {showExpanded && (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.label === 'Chat' && chatUnreadCount > 0 && (
                      <span className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-black text-white bg-red-500 rounded-full animate-pulse select-none leading-none border border-red-400 shrink-0">
                        {chatUnreadCount}
                      </span>
                    )}
                  </div>
                )}
              </NextLink>
            )
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-3 border-t flex flex-col gap-2" style={{ borderColor: BORDER_COLOR }}>
          {showExpanded && userEmail && (
            <div className="px-3 py-2 rounded-xl bg-zinc-950/40 border border-zinc-900 overflow-hidden text-ellipsis">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Client Account</p>
              <p className="text-[10px] font-bold text-zinc-400 truncate mt-0.5">{userEmail}</p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-black uppercase text-red-400 hover:bg-red-500/10 transition-colors w-full cursor-pointer"
          >
            <LogOut className="h-5 w-5 shrink-0 text-red-500" />
            {showExpanded && <span>Sign Out</span>}
          </button>

          {/* Sidebar Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {isCollapsed ? "Expand →" : "← Collapse"}
          </button>
        </div>
      </aside>
    </>
  )
}
