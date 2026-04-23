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
import { Plus, Search, TrendingUp, Calendar, Briefcase, Loader2, DollarSign, History } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function IncomePage() {
  const [income, setIncome] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    project_id: '',
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
    const { data: incData } = await supabase.from('income').select('*, projects(name)').order('date', { ascending: false })
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setIncome(incData || [])
    setProjects(projData || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id || !formData.amount) {
      toast.error('Project and Amount are required')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('income').insert([{
      ...formData,
      amount: parseFloat(formData.amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Income recorded')
      setFormData({ project_id: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      fetchData()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Revenue</h1>
          <p className="mt-2 text-zinc-500 font-medium">Record site-wide collections and progress payments.</p>
        </div>
        <Button className="bg-[#059669] hover:bg-[#047857] text-white rounded-xl font-bold uppercase tracking-tight gap-2 px-8 shadow-lg shadow-emerald-500/20">
          <TrendingUp size={18} /> New Collection
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: History */}
        <div className="lg:col-span-8">
          <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Collection Ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-[#0F172A]">
                  <TableRow className="border-zinc-800 hover:bg-[#0F172A]">
                    <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Project</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400 text-right">Amount Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} className="animate-pulse border-zinc-800">
                        <TableCell colSpan={3} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                      </TableRow>
                    ))
                  ) : income.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-4 text-zinc-600">
                            <History size={48} className="opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest">No income record history</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    income.map((item) => (
                      <TableRow key={item.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                        <TableCell className="px-8 py-5 font-bold text-gray-400 text-xs">
                          {format(new Date(item.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="py-5 font-bold text-white text-sm lowercase">{item.projects?.name}</TableCell>
                        <TableCell className="py-5 text-right px-8 font-black text-[#059669] text-lg">₹ {item.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Add Form */}
        <div className="lg:col-span-4">
           <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden p-8">
              <h3 className="text-lg font-black uppercase tracking-tight mb-8">Record collection</h3>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                  <Select onValueChange={(v: string | null) => setFormData({...formData, project_id: v ?? ''})} value={formData.project_id}>
                    <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Chose site" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold hover:bg-zinc-800">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Amount Received (₹)</label>
                  <Input 
                    placeholder="Enter amount" 
                    type="number"
                    value={formData.amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, amount: e.target.value})}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                  />
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Confirmed collection</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Collection Date</label>
                  <Input 
                    type="date"
                    value={formData.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, date: e.target.value})}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Notes (optional)</label>
                  <Textarea 
                    placeholder="Reference, receipt no etc." 
                    value={formData.notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
                    className="bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white p-4"
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full h-14 bg-[#059669] hover:bg-[#047857] text-white rounded-xl font-black uppercase tracking-tight text-lg shadow-xl shadow-emerald-500/20">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Record Entry
                </Button>
              </form>
           </Card>
        </div>
      </div>
    </div>
  )
}
