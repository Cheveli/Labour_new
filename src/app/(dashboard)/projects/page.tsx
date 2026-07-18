'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Plus, Loader2, MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [deleteOtpInput, setDeleteOtpInput] = useState('')
  const [deleteStep, setDeleteStep] = useState<'idle' | 'sending' | 'verify'>('idle')
  const [showAddModal, setShowAddModal] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    description: '', // holds address in UI
    project_type: 'Material Contract',
    client_email: '',
    client_mobile: '',
    client_password: 'Client@123',
    status: 'ACTIVE'
  })

  const supabase = createClient()

  useEffect(() => {
    const handleTrigger = () => {
      setFormData({
        name: '',
        owner_name: '',
        description: '',
        project_type: 'Material Contract',
        client_email: '',
        client_mobile: '',
        client_password: 'Client@123',
        status: 'ACTIVE'
      })
      setEditingProject(null)
      setShowAddModal(true)
    }
    window.addEventListener('ssc_trigger_add_project', handleTrigger)
    return () => window.removeEventListener('ssc_trigger_add_project', handleTrigger)
  }, [])

  // Helper parsing functions
  const getProjectAddress = (desc: string | null) => {
    if (!desc) return ''
    if (desc.startsWith('{')) {
      try {
        const parsed = JSON.parse(desc)
        return parsed.address || ''
      } catch (e) {
        return desc
      }
    }
    return desc
  }

  const getProjectType = (desc: string | null) => {
    if (!desc) return 'Material Contract'
    if (desc.startsWith('{')) {
      try {
        const parsed = JSON.parse(desc)
        return parsed.project_type || 'Material Contract'
      } catch (e) {
        return 'Material Contract'
      }
    }
    return 'Material Contract'
  }

  const getProjectClient = (desc: string | null) => {
    if (!desc) return null
    if (desc.startsWith('{')) {
      try {
        const parsed = JSON.parse(desc)
        return {
          client_email: parsed.client_email || '',
          client_mobile: parsed.client_mobile || '',
          client_password: parsed.client_password || 'Client@123',
          client_id: parsed.client_id || null
        }
      } catch (e) {
        return null
      }
    }
    return null
  }

  useEffect(() => {
    fetchProjects().then((list) => {
      // Find and auto-upgrade Chevelly project to Material Contract
      const chevelly = list?.find(p => p.name.toLowerCase().includes('chevelly'))
      if (chevelly && (!chevelly.description || !chevelly.description.startsWith('{'))) {
        const upgradePayload = {
          description: JSON.stringify({
            address: chevelly.description || 'Uppal, Peerzadiguda, Ganesh nagar',
            project_type: 'Material Contract',
            client_name: chevelly.owner_name || 'Chevelly Srinivas'
          })
        }
        supabase.from('projects').update(upgradePayload).eq('id', chevelly.id).then(() => {
          fetchProjects()
        })
      }
    })
  }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').neq('status', 'SYSTEM').order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
    return data || []
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Project name is required')
      return
    }

    setSaving(true)

    let registeredClientId = null
    if (formData.client_email && formData.client_mobile) {
      try {
        const res = await fetch('/api/auth/register-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.owner_name || 'Client',
            email: formData.client_email,
            mobileNumber: formData.client_mobile,
            password: formData.client_password || 'Client@123'
          })
        })
        const resData = await res.json()
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to register client user')
        }
        registeredClientId = resData.userId
      } catch (err: any) {
        toast.error('Client account creation failed: ' + err.message)
        setSaving(false)
        return
      }
    }

    const descriptionPayload = JSON.stringify({
      address: formData.description,
      project_type: formData.project_type,
      client_email: formData.client_email,
      client_mobile: formData.client_mobile,
      client_password: formData.client_password,
      client_id: registeredClientId
    })

    const payload = {
      name: formData.name,
      owner_name: formData.owner_name,
      status: formData.status,
      description: descriptionPayload
    }

    const { error } = await supabase.from('projects').insert([payload])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Project created successfully')
      setFormData({
        name: '',
        owner_name: '',
        description: '',
        project_type: 'Material Contract',
        client_email: '',
        client_mobile: '',
        client_password: 'Client@123',
        status: 'ACTIVE'
      })
      setShowAddModal(false)
      fetchProjects()
    }
    setSaving(false)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !editingProject) {
      toast.error('Project name is required')
      return
    }

    setSaving(true)

    let registeredClientId = null
    if (formData.client_email && formData.client_mobile) {
      try {
        const res = await fetch('/api/auth/register-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.owner_name || 'Client',
            email: formData.client_email,
            mobileNumber: formData.client_mobile,
            password: formData.client_password || 'Client@123'
          })
        })
        const resData = await res.json()
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to register client user')
        }
        registeredClientId = resData.userId
      } catch (err: any) {
        toast.error('Client account update failed: ' + err.message)
        setSaving(false)
        return
      }
    }

    const currentClient = getProjectClient(editingProject.description)
    const descriptionPayload = JSON.stringify({
      address: formData.description,
      project_type: formData.project_type,
      client_email: formData.client_email,
      client_mobile: formData.client_mobile,
      client_password: formData.client_password,
      client_id: registeredClientId || currentClient?.client_id || null,
      progress_updates: editingProject.description?.startsWith('{') ? JSON.parse(editingProject.description).progress_updates || [] : [],
      chat: editingProject.description?.startsWith('{') ? JSON.parse(editingProject.description).chat || [] : [],
      money_requests: editingProject.description?.startsWith('{') ? JSON.parse(editingProject.description).money_requests || [] : [],
      material_requests: editingProject.description?.startsWith('{') ? JSON.parse(editingProject.description).material_requests || [] : []
    })

    const payload = {
      name: formData.name,
      owner_name: formData.owner_name,
      status: formData.status,
      description: descriptionPayload
    }

    const { error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', editingProject.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Project updated successfully')
      setFormData({
        name: '',
        owner_name: '',
        description: '',
        project_type: 'Material Contract',
        client_email: '',
        client_mobile: '',
        client_password: 'Client@123',
        status: 'ACTIVE'
      })
      setEditingProject(null)
      setShowAddModal(false)
      fetchProjects()
    }
    setSaving(false)
  }

  const handleEdit = (project: any) => {
    setEditingProject(project)
    const client = getProjectClient(project.description)
    setFormData({
      name: project.name,
      owner_name: project.owner_name || '',
      description: getProjectAddress(project.description),
      project_type: getProjectType(project.description),
      client_email: client?.client_email || '',
      client_mobile: client?.client_mobile || '',
      client_password: client?.client_password || 'Client@123',
      status: project.status || 'ACTIVE'
    })
    setShowAddModal(true)
  }

  const handleCancelEdit = () => {
    setEditingProject(null)
    setFormData({
      name: '',
      owner_name: '',
      description: '',
      project_type: 'Material Contract',
      client_email: '',
      client_mobile: '',
      client_password: 'Client@123',
      status: 'ACTIVE'
    })
    setShowAddModal(false)
  }

  const handleDeleteClick = async (id: string) => {
    setProjectToDelete(id)
    setDeleteOtpInput('')
    setDeleteStep('sending')
    setDeleteDialogOpen(true)

    // Get current user email and send OTP
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email || user?.user_metadata?.email || 'saichevelly@gmail.com'

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }
    })

    if (error) {
      toast.error('Failed to send OTP: ' + error.message)
      setDeleteDialogOpen(false)
    } else {
      toast.success(`OTP sent to ${email}`)
      setDeleteStep('verify')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || !deleteOtpInput) return

    // Get user email for verification
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email || user?.user_metadata?.email || 'saichevelly@gmail.com'

    // Verify OTP
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: deleteOtpInput,
      type: 'email'
    })

    if (verifyError) {
      toast.error('Invalid OTP — please try again')
      return
    }

    // OTP verified — proceed with deletion
    const { error } = await supabase.from('projects').delete().eq('id', projectToDelete)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Project deleted. Related records (attendance, revenue, extra work) are preserved.')
      fetchProjects()
    }
    setDeleteDialogOpen(false)
    setProjectToDelete(null)
    setDeleteOtpInput('')
    setDeleteStep('idle')
  }

  const sendClientWhatsApp = (project: any) => {
    const msg = [
      `🏗️ *SSC CONSTRUCTIONS — PROJECT UPDATE*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 *Project:* ${project.name}`,
      project.owner_name ? `👤 *Client:* ${project.owner_name}` : '',
      `📌 *Status:* ${project.status}`,
      project.description ? `📍 *Site:* ${project.description}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `_For billing queries contact SSC Constructions_`,
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const GOLD = '#3b82f6'
  const DIM = '#6b7280'
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }
  const DLG_ST = { backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Projects</h1>
          <p className="mt-1 text-sm" style={{ color: DIM }}>Manage active and completed construction sites.</p>
        </div>
        <button
          onClick={() => {
            setEditingProject(null);
            setFormData({
              name: '',
              owner_name: '',
              description: '',
              project_type: 'Material Contract',
              client_email: '',
              client_mobile: '',
              client_password: 'Client@123',
              status: 'ACTIVE'
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase text-[#0a0c12] cursor-pointer self-start sm:self-auto"
          style={{ backgroundColor: GOLD, boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table - Full Width */}
        <div className="lg:col-span-12">
          <div style={PANEL} className="overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: '#1e2435' }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>All Projects — {projects.length} sites</p>
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader style={{ backgroundColor: '#0d1018' }}>
                  <TableRow style={{ borderColor: '#1e2435' }}>
                    {['Project Name', 'Type', 'Owner', 'Address', 'Status', 'Actions'].map(h => (
                      <TableHead key={h} className="py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i} style={{ borderColor: '#1e2435' }}>
                        <TableCell colSpan={6} className="h-14 animate-pulse" style={{ backgroundColor: '#1a1f2e' }} />
                      </TableRow>
                    ))
                  ) : projects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center text-sm font-bold" style={{ color: DIM }}>No projects yet</TableCell>
                    </TableRow>
                  ) : (
                    projects.map((project) => (
                      <TableRow key={project.id} style={{ borderColor: '#1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                        <TableCell className="px-4 py-4 font-bold text-white text-sm">{project.name}</TableCell>
                        <TableCell className="px-4 py-4 text-xs font-semibold">
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase"
                            style={getProjectType(project.description) === 'Labour Contract'
                              ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                              : { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                            {getProjectType(project.description)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-xs" style={{ color: DIM }}>{project.owner_name || '—'}</TableCell>
                        <TableCell className="px-4 py-4 text-xs truncate max-w-[160px]" style={{ color: DIM }}>{getProjectAddress(project.description) || '—'}</TableCell>
                        <TableCell className="px-4 py-4">
                          <span className="px-2 py-1 rounded-lg text-[10px] font-black"
                            style={project.status === 'ACTIVE'
                              ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                              : { backgroundColor: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }}>
                            {project.status}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(project)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Edit</button>
                            <button onClick={() => handleDeleteClick(project.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Delete</button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="flex flex-col gap-3 p-4 md:hidden">
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl" style={{ backgroundColor: '#1a1f2e' }} />
                ))
              ) : projects.length === 0 ? (
                <div className="py-16 text-center text-sm font-bold" style={{ color: DIM }}>No projects yet</div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="rounded-xl p-4 flex flex-col gap-4 border" style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-base">{project.name}</p>
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase"
                            style={project.status === 'ACTIVE'
                              ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                              : { backgroundColor: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }}>
                            {project.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase"
                            style={getProjectType(project.description) === 'Labour Contract'
                              ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                              : { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                            {getProjectType(project.description)}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold mt-1" style={{ color: DIM }}>{project.owner_name || 'No Owner'}</p>
                        {project.description && <p className="text-xs font-semibold mt-1" style={{ color: DIM }}>{getProjectAddress(project.description)}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-2 pt-3 border-t" style={{ borderColor: '#1e2435' }}>
                      <button onClick={() => handleEdit(project)} className="flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Edit</button>
                      <button onClick={() => handleDeleteClick(project.id)} className="flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={handleCancelEdit}>
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">{editingProject ? 'Edit Project' : 'New Project'}</p>
              </div>
              <button onClick={handleCancelEdit} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"><X size={18}/></button>
            </div>
            
            <form onSubmit={editingProject ? handleUpdate : handleCreate} className="space-y-4">
              {[
                { label: 'Project Name', key: 'name', placeholder: 'e.g. Gachibowli Tower', type: 'text' },
                { label: 'Owner Name', key: 'owner_name', placeholder: 'Owner full name', type: 'text' },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(formData as any)[f.key]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [f.key]: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                    style={INPUT_ST}
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Address</label>
                <textarea
                  placeholder="Site location, city..."
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold outline-none resize-none"
                  style={INPUT_ST}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project Type</label>
                <select value={formData.project_type} onChange={e => setFormData({ ...formData, project_type: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST}>
                  <option value="Material Contract">Material Contract</option>
                  <option value="Labour Contract">Labour Contract</option>
                </select>
              </div>

              <div className="space-y-3 pt-2 border-t border-[#1e2435]">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Owner (Client) Portal Credentials</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Client Email</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={formData.client_email}
                      onChange={e => setFormData({ ...formData, client_email: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                      style={INPUT_ST}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Client Mobile</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9999999999"
                      value={formData.client_mobile}
                      onChange={e => setFormData({ ...formData, client_mobile: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                      style={INPUT_ST}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Client Password</label>
                  <input
                    type="text"
                    placeholder="Standard password"
                    value={formData.client_password}
                    onChange={e => setFormData({ ...formData, client_password: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                    style={INPUT_ST}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Status</label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST}>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ON_HOLD">On Hold</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCancelEdit} className="flex-1 h-11 rounded-xl text-sm font-bold bg-[#1a1f2e] text-[#f0f0f0] border border-[#1e2435]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl text-sm font-black text-[#0a0c12] flex items-center justify-center gap-2" style={{ backgroundColor: GOLD }}>
                  {saving ? <Loader2 size={14} className="animate-spin text-[#0a0c12]" /> : null}
                  {editingProject ? 'Update' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeleteStep('idle'); setDeleteOtpInput(''); } }}>
        <DialogContent style={DLG_ST} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 font-black">Delete Project</DialogTitle>
            <DialogDescription style={{ color: DIM }}>
              {deleteStep === 'sending' ? 'Sending OTP to your email...' : 'Enter the OTP sent to your email to confirm deletion. Attendance, revenue, and extra work records will be preserved.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {deleteStep === 'sending' && (
              <div className="text-center py-6">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} style={{ color: '#3b82f6' }} />
                <p className="text-sm" style={{ color: DIM }}>Sending OTP...</p>
              </div>
            )}
            {deleteStep === 'verify' && (
              <input
                placeholder="Enter 6-digit OTP"
                value={deleteOtpInput}
                onChange={(e) => setDeleteOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full h-11 px-3 rounded-xl text-sm outline-none text-center font-black tracking-widest"
                style={INPUT_ST}
                maxLength={6}
                autoFocus
              />
            )}
          </div>
          <DialogFooter>
            <button onClick={() => { setDeleteDialogOpen(false); setDeleteStep('idle'); setDeleteOtpInput(''); }} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Cancel</button>
            {deleteStep === 'verify' && (
              <button onClick={handleDeleteConfirm} disabled={deleteOtpInput.length !== 6} className="px-4 py-2 rounded-xl text-sm font-black text-white disabled:opacity-40" style={{ backgroundColor: '#ef4444' }}>Delete Project</button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
