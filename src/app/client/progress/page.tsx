'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, TrendingUp, Info } from 'lucide-react'
import { format } from 'date-fns'
import { showWebNotification } from '@/lib/audio-effects'

export default function ClientProgressPage() {
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/client/project-data')
        if (!res.ok) throw new Error('Failed to load project details.')
        const resData = await res.json()
        setProject(resData.project)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!project?.id) return

    const channel = supabase
      .channel(`project-progress-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${project.id}`
        },
        (payload) => {
          const desc = payload.new.description
          if (desc && desc.startsWith('{')) {
            try {
              const parsed = JSON.parse(desc)
              const newUpdates = parsed.progress_updates || []
              setProject((prev: any) => {
                if (!prev) return prev
                const oldUpdates = prev.progress_updates || []
                if (newUpdates.length > oldUpdates.length) {
                  const latest = newUpdates[0]
                  showWebNotification('Project Progress Updated! 🏗️', latest.remarks)
                }
                return {
                  ...prev,
                  progress_updates: newUpdates
                }
              })
            } catch (e) {
              console.error('Error parsing progress realtime update:', e)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [project?.id])

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  if (!project) return (
    <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl mt-12 space-y-4 max-w-md mx-auto text-white">
      <Info className="mx-auto text-zinc-500" size={32} />
      <h2 className="text-lg font-bold">No Project Associated</h2>
      <p className="text-xs text-zinc-400">Please contact the administrator or your contractor to link this client profile to your active site project.</p>
    </div>
  )

  const progressList = project.progress_updates || []
  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Timeline,</p>
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-1">Project Progress</h1>
        <p className="text-xs text-zinc-400 mt-1">Real-time daily site progress remarks logged by the contractor.</p>
      </div>

      <Card style={PANEL} className="border-none shadow-xl p-6 md:p-8">
        <div className="flex items-center gap-3 pb-6 border-b border-[#1e2435] mb-8">
          <TrendingUp className="text-blue-500 shrink-0" size={22} />
          <div>
            <h2 className="text-lg font-black text-white">Site Log Timeline</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Chronological updates from project start</p>
          </div>
        </div>

        {/* Vertical Timeline */}
        <div className="relative pl-6 sm:pl-8 border-l border-blue-500/20 space-y-8 ml-2 sm:ml-4 pt-2 pb-6">
          {progressList.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 italic text-sm">
              No progress remarks logged by the contractor yet.
            </div>
          ) : (
            // Remarks are already stored in reverse chronological order during save, but sort again to ensure correctness
            [...progressList]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((upd, idx) => (
                <div key={upd.id || idx} className="relative space-y-1 group">
                  {/* Timeline bullet dot */}
                  <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-500/10 group-hover:scale-110 transition-transform duration-200" />
                  
                  {/* Date badge */}
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">
                    {format(new Date(upd.date), 'dd MMMM yyyy')}
                  </p>
                  
                  {/* Remarks details */}
                  <div className="p-4 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 text-sm font-semibold text-zinc-200 mt-2 leading-relaxed">
                    {upd.remarks}
                  </div>
                </div>
              ))
          )}
        </div>
      </Card>

    </div>
  )
}
