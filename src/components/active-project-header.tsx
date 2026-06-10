'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Folder } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { id } from 'date-fns/locale'

export default function ActiveProjectHeader() {
  const [projectName, setProjectName] = useState<string>('All Projects')
  const supabase = createClient()
  const pathname = usePathname()

  const fetchActiveProject = async () => {
    try {
      let activeId = localStorage.getItem('ssc_active_project_id')

      // If we are on the main overview dashboard page, check overview selection
      if (pathname === '/') {
        const overviewSel = localStorage.getItem('ssc_overview_selection')
        if (overviewSel === 'all') {
          setProjectName('All Projects')
          return
        } else if (overviewSel) {
          activeId = overviewSel
        }
      }

      if (!activeId) {
        setProjectName('All Projects')
        return
      }

      const { data, error } = await supabase
        .from('projects')
        .select('name')
        .eq('id', activeId)
        .maybeSingle()

      if (error) {
        setProjectName('All Projects')
      } else if (data) {
        setProjectName(data.name)
      }
    } catch (err) {
      setProjectName('All Projects')
    }
  }

  useEffect(() => {
    fetchActiveProject()

    // Listen for storage changes (across tabs)
    window.addEventListener('storage', fetchActiveProject)

    // Listen for custom project change event (same tab)
    window.addEventListener('ssc_project_changed', fetchActiveProject)

    // Interval polling fallback
    const interval = setInterval(fetchActiveProject, 1200)

    return () => {
      window.removeEventListener('storage', fetchActiveProject)
      window.removeEventListener('ssc_project_changed', fetchActiveProject)
      clearInterval(interval)
    }
  }, [pathname])

  return (
    <div className="flex items-center justify-center w-full mb-4 shrink-0" suppressHydrationWarning>
      <div
        className="px-4 py-2 rounded-xl border flex items-center gap-2.5 bg-[#111520]/80 backdrop-blur-md transition-all duration-300 hover:border-blue-500/30 max-w-full"
        style={{ borderColor: '#1e2435', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 shrink-0">Active Site:</span>
          <span className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1.5">
            <Folder size={11} className="text-blue-400 shrink-0" />
            <span className="break-words text-center">{projectName}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
