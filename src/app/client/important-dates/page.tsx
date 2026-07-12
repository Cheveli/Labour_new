'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Calendar, Info, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

export default function ClientImportantDatesPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/client/project-data')
        if (!res.ok) throw new Error('Failed to load project details.')
        const resData = await res.json()
        setData(resData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()

    const supabase = createClient()
    const channel = supabase
      .channel('client-important-dates-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'important_dates'
        },
        async () => {
          const res = await fetch('/api/client/project-data')
          if (res.ok) {
            const resData = await res.json()
            setData(resData)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  if (!data?.project) return (
    <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl mt-12 space-y-4 max-w-md mx-auto text-white">
      <Info className="mx-auto text-zinc-500" size={32} />
      <h2 className="text-lg font-bold">No Project Associated</h2>
      <p className="text-xs text-zinc-400">Please contact the administrator or your contractor to link this client profile to your active site project.</p>
    </div>
  )

  const { importantDates } = data
  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Schedule,</p>
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-1">Important Dates</h1>
        <p className="text-xs text-zinc-400 mt-1">Project milestones, reminders, and key timelines scheduled by your builder.</p>
      </div>

      <Card style={PANEL} className="border-none shadow-xl p-6 md:p-8">
        <div className="flex items-center gap-3 pb-6 border-b border-[#1e2435] mb-6">
          <Calendar className="text-blue-500 shrink-0" size={22} />
          <div>
            <h2 className="text-lg font-black text-white">Milestone Calendar</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Scheduled dates & construction timelines</p>
          </div>
        </div>

        {importantDates.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 italic text-sm">
            No important dates or milestones scheduled for this project yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {importantDates.map((item: any, idx: number) => {
              const isPast = new Date(item.date).getTime() < new Date().setHours(0,0,0,0)
              return (
                <div
                  key={item.id || idx}
                  className="p-4 border rounded-2xl bg-zinc-950/40 border-zinc-900/60 hover:border-blue-500/20 transition-all flex gap-4 items-start group"
                >
                  <div className={`p-3 rounded-xl ${isPast ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-blue-600/10 text-blue-400 border border-blue-500/20'} shrink-0`}>
                    <Clock size={20} className="group-hover:rotate-12 transition-transform duration-200" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-sm font-black text-white uppercase truncate">{item.title}</h4>
                      {isPast && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-800 bg-zinc-900 px-2 py-0.5 rounded shrink-0">Past</span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 font-bold">
                      {format(new Date(item.date), 'EEEE, dd MMMM yyyy')}
                    </p>
                    {item.description && (
                      <p className="text-xs text-zinc-400 font-medium leading-relaxed mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

    </div>
  )
}
