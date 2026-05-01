'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Search, 
  Plus, 
  Phone, 
  Copy, 
  Check, 
  User, 
  HardHat, 
  Hammer, 
  Users,
  Loader2,
  Edit2,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const GOLD = '#3b82f6'
const DIM = '#6b7280'
const INPUT_STYLE = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }
const DIALOG_STYLE = { backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }

const workerTypes = [
  { label: 'Mistry (Skilled)', value: 'Mistry (Skilled)', icon: HardHat, color: 'text-blue-400' },
  { label: 'Labour (Women)', value: 'Labour (Women)', icon: Users, color: 'text-pink-400' },
  { label: 'Parakadu (Helper)', value: 'Parakadu (Helper)', icon: Hammer, color: 'text-amber-400' },
]

export default function ContactsPage() {
  const [workers, setWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    type: 'Mistry (Skilled)'
  })

  const supabase = createClient()

  useEffect(() => {
    fetchWorkers()
  }, [])

  async function fetchWorkers() {
    setLoading(true)
    const { data } = await supabase.from('labour').select('*').order('name')
    setWorkers(data || [])
    setLoading(false)
  }

  const handleCopy = (phone: string, id: string) => {
    if (!phone) {
      toast.error('No phone number available')
      return
    }
    navigator.clipboard.writeText(phone)
    setCopiedId(id)
    toast.success('Number copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return toast.error('Name is required')
    
    setSaving(true)
    const payload = {
      ...formData
    }

    let error
    if (editingWorker) {
      const { error: err } = await supabase.from('labour').update(payload).eq('id', editingWorker.id)
      error = err
    } else {
      const { error: err } = await supabase.from('labour').insert([payload])
      error = err
    }

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(editingWorker ? 'Contact updated' : 'Contact added')
      setDialogOpen(false)
      setEditingWorker(null)
      setFormData({ name: '', phone: '', type: 'Mistry (Skilled)' })
      fetchWorkers()
    }
    setSaving(false)
  }

  const handleEdit = (worker: any) => {
    setEditingWorker(worker)
    setFormData({
      name: worker.name,
      phone: worker.phone || '',
      type: worker.type
    })
    setDialogOpen(true)
  }

  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.phone && w.phone.includes(searchQuery))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Worker Contacts</h1>
          <p className="mt-1 text-sm" style={{ color: DIM }}>Quick access to site crew phone numbers. Click to copy.</p>
        </div>
        <button
          onClick={() => {
            setEditingWorker(null)
            setFormData({ name: '', phone: '', type: 'Mistry (Skilled)' })
            setDialogOpen(true)
          }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide text-[#0a0c12] transition-all"
          style={{ backgroundColor: GOLD, boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
        >
          <Plus size={16} /> Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Search by name or number..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full h-12 pl-11 pr-4 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/50"
          style={INPUT_STYLE}
        />
      </div>

      {/* Contacts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} />
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={PANEL}>
          <Users size={48} className="mx-auto mb-4 opacity-20" style={{ color: DIM }} />
          <p className="text-sm font-bold" style={{ color: DIM }}>No contacts found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredWorkers.map((worker) => {
              const typeInfo = workerTypes.find(t => t.value === worker.type) || workerTypes[0]
              const Icon = typeInfo.icon
              
              return (
                <motion.div
                  key={worker.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative rounded-2xl p-4 transition-all hover:ring-2 hover:ring-blue-500/30 overflow-hidden cursor-pointer"
                  style={PANEL}
                  onClick={() => handleCopy(worker.phone, worker.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white/5", typeInfo.color)}>
                      <Icon size={20} />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEdit(worker); }}
                        className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-white truncate text-base mb-1">{worker.name}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-60" style={{ color: DIM }}>{worker.type}</p>
                  
                  <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-400 group-hover:text-blue-400 transition-colors">
                      <Phone size={14} />
                      <span className="text-sm font-mono font-bold">{worker.phone || 'NO NUMBER'}</span>
                    </div>
                    {copiedId === worker.id ? (
                      <Check size={14} className="text-emerald-400 animate-in zoom-in" />
                    ) : (
                      <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>

                  {/* Copy overlay effect */}
                  <div className={cn(
                    "absolute inset-0 bg-blue-500/10 flex items-center justify-center backdrop-blur-[2px] transition-opacity pointer-events-none",
                    copiedId === worker.id ? "opacity-100" : "opacity-0"
                  )}>
                    <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest">Number Copied!</span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={DIALOG_STYLE} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-black">{editingWorker ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
            <DialogDescription style={{ color: DIM }}>Save worker phone numbers for quick access.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Full Name</label>
              <input
                type="text"
                placeholder="Enter name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                style={INPUT_STYLE}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Worker Type</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_STYLE}>
                {workerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Mobile Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-11 pl-10 pr-3 rounded-xl text-sm font-semibold outline-none"
                  style={INPUT_STYLE}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <button type="button" onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Cancel</button>
              <button type="submit" disabled={saving} className="px-6 py-2 rounded-xl text-sm font-black text-[#0a0c12] flex items-center gap-2" style={{ backgroundColor: GOLD }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Contact
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
