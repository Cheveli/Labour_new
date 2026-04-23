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
import { Plus, Search, Edit2, Trash2, Loader2, Users, HardHat, Phone, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export default function WorkersPage() {
  const [labourers, setLabourers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingWorker, setEditingWorker] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workerToDelete, setWorkerToDelete] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: 'Male',
    type: 'Mistry (Skilled)',
    daily_rate: '1300'
  })
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    setLabourers(labData || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('labour').insert([{
      ...formData,
      daily_rate: parseFloat(formData.daily_rate || '0')
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Worker added successfully')
      setFormData({ name: '', phone: '', gender: 'Male', type: 'Mistry (Skilled)', daily_rate: '1300' })
      setDialogOpen(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !editingWorker) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('labour')
      .update({
        ...formData,
        daily_rate: parseFloat(formData.daily_rate || '0')
      })
      .eq('id', editingWorker.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Worker updated successfully')
      setFormData({ name: '', phone: '', gender: 'Male', type: 'Mistry (Skilled)', daily_rate: '1300' })
      setEditingWorker(null)
      setDialogOpen(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleEdit = (worker: any) => {
    setEditingWorker(worker)
    setFormData({
      name: worker.name,
      phone: worker.phone || '',
      gender: worker.gender || 'Male',
      type: worker.type,
      daily_rate: worker.daily_rate.toString()
    })
    setDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setWorkerToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!workerToDelete) return

    const { error } = await supabase.from('labour').delete().eq('id', workerToDelete)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Worker deleted successfully')
      fetchData()
    }
    setDeleteDialogOpen(false)
    setWorkerToDelete(null)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingWorker(null)
    setFormData({ name: '', phone: '', gender: 'Male', type: 'Mistry (Skilled)', daily_rate: '1300' })
  }

  const handleTypeChange = (value: string) => {
    const rates: any = {
      'Mistry (Skilled)': '1300',
      'Labour (Women)': '800',
      'Parakadu (Helper)': '1000'
    }
    const genders: any = {
      'Mistry (Skilled)': 'Male',
      'Labour (Women)': 'Female',
      'Parakadu (Helper)': 'Male'
    }
    setFormData({ 
      ...formData, 
      type: value,
      daily_rate: rates[value] || '0',
      gender: genders[value] || 'Male'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Workers</h1>
          <p className="mt-2 text-zinc-500 font-medium">Manage workers and set per-day salary.</p>
        </div>
        <Button 
          className="bg-[#00A3FF] hover:bg-[#0092E6] text-white rounded-xl font-bold uppercase tracking-tight gap-2 px-8 shadow-lg shadow-blue-500/20"
          onClick={() => setDialogOpen(true)}
        >
          <Plus size={18} /> Add Worker
        </Button>
      </div>

      {/* Workers Table */}
      <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-zinc-800">
           <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">All Workers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#0F172A]">
              <TableRow className="border-zinc-800 hover:bg-[#0F172A]">
                <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Name</TableHead>
                <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Phone</TableHead>
                <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Gender</TableHead>
                <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Type</TableHead>
                <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Per-day</TableHead>
                <TableHead className="text-right px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i} className="animate-pulse border-zinc-800">
                    <TableCell colSpan={6} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                  </TableRow>
                ))
              ) : labourers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-24 text-center text-zinc-500">No workers found</TableCell>
                </TableRow>
              ) : (
                labourers.map((worker) => (
                  <TableRow key={worker.id} className="border-zinc-800 transition-colors hover:bg-white/5 group">
                    <TableCell className="px-8 py-5 font-bold text-white text-sm">{worker.name}</TableCell>
                    <TableCell className="py-5 font-bold text-zinc-500 text-xs tracking-tight">{worker.phone || '—'}</TableCell>
                    <TableCell className="py-5 font-bold text-zinc-500 text-xs">{worker.gender || '—'}</TableCell>
                    <TableCell className="py-5 font-bold text-zinc-500 text-xs">{worker.type}</TableCell>
                    <TableCell className="py-5 font-black text-[#00A3FF] text-[13px]">₹ {worker.daily_rate.toFixed(2)}</TableCell>
                    <TableCell className="text-right px-8 py-5 space-x-2">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-8 border-zinc-800 bg-[#1F2937] text-white px-3 font-bold text-[10px] uppercase tracking-tighter"
                         onClick={() => handleEdit(worker)}
                        >
                         Edit
                       </Button>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-8 border-zinc-800 bg-[#1F2937] text-red-500 px-3 font-bold text-[10px] uppercase tracking-tighter"
                         onClick={() => handleDeleteClick(worker.id)}
                        >
                         Delete
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Worker Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWorker ? 'Edit Worker' : 'Add Worker'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingWorker ? handleUpdate : handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Full name</label>
              <Input 
                placeholder="Enter full name" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
                className="h-12"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Phone (optional)</label>
              <Input 
                placeholder="Mobile number" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Gender</label>
              <Select onValueChange={(v) => setFormData({...formData, gender: v || 'Male'})} value={formData.gender}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Worker type</label>
              <Select onValueChange={(v) => handleTypeChange(v || 'Mistry (Skilled)')} value={formData.type}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mistry (Skilled)">Mistry (Skilled) - ₹1300/day</SelectItem>
                  <SelectItem value="Labour (Women)">Labour (Women) - ₹800/day</SelectItem>
                  <SelectItem value="Parakadu (Helper)">Parakadu (Helper) - ₹1000/day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Per-day salary</label>
              <Input 
                placeholder="Daily rate" 
                type="number"
                value={formData.daily_rate}
                onChange={e => setFormData({...formData, daily_rate: e.target.value})}
                className="h-12"
              />
              <p className="text-[9px] font-medium text-zinc-500 italic mt-1 leading-tight">You can override the default rate here.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDialogClose}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#00A3FF] hover:bg-[#0092E6]">
                {saving ? <Loader2 size={16} className="animate-spin" /> : editingWorker ? 'Update' : 'Add Worker'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Worker</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this worker? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete Worker</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
