'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Loader2, 
  Wallet, 
  Plus, 
  ChevronRight, 
  Calendar,
  AlertCircle,
  FileText,
  User,
  Clock,
  Briefcase,
  Table as TableIcon
} from 'lucide-react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function PaymentsPage() {
  const [labourers, setLabourers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false)
  const [weeklyReportData, setWeeklyReportData] = useState<any[]>([])
  
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setLabourers(labData || [])
    setProjects(projData || [])
    setLoading(false)
  }

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkerId) {
      toast.error('Select a worker to preview payments')
      return
    }

    setCalculating(true)
    try {
      const worker = labourers.find(l => l.id === selectedWorkerId)
      
      // Fetch attendance for range
      const { data: attData, error } = await supabase
        .from('attendance')
        .select(`
          *,
          projects(name)
        `)
        .eq('labour_id', selectedWorkerId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (error) throw error

      // Calculate totals using custom_rate from attendance
      const totalDays = attData?.reduce((acc, curr) => acc + Number(curr.days_worked), 0) || 0
      const totalOvertimeHours = attData?.reduce((acc, curr) => acc + Number(curr.overtime_hours), 0) || 0
      const totalOvertimeAmount = attData?.reduce((acc, curr) => acc + Number(curr.overtime_amount), 0) || 0
      
      // Use custom_rate if present, otherwise use worker's default rate
      const wageAmount = attData?.reduce((acc, att) => {
        const rate = att.custom_rate || worker.daily_rate
        return acc + (Number(att.days_worked) * Number(rate))
      }, 0) || 0
      
      const totalPayable = wageAmount + totalOvertimeAmount

      // Generate daily breakdown for ALL days in range (even if absent)
      const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
      const breakdown = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const att = attData?.find(a => a.date === dateStr)
        return {
          date: dateStr,
          project: att?.projects?.name || '—',
          status: att ? (att.days_worked === 1 ? 'PRESENT' : att.days_worked === 0.5 ? 'HALF_DAY' : 'ABSENT') : 'ABSENT',
          amount: att ? (Number(att.days_worked) * Number(worker.daily_rate)) + Number(att.overtime_amount) : 0
        }
      })

      setPreviewData({
        worker,
        totalDays,
        totalOvertimeHours,
        totalOvertimeAmount,
        wageAmount,
        totalPayable,
        breakdown
      })
      setIsPreviewMode(true)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCalculating(false)
    }
  }

  const handleCreatePayment = async () => {
    if (!previewData) return
    setCalculating(true)
    
    try {
      const { error } = await supabase.from('payments').insert([{
        labour_id: previewData.worker.id,
        amount: previewData.totalPayable,
        date: format(new Date(), 'yyyy-MM-dd')
      }])

      if (error) throw error
      
      // Prepare receipt data
      setReceiptData({
        ...previewData,
        period: `${startDate} to ${endDate}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      })
      
      toast.success('Payment recorded successfully')
      setIsPreviewMode(false)
      setShowReceipt(true) // Show the receipt modal
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCalculating(false)
    }
  }

  const generateThermalPDF = async () => {
    if (!receiptData) return
    
    const { worker, totalDays, totalPayable, breakdown, period, receiptNo, date } = receiptData
    
    // Thermal paper is narrow. We use 80mm width.
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 200]
    })

    const width = 80
    let currY = 10

    // Header - Thermal Style
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('CASH RECEIPT', width / 2, currY, { align: 'center' })
    currY += 8

    doc.setFontSize(8)
    doc.text('SS CONSTRUCTIONS', width / 2, currY, { align: 'center' })
    currY += 4
    doc.setFont('helvetica', 'normal')
    doc.text('Boduppal, Hyderabad', width / 2, currY, { align: 'center' })
    currY += 4
    doc.text('Phone: 9849678296', width / 2, currY, { align: 'center' })
    currY += 6

    // Separator
    doc.setLineDashPattern([1, 1], 0)
    doc.line(5, currY, 75, currY)
    currY += 5

    // Details
    doc.setFontSize(7)
    doc.text(`Date: ${date}`, 5, currY)
    doc.text(`Receipt: ${receiptNo}`, 45, currY)
    currY += 4
    doc.text(`Manager: Cheveli Somaiah`, 5, currY)
    doc.text(`Worker: ${worker.name}`, 45, currY)
    currY += 4
    doc.text(`Period: ${period}`, 5, currY)
    currY += 6

    // Table Header
    doc.line(5, currY, 75, currY)
    currY += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Description', 5, currY)
    doc.text('Amount', 75, currY, { align: 'right' })
    currY += 3
    doc.line(5, currY, 75, currY)
    currY += 5

    // Table Body
    doc.setFont('helvetica', 'normal')
    breakdown.filter((r: any) => r.status !== 'ABSENT').forEach((row: any) => {
      doc.text(`${row.date} (${row.status.slice(0,1)})`, 5, currY)
      doc.text(`Rs. ${row.amount.toLocaleString()}`, 75, currY, { align: 'right' })
      currY += 4
      if (currY > 180) doc.addPage()
    })

    currY += 2
    doc.line(5, currY, 75, currY)
    currY += 5

    // Totals
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('TOTAL', 5, currY)
    doc.text(`Rs. ${totalPayable.toLocaleString()}`, 75, currY, { align: 'right' })
    currY += 10

    // Footer
    doc.setFontSize(12)
    doc.text('THANK YOU!', width / 2, currY, { align: 'center' })
    currY += 8

    // Fake Barcode Serial
    doc.setFont('courier', 'normal')
    doc.setFontSize(7)
    doc.text(`#${receiptNo}${worker.id.slice(0,4)}#`, width / 2, currY, { align: 'center' })

    return doc
  }

  const downloadReceipt = async () => {
    const doc = await generateThermalPDF()
    if (doc) {
      doc.save(`${receiptData.receiptNo}.pdf`)
      toast.success('Receipt downloaded')
    }
  }

  const shareToWhatsApp = async () => {
    if (!receiptData) return
    setReceiptLoading(true)
    try {
      const doc = await generateThermalPDF()
      if (!doc) throw new Error('PDF Generation failed')

      const fileName = `${receiptData.receiptNo}.pdf`
      const pdfBlob = doc.output('blob')
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, { upsert: true, contentType: 'application/pdf' })

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
        const message = `*SS Constructions - Receipt*\n\nReceipt No: ${receiptData.receiptNo}\nWorker: ${receiptData.worker.name}\nPeriod: ${receiptData.period}\n*Total Paid: Rs. ${receiptData.totalPayable.toLocaleString()}*\n\nView Digital Receipt:\n${publicUrl}\n\nTHANK YOU!`
        const encodedMessage = encodeURIComponent(message)
        const phone = receiptData.worker.phone?.replace(/\D/g, '') || ''
        window.open(`https://wa.me/91${phone}?text=${encodedMessage}`, '_blank')
        toast.success('Receipt shared to WhatsApp')
      } else {
        // Fallback to direct share
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Payment Receipt',
            text: `Receipt for ${receiptData.worker.name}`
          })
        } else {
          toast.error('Could not share file. Please download and send manually.')
        }
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setReceiptLoading(false)
    }
  }

  const generateWeeklyReport = async () => {
    setCalculating(true)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          labour(name),
          projects(name)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      if (error) throw error

      // Group by project
      const projectMap = new Map()
      data?.forEach(payment => {
        const projectId = payment.project_id || 'unassigned'
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            projectName: payment.projects?.name || 'Unassigned',
            totalAmount: 0,
            payments: []
          })
        }
        projectMap.get(projectId).totalAmount += Number(payment.amount)
        projectMap.get(projectId).payments.push(payment)
      })

      setWeeklyReportData(Array.from(projectMap.values()))
      setWeeklyReportOpen(true)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCalculating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Payments</h1>
          <p className="mt-2 text-zinc-500 font-medium italic">Create payments, preview calculations, and generate reports.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button className="bg-[#00A3FF] hover:bg-[#0092E6] text-white rounded-xl font-bold uppercase tracking-tight gap-2 px-6 shadow-lg shadow-blue-500/20">
             Individual Payment
           </Button>
           <Button 
             variant="outline" 
             className="border-zinc-800 bg-[#1F2937] text-gray-300 rounded-xl font-bold uppercase tracking-tight px-6"
             onClick={generateWeeklyReport}
           >
             Weekly Report
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Calculation Form */}
        <div className="lg:col-span-4">
          <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-lg font-black uppercase tracking-tight">Create Payment</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handlePreview} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Worker</label>
                  <Select onValueChange={(v: string | null) => setSelectedWorkerId(v ?? '')} value={selectedWorkerId}>
                    <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Select worker" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                      {labourers.map(l => (
                        <SelectItem key={l.id} value={l.id} className="py-3 font-bold hover:bg-zinc-800">
                          {l.name} ({l.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Start Date</label>
                  <Input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">End Date</label>
                  <Input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={calculating} 
                  className="w-full h-14 bg-[#00A3FF] hover:bg-[#0092E6] text-white rounded-xl font-black uppercase tracking-tight text-lg shadow-xl shadow-blue-500/20"
                >
                  {calculating ? <Loader2 className="animate-spin mr-2" /> : null}
                  Preview
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Preview & Breakdowns */}
        <div className="lg:col-span-8">
           <AnimatePresence mode="wait">
             {!isPreviewMode ? (
               <motion.div 
                 key="empty"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="flex flex-col items-center justify-center p-24 bg-[#111827] rounded-3xl text-zinc-600 border border-zinc-800 border-dashed h-full"
               >
                  <FileText size={48} className="opacity-10 mb-4" />
                  <p className="font-bold uppercase tracking-widest text-sm italic">Select worker and dates to see preview</p>
               </motion.div>
             ) : (
               <motion.div 
                 key="preview"
                 initial={{ opacity: 0, scale: 0.98 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="space-y-6"
               >
                 <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden p-8">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-lg font-black uppercase tracking-tight">Payment Preview</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-10">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Worker</p>
                          <p className="text-xl font-bold flex items-center gap-2">
                             <User size={18} className="text-[#00A3FF]" />
                             {previewData.worker.name}
                          </p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Period</p>
                          <p className="text-sm font-bold flex items-center gap-2">
                             <Calendar size={16} className="text-zinc-500" />
                             {startDate} to {endDate}
                          </p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Per Day Salary</p>
                          <p className="text-lg font-bold">₹ {previewData.worker.daily_rate}.00</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Days</p>
                          <p className="text-lg font-bold">{previewData.totalDays.toFixed(1)}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Overtime</p>
                          <p className="text-lg font-bold">₹ {previewData.totalOvertimeAmount.toFixed(1)}</p>
                       </div>
                       <div className="space-y-1 bg-[#1F2937] p-4 rounded-xl border border-zinc-800">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Payable</p>
                          <p className="text-2xl font-black text-[#00A3FF]">₹ {previewData.totalPayable.toFixed(2)}</p>
                       </div>
                    </div>

                    {/* Daily Breakdown Table */}
                    <div className="mt-10 space-y-4">
                       <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Daily Details</p>
                       <div className="rounded-xl border border-zinc-800 overflow-hidden">
                          <Table>
                            <TableHeader className="bg-[#0F172A]">
                              <TableRow className="border-zinc-800 hover:bg-[#0F172A]">
                                <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Date</TableHead>
                                <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Project</TableHead>
                                <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500 text-center">Status</TableHead>
                                <TableHead className="py-4 text-right text-[10px] font-black uppercase text-zinc-500 px-6">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewData.breakdown.map((row: any, idx: number) => (
                                <TableRow key={idx} className="border-zinc-800 hover:bg-white/5">
                                  <TableCell className="py-3 text-xs font-bold tracking-tight text-zinc-400">{row.date}</TableCell>
                                  <TableCell className="py-3 text-xs font-bold text-zinc-600">{row.project}</TableCell>
                                  <TableCell className="py-3 text-center">
                                     <Badge className={cn(
                                       "px-3 py-0.5 rounded text-[8px] font-black uppercase border-none",
                                       row.status === 'ABSENT' ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-400"
                                     )}>
                                       {row.status}
                                     </Badge>
                                  </TableCell>
                                  <TableCell className="py-3 text-right font-black text-xs px-6 text-zinc-400 leading-none">
                                    ₹ {row.amount.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                       </div>
                    </div>

                    <Button 
                      onClick={handleCreatePayment}
                      className="w-full h-14 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-black uppercase tracking-tight text-lg mt-10 shadow-xl shadow-emerald-500/20"
                    >
                      {calculating ? <Loader2 className="animate-spin mr-2" /> : null}
                      Create Payment
                    </Button>
                 </Card>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>

      {/* Weekly Report Modal */}
      <Dialog open={weeklyReportOpen} onOpenChange={setWeeklyReportOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weekly Payment Report</DialogTitle>
            <DialogDescription>
              Project-wise payment breakdown from {startDate} to {endDate}
            </DialogDescription>
          </DialogHeader>
          
          {weeklyReportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <TableIcon size={48} className="opacity-10 mb-4" />
              <p className="font-bold">No payments found for this period</p>
            </div>
          ) : (
            <div className="space-y-6">
              {weeklyReportData.map((project, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{project.projectName}</h3>
                    <span className="font-black text-[#00A3FF] text-xl">₹{project.totalAmount.toLocaleString()}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.payments.map((payment: any, pIdx: number) => (
                        <TableRow key={pIdx}>
                          <TableCell className="font-bold">{payment.labour?.name || 'N/A'}</TableCell>
                          <TableCell>{format(new Date(payment.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="capitalize">{payment.payment_type || 'N/A'}</TableCell>
                          <TableCell className="text-right font-bold">₹{Number(payment.amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md bg-[#F4F4F5] dark:bg-zinc-950 p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-8 space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-6 shadow-sm border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg font-mono text-sm space-y-4">
               <div className="text-center border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <p className="font-bold text-lg">CASH RECEIPT</p>
                  <p className="text-[10px] text-zinc-500">SS CONSTRUCTIONS</p>
               </div>
               
               {receiptData && (
                 <>
                   <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <p><span className="text-zinc-500">Date:</span> {receiptData.date}</p>
                      <p className="text-right"><span className="text-zinc-500">Receipt:</span> {receiptData.receiptNo}</p>
                      <p><span className="text-zinc-500">Manager:</span> Somaiah</p>
                      <p className="text-right"><span className="text-zinc-500">Worker:</span> {receiptData.worker.name}</p>
                   </div>
                   
                   <div className="border-y border-zinc-200 dark:border-zinc-800 py-2">
                      <div className="flex justify-between font-bold mb-2">
                        <span>Description</span>
                        <span>Amount</span>
                      </div>
                      <div className="space-y-1 text-zinc-600 dark:text-zinc-400">
                        {receiptData.breakdown.filter((r:any) => r.status !== 'ABSENT').map((r:any, i:number) => (
                          <div key={i} className="flex justify-between">
                            <span>{r.date}</span>
                            <span>{r.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                   
                   <div className="flex justify-between font-bold text-lg pt-2">
                      <span>TOTAL</span>
                      <span>Rs. {receiptData.totalPayable.toLocaleString()}</span>
                   </div>
                   
                   <div className="text-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="text-lg font-bold">THANK YOU!</p>
                      <p className="text-[10px] text-zinc-400 mt-2">#{receiptData.receiptNo}#</p>
                   </div>
                 </>
               )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <Button 
                variant="outline" 
                className="h-12 border-zinc-300 dark:border-zinc-800 rounded-xl font-bold uppercase tracking-tight"
                onClick={downloadReceipt}
               >
                 Download
               </Button>
               <Button 
                className="h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold uppercase tracking-tight gap-2"
                onClick={shareToWhatsApp}
                disabled={receiptLoading}
               >
                 {receiptLoading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                 WhatsApp
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
