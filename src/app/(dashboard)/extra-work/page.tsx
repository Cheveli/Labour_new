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
import { Zap, Plus, Search, Loader2, Calendar, Briefcase, History, Star, FileText, Download } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function ExtraWorkPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
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
    const { data: workData } = await supabase.from('extra_work').select('*, projects(name)').order('date', { ascending: false })
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setTasks(workData || [])
    setProjects(projData || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id || !formData.work_name || !formData.amount) {
      toast.error('All required fields are needed')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('extra_work').insert([{
      ...formData,
      amount: parseFloat(formData.amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Extra task recorded')
      setFormData({ project_id: '', work_name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      fetchData()
    }
    setSaving(false)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text('Extra Work Report', 14, 20)
    
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy')}`, 14, 28)

    const tableData = tasks.map((row, idx) => [
      idx + 1,
      row.date,
      row.projects?.name || 'N/A',
      row.work_name,
      `Rs. ${Number(row.amount).toLocaleString()}`,
      row.notes || '-'
    ])

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Date', 'Project', 'Work Description', 'Amount', 'Notes']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    })

    doc.save(`extra-work-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported successfully')
  }

  const exportExcel = () => {
    const worksheetData = [
      ['Extra Work Report'],
      [`Generated: ${format(new Date(), 'MMM dd, yyyy')}`],
      [],
      ['#', 'Date', 'Project', 'Work Description', 'Amount', 'Notes']
    ]

    tasks.forEach((row, idx) => {
      worksheetData.push([
        idx + 1,
        row.date,
        row.projects?.name || 'N/A',
        row.work_name,
        Number(row.amount),
        row.notes || '-'
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Extra Work Report')
    XLSX.writeFile(wb, `extra-work-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    toast.success('Excel exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Extra Tasks</h1>
          <p className="mt-1 text-sm text-zinc-500">Record lumpsum payments for extra works and ad-hoc tasks.</p>
        </div>
        <div className="flex items-center gap-3">
          {tasks.length > 0 && (
            <>
              <Button onClick={exportPDF} variant="outline" className="border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight px-6 gap-2">
                <FileText size={16} /> Export PDF
              </Button>
              <Button onClick={exportExcel} variant="outline" className="border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight px-6 gap-2">
                <Download size={16} /> Export Excel
              </Button>
            </>
          )}
          <Button className="btn-construction rounded-xl font-bold uppercase tracking-tight gap-2 px-8">
            <Star size={18} /> Add Extra Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Task History */}
        <div className="lg:col-span-8">
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Historical Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-zinc-900/80">
                  <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
                    <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Site/Project</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Task Name</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Remarks</TableHead>
                    <TableHead className="text-right px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Valuation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} className="animate-pulse border-zinc-800">
                        <TableCell colSpan={5} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                      </TableRow>
                    ))
                  ) : tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-4 text-zinc-600">
                            <Zap size={48} className="opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest">No extra task history</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((task) => (
                      <TableRow key={task.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                        <TableCell className="px-8 py-5 font-bold text-gray-400 text-xs">
                          {format(new Date(task.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="py-5 font-bold text-white text-sm lowercase">{task.projects?.name}</TableCell>
                        <TableCell className="py-5 font-black text-xs text-gray-300 uppercase tracking-tighter">{task.work_name}</TableCell>
                        <TableCell className="py-5 text-xs text-zinc-400 max-w-[220px] truncate">{task.notes || '—'}</TableCell>
                        <TableCell className="py-5 text-right px-8 font-black text-blue-400 text-sm">₹ {task.amount.toLocaleString()}</TableCell>
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
           <Card className="panel-elevated text-white rounded-2xl overflow-hidden p-8">
              <h3 className="text-lg font-black uppercase tracking-tight mb-8">Record workload</h3>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                  <Select onValueChange={(v: string | null) => setFormData({...formData, project_id: v ?? ''})} value={formData.project_id}>
                    <SelectTrigger className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Execution site" items={Object.fromEntries(projects.map(p => [p.id, p.name]))} />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl">
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold hover:bg-zinc-800">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Work Title / Description</label>
                  <Input 
                    placeholder="e.g. Wall Piling, Foundation etc." 
                    value={formData.work_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, work_name: e.target.value})}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Amount (₹)</label>
                  <Input 
                    placeholder="Lumpsum amount" 
                    type="number"
                    value={formData.amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, amount: e.target.value})}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Execution Date</label>
                  <Input 
                    type="date"
                    value={formData.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, date: e.target.value})}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Notes (optional)</label>
                  <Textarea 
                    placeholder="Specific details about the extra work" 
                    value={formData.notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4"
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full h-14 btn-construction rounded-xl font-black uppercase tracking-tight text-lg">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Record Task
                </Button>
              </form>
           </Card>
        </div>
      </div>
    </div>
  )
}
