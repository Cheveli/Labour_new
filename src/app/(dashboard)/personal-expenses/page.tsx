'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { UserPlus, Search, Calendar, Loader2, DollarSign, History, Trash2, FileText, Download, Edit2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'

export default function PersonalExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({ person_name: '', purpose: '', amount: '', date: '' })
  const [editSaving, setEditSaving] = useState(false)

  const [formData, setFormData] = useState({
    person_name: '',
    purpose: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd')
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('personal_expenses')
      .select('*')
      .order('date', { ascending: false })
    
    if (error) {
      toast.error('Failed to fetch expenses')
    } else {
      setExpenses(data || [])
    }
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.person_name || !formData.amount || !formData.purpose) {
      toast.error('All fields are required')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('personal_expenses').insert([{
      ...formData,
      amount: parseFloat(formData.amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Expense recorded')
      setFormData({ 
        person_name: '', 
        purpose: '', 
        amount: '', 
        date: format(new Date(), 'yyyy-MM-dd') 
      })
      fetchData()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return

    const { error } = await supabase.from('personal_expenses').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Entry deleted')
      fetchData()
    }
  }

  const handleOpenEdit = (expense: any) => {
    setEditingExpense(expense)
    setEditFormData({ person_name: expense.person_name, purpose: expense.purpose, amount: String(expense.amount), date: expense.date })
  }

  const handleSaveEdit = async () => {
    if (!editingExpense) return
    setEditSaving(true)
    const { error } = await supabase.from('personal_expenses').update({
      person_name: editFormData.person_name,
      purpose: editFormData.purpose,
      amount: parseFloat(editFormData.amount),
      date: editFormData.date
    }).eq('id', editingExpense.id).select()
    if (error) toast.error(error.message)
    else { toast.success('Entry updated'); setEditingExpense(null); fetchData() }
    setEditSaving(false)
  }

  const totalExpenses = expenses.reduce((s, i) => s + Number(i.amount), 0)

  const exportPDF = () => {
    const doc = new jsPDF()
    
    drawPremiumHeader(doc, 'PERSONAL EXPENSES', 'INTERNAL SPENDING LEDGER')

    let y = 52
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('STATEMENT OF PERSONAL WITHDRAWALS', 14, y)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...PDF_COLORS.MUTED)
    doc.text('This report documents all internal funds used for personal purposes, excluding project-specific costs.', 14, y + 5)

    autoTable(doc, {
      startY: y + 10,
      head: [['#', 'DATE', 'PERSON NAME', 'PURPOSE / DESCRIPTION', 'AMOUNT']],
      body: expenses.map((item, idx) => [
        idx + 1,
        format(new Date(item.date), 'dd MMM yyyy'),
        item.person_name.toUpperCase(),
        item.purpose,
        `Rs. ${Number(item.amount).toLocaleString('en-IN')}`
      ]),
      theme: 'grid',
      headStyles: { 
        fillColor: PDF_COLORS.NAVY, 
        textColor: 255, 
        fontStyle: 'bold', 
        fontSize: 8,
        halign: 'center'
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 4, 
        textColor: PDF_COLORS.NAVY,
        lineColor: [230, 235, 245]
      },
      columnStyles: { 
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { fontStyle: 'bold', cellWidth: 40 },
        4: { halign: 'right', fontStyle: 'bold', textColor: PDF_COLORS.RED, cellWidth: 35 } 
      },
      alternateRowStyles: { fillColor: [250, 252, 255] },
      margin: { left: 14, right: 14 }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 15
    
    // Summary Section
    if (finalY > 240) doc.addPage()
    
    const boxW = 80
    const startX = 210 - 14 - boxW
    
    doc.setFillColor(...PDF_COLORS.NAVY)
    doc.roundedRect(startX, finalY, boxW, 28, 1, 1, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('GRAND TOTAL EXPENSES', startX + 5, finalY + 10)
    
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`Rs. ${totalExpenses.toLocaleString('en-IN')}`, startX + 5, finalY + 20)

    // Authorised Signatory
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(9)
    doc.text('Authorised Signatory', 14, finalY + 20)
    doc.line(14, finalY + 22, 60, finalY + 22)

    drawPremiumFooter(doc)
    doc.save(`Personal_Expenses_${format(new Date(), 'dd_MMM_yyyy')}.pdf`)
    toast.success('Premium PDF Report generated')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Personal Expenses</h1>
          <p className="mt-1 text-sm text-zinc-500 font-medium">Internal tracking for personal spending from revenue.</p>
        </div>
        <div className="flex items-center gap-4">
          {expenses.length > 0 && (
            <Button onClick={exportPDF} variant="outline" className="border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight px-4 gap-2 h-10">
              <FileText size={14} /> Export PDF
            </Button>
          )}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Total Spent</span>
            <span className="text-2xl font-black text-rose-500">₹{totalExpenses.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: History */}
        <div className="lg:col-span-8">
          <Card className="panel-elevated text-white overflow-hidden min-h-full border-[#1e2435] bg-[#0d1018]">
            <CardHeader className="p-8 border-b border-[#1e2435]">
               <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic flex items-center gap-2">
                 <History size={14} /> Spending Ledger
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-black/20">
                    <TableRow className="border-[#1e2435] hover:bg-transparent">
                      <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500 w-16">#</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500">Date</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500">Person</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500">Purpose</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-500 text-right">Amount</TableHead>
                      <TableHead className="py-6 px-8 text-right w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-[#1e2435]">
                          <TableCell colSpan={6} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                        </TableRow>
                      ))
                    ) : expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                              <DollarSign size={48} className="opacity-10" />
                              <p className="text-sm font-bold uppercase tracking-widest">No expenses recorded yet</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.slice(page * 10, page * 10 + 10).map((item, idx) => (
                        <TableRow key={item.id} className="border-[#1e2435] transition-colors hover:bg-white/5">
                          <TableCell className="px-8 py-5 font-bold text-zinc-600 text-xs">
                            {page * 10 + idx + 1}
                          </TableCell>
                          <TableCell className="py-5 font-bold text-zinc-400 text-xs">
                            {format(new Date(item.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="py-5 font-bold text-white text-sm">{item.person_name}</TableCell>
                          <TableCell className="py-5 text-xs text-zinc-400 max-w-[200px] truncate">{item.purpose}</TableCell>
                          <TableCell className="py-5 text-right font-black text-rose-400 text-lg">₹{Number(item.amount).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="py-5 px-8 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => handleOpenEdit(item)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 transition-colors"><Edit2 size={13} /></button>
                              <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {expenses.length > 10 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2435]">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-40 transition-all border border-[#1e2435] bg-[#111520] text-zinc-400 hover:text-white">
                    Previous
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Page {page + 1} / {Math.ceil(expenses.length / 10)}</span>
                  <button disabled={(page + 1) * 10 >= expenses.length} onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-40 transition-all border border-[#1e2435] bg-[#111520] text-zinc-400 hover:text-white">
                    Next
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Add Form */}
        <div className="lg:col-span-4">
           <Card className="panel-elevated text-white overflow-hidden p-8 border-[#1e2435] bg-[#0d1018]">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-500">
                  <UserPlus size={20} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Record Expense</h3>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Person Name</label>
                  <Input 
                    placeholder="Who used the amount?" 
                    value={formData.person_name}
                    onChange={(e) => setFormData({...formData, person_name: e.target.value})}
                    className="h-12 bg-black/20 border-[#1e2435] rounded-xl font-bold text-white focus:border-rose-500 transition-all px-4"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Amount (₹)</label>
                  <Input 
                    placeholder="0.00" 
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="h-12 bg-black/20 border-[#1e2435] rounded-xl font-bold text-white focus:border-rose-500 transition-all px-4 text-lg text-rose-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Purpose / Reason</label>
                  <Textarea 
                    placeholder="Details of the expense..." 
                    value={formData.purpose}
                    onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    className="bg-black/20 border-[#1e2435] rounded-xl font-bold text-white focus:border-rose-500 transition-all p-4 min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Date</label>
                  <Input 
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="h-12 bg-black/20 border-[#1e2435] rounded-xl font-bold text-white focus:border-rose-500 transition-all px-4"
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full h-14 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <DollarSign size={20} />}
                  Add Entry
                </Button>
              </form>
           </Card>
        </div>
      </div>

      {/* Edit Personal Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingExpense(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 bg-[#0d1018] border border-[#1e2435]" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-white uppercase tracking-wide">Edit Personal Expense</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Person Name</label>
                <Input value={editFormData.person_name} onChange={e => setEditFormData({ ...editFormData, person_name: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Purpose</label>
                <Textarea value={editFormData.purpose} onChange={e => setEditFormData({ ...editFormData, purpose: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Amount</label>
                <Input type="number" value={editFormData.amount} onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</label>
                <Input type="date" value={editFormData.date} onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setEditingExpense(null)} variant="outline" className="flex-1 border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight">Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={editSaving} className="flex-1 bg-rose-600 hover:bg-rose-500 rounded-xl font-black uppercase tracking-tight">{editSaving ? <Loader2 className="animate-spin mr-2" /> : null} Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
