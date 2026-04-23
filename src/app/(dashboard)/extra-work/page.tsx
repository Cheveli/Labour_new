'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Plus, 
  Zap, 
  Construction,
  Loader2,
  Trash2,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function ExtraWorkPage() {
  const [extraWork, setExtraWork] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    project_id: '',
    work_name: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  })
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: ewData } = await supabase.from('extra_work').select('*, projects(name)').order('date', { ascending: false })
    const { data: projectData } = await supabase.from('projects').select('*').order('name')
    
    setExtraWork(ewData || [])
    setProjects(projectData || [])
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.from('extra_work').insert([{
      ...formData,
      amount: parseFloat(formData.amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Extra work recorded')
      setIsAddDialogOpen(false)
      setFormData({ project_id: '', work_name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      fetchData()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Extra Work & Lumpsum</h1>
          <p className="text-gray-500">Track specialized tasks like Centering, Slab, etc.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-purple-600 hover:bg-purple-700 h-11 px-6 rounded-xl shadow-lg shadow-purple-100">
              <Plus className="mr-2 h-5 w-5" /> Record Extra Work
            </Button>
          } />
          <DialogContent className="rounded-xl border-none shadow-2xl p-8 bg-white dark:bg-zinc-950">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-purple-600 flex items-center gap-2">
                <Zap size={24} /> Lumpsum Task
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-5 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Select Project</label>
                <Select onValueChange={(v: string | null) => setFormData({...formData, project_id: v ?? ''})}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue placeholder="Project site" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Work Name / Task</label>
                <Input 
                  placeholder="e.g. Roof Slab Casting, Plumbing Lumpsum" 
                  value={formData.work_name}
                  onChange={e => setFormData({...formData, work_name: e.target.value})}
                  required
                  className="rounded-xl h-12"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Amount (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="15000" 
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Date</label>
                  <Input 
                    type="date" 
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="rounded-xl h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Notes (Optional)</label>
                <Input 
                  placeholder="Any specific details..." 
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="rounded-xl h-12"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 h-12 rounded-xl text-lg mt-4">
                {loading ? <Loader2 className="animate-spin" /> : 'Record Task'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SummaryCard 
          title="Total Lumpsum" 
          value={`₹${extraWork.reduce((acc, ew) => acc + Number(ew.amount), 0).toLocaleString()}`} 
          icon={<Construction className="text-purple-500" />}
        />
        <SummaryCard 
          title="Tasks Completed" 
          value={extraWork.length.toString()} 
          icon={<Zap className="text-yellow-500" />}
        />
      </div>

      <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50">
                <TableHead className="px-6 py-4">Work Name</TableHead>
                <TableHead>Project Site</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right px-6">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extraWork.map(ew => (
                <TableRow key={ew.id} className="group">
                  <TableCell className="px-6 py-4 font-bold text-gray-900 dark:text-zinc-100">{ew.work_name}</TableCell>
                  <TableCell className="font-medium text-blue-600">{ew.projects?.name}</TableCell>
                  <TableCell className="text-xs text-gray-500">{format(new Date(ew.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className="font-black text-purple-600 text-lg">₹{ew.amount?.toLocaleString()}</TableCell>
                  <TableCell className="text-right px-6 text-gray-400 text-xs italic">{ew.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, icon }: any) {
  return (
    <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
          <div className="p-2 bg-gray-50 dark:bg-zinc-900 rounded-lg">{icon}</div>
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{value}</h3>
      </CardContent>
    </Card>
  )
}
