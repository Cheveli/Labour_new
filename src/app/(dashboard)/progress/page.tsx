'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, Info, Edit3, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function ContractorProgressPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectData, setProjectData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [progressUpdates, setProgressUpdates] = useState<any[]>([])
  const [newProgressText, setNewProgressText] = useState('')
  const [newProgressDate, setNewProgressDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Load all projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .neq('status', 'SYSTEM')
          .order('name', { ascending: true })

        if (error) throw error
        setProjects(data || [])
        if (data && data.length > 0) {
          setSelectedProjectId(data[0].id)
        }
      } catch (err: any) {
        toast.error('Failed to load projects: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

  // Load progress details when a project is selected
  useEffect(() => {
    if (!selectedProjectId) return

    async function loadProjectDetails() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', selectedProjectId)
        .single()

      if (data) {
        setProjectData(data)
        if (data.description && data.description.startsWith('{')) {
          try {
            const parsed = JSON.parse(data.description)
            setProgressUpdates(parsed.progress_updates || [])
          } catch (e) {
            setProgressUpdates([])
          }
        } else {
          setProgressUpdates([])
        }
      }
    }
    loadProjectDetails()

    // Subscribe to real-time progress updates
    const channel = supabase
      .channel(`contractor-progress-${selectedProjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${selectedProjectId}`
        },
        (payload) => {
          const desc = payload.new.description
          if (desc && desc.startsWith('{')) {
            try {
              const parsed = JSON.parse(desc)
              setProgressUpdates(parsed.progress_updates || [])
            } catch (e) {
              console.error('Error parsing contractor progress updates:', e)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedProjectId])

  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProgressText.trim() || !selectedProjectId || saving) return

    setSaving(true)
    try {
      // 1. Fetch latest description payload
      const { data: latestProj } = await supabase
        .from('projects')
        .select('description')
        .eq('id', selectedProjectId)
        .single()

      let meta = {
        address: '',
        project_type: 'Material Contract',
        client_email: '',
        client_mobile: '',
        client_id: null,
        progress_updates: [],
        chat: [],
        money_requests: [],
        material_requests: []
      }

      if (latestProj?.description && latestProj.description.startsWith('{')) {
        try {
          meta = { ...meta, ...JSON.parse(latestProj.description) }
        } catch (e) {}
      } else {
        meta.address = latestProj?.description || ''
      }

      let updatedList = []
      if (editingProgressId) {
        updatedList = (meta.progress_updates || []).map((up: any) => {
          if (up.id === editingProgressId) {
            return { ...up, date: newProgressDate, remarks: newProgressText.trim() }
          }
          return up
        })
      } else {
        const newUpdate = {
          id: `p-${Date.now()}`,
          date: newProgressDate || format(new Date(), 'yyyy-MM-dd'),
          remarks: newProgressText.trim()
        }
        updatedList = [newUpdate, ...(meta.progress_updates || [])]
      }

      const updatedPayload = JSON.stringify({
        ...meta,
        progress_updates: updatedList
      })

      const { error } = await supabase
        .from('projects')
        .update({ description: updatedPayload })
        .eq('id', selectedProjectId)

      if (error) throw error

      setProgressUpdates(updatedList)
      setNewProgressText('')
      setEditingProgressId(null)
      toast.success(editingProgressId ? 'Progress remark updated successfully!' : 'Progress remark logged successfully!')
    } catch (err: any) {
      toast.error('Failed to update progress: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStartEdit = (upd: any) => {
    setEditingProgressId(upd.id)
    setNewProgressText(upd.remarks)
    setNewProgressDate(upd.date)
  }

  const handleCancelEdit = () => {
    setEditingProgressId(null)
    setNewProgressText('')
    setNewProgressDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const handleDeleteProgress = async (id: string) => {
    if (!confirm('Are you sure you want to delete this progress remark?')) return

    try {
      const { data: latestProj } = await supabase
        .from('projects')
        .select('description')
        .eq('id', selectedProjectId)
        .single()

      let meta = {
        address: '',
        project_type: 'Material Contract',
        client_email: '',
        client_mobile: '',
        client_id: null,
        progress_updates: [],
        chat: [],
        money_requests: [],
        material_requests: []
      }

      if (latestProj?.description && latestProj.description.startsWith('{')) {
        try {
          meta = { ...meta, ...JSON.parse(latestProj.description) }
        } catch (e) {}
      } else {
        meta.address = latestProj?.description || ''
      }

      const updatedList = (meta.progress_updates || []).filter((up: any) => up.id !== id)

      const updatedPayload = JSON.stringify({
        ...meta,
        progress_updates: updatedList
      })

      const { error } = await supabase
        .from('projects')
        .update({ description: updatedPayload })
        .eq('id', selectedProjectId)

      if (error) throw error

      setProgressUpdates(updatedList)
      toast.success('Progress remark deleted successfully!')
    } catch (err: any) {
      toast.error('Failed to delete progress: ' + err.message)
    }
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Project Progress Log</h1>
        <p className="text-xs text-zinc-400 mt-1">Publish daily site progress timeline updates to your client portal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Projects Selector Sidebar */}
        <div style={PANEL} className="lg:col-span-4 p-4 flex flex-col space-y-4 overflow-y-auto max-h-[600px] custom-scrollbar">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Active Site Projects</p>
          <div className="space-y-2 flex-1">
            {projects.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No projects found.</p>
            ) : (
              projects.map(p => {
                const isSelected = p.id === selectedProjectId
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full text-left p-3.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-3 ${
                      isSelected 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-950/40 text-zinc-400 hover:bg-white/[0.02] hover:text-white border border-zinc-900'
                    }`}
                  >
                    <TrendingUp size={16} />
                    <span className="truncate">{p.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Progress Timeline and Form */}
        <div className="lg:col-span-8 space-y-6">
          {selectedProjectId && projectData ? (
            <>
              {/* Form Card */}
              <Card style={PANEL} className="border-none shadow-xl p-6">
                <div className="pb-4 border-b border-[#1e2435] mb-4">
                  <CardTitle className="text-lg text-white">
                    {editingProgressId ? "Edit Progress Update" : "Log Today's Work Progress"}
                  </CardTitle>
                </div>
                <form onSubmit={handleAddProgress} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1.5 w-full">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Progress Remark</label>
                    <input
                      type="text"
                      placeholder="e.g. Excavation complete / Brickwork started..."
                      value={newProgressText}
                      onChange={e => setNewProgressText(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-zinc-800 bg-[#0d1018] text-white focus:border-blue-500/50"
                      required
                    />
                  </div>
                  <div className="w-full sm:w-44 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
                    <input
                      type="date"
                      value={newProgressDate}
                      onChange={e => setNewProgressDate(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-zinc-800 bg-[#0d1018] text-white focus:border-blue-500/50"
                      required
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    {editingProgressId && (
                      <Button type="button" onClick={handleCancelEdit} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl px-4 h-11 font-bold w-full sm:w-auto">
                        Cancel
                      </Button>
                    )}
                    <Button type="submit" className="bg-blue-600 rounded-xl px-6 h-11 text-white font-bold w-full sm:w-auto" disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingProgressId ? 'Save Changes' : 'Log Update'}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Progress timeline log */}
              <Card style={PANEL} className="border-none shadow-xl p-6">
                <div className="pb-4 border-b border-[#1e2435] mb-6 flex items-center gap-3">
                  <TrendingUp className="text-blue-500 shrink-0" size={18} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Timeline Logs for {projectData.name}</p>
                </div>

                <div className="relative pl-6 border-l border-blue-500/20 space-y-6 ml-2 pt-2">
                  {progressUpdates.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic py-4">No progress remarks logged yet.</p>
                  ) : (
                    progressUpdates.map((upd, idx) => (
                      <div key={upd.id || idx} className="relative space-y-1 group flex items-start justify-between gap-4 border-b border-[#1e2435]/30 pb-3 last:border-none">
                        <div className="space-y-1">
                          <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/10" />
                          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">{format(new Date(upd.date), 'dd MMM yyyy')}</p>
                          <p className="text-sm text-white font-bold leading-relaxed">{upd.remarks}</p>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStartEdit(upd)}
                            className="p-1.5 rounded-lg bg-[#1a1f2e] border border-[#1e2435] text-zinc-400 hover:text-white transition-all cursor-pointer"
                            title="Edit Update"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteProgress(upd.id)}
                            className="p-1.5 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                            title="Delete Update"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          ) : (
            <div style={PANEL} className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[300px]">
              <TrendingUp size={32} className="mb-2 text-zinc-600" />
              <p className="text-sm font-semibold">Select a project from the sidebar to manage progress updates.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
