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
import { Package, Truck, Boxes, Plus, Search, Loader2, Calendar, Briefcase, History, FileText, Download } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    quantity: '',
    unit: 'bags',
    cost_per_unit: '',
    total_amount: '',
    date: format(new Date(), 'yyyy-MM-dd')
  })
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: matData } = await supabase.from('materials').select('*, projects(name)').order('date', { ascending: false })
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setMaterials(matData || [])
    setProjects(projData || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id || !formData.name || !formData.total_amount) {
      toast.error('Required fields missing')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('materials').insert([{
      ...formData,
      quantity: parseFloat(formData.quantity) || 0,
      cost_per_unit: parseFloat(formData.cost_per_unit) || 0,
      total_amount: parseFloat(formData.total_amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Inventory recorded')
      setFormData({ project_id: '', name: '', quantity: '', unit: 'bags', cost_per_unit: '', total_amount: '', date: format(new Date(), 'yyyy-MM-dd') })
      fetchData()
    }
    setSaving(false)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text('Material Cost Report', 14, 20)
    
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy')}`, 14, 28)

    const tableData = materials.map((row, idx) => [
      idx + 1,
      row.date,
      row.projects?.name || 'N/A',
      row.name,
      row.quantity || '-',
      row.unit || '-',
      `Rs. ${Number(row.total_amount).toLocaleString()}`
    ])

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Date', 'Project', 'Material', 'Qty', 'Unit', 'Total Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    })

    doc.save(`materials-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    toast.success('PDF exported successfully')
  }

  const exportExcel = () => {
    const worksheetData = [
      ['Material Cost Report'],
      [`Generated: ${format(new Date(), 'MMM dd, yyyy')}`],
      [],
      ['#', 'Date', 'Project', 'Material', 'Qty', 'Unit', 'Total Amount']
    ]

    materials.forEach((row, idx) => {
      worksheetData.push([
        idx + 1,
        row.date,
        row.projects?.name || 'N/A',
        row.name,
        row.quantity || '-',
        row.unit || '-',
        Number(row.total_amount)
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Materials Report')
    XLSX.writeFile(wb, `materials-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    toast.success('Excel exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Inventory</h1>
          <p className="mt-2 text-zinc-500 font-medium">Record site deliveries, stock levels, and resource costs.</p>
        </div>
        <div className="flex items-center gap-3">
          {materials.length > 0 && (
            <>
              <Button onClick={exportPDF} variant="outline" className="border-zinc-800 bg-[#1F2937] text-gray-300 rounded-xl font-bold uppercase tracking-tight px-6 gap-2">
                <FileText size={16} /> Export PDF
              </Button>
              <Button onClick={exportExcel} variant="outline" className="border-zinc-800 bg-[#1F2937] text-gray-300 rounded-xl font-bold uppercase tracking-tight px-6 gap-2">
                <Download size={16} /> Export Excel
              </Button>
            </>
          )}
          <Button className="bg-[#B45309] hover:bg-[#92400E] text-white rounded-xl font-bold uppercase tracking-tight gap-2 px-8 shadow-lg shadow-amber-500/20">
            <Truck size={18} /> Add Stock
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Material List */}
        <div className="lg:col-span-8">
          <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Inventory History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-[#0F172A]">
                  <TableRow className="border-zinc-800 hover:bg-[#0F172A]">
                    <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Project</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Material</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Qty</TableHead>
                    <TableHead className="text-right px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Total Val</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} className="animate-pulse border-zinc-800">
                        <TableCell colSpan={5} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                      </TableRow>
                    ))
                  ) : materials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-4 text-zinc-600">
                            <Boxes size={48} className="opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest">No material history found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    materials.map((item) => (
                      <TableRow key={item.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                        <TableCell className="px-8 py-5 font-bold text-gray-400 text-xs">
                          {format(new Date(item.date), 'M/d/yyyy')}
                        </TableCell>
                        <TableCell className="py-5 font-bold text-white text-sm lowercase">{item.projects?.name}</TableCell>
                        <TableCell className="py-5 font-black text-gray-200 text-xs tracking-tight uppercase">{item.name}</TableCell>
                        <TableCell className="py-5 font-bold text-zinc-500 text-xs">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="py-5 text-right px-8 font-black text-white text-sm">₹ {item.total_amount?.toLocaleString() || item.total_cost?.toLocaleString()}</TableCell>
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
              <h3 className="text-lg font-black uppercase tracking-tight mb-8">Stock Entry</h3>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                  <Select onValueChange={(v: string | null) => setFormData({...formData, project_id: v ?? ''})} value={formData.project_id}>
                    <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Delivery location" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold hover:bg-zinc-800">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Material Name</label>
                  <Input 
                    placeholder="e.g. Cement, Sand, Steel" 
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, name: e.target.value})}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Qty (optional)</label>
                    <Input 
                      placeholder="0.00" 
                      type="number"
                      value={formData.quantity}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, quantity: e.target.value})}
                      className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Unit</label>
                    <Select onValueChange={(v: string | null) => setFormData({...formData, unit: v ?? 'bags'})} value={formData.unit}>
                      <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                        <SelectItem value="bags" className="py-3 font-bold">Bags</SelectItem>
                        <SelectItem value="brass" className="py-3 font-bold">Brass</SelectItem>
                        <SelectItem value="units" className="py-3 font-bold">Units</SelectItem>
                        <SelectItem value="kgs" className="py-3 font-bold">KGs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Cost Per Unit (₹) (optional)</label>
                  <Input 
                    placeholder="0.00" 
                    type="number"
                    value={formData.cost_per_unit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, cost_per_unit: e.target.value})}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Amount (₹) *</label>
                  <Input 
                    placeholder="Enter total amount" 
                    type="number"
                    value={formData.total_amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, total_amount: e.target.value})}
                    required
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                  />
                  <p className="text-[9px] font-medium text-zinc-500 italic mt-1 leading-tight">Enter the total amount directly (not auto-calculated).</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Delivery Date</label>
                  <Input 
                    type="date"
                    value={formData.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, date: e.target.value})}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full h-14 bg-[#B45309] hover:bg-[#92400E] text-white rounded-xl font-black uppercase tracking-tight text-lg shadow-xl shadow-amber-500/20">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Record Delivery
                </Button>
              </form>
           </Card>
        </div>
      </div>
    </div>
  )
}
