'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarCheck, Package, Settings } from 'lucide-react'

const NAV = [
  { label: 'Dashboard', href: '/', Icon: LayoutDashboard },
  { label: 'Attendance', href: '/attendance', Icon: CalendarCheck },
  { label: 'Materials', href: '/materials', Icon: Package },
  { label: 'Important Dates', href: '/important-dates', Icon: CalendarCheck },
  { label: 'Settings', href: '/settings', Icon: Settings },
]


export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[80] flex items-center border-t"
      style={{
        backgroundColor: '#0d1018',
        borderColor: '#1e2435',
        height: '62px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV.map(({ label, href, Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all active:scale-95"
          >
            {/* Icon container */}
            <div
              className="flex items-center justify-center rounded-xl transition-all"
              style={{
                width: 36, height: 28,
                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
              }}
            >
              <Icon
                size={19}
                style={{ color: isActive ? '#3b82f6' : '#52525b', transition: 'color 0.15s' }}
              />
            </div>
            {/* Label */}
            <span
              className="font-black uppercase tracking-widest leading-none"
              style={{
                fontSize: 8,
                color: isActive ? '#3b82f6' : '#52525b',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
