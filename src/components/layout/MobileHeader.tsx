'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { HardHat, Bell, BellOff, Zap, Menu, X, Clock, CalendarCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

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

      {/* ── Right: Dashboard-only action buttons ── */}
      {isDashboard && (
        <div className="flex items-center gap-2 relative">
          {/* Notification bell */}
          <button
            onClick={() => setIsPopupOpen(!isPopupOpen)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{
              backgroundColor: '#111520',
              border: '1px solid #1e2435',
              color: isAnyNotifEnabled ? '#3b82f6' : '#71717a',
            }}
            title="Notifications"
          >
            {isAnyNotifEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            {isAnyNotifEnabled && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: '#3b82f6', boxShadow: '0 0 6px rgba(59,130,246,0.8)' }}
              />
            )}
          </button>

          {/* Settings Dropdown Popover */}
          {isPopupOpen && (
            <>
              {/* Overlay backdrop */}
              <div className="fixed inset-0 z-[58]" onClick={() => setIsPopupOpen(false)} />

              {/* Popover Card */}
              <div
                className="absolute top-[48px] right-0 z-[59] w-72 rounded-2xl border p-4 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-150"
                style={{
                  backgroundColor: '#111520',
                  borderColor: '#1e2435',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                }}
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#1e2435]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Reminders Panel
                  </span>
                  <button
                    onClick={() => setIsPopupOpen(false)}
                    className="p-1 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Permission status banner */}
                {notifPermission !== 'granted' ? (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[10px] font-bold text-amber-400 leading-normal">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>Permission Required. Toggling reminders will prompt for browser access.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-[10px] font-bold text-emerald-400">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>Notifications are allowed</span>
                  </div>
                )}

                {/* Attendance settings */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-wide">Daily Attendance</p>
                      <p className="text-[9px] text-zinc-500 font-medium">Daily reminder to mark attendance</p>
                    </div>
                    <button
                      onClick={() => requestPermissionAndToggle('attendance', attendanceEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${attendanceEnabled && notifPermission === 'granted' ? 'bg-blue-600' : 'bg-zinc-700'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${attendanceEnabled && notifPermission === 'granted' ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {attendanceEnabled && notifPermission === 'granted' && (
                    <div className="flex items-center justify-between pt-1 pl-1">
                      <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                        <Clock size={11} /> Time:
                      </span>
                      <input
                        type="time"
                        value={attendanceTime}
                        onChange={(e) => handleTimeChange(e.target.value)}
                        className="h-7 px-2 text-[11px] font-black bg-black/40 border border-[#1e2435] rounded-lg text-white outline-none focus:border-blue-500/50 text-center"
                      />
                    </div>
                  )}
                </div>

                {/* Weekly settings */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1e2435]">
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-wide">Weekly Report</p>
                    <p className="text-[9px] text-zinc-500 font-medium">Saturday at 7:00 PM reminder</p>
                  </div>
                  <button
                    onClick={() => requestPermissionAndToggle('weekly', weeklyEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${weeklyEnabled && notifPermission === 'granted' ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${weeklyEnabled && notifPermission === 'granted' ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Quick Add */}
          <button
            onClick={onQuickAdd}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
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
      )}
    </div>
  )
}
