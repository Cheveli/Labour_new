'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Bell, Check, Trash2, X, MessageSquare, Package, ArrowUpRight, CalendarCheck2, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { haptic } from '@/lib/haptic'

interface NotificationItem {
  id: string
  title: string
  message: string
  timestamp: string
  read: boolean
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load notifications from localStorage
  const loadNotifications = () => {
    if (typeof window === 'undefined') return
    const logsStr = localStorage.getItem('ssc_notification_logs')
    if (logsStr) {
      try {
        setNotifications(JSON.parse(logsStr))
      } catch (e) {
        setNotifications([])
      }
    }
  }

  // Add notification with duplicate check
  const addNotification = (notif: NotificationItem) => {
    const logsStr = localStorage.getItem('ssc_notification_logs')
    let logs: NotificationItem[] = logsStr ? JSON.parse(logsStr) : []
    
    if (logs.some((l) => l.id === notif.id)) return
    
    logs = [notif, ...logs].slice(0, 40) // cap at 40
    localStorage.setItem('ssc_notification_logs', JSON.stringify(logs))
    window.dispatchEvent(new Event('ssc_notifications_updated'))
  }

  // Subscribe to realtime database updates
  useEffect(() => {
    loadNotifications()

    const handleUpdateEvent = () => {
      loadNotifications()
    }
    window.addEventListener('ssc_notifications_updated', handleUpdateEvent)

    // Create a single unified realtime channel for all postgres notifications
    const instanceId = Math.random().toString(36).substring(2, 9)
    const unifiedChannel = supabase
      .channel(`realtime-db-notifications-sync-${instanceId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, (payload) => {
        const desc = payload.new.description
        if (desc && desc.startsWith('{')) {
          try {
            const parsed = JSON.parse(desc)
            const chat = parsed.chat || []
            if (chat.length > 0) {
              const lastMsg = chat[chat.length - 1]
              if (lastMsg.sender === 'client') {
                addNotification({
                  id: `chat-${lastMsg.timestamp}`,
                  title: 'Client Message 💬',
                  message: lastMsg.text,
                  timestamp: lastMsg.timestamp,
                  read: false
                })
              }
            }
          } catch (e) {}
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'materials' }, (payload) => {
        addNotification({
          id: `mat-${payload.new.id}`,
          title: 'Material Entry added 📦',
          message: `${payload.new.name} (${payload.new.quantity} ${payload.new.unit || ''}) logged.`,
          timestamp: new Date().toISOString(),
          read: false
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'income' }, (payload) => {
        addNotification({
          id: `inc-${payload.new.id}`,
          title: 'Revenue Logged 📈',
          message: `Received ₹${Number(payload.new.amount).toLocaleString('en-IN')}`,
          timestamp: new Date().toISOString(),
          read: false
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, (payload) => {
        addNotification({
          id: `att-${payload.new.id}`,
          title: 'Workforce Attendance 📋',
          message: `Attendance marked.`,
          timestamp: new Date().toISOString(),
          read: false
        })
      })
      .subscribe()

    return () => {
      window.removeEventListener('ssc_notifications_updated', handleUpdateEvent)
      supabase.removeChannel(unifiedChannel)
    }
  }, [])

  // Auto close on clicking outside dropdown list
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleToggle = () => {
    haptic(15)
    setIsOpen(!isOpen)
  }

  const markAllRead = () => {
    haptic(20)
    const updated = notifications.map((n) => ({ ...n, read: true }))
    localStorage.setItem('ssc_notification_logs', JSON.stringify(updated))
    window.dispatchEvent(new Event('ssc_notifications_updated'))
  }

  const clearAll = () => {
    haptic(25)
    localStorage.setItem('ssc_notification_logs', JSON.stringify([]))
    window.dispatchEvent(new Event('ssc_notifications_updated'))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div ref={wrapperRef} className="relative z-[95]">
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer"
        style={{
          backgroundColor: '#111520',
          border: '1px solid #1e2435',
          color: unreadCount > 0 ? '#3b82f6' : '#71717a',
        }}
        title="Notification Center"
      >
        <Bell size={16} className={unreadCount > 0 ? 'animate-bounce' : ''} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black text-white bg-red-500 border border-red-400 px-1"
            style={{ boxShadow: '0 0 8px rgba(239,68,68,0.5)' }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Container */}
      {isOpen && (
        <div
          className="absolute top-[48px] right-0 w-80 rounded-2xl border p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{
            backgroundColor: '#111520',
            borderColor: '#1e2435',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1e2435]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Notifications</p>
              {unreadCount > 0 && (
                <p className="text-[8px] font-black text-blue-400 uppercase tracking-wider mt-0.5">{unreadCount} unread logs</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                    title="Mark all as read"
                  >
                    Read
                  </button>
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                    title="Clear All"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* List content */}
          <div className="max-h-[280px] overflow-y-auto space-y-2 no-scrollbar pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 italic">
                No recent notifications logs
              </div>
            ) : (
              notifications.map((item) => {
                const getIcon = (title: string) => {
                  const t = title.toLowerCase()
                  if (t.includes('message') || t.includes('chat')) return <MessageSquare size={13} className="text-blue-400" />
                  if (t.includes('material')) return <Package size={13} className="text-amber-500" />
                  if (t.includes('revenue') || t.includes('income')) return <ArrowUpRight size={13} className="text-emerald-500" />
                  if (t.includes('attendance')) return <CalendarCheck2 size={13} className="text-indigo-400" />
                  return <DollarSign size={13} className="text-zinc-400" />
                }

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      item.read 
                        ? 'bg-[#0d1018]/30 border-transparent text-zinc-400' 
                        : 'bg-[#1e2435]/15 border-blue-500/10 text-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-zinc-900 border border-[#1e2435] flex items-center justify-center shrink-0 mt-0.5">
                        {getIcon(item.title)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wider truncate">
                            {item.title}
                          </p>
                          {!item.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs font-semibold leading-relaxed mt-0.5 line-clamp-2">
                          {item.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
