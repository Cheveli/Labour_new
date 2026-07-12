'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, TrendingUp, MessageCircle, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { label: 'Overview', href: '/client/dashboard', icon: LayoutDashboard },
  { label: 'Progress', href: '/client/progress', icon: TrendingUp },
  { label: 'Chat', href: '/client/chat', icon: MessageCircle },
  { label: 'Agreement', href: '/client/agreement', icon: FileText },
]

export default function ClientMobileBottomNav() {
  const pathname = usePathname()
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  const NAV_ST = {
    backgroundColor: '#111520',
    borderTop: '1px solid #1e2435',
  }

  const GOLD = '#3b82f6'

  useEffect(() => {
    const supabase = createClient()
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
      .channel('client-mobile-chat-badge')
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

  return (
    <div
      style={NAV_ST}
      className="fixed bottom-0 left-0 right-0 z-30 h-16 flex items-center justify-around px-2 lg:hidden"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center w-16 h-full gap-1 group"
          >
            <div className="relative">
              <item.icon
                className="h-5 w-5 shrink-0 transition-transform duration-200 group-active:scale-95"
                style={{ color: isActive ? GOLD : '#6b7280' }}
              />
              {item.label === 'Chat' && chatUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center text-[8px] font-black text-white bg-red-500 rounded-full animate-pulse leading-none border border-red-400 select-none">
                  {chatUnreadCount}
                </span>
              )}
            </div>
            <span
              className="text-[9px] font-black uppercase tracking-wider transition-colors duration-200"
              style={{ color: isActive ? GOLD : '#6b7280' }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
