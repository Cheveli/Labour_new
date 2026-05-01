'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Plus, Search, TrendingUp, Calendar, Briefcase, Loader2, DollarSign, History, FileText, Download } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function IncomePage() {
  const [income, setIncome] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [incomePage, setIncomePage] = useState(0)
  
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

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Revenue Report', 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy')}`, 14, 28)

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Date', 'Project', 'Amount', 'Remarks']],
      body: income.map((item, idx) => [
        idx + 1,
        format(new Date(item.date), 'dd/MM/yyyy'),
        item.projects?.name || 'N/A',
        `₹ ${Number(item.amount).toLocaleString()}`,
        item.notes || '—'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 4: { cellWidth: 55 } }
    })

    doc.save(`Revenue_Report_${format(new Date(), 'dd-MMM-yyyy')}.pdf`)
    toast.success('PDF exported successfully')
  }

  const exportExcel = () => {
    const worksheetData: (string | number)[][] = [
      ['Revenue Report'],
      [`Generated: ${format(new Date(), 'MMM dd, yyyy')}`],
      [],
      ['#', 'Date', 'Project', 'Amount', 'Remarks']
    ]

    income.forEach((item, idx) => {
      worksheetData.push([
        idx + 1,
        format(new Date(item.date), 'dd/MM/yyyy'),
        item.projects?.name || 'N/A',
        Number(item.amount),
        item.notes || '—'
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue Report')
    XLSX.writeFile(wb, `revenue-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    toast.success('Excel exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Revenue</h1>
          <p className="mt-1 text-sm text-zinc-500">Record site-wide collections and progress payments.</p>
        </div>
        <div className="flex items-center gap-3">
          {income.length > 0 && (
            <>
              <Button onClick={exportPDF} variant="outline" className="border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight px-6 gap-2">
                <FileText size={16} /> Export PDF
              </Button>
              <Button onClick={exportExcel} variant="outline" className="border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight px-6 gap-2">
                <Download size={16} /> Export Excel
              </Button>
            </>
          )}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Total Revenue</span>
            <span className="text-xl font-black" style={{ color: '#22c55e' }}>₹{income.reduce((s, i) => s + Number(i.amount), 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: History */}
        <div className="lg:col-span-8">
          <Card className="panel-elevated text-white overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-slate-800">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Collection Ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-zinc-900/80">
                    <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
                      <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Project</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Remarks</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400 text-right">Amount Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-zinc-800">
                          <TableCell colSpan={4} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                        </TableRow>
                      ))
                    ) : income.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                              <History size={48} className="opacity-10" />
                              <p className="text-sm font-bold uppercase tracking-widest">No income record history</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      income.slice(incomePage * 10, incomePage * 10 + 10).map((item) => (
                        <TableRow key={item.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                          <TableCell className="px-8 py-5 font-bold text-gray-400 text-xs">
                            {format(new Date(item.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="py-5 font-bold text-white text-sm lowercase">{item.projects?.name}</TableCell>
                          <TableCell className="py-5 text-xs text-zinc-400 max-w-[220px] truncate">{item.notes || '—'}</TableCell>
                          <TableCell className="py-5 text-right px-8 font-black text-blue-400 text-lg">₹ {item.amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {income.length > 10 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800">
                  <button disabled={incomePage === 0} onClick={() => setIncomePage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>Page {incomePage + 1} / {Math.ceil(income.length / 10)}</span>
                  <button disabled={(incomePage + 1) * 10 >= income.length} onClick={() => setIncomePage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
                </div>
              )}

              {/* Mobile Cards */}
              <div className="flex flex-col gap-3 p-4 md:hidden bg-[#05070B]">
                {loading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="h-24 animate-pulse bg-zinc-900 rounded-xl" />)
                ) : income.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 text-zinc-600 py-10">
                    <History size={48} className="opacity-10" />
                    <p className="text-sm font-bold uppercase tracking-widest">No income record history</p>
                  </div>
                ) : (
                  income.slice(incomePage * 10, incomePage * 10 + 10).map((item) => (
                    <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-sm">{item.projects?.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-1">{format(new Date(item.date), 'MMM dd, yyyy')}</p>
                        </div>
                        <p className="font-black text-blue-400 text-lg">₹ {item.amount.toLocaleString()}</p>
                      </div>
                      {item.notes && <p className="text-xs text-zinc-400">{item.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Add Form */}
        <div className="lg:col-span-4">
           <Card className="panel-elevated text-white overflow-hidden p-8">
              <h3 className="text-lg font-black uppercase tracking-tight mb-8">Record collection</h3>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                  <select value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})}
                    className="w-full h-12 px-3 rounded-xl text-sm font-semibold outline-none" style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }}>
                    <option value="">Choose site</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Amount Received (₹)</label>
                  <Input 
                    placeholder="Enter amount" 
                    type="number"
                    value={formData.amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, amount: e.target.value})}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Confirmed collection</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Collection Date</label>
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
                    placeholder="Reference, receipt no etc." 
                    value={formData.notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4"
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full h-14 btn-construction rounded-xl font-black uppercase tracking-tight text-lg">
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
