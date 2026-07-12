'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Briefcase, User, Phone, MapPin, Building, Landmark, Info, Bell } from 'lucide-react'
import { format } from 'date-fns'

export default function ClientDashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/client/project-data')
        if (!res.ok) {
          throw new Error('Failed to load project details.')
        }
        const resData = await res.json()
        setData(resData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Subscribe to real-time updates (notifications)
  useEffect(() => {
    if (!data?.project?.id) return

    const channel = supabase
      .channel(`project-dashboard-${data.project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${data.project.id}`
        },
        (payload) => {
          const desc = payload.new.description
          if (desc && desc.startsWith('{')) {
            try {
              const parsed = JSON.parse(desc)
              setData((prev: any) => {
                if (!prev) return prev
                return {
                  ...prev,
                  project: {
                    ...prev.project,
                    progress_updates: parsed.progress_updates || [],
                    chat: parsed.chat || [],
                    money_requests: parsed.money_requests || [],
                    material_requests: parsed.material_requests || []
                  }
                }
              })
            } catch (e) {
              console.error('Error parsing realtime dashboard update:', e)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [data?.project?.id])

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  if (!data?.project) return (
    <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl mt-12 space-y-4 max-w-md mx-auto">
      <Info className="mx-auto text-zinc-500" size={32} />
      <h2 className="text-lg font-bold text-white">No Project Associated</h2>
      <p className="text-xs text-zinc-400">Please contact the administrator or your contractor to link this client profile to your active site project.</p>
    </div>
  )

  const { project, companyDetails } = data
  const isLabourContract = project.project_type === 'Labour Contract'

  const activeMoneyRequests = project.money_requests || []
  const activeMaterialRequests = project.material_requests || []

  const hasNotifications = isLabourContract && (activeMoneyRequests.length > 0 || activeMaterialRequests.length > 0)

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }

  return (
    <div className="space-y-6">
      
      {/* Welcome Hero */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Welcome back,</p>
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-1">{project.owner_name}</h1>
        <p className="text-xs text-zinc-400 mt-1">Client portal control room for Sri Sai Constructions.</p>
      </div>

      {/* Notifications/Requests Section (Instantly displays requests raised by contractor) */}
      {hasNotifications && (
        <Card className="border-none shadow-xl bg-gradient-to-r from-blue-950/20 via-zinc-950 to-orange-950/20 rounded-3xl overflow-hidden p-6 space-y-4 border border-blue-500/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/25 grid place-items-center">
              <Bell className="h-5 w-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Active Contractor Requests</h2>
              <p className="text-[10px] text-zinc-400 mt-0.5">Please review the details below. Requests appear here automatically in real time.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Money Requests */}
            {activeMoneyRequests.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Money Requests ({activeMoneyRequests.length})</p>
                <div className="space-y-3">
                  {activeMoneyRequests.map((r: any, idx: number) => (
                    <div key={r.id || idx} className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/10 flex flex-col space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-black text-blue-400">₹{r.amount.toLocaleString('en-IN')}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Required: {format(new Date(r.required_date), 'dd MMM yyyy')}</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">"{r.reason}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Material Requests */}
            {activeMaterialRequests.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Material Requests ({activeMaterialRequests.length})</p>
                <div className="space-y-3">
                  {activeMaterialRequests.map((r: any, idx: number) => (
                    <div key={r.id || idx} className="p-4 rounded-2xl bg-orange-950/20 border border-orange-500/10 flex flex-col space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-orange-400">{r.material_name}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{r.quantity}</span>
                      </div>
                      {r.remarks && <p className="text-xs text-zinc-300 font-medium">"{r.remarks}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Main Info Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Project details card */}
        <div style={PANEL} className="md:col-span-8 p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
            <Briefcase className="text-blue-500 shrink-0" size={22} />
            <div>
              <h2 className="text-lg font-black text-white">Project Information</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Active construction site profile</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Project Name</p>
              <p className="text-base font-bold text-white uppercase">{project.name}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Contract Classification</p>
              <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase mt-1"
                style={project.project_type === 'Labour Contract'
                  ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                  : { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                {project.project_type}
              </span>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Project Address</p>
              <div className="flex items-start gap-2 text-sm text-zinc-300 font-semibold mt-1">
                <MapPin className="text-zinc-500 shrink-0 mt-0.5" size={16} />
                <span>{project.address || 'Uppal, Hyderabad'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Owner Name</p>
              <div className="flex items-center gap-2 text-sm text-zinc-300 font-semibold mt-1">
                <User className="text-zinc-500 shrink-0" size={16} />
                <span>{project.owner_name}</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Site Status</p>
              <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase mt-1"
                style={project.status === 'ACTIVE'
                  ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                  : { backgroundColor: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }}>
                {project.status}
              </span>
            </div>
          </div>
        </div>

        {/* Contractor contact details card */}
        <div style={PANEL} className="md:col-span-4 p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
            <Building className="text-blue-500 shrink-0" size={22} />
            <div>
              <h2 className="text-lg font-black text-white">Contractor Profile</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">SSC builder contacts</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Company Name</p>
              <div className="flex items-center gap-2 text-sm text-zinc-300 font-semibold">
                <Building className="text-zinc-600 shrink-0" size={15} />
                <span>{companyDetails.name}</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Managing Contractor</p>
              <div className="flex items-center gap-2 text-sm text-zinc-300 font-semibold">
                <User className="text-zinc-600 shrink-0" size={15} />
                <span>{companyDetails.contractor}</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Contractor Mobile</p>
              <div className="flex items-center gap-2 text-sm text-zinc-300 font-mono">
                <Phone className="text-zinc-600 shrink-0" size={15} />
                <span>{companyDetails.phone1}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
