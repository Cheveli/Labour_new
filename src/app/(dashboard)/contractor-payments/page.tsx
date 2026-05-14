'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { UserPlus, Loader2, FileText, Download, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'

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
    if (!confirm('Delete this contractor payment?')) return
    const { error } = await supabase.from('contractor_payments').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); fetchContractors() }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Contractor Payments</h1>
          <p className="mt-1 text-sm text-zinc-500">Track contractor payments in installments (separate from revenue).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Contractor List */}
        <div className="lg:col-span-8">
          <Card className="panel-elevated text-white overflow-hidden min-h-full border-[#1e2435] bg-[#0d1018]">
            <CardHeader className="p-8 border-b border-[#1e2435]">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-black/20">
                    <TableRow className="border-[#1e2435] hover:bg-transparent">
                      <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500">Date</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500">Name</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500">Work</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500">Mobile</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500 text-right">Total</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500 text-right">Paid</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500 text-right">Receipts</TableHead>
                      <TableHead className="py-6 px-8 w-16"></TableHead>
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
                          <TableCell className="px-8 py-5 font-bold text-zinc-400 text-xs">
                            {format(new Date(contractor.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="py-5 font-bold text-white text-sm">{contractor.name}</TableCell>
                          <TableCell className="py-5 text-xs text-zinc-400 max-w-[150px] truncate">{contractor.work_nature}</TableCell>
                          <TableCell className="py-5 text-xs text-zinc-400">{contractor.mobile}</TableCell>
                          <TableCell className="py-5 text-right font-black text-white text-lg">₹{contractor.total_amount.toLocaleString()}</TableCell>
                          <TableCell className="py-5 text-right font-black text-blue-400 text-lg">₹{contractor.total_paid.toLocaleString()}</TableCell>
                          <TableCell className="py-5 text-right font-bold text-amber-400 text-xs">{contractor.installments?.length || 0}</TableCell>
                          <TableCell className="py-5 px-8 text-right">
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
              
              {contractors.length > 10 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2435]">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 bg-zinc-900 text-gray-300">← Prev</button>
                  <span className="text-xs text-zinc-500">Page {page + 1} / {Math.ceil(contractors.length / 10)}</span>
                  <button disabled={(page + 1) * 10 >= contractors.length} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 bg-zinc-900 text-gray-300">Next →</button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Add Form */}
        <div className="lg:col-span-4">
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden p-8 bg-[#0d1018] border-[#1e2435]">
            <h3 className="text-lg font-black uppercase tracking-tight mb-6">Add Contractor Payment</h3>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Name</label>
                <Input 
                  placeholder="Contractor name" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mobile Number</label>
                <Input 
                  placeholder="9876543210" 
                  value={formData.mobile}
                  onChange={e => setFormData({...formData, mobile: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
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
                    className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Site / Project (optional)</label>
                <Input 
                  placeholder="e.g. Sai Residency, Boduppal" 
                  value={formData.site_project}
                  onChange={e => setFormData({...formData, site_project: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Amount</label>
                <Input 
                  type="number" 
                  placeholder="Enter amount" 
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
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

              <Button type="submit" disabled={saving} className="w-full h-12 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase tracking-widest text-sm">
                {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                Add Payment
              </Button>
            </form>
          </Card>

          {/* Add Installment Card */}
          {selectedContractor && (
            <Card className="panel-elevated text-white rounded-2xl overflow-hidden p-6 bg-[#0d1018] border-[#1e2435] mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black uppercase tracking-tight">Add Installment</h3>
                <button onClick={() => setSelectedContractor(null)} className="text-zinc-500 hover:text-white">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">{selectedContractor.name}</p>
                <p className="text-[10px] text-zinc-500">Total: ₹{selectedContractor.total_amount.toLocaleString()} | Paid: ₹{selectedContractor.total_paid.toLocaleString()}</p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Amount</label>
                  <Input 
                    type="number" 
                    placeholder="Enter amount" 
                    value={installmentAmount}
                    onChange={e => setInstallmentAmount(e.target.value)}
                    className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</label>
                  <Input 
                    type="date"
                    value={installmentDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstallmentDate(e.target.value)}
                    className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>
                <Button onClick={handleAddInstallment} className="w-full h-10 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold uppercase tracking-widest text-xs">
                  Add Installment
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
