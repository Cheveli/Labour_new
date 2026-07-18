'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { HardHat, Bell, BellOff, Zap, Menu, X, Clock, CalendarCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import NotificationCenter from '@/components/layout/NotificationCenter'

interface MobileHeaderProps {
  onQuickAdd: () => void
}

export default function MobileHeader({ onQuickAdd }: MobileHeaderProps) {
  const pathname = usePathname()
  const isDashboard = pathname === '/'

  // Notification Preferences States
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [attendanceEnabled, setAttendanceEnabled] = useState(false)
  const [attendanceTime, setAttendanceTime] = useState('08:00')
  const [weeklyEnabled, setWeeklyEnabled] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')

  const loadPrefs = () => {
    if (typeof window === 'undefined') return
    setAttendanceEnabled(localStorage.getItem('ssc_notif_attendance') === 'true')
    setAttendanceTime(localStorage.getItem('ssc_notif_attendance_time') || '08:00')
    setWeeklyEnabled(localStorage.getItem('ssc_notif_weekly_report') === 'true')
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission)
    }
  }

  // Load settings on mount and listen to settings update events
  useEffect(() => {
    loadPrefs()
    const handleSettingsUpdate = () => {
      loadPrefs()
    }
    window.addEventListener('ssc_settings_updated', handleSettingsUpdate)
    return () => {
      window.removeEventListener('ssc_settings_updated', handleSettingsUpdate)
    }
  }, [])

  const requestPermissionAndToggle = async (type: 'attendance' | 'weekly', currentVal: boolean) => {
    if (typeof Notification === 'undefined') {
      toast.error('Notifications are not supported in this browser.')
      return
    }

    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
      setNotifPermission(permission)
    }

    if (permission !== 'granted') {
      toast.error('Notification permission denied. Enable it in browser settings.')
      return
    }

    if (type === 'attendance') {
      const newVal = !currentVal
      localStorage.setItem('ssc_notif_attendance', String(newVal))
      setAttendanceEnabled(newVal)
      toast.success(newVal ? `Attendance reminder enabled for ${attendanceTime}.` : 'Attendance reminder disabled.')
    } else {
      const newVal = !currentVal
      localStorage.setItem('ssc_notif_weekly_report', String(newVal))
      setWeeklyEnabled(newVal)
      toast.success(newVal ? 'Weekly report reminder enabled.' : 'Weekly report reminder disabled.')
    }

    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  const handleTimeChange = (time: string) => {
    localStorage.setItem('ssc_notif_attendance_time', time)
    setAttendanceTime(time)
    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  const openSidebar = () => {
    window.dispatchEvent(new Event('ssc_open_sidebar'))
  }

  // Bell icon is active if either notification is enabled AND browser permission is granted
  const isAnyNotifEnabled = (attendanceEnabled || weeklyEnabled) && notifPermission === 'granted'

  return (
    <div
      className="lg:hidden fixed top-0 left-0 right-0 z-[60] flex items-center justify-between border-b"
      style={{
        backgroundColor: '#0d1018',
        borderColor: '#1e2435',
        height: '52px',
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
      }}
    >
      {/* ── Left: Hamburger + Logo ── */}
      <div className="flex items-center gap-2">
        {/* Hamburger — opens the full sidebar slide-in */}
        <button
          onClick={openSidebar}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white active:scale-90 transition-all"
          style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }}
          title="Open Menu"
        >
          <Menu size={17} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 2px 10px rgba(59,130,246,0.35)' }}
          >
            <HardHat className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="font-black text-sm tracking-widest uppercase text-white leading-none">Nirmana</p>
        </div>
      </div>

      {/* ── Right: Action buttons ── */}
      <div className="flex items-center gap-2 relative">
        {/* Real-time Notification Center */}
        <NotificationCenter />

        {/* Quick Add Button */}
        <button
          onClick={onQuickAdd}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg,#10b981,#059669)',
            boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          title="Quick Material Entry"
        >
          <Zap size={16} className="fill-white text-white" />
        </button>
      </div>
    </div>
  )
}
