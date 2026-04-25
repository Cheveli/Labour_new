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

const workerTypeConfig: Record<string, { dailyRate: string; gender: 'Male' | 'Female' }> = {
  'Mistry (Skilled)': { dailyRate: '1300', gender: 'Male' },
  'Labour (Women)': { dailyRate: '800', gender: 'Female' },
  'Parakadu (Helper)': { dailyRate: '1000', gender: 'Male' },
}

function normalizeWorkerType(value: string, fallbackGender?: string): keyof typeof workerTypeConfig {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'mistry' || normalized === 'maistry' || normalized === 'mistry (skilled)' || normalized === 'mistry skilled') {
    return 'Mistry (Skilled)'
  }
  if (normalized === 'labour (women)' || normalized === 'labour women' || normalized === 'women labour') {
    return 'Labour (Women)'
  }
  if (normalized === 'parakadu' || normalized === 'parakadu (helper)' || normalized === 'helper') {
    return 'Parakadu (Helper)'
  }
  if (normalized === 'male' || normalized === 'female') {
    return normalizeGender(fallbackGender || '') === 'Female' ? 'Labour (Women)' : 'Mistry (Skilled)'
  }
  return 'Mistry (Skilled)'
}

function normalizeGender(value: string): 'Male' | 'Female' {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'female' || normalized === 'f' || normalized === 'woman' || normalized === 'women') {
    return 'Female'
  }
  return 'Male'
}

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

  const buildWorkerPayload = () => {
    const normalizedType = normalizeWorkerType(formData.type, formData.gender)
    const selectedType = workerTypeConfig[normalizedType]
    const resolvedGender = selectedType ? selectedType.gender : normalizeGender(formData.gender)
    return {
      ...formData,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      type: normalizedType,
      gender: resolvedGender,
      daily_rate: Number.parseFloat(formData.daily_rate || '0'),
    }
  }

  const showConstraintAwareError = (error: any) => {
    if (typeof error?.message === 'string' && error.message.toLowerCase().includes('labour_gender_check')) {
      toast.error('Gender value failed database rule. Set worker type correctly and try again.')
      return
    }
    toast.error(error?.message || 'Unable to save worker')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('labour').insert([buildWorkerPayload()])

    if (error) {
      showConstraintAwareError(error)
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
    const payload = buildWorkerPayload()
    const { error } = await supabase
      .from('labour')
      .update(payload)
      .eq('id', editingWorker.id)

    if (error) {
      showConstraintAwareError(error)
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
    const normalizedType = normalizeWorkerType(worker.type || '', worker.gender || '')
    const normalizedGender = normalizeGender(worker.gender || worker.type || 'Male')
    setEditingWorker(worker)
    setFormData({
      name: worker.name,
      phone: worker.phone || '',
      gender: normalizedGender,
      type: normalizedType,
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
    const selectedType = workerTypeConfig[value]
    setFormData({ 
      ...formData, 
      type: value,
      daily_rate: selectedType?.dailyRate || '0',
      gender: selectedType?.gender || 'Male'
    })
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const GOLD = '#3b82f6'
  const DIM = '#6b7280'
  const INPUT_STYLE = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }
  const DIALOG_STYLE = { backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Workers</h1>
          <p className="mt-1 text-sm" style={{ color: DIM }}>Manage your site crew, roles and daily wage rates.</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide text-[#0a0c12] transition-all"
          style={{ backgroundColor: GOLD, boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
        >
          <Plus size={16} /> Add Worker
        </button>
      </div>

      {/* Workers Table */}
      <div style={PANEL} className="overflow-hidden">
        <div className="px-6 py-4 border-b" style={{ borderColor: '#1e2435' }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>All Workers — {labourers.length} total</p>
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader style={{ backgroundColor: '#0d1018' }}>
              <TableRow style={{ borderColor: '#1e2435' }}>
                {['Worker', 'Phone', 'Role', 'Daily Wage', 'Status', 'Actions'].map(h => (
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
              ) : labourers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center text-sm font-bold" style={{ color: DIM }}>No workers added yet</TableCell>
                </TableRow>
              ) : (
                labourers.map((worker) => (
                  <TableRow key={worker.id} style={{ borderColor: '#1e2435' }} className="transition-colors hover:bg-white/[0.02]">
                    <TableCell className="px-4 py-4 font-bold text-white text-sm">{worker.name}</TableCell>
                    <TableCell className="px-4 py-4 text-xs font-semibold" style={{ color: DIM }}>{worker.phone || '—'}</TableCell>
                    <TableCell className="px-4 py-4 text-xs font-semibold" style={{ color: DIM }}>{worker.type}</TableCell>
                    <TableCell className="px-4 py-4 text-sm font-black" style={{ color: GOLD }}>₹{worker.daily_rate}</TableCell>
                    <TableCell className="px-4 py-4">
                      <span className="px-2 py-1 rounded-lg text-[10px] font-black" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>Active</span>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(worker)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Edit</button>
                        <button onClick={() => handleDeleteClick(worker.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Delete</button>
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
          ) : labourers.length === 0 ? (
            <div className="py-16 text-center text-sm font-bold" style={{ color: DIM }}>No workers added yet</div>
          ) : (
            labourers.map((worker) => (
              <div key={worker.id} className="rounded-xl p-4 flex flex-col gap-4 border" style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-base">{worker.name}</p>
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>Active</span>
                    </div>
                    <p className="text-xs font-semibold mt-1" style={{ color: DIM }}>{worker.type}</p>
                    {worker.phone && <p className="text-xs font-semibold mt-1" style={{ color: DIM }}>{worker.phone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Daily Rate</p>
                    <p className="font-black text-lg mt-0.5" style={{ color: GOLD }}>₹{worker.daily_rate}</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-2 pt-3 border-t" style={{ borderColor: '#1e2435' }}>
                  <button onClick={() => handleEdit(worker)} className="flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Edit</button>
                  <button onClick={() => handleDeleteClick(worker.id)} className="flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Worker Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent style={DIALOG_STYLE} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-black">{editingWorker ? 'Edit Worker' : 'Add New Worker'}</DialogTitle>
            <DialogDescription style={{ color: DIM }}>Worker type sets the default rate and gender.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editingWorker ? handleUpdate : handleCreate} className="space-y-4 mt-2">
            {[
              { label: 'Full Name', key: 'name', placeholder: 'Enter full name', type: 'text', required: true },
              { label: 'Phone Number', key: 'phone', placeholder: 'Enter phone number', type: 'text', required: false },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(formData as any)[f.key]}
                  onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  required={f.required}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none focus:ring-2"
                  style={INPUT_STYLE}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Worker Type</label>
              <Select onValueChange={(v) => handleTypeChange(v || 'Mistry (Skilled)')} value={formData.type}>
                <SelectTrigger className="h-11 rounded-xl font-semibold" style={INPUT_STYLE}>
                  <SelectValue items={{ 'Mistry (Skilled)': 'Mistry (Skilled) — ₹1300/day', 'Labour (Women)': 'Labour (Women) — ₹800/day', 'Parakadu (Helper)': 'Parakadu (Helper) — ₹1000/day' }} />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }}>
                  <SelectItem value="Mistry (Skilled)">Mistry (Skilled) — ₹1300/day</SelectItem>
                  <SelectItem value="Labour (Women)">Labour (Women) — ₹800/day</SelectItem>
                  <SelectItem value="Parakadu (Helper)">Parakadu (Helper) — ₹1000/day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Per-Day Rate (₹)</label>
              <input
                type="number"
                placeholder="Daily rate"
                value={formData.daily_rate}
                onChange={e => setFormData({ ...formData, daily_rate: e.target.value })}
                className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                style={INPUT_STYLE}
              />
            </div>

            <DialogFooter className="mt-4">
              <button type="button" onClick={handleDialogClose} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Cancel</button>
              <button type="submit" disabled={saving} className="px-6 py-2 rounded-xl text-sm font-black text-[#0a0c12] flex items-center gap-2" style={{ backgroundColor: GOLD }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingWorker ? 'Update Worker' : 'Save Worker'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={DIALOG_STYLE} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 font-black">Delete Worker</DialogTitle>
            <DialogDescription style={{ color: DIM }}>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setDeleteDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Cancel</button>
            <button onClick={handleDeleteConfirm} className="px-4 py-2 rounded-xl text-sm font-black text-white" style={{ backgroundColor: '#ef4444' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
