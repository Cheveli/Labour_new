'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Edit2, Trash2, Loader2, Briefcase, MapPin, Activity } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Projects</h1>
          <p className="mt-2 text-zinc-500 font-medium">Manage active, inactive and completed sites.</p>
        </div>
        <Button className="bg-[#00A3FF] hover:bg-[#0092E6] text-white rounded-xl font-bold uppercase tracking-tight gap-2 px-8 shadow-lg shadow-blue-500/20">
          <Plus size={18} /> New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Projects Table */}
        <div className="lg:col-span-8">
          <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-zinc-800">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">All Projects</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto no-scrollbar">
                <Table>
                  <TableHeader className="bg-[#0F172A] sticky top-0 z-10">
                    <TableRow className="border-zinc-800 hover:bg-[#0F172A]">
                      <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Name</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Owner</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Address</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400 text-center">Status</TableHead>
                      <TableHead className="text-right px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-zinc-800">
                          <TableCell colSpan={4} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                        </TableRow>
                      ))
                    ) : projects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-24 text-center text-zinc-500">No sites found</TableCell>
                      </TableRow>
                    ) : (
                      projects.map((project) => (
                        <TableRow key={project.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                          <TableCell className="px-8 py-5 font-bold text-white text-sm">{project.name}</TableCell>
                          <TableCell className="py-5 font-bold text-zinc-600 text-xs tracking-tight lowercase truncate max-w-xs">{project.owner_name || '—'}</TableCell>
                          <TableCell className="py-5 font-bold text-zinc-600 text-xs tracking-tight lowercase truncate max-w-xs">{project.description || '—'}</TableCell>
                          <TableCell className="py-5 text-center">
                            <Badge className={cn(
                              "px-3 py-1 rounded-lg text-[9px] font-black border-2",
                              project.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                            )}>
                              {project.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-8 py-5 space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 border-zinc-800 bg-[#1F2937] text-white px-3 font-bold text-[10px] uppercase tracking-tighter"
                              onClick={() => handleEdit(project)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-zinc-800 bg-[#1F2937] text-red-500 px-3 font-bold text-[10px] uppercase tracking-tighter"
                              onClick={() => handleDeleteClick(project.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Create/Edit Project Form */}
        <div className="lg:col-span-4">
          <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden p-8">
            <h3 className="text-lg font-black uppercase tracking-tight mb-8">{editingProject ? 'Edit Project' : 'Project Name'}</h3>
            <form onSubmit={editingProject ? handleUpdate : handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Input
                  placeholder="Eg. Gachibowli Tower"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Owner Name</label>
                <Input
                  placeholder="Project owner name"
                  value={formData.owner_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Project Address</label>
                <Textarea
                  placeholder="Site location, city, etc."
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-[120px] bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white p-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</label>
                <Select onValueChange={(v: string | null) => setFormData({ ...formData, status: v ?? 'ACTIVE' })} value={formData.status}>
                  <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                    <SelectItem value="ACTIVE" className="py-3 font-bold">ACTIVE</SelectItem>
                    <SelectItem value="COMPLETED" className="py-3 font-bold">COMPLETED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4 pt-4">
                {editingProject && (
                  <Button type="button" variant="ghost" className="flex-1 h-12 rounded-xl font-black uppercase text-xs tracking-tight hover:bg-zinc-800" onClick={handleCancelEdit}>Cancel</Button>
                )}
                <Button type="submit" disabled={saving} className="flex-1 h-12 bg-[#00A3FF] hover:bg-[#0092E6] text-white rounded-xl font-black uppercase text-xs tracking-tight shadow-xl shadow-blue-500/20">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : editingProject ? 'Update Project' : 'Create Project'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Project</DialogTitle>
            <DialogDescription>
              Deleting this project will remove all related records. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Type DELETE here"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="h-12"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmText !== 'DELETE'}
            >
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
