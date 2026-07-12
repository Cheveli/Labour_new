'use client'

import React from 'react'
import { Menu, HardHat } from 'lucide-react'

export default function ClientMobileHeader() {
  const triggerSidebar = () => {
    window.dispatchEvent(new CustomEvent('ssc_open_client_sidebar'))
  }

  const HEADER_ST = {
    backgroundColor: '#111520',
    borderBottom: '1px solid #1e2435',
  }

  return (
    <header
      style={HEADER_ST}
      className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 lg:hidden"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={triggerSidebar}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/25 grid place-items-center">
            <HardHat className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-wide text-white uppercase leading-none">Nirmana</span>
            <span className="text-[7px] uppercase tracking-widest text-zinc-500 leading-none mt-1">Client Portal</span>
          </div>
        </div>
      </div>
    </header>
  )
}
