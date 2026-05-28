'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { UserPlus, Loader2, FileText, Download, Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const WORK_NATURES = [
  'Painter',
  'Carpenter',
  'Aluminium Work',
  'Electrician',
  'Granite Installation',
  'Tiles Work',
  'Plumbing',
  'Masonry',
  'Welding',
  'Other'
]

export default function ContractorPaymentsPage() {
  const [contractors, setContractors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    work_nature: '',
    custom_work: '',
    site_project: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  })

  const [installments, setInstallments] = useState<any[]>([])
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentDate, setInstallmentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedContractor, setSelectedContractor] = useState<any>(null)
  const [viewContractor, setViewContractor] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchContractors()
  }, [])

  async function fetchContractors() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contractor_payments')
      .select('*')
      .order('date', { ascending: false })
    
    if (error) {
      toast.error('Failed to fetch contractors')
    } else {
      setContractors(data || [])
    }
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.mobile || !formData.amount) {
      toast.error('All required fields are needed')
      return
    }
    
    if (!formData.work_nature) {
      toast.error('Please select work nature')
      return
    }
    
    if (formData.work_nature === 'Other' && !formData.custom_work) {
      toast.error('Please enter custom work type')
      return
    }

    setSaving(true)
    const workNature = formData.work_nature === 'Other' ? formData.custom_work : formData.work_nature

    const { error } = await supabase.from('contractor_payments').insert([{
      name: formData.name,
      mobile: formData.mobile,
      work_nature: workNature,
      total_amount: parseFloat(formData.amount),
      date: formData.date,
      notes: formData.notes,
      installments: [{
        amount: parseFloat(formData.amount),
        date: formData.date,
        receipt_number: 1,
        site_project: formData.site_project
      }],
      total_paid: parseFloat(formData.amount),
      current_receipt: 1
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Contractor payment recorded')
      setFormData({ name: '', mobile: '', work_nature: '', custom_work: '', site_project: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      setShowAddModal(false)
      fetchContractors()
    }
    setSaving(false)
  }

  const handleAddInstallment = async () => {
    if (!selectedContractor || !installmentAmount) {
      toast.error('Please select contractor and enter amount')
      return
    }

    const newInstallment = {
      amount: parseFloat(installmentAmount),
      date: installmentDate,
      receipt_number: selectedContractor.current_receipt + 1
    }

    const updatedInstallments = [...selectedContractor.installments, newInstallment]
    const totalPaid = updatedInstallments.reduce((sum: number, inst: any) => sum + inst.amount, 0)

    const { error } = await supabase.from('contractor_payments')
      .update({
        installments: updatedInstallments,
        total_paid: totalPaid,
        current_receipt: selectedContractor.current_receipt + 1
      })
      .eq('id', selectedContractor.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Installment added')
      setInstallmentAmount('')
      setSelectedContractor(null)
      fetchContractors()
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('contractor_payments').delete().eq('id', deleteId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Deleted successfully')
      setDeleteId(null)
      fetchContractors()
    }
  }

  const exportPDF = (contractor: any) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 160]
    })
    
    const W = 80
    const H = 160
    
    // =====================================================
    // HEADER SECTION
    // =====================================================
    
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, W, H, 'F')
    doc.setFillColor(13, 27, 62)
    doc.rect(0, 0, W, 27, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('SRI SAI CONSTRUCTIONS', 40, 7, { align: 'center' })
    
    // Divider lines
    doc.setFontSize(4.5)
    doc.setFont('helvetica', 'normal')
    doc.text('BUILDING YOUR VISION', 40, 12, { align: 'center' })
    doc.text('Boduppal, Hyderabad', 40, 17, { align: 'center' })
    doc.text('Contractor: Cheveli Somaiah  |  Ph: 9849678296 / 9550017985', 40, 22, { align: 'center' })
    
    // =====================================================
    // PAYMENT RECEIPT TITLE
    // =====================================================
    
    const titleY = 31
    doc.setFillColor(13, 27, 62)
    doc.roundedRect(15, titleY, 50, 8, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYMENT RECEIPT', 40, titleY + 5, { align: 'center' })
    
    // =====================================================
    // RECEIPT INFO SECTION
    // =====================================================
    
    const infoY = titleY + 14
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'normal')
    doc.text(`Receipt No. : REC-${contractor.id.slice(0, 6).toUpperCase()}`, 10, infoY)
    doc.text(`Date : ${format(new Date(contractor.date), 'dd MMM yyyy')}`, 75, infoY, { align: 'right' })
    
    // Dotted divider
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(5, infoY + 4, 75, infoY + 4)
    
    // =====================================================
    // WORKER / SUB-CONTRACTOR DETAILS SECTION
    // =====================================================
    
    const detailsY = infoY + 7
    doc.setFillColor(13, 27, 62)
    doc.rect(5, detailsY, 70, 5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.text('WORKER / SUB-CONTRACTOR DETAILS', 40, detailsY + 3.5, { align: 'center' })
    
    // Details table
    const tableY = detailsY + 5
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.1)
    
    const details = [
      ['Name', contractor.name],
      ['Work Type', contractor.work_nature],
      ['Contact No.', contractor.mobile],
      ['Site / Project', contractor.installments?.[0]?.site_project || formData.site_project || '-'],
      ['Agreement / Ref No.', contractor.id.slice(0, 8).toUpperCase()]
    ]
    
    let currentY = tableY
    details.forEach((row, idx) => {
      // Row background
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 255)
        doc.rect(5, currentY, 70, 5, 'F')
      }
      
      // Row border
      doc.rect(5, currentY, 70, 5, 'S')
      
      doc.setTextColor(13, 27, 62)
      doc.setFontSize(4.5)
      doc.setFont('helvetica', 'bold')
      doc.text(`${row[0]}               :`, 8, currentY + 3.2)
      
      doc.setTextColor(60, 60, 60)
      doc.setFont('helvetica', 'normal')
      doc.text(row[1], 35, currentY + 3.2)
      
      currentY += 5
    })
    
    // =====================================================
    // INSTALLMENT PAYMENT HISTORY SECTION
    // =====================================================
    
    const historyY = currentY + 5
    doc.setFillColor(13, 27, 62)
    doc.rect(5, historyY, 70, 5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.text('INSTALLMENT PAYMENT HISTORY', 40, historyY + 3.5, { align: 'center' })
    
    // Table header
    const headerY = historyY + 5
    doc.setFillColor(248, 250, 255)
    doc.rect(5, headerY, 70, 4.5, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.rect(5, headerY, 70, 4.5, 'S')
    
    doc.setTextColor(13, 27, 62)
    doc.setFontSize(3.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Installment No.', 7, headerY + 3)
    doc.text('Date', 28, headerY + 3)
    doc.text('Amount', 48, headerY + 3)
    doc.text('Status', 63, headerY + 3)
    
    // Table rows
    let rowY = headerY + 4.5
    let totalPaid = 0
    
    contractor.installments.forEach((inst: any, idx: number) => {
      totalPaid += inst.amount
      // Row background
      if (idx % 2 === 0) {
        doc.setFillColor(255, 255, 255)
      } else {
        doc.setFillColor(248, 250, 255)
      }
      doc.rect(5, rowY, 70, 4, 'F')
      
      // Row border
      doc.setDrawColor(220, 220, 220)
      doc.rect(5, rowY, 70, 4, 'S')
      
      doc.setTextColor(60, 60, 60)
      doc.setFontSize(3.5)
      doc.setFont('helvetica', 'normal')
      doc.text(String(inst.receipt_number), 7, rowY + 2.8)
      doc.text(format(new Date(inst.date), 'dd MMM yyyy'), 28, rowY + 2.8)
      doc.text(inst.amount.toLocaleString(), 48, rowY + 2.8)
      doc.text(idx === contractor.installments.length - 1 ? 'Current' : 'Paid', 63, rowY + 2.8)
      
      rowY += 4
    })
    
    // =====================================================
    // TOTAL SUMMARY SECTION
    // =====================================================
    
    const summaryY = rowY + 4
    doc.setTextColor(13, 27, 62)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL PAID', 10, summaryY)
    doc.text(`${totalPaid.toLocaleString()}`, 75, summaryY, { align: 'right' })
    
    // =====================================================
    // FOOTER SECTION
    // =====================================================
    
    const footerY = summaryY + 8
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(5, footerY, 75, footerY)
    
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(4)
    doc.setFont('helvetica', 'normal')
    doc.text('-- COMPUTER GENERATED RECEIPT --', 40, footerY + 5, { align: 'center' })
    
    // Footer strip
    doc.setFillColor(13, 27, 62)
    doc.rect(0, H - 10, W, 10, 'F')
    
    doc.setTextColor(180, 200, 240)
    doc.setFontSize(3.5)
    doc.text('Tel: 9849678296 / 9550017985  |  Boduppal, Hyderabad', 40, H - 5, { align: 'center' })
    
    doc.save(`Receipt_${contractor.name}_${contractor.current_receipt}.pdf`)
    toast.success('Receipt generated')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Contractor Payments</h1>
          <p className="mt-1 text-sm text-zinc-500">Track contractor payments in installments (separate from revenue).</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', mobile: '', work_nature: '', custom_work: '', site_project: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase text-[#0a0c12] transition-all cursor-pointer bg-blue-500 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] self-start sm:self-auto"
        >
          <Plus size={16} /> Add Contractor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Contractor List - Full Width */}
        <div className="lg:col-span-12">
          <Card className="panel-elevated text-white overflow-hidden min-h-full border-[#1e2435] bg-[#0d1018]">
            <CardHeader className="p-8 border-b border-[#1e2435]">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-black/20">
                    <TableRow className="border-[#1e2435] hover:bg-transparent">
                      <TableHead className="px-4 py-4 uppercase text-[10px] font-black tracking-widest text-zinc-500">Date</TableHead>
                      <TableHead className="py-4 uppercase text-[10px] font-black tracking-widest text-zinc-500">Name</TableHead>
                      <TableHead className="py-4 uppercase text-[10px] font-black tracking-widest text-zinc-500">Work</TableHead>
                      <TableHead className="py-4 uppercase text-[10px] font-black tracking-widest text-zinc-500">Mobile</TableHead>
                      <TableHead className="py-4 uppercase text-[10px] font-black tracking-widest text-zinc-500 text-right">Last Payment</TableHead>
                      <TableHead className="py-4 uppercase text-[10px] font-black tracking-widest text-zinc-500 text-right">Total Paid</TableHead>
                      <TableHead className="py-4 uppercase text-[10px] font-black tracking-widest text-zinc-500 text-right">Receipts</TableHead>
                      <TableHead className="py-4 px-4 w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-[#1e2435]">
                          <TableCell colSpan={8} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                        </TableRow>
                      ))
                    ) : contractors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                            <UserPlus size={48} className="opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest">No contractor payments recorded</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      contractors.slice(page * 10, page * 10 + 10).map((contractor) => (
                        <TableRow key={contractor.id} className="border-[#1e2435] transition-colors hover:bg-white/5">
                          <TableCell className="px-4 py-3.5 font-bold text-zinc-400 text-xs">
                            {format(new Date(contractor.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="py-3.5 font-bold text-white text-sm">{contractor.name}</TableCell>
                          <TableCell className="py-3.5 text-xs text-zinc-400 max-w-[150px] truncate">{contractor.work_nature}</TableCell>
                          <TableCell className="py-3.5 text-xs text-zinc-400">{contractor.mobile}</TableCell>
                          <TableCell className="py-3.5 text-right font-black text-white text-lg">
                            ₹{(contractor.installments?.[contractor.installments.length - 1]?.amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="py-3.5 text-right font-black text-blue-400 text-lg">₹{contractor.total_paid.toLocaleString()}</TableCell>
                          <TableCell className="py-3.5 text-right font-bold text-amber-400 text-xs">
                            <button
                              onClick={() => setViewContractor(contractor)}
                              className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-bold text-xs border border-amber-500/20 transition-all cursor-pointer"
                              title="Click to view installments"
                            >
                              {contractor.installments?.length || 0} Receipts
                            </button>
                          </TableCell>
                          <TableCell className="py-3.5 px-4 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => setSelectedContractor(contractor)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 transition-colors" title="Add Installment"><Plus size={13} /></button>
                              <button onClick={() => exportPDF(contractor)} className="p-1.5 rounded-lg hover:bg-green-500/10 text-zinc-500 hover:text-green-400 transition-colors" title="Download PDF"><Download size={13} /></button>
                              <button onClick={() => handleDelete(contractor.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={13} /></button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col gap-3 p-4 bg-[#05070B]">
                {loading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="h-24 animate-pulse bg-zinc-900 rounded-xl" />)
                ) : contractors.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 text-zinc-600 py-10">
                    <UserPlus size={48} className="opacity-10" />
                    <p className="text-sm font-bold uppercase tracking-widest">No contractor payments recorded</p>
                  </div>
                ) : (
                  contractors.slice(page * 10, page * 10 + 10).map((contractor) => (
                    <div key={contractor.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{contractor.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{contractor.work_nature}</p>
                          <p className="text-[10px] font-bold text-zinc-400 mt-1">{format(new Date(contractor.date), 'MMM dd, yyyy')} · {contractor.mobile}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-blue-400 text-base">₹{contractor.total_paid.toLocaleString()}</p>
                          <p className="text-[9px] text-zinc-500 mt-0.5">Total Paid</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                        <button
                          onClick={() => setViewContractor(contractor)}
                          className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-bold text-xs border border-amber-500/20 transition-all cursor-pointer"
                        >
                          {contractor.installments?.length || 0} Receipts
                        </button>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedContractor(contractor)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 transition-colors" title="Add Installment"><Plus size={13} /></button>
                          <button onClick={() => exportPDF(contractor)} className="p-1.5 rounded-lg hover:bg-green-500/10 text-zinc-500 hover:text-green-400 transition-colors" title="PDF"><Download size={13} /></button>
                          <button onClick={() => handleDelete(contractor.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Desktop Pagination */}
              {contractors.length > 10 && (
                <div className="hidden md:flex items-center justify-between px-6 py-4 border-t border-[#1e2435]">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 bg-zinc-900 text-gray-300">← Prev</button>
                  <span className="text-xs text-zinc-500">Page {page + 1} / {Math.ceil(contractors.length / 10)}</span>
                  <button disabled={(page + 1) * 10 >= contractors.length} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 bg-zinc-900 text-gray-300">Next →</button>
                </div>
              )}
              {/* Mobile Pagination */}
              {contractors.length > 10 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e2435] md:hidden">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 bg-zinc-900 text-gray-300">← Prev</button>
                  <span className="text-xs text-zinc-500">{page + 1} / {Math.ceil(contractors.length / 10)}</span>
                  <button disabled={(page + 1) * 10 >= contractors.length} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 bg-zinc-900 text-gray-300">Next →</button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Contractor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowAddModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">Add Contractor Payment</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Name</label>
                <Input 
                  placeholder="Contractor name" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mobile Number</label>
                <Input 
                  placeholder="9876543210" 
                  value={formData.mobile}
                  onChange={e => setFormData({...formData, mobile: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Work Nature</label>
                <select 
                  value={formData.work_nature}
                  onChange={e => setFormData({...formData, work_nature: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl font-bold bg-zinc-900 border-zinc-800 text-white outline-none"
                >
                  <option value="">Select work</option>
                  {WORK_NATURES.map(work => <option key={work} value={work}>{work}</option>)}
                </select>
              </div>

              {formData.work_nature === 'Other' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Custom Work</label>
                  <Input 
                    placeholder="Enter work type" 
                    value={formData.custom_work}
                    onChange={e => setFormData({...formData, custom_work: e.target.value})}
                    className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Site / Project (optional)</label>
                <Input 
                  placeholder="e.g. Sai Residency, Boduppal" 
                  value={formData.site_project}
                  onChange={e => setFormData({...formData, site_project: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">First Installment Amount</label>
                <Input 
                  type="number" 
                  placeholder="Enter installment amount" 
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</label>
                <Input 
                  type="date"
                  value={formData.date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, date: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Notes (optional)</label>
                <Textarea 
                  placeholder="Additional details..." 
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 h-12 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-[#6b7280] border border-[#1e2435]">Cancel</button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Add Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Installment Dialog Modal */}
      <Dialog open={!!selectedContractor} onOpenChange={(open) => !open && setSelectedContractor(null)}>
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-black text-lg">ADD INSTALLMENT PAYMENT</DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>
              Record a new installment payment for <strong>{selectedContractor?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-xl bg-black/30 border border-[#1e2435] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-widest font-bold">Role/Work:</span>
                <span className="text-white font-bold">{selectedContractor?.work_nature}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase tracking-widest font-bold">Last Payment:</span>
                <span className="text-white font-bold">
                  ₹{(selectedContractor?.installments?.[selectedContractor.installments.length - 1]?.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#1e2435] pt-1.5 mt-1.5">
                <span className="text-zinc-500 uppercase tracking-widest font-bold">Total Paid Till Now:</span>
                <span className="text-blue-400 font-black text-sm">₹{selectedContractor?.total_paid.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Installment Amount (₹)</label>
              <Input 
                type="number" 
                placeholder="Enter amount" 
                value={installmentAmount}
                onChange={e => setInstallmentAmount(e.target.value)}
                className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Date</label>
              <Input 
                type="date"
                value={installmentDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstallmentDate(e.target.value)}
                className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-3 mt-4">
            <button 
              type="button" 
              onClick={() => setSelectedContractor(null)} 
              className="h-11 px-6 rounded-xl font-bold text-sm bg-[#1a1f2e] hover:bg-[#252b3d] border border-[#1e2435] text-zinc-300 transition-all cursor-pointer flex items-center justify-center min-w-[100px]"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleAddInstallment} 
              className="h-11 px-6 rounded-xl font-black uppercase tracking-widest text-xs text-[#0a0c12] hover:shadow-lg hover:shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center min-w-[140px]"
              style={{ backgroundColor: '#f39c12' }}
            >
              Add Installment
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Installments Details Dialog */}
      <Dialog open={!!viewContractor} onOpenChange={(open) => !open && setViewContractor(null)}>
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-black text-lg">CONTRACTOR PROFILE & PAYMENTS</DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>Summary of all installment transactions</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Header info */}
            <div className="p-5 rounded-2xl bg-black/40 border border-[#1e2435] space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-black text-white">{viewContractor?.name}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{viewContractor?.work_nature}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Contact Number</p>
                  <p className="text-sm font-bold text-zinc-300">{viewContractor?.mobile || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2435] text-center">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Last Payment</p>
                  <p className="text-sm font-black text-white">
                    ₹{(viewContractor?.installments?.[viewContractor.installments.length - 1]?.amount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Paid Till Now</p>
                  <p className="text-sm font-black text-blue-400">₹{viewContractor?.total_paid.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Installment History list */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Installments Paid ({viewContractor?.installments?.length || 0} terms)</p>
              <div className="max-h-[200px] overflow-y-auto divide-y divide-[#1e2435] border border-[#1e2435] rounded-xl bg-black/20">
                {viewContractor?.installments?.map((inst: any, idx: number) => (
                  <div key={idx} className="p-3 flex justify-between items-center hover:bg-white/[0.02] transition-all">
                    <div>
                      <p className="text-xs font-bold text-white">Installment #{inst.receipt_number || (idx + 1)}</p>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">{inst.date ? format(new Date(inst.date), 'dd MMM yyyy') : 'N/A'} {inst.site_project ? `· ${inst.site_project}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-400">₹{inst.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setViewContractor(null)} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs h-11">
              Close Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog Modal */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-black text-lg">DELETE CONTRACTOR PAYMENT</DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>
              Are you absolutely sure you want to delete this payment record? This action cannot be undone, and the paid amount will be added back into your Net Cash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-3 mt-6">
            <button 
              type="button" 
              onClick={() => setDeleteId(null)} 
              className="h-11 px-6 rounded-xl font-bold text-sm bg-[#1a1f2e] hover:bg-[#252b3d] border border-[#1e2435] text-zinc-300 transition-all cursor-pointer flex items-center justify-center min-w-[100px]"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={confirmDelete} 
              className="h-11 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer flex items-center justify-center min-w-[150px]"
            >
              Yes, Delete Record
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
