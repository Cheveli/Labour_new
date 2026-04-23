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
  Search, 
  TrendingUp, 
  Filter,
  Loader2,
  Trash2,
  Download
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

export default function IncomePage() {
  const [income, setIncome] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    project_id: '',
    amount: '',
    source: '',
    date: format(new Date(), 'yyyy-MM-dd')
  })
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: incomeData } = await supabase.from('income').select('*, projects(name)').order('date', { ascending: false })
    const { data: projectData } = await supabase.from('projects').select('*').order('name')
    
    setIncome(incomeData || [])
    setProjects(projectData || [])
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.from('income').insert([{
      ...formData,
      amount: parseFloat(formData.amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Income recorded')
      setIsAddDialogOpen(false)
      setFormData({ project_id: '', amount: '', source: '', date: format(new Date(), 'yyyy-MM-dd') })
      fetchData()
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this entry?')) {
      const { error } = await supabase.from('income').delete().eq('id', id)
      if (!error) fetchData()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Revenue & Income</h1>
          <p className="text-gray-500">Track all incoming payments from clients.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 rounded-xl shadow-lg shadow-emerald-100">
              <Plus className="mr-2 h-5 w-5" /> Add Income Entry
            </Button>
          } />
          <DialogContent className="rounded-3xl border-none shadow-2xl p-8 bg-white dark:bg-zinc-950">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-emerald-600">Register Revenue</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-5 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Select Project</label>
                <Select onValueChange={(v: string | null) => setFormData({...formData, project_id: v ?? ''})}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue placeholder="Chose site..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Amount (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="25000" 
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
                <label className="text-sm font-semibold">Source/Client</label>
                <Input 
                  placeholder="e.g. Client Payment, Milestone 1" 
                  value={formData.source}
                  onChange={e => setFormData({...formData, source: e.target.value})}
                  required
                  className="rounded-xl h-12"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl text-lg mt-4">
                {loading ? <Loader2 className="animate-spin" /> : 'Record Income'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SummaryCard 
          title="Total Income" 
          value={`₹${income.reduce((acc, i) => acc + Number(i.amount), 0).toLocaleString()}`} 
          icon={<TrendingUp className="text-emerald-500" />}
        />
        <div className="lg:col-span-2">
          <Card className="border-none shadow-xl bg-emerald-600/10 text-emerald-700 rounded-3xl h-full flex items-center p-8 gap-6 border-dashed border-2 border-emerald-200">
             <div className="p-4 bg-emerald-600 text-white rounded-2xl">
               <Download size={24} />
             </div>
             <div>
               <h4 className="font-extrabold text-xl">Monthly Reports</h4>
               <p className="text-emerald-600/80">Generate and download financial summaries.</p>
             </div>
             <Button variant="outline" className="ml-auto bg-white rounded-xl border-none shadow-sm hover:bg-emerald-50">Export PDF</Button>
          </Card>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50">
                <TableHead className="px-6 py-4">Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {income.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center text-gray-400">No income records found.</TableCell>
                </TableRow>
              ) : (
                income.map(item => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="px-6 py-4 font-medium">{format(new Date(item.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-bold">{item.projects?.name}</TableCell>
                    <TableCell className="text-gray-500">{item.source}</TableCell>
                    <TableCell className="font-black text-emerald-600 font-mono text-lg">₹{item.amount}</TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{title}</p>
          <div className="p-2 bg-gray-50 dark:bg-zinc-900 rounded-lg">{icon}</div>
        </div>
        <h3 className="text-3xl font-black text-gray-900 dark:text-white">{value}</h3>
      </CardContent>
    </Card>
  )
}
