'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import { HardHat, Bell, BellOff, Zap, Menu } from 'lucide-react'

interface MobileHeaderProps {
  onQuickAdd: () => void
}

export default function MobileHeader({ onQuickAdd }: MobileHeaderProps) {
  const pathname = usePathname()
  const isDashboard = pathname === '/'
  const [notifOn, setNotifOn] = useState(false)

  const openSidebar = () => {
    window.dispatchEvent(new Event('ssc_open_sidebar'))
  }

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
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <button
            onClick={() => setNotifOn(v => !v)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{
              backgroundColor: '#111520',
              border: '1px solid #1e2435',
              color: notifOn ? '#3b82f6' : '#71717a',
            }}
            title="Notifications"
          >
            {notifOn ? <Bell size={16} /> : <BellOff size={16} />}
            {notifOn && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: '#3b82f6', boxShadow: '0 0 6px rgba(59,130,246,0.8)' }}
              />
            )}
          </button>

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
