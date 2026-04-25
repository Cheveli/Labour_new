'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Plus, Loader2 } from 'lucide-react'
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
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    description: '',
    status: 'ACTIVE'
  })

  const supabase = createClient()

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Project name is required')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('projects').insert([formData])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Project created successfully')
      setFormData({ name: '', owner_name: '', description: '', status: 'ACTIVE' })
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
    const { error } = await supabase
      .from('projects')
      .update(formData)
      .eq('id', editingProject.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Project updated successfully')
      setFormData({ name: '', owner_name: '', description: '', status: 'ACTIVE' })
      setEditingProject(null)
      fetchProjects()
    }
    setSaving(false)
  }

  const handleEdit = (project: any) => {
    setEditingProject(project)
    setFormData({
      name: project.name,
      owner_name: project.owner_name || '',
      description: project.description || '',
      status: project.status || 'ACTIVE'
    })
  }

  const handleCancelEdit = () => {
    setEditingProject(null)
    setFormData({ name: '', owner_name: '', description: '', status: 'ACTIVE' })
  }

  const handleDeleteClick = (id: string) => {
    setProjectToDelete(id)
    setDeleteConfirmText('')
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('You must type DELETE to confirm')
      return
    }

    if (!projectToDelete) return

    const { error } = await supabase.from('projects').delete().eq('id', projectToDelete)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Project deleted successfully')
      fetchProjects()
    }
    setDeleteDialogOpen(false)
    setProjectToDelete(null)
    setDeleteConfirmText('')
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const GOLD = '#3b82f6'
  const DIM = '#6b7280'
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }
  const DLG_ST = { backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Projects</h1>
          <p className="mt-1 text-sm" style={{ color: DIM }}>Manage active and completed construction sites.</p>
        </div>
        <button
          onClick={() => { setEditingProject(null); setFormData({ name: '', owner_name: '', description: '', status: 'ACTIVE' }) }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase text-[#0a0c12]"
          style={{ backgroundColor: GOLD, boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table */}
        <div className="lg:col-span-8">
          <div style={PANEL} className="overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: '#1e2435' }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>All Projects — {projects.length} sites</p>
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader style={{ backgroundColor: '#0d1018' }}>
                  <TableRow style={{ borderColor: '#1e2435' }}>
                    {['Project Name', 'Owner', 'Address', 'Status', 'Actions'].map(h => (
                      <TableHead key={h} className="py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i} style={{ borderColor: '#1e2435' }}>
                        <TableCell colSpan={5} className="h-14 animate-pulse" style={{ backgroundColor: '#1a1f2e' }} />
                      </TableRow>
                    ))
                  ) : projects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-16 text-center text-sm font-bold" style={{ color: DIM }}>No projects yet</TableCell>
                    </TableRow>
                  ) : (
                    projects.map((project) => (
                      <TableRow key={project.id} style={{ borderColor: '#1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                        <TableCell className="px-4 py-4 font-bold text-white text-sm">{project.name}</TableCell>
                        <TableCell className="px-4 py-4 text-xs" style={{ color: DIM }}>{project.owner_name || '—'}</TableCell>
                        <TableCell className="px-4 py-4 text-xs truncate max-w-[160px]" style={{ color: DIM }}>{project.description || '—'}</TableCell>
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
                        </div>
                        <p className="text-[10px] font-bold mt-1" style={{ color: DIM }}>{project.owner_name || 'No Owner'}</p>
                        {project.description && <p className="text-xs font-semibold mt-1" style={{ color: DIM }}>{project.description}</p>}
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

        {/* Form */}
        <div className="lg:col-span-4">
          <div style={PANEL} className="p-6">
            <p className="text-sm font-black text-white mb-6">{editingProject ? 'Edit Project' : 'New Project'}</p>
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
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Status</label>
                <Select onValueChange={(v: string | null) => setFormData({ ...formData, status: v ?? 'ACTIVE' })} value={formData.status}>
                  <SelectTrigger className="h-11 rounded-xl font-semibold text-sm" style={INPUT_ST}>
                    <SelectValue items={{ ACTIVE: 'Active', COMPLETED: 'Completed' }} />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }}>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                {editingProject && (
                  <button type="button" onClick={handleCancelEdit} className="flex-1 h-11 rounded-xl text-sm font-bold" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Cancel</button>
                )}
                <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl text-sm font-black text-[#0a0c12] flex items-center justify-center gap-2" style={{ backgroundColor: GOLD }}>
                  {saving ? <Loader2 size={14} className="animate-spin text-[#0a0c12]" /> : null}
                  {editingProject ? 'Update' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={DLG_ST} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 font-black">Delete Project</DialogTitle>
            <DialogDescription style={{ color: DIM }}>Type <strong>DELETE</strong> to confirm. All related records will be removed.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full h-11 px-3 rounded-xl text-sm outline-none"
              style={INPUT_ST}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDeleteDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Cancel</button>
            <button onClick={handleDeleteConfirm} disabled={deleteConfirmText !== 'DELETE'} className="px-4 py-2 rounded-xl text-sm font-black text-white disabled:opacity-40" style={{ backgroundColor: '#ef4444' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
