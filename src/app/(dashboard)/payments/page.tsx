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
  Calendar,
  FileText,
  Download,
  User
} from 'lucide-react'
import { format, eachDayOfInterval, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

import { 
  drawPremiumHeader, 
  drawPremiumFooter, 
  PDF_COLORS, 
  numberToWords 
} from '@/lib/report-utils'



// using numberToWords from report-utils

export default function PaymentsPage() {
  const [labourers, setLabourers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  
  const [weeklyReportOpen, setWeeklyReportOpen] = useState(false)
  const [weeklyReportData, setWeeklyReportData] = useState<any[]>([])
  
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState<string>('0')
  const [paymentType, setPaymentType] = useState<string>('REGULAR')
  const [paymentNotes, setPaymentNotes] = useState<string>('')
  
  const supabase = createClient()

  async function fetchData() {
    setLoading(true)
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setLabourers(labData || [])
    setProjects(projData || [])
    setLoading(false)
  }

  useEffect(() => { 
    fetchData() 
    // Default to current week: Sunday to Saturday
    const now = new Date()
    setStartDate(format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    setEndDate(format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  }, [])

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

      // AUTO-DETECT ADVANCES: Fetch all payments of type 'ADVANCE' in this range for this worker
      const { data: advanceData } = await supabase
        .from('payments')
        .select('*')
        .eq('labour_id', selectedWorkerId)
        .eq('payment_type', 'ADVANCE')
        .gte('date', startDate)
        .lte('date', endDate)
      
      const attAdvances = attData?.reduce((acc, curr) => acc + Number(curr.advance_amount || 0), 0) || 0
      const payAdvances = advanceData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
      setAdvanceAmount((attAdvances + payAdvances).toString())

      // Generate daily breakdown for ALL days in range (even if absent)
      const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
      const breakdown = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const att = attData?.find(a => a.date === dateStr)
        const daysWorked = att ? Number(att.days_worked) : 0
        const rate = att?.custom_rate ? Number(att.custom_rate) : Number(worker.daily_rate)
        const baseWage = daysWorked * rate
        const otHours = att ? Number(att.overtime_hours || 0) : 0
        const otAmount = att ? Number(att.overtime_amount || 0) : 0
        return {
          date: dateStr,
          project: att?.projects?.name || '—',
          status: att ? (att.days_worked === 1 ? 'PRESENT' : att.days_worked === 0.5 ? 'HALF_DAY' : 'ABSENT') : 'ABSENT',
          daysWorked,
          baseWage,
          overtimeHours: otHours,
          overtimeAmount: otAmount,
          notes: att?.notes || '',
          amount: baseWage + otAmount
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
        amount: previewData.totalPayable - (parseFloat(advanceAmount || '0') || 0),
        date: format(new Date(), 'yyyy-MM-dd'),
        payment_type: paymentType,
        notes: paymentNotes || null
      }])

      if (error) throw error
      
      // Prepare receipt data
      setReceiptData({
        ...previewData,
        advanceDeducted: parseFloat(advanceAmount || '0'),
        paymentType,
        period: `${startDate} to ${endDate}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      })
      
      toast.success('Payment recorded successfully')
      setIsPreviewMode(false)
      setShowReceipt(true)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCalculating(false)
    }
  }

  const generateThermalPDF = async () => {
    if (!receiptData) return null
    const { worker, totalDays, totalOvertimeHours, totalOvertimeAmount, totalPayable, breakdown, receiptNo, date } = receiptData
    
    // Calculate Dynamic Height
    const tableHeight = (breakdown.length + 1) * 8
    const requiredHeight = 44 + 10 + 15 + tableHeight + 40 + 20
    const pageHeight = Math.max(297, requiredHeight)

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [210, pageHeight]
    })
    
    drawPremiumHeader(doc, 'LABOUR WEEKLY REPORT', '(INDIVIDUAL)')
    
    const infoY = 54
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text('Worker Name', 14, infoY); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.name}`, 40, infoY)
    doc.setFont('helvetica', 'bold'); doc.text('Role', 14, infoY + 6); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.type || 'N/A'}`, 40, infoY + 6)
    
    doc.setFont('helvetica', 'bold'); doc.text('Date Range', 110, infoY)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${receiptData.period}`, 140, infoY)
    doc.setFont('helvetica', 'bold'); doc.text('Receipt No', 110, infoY + 6)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${receiptNo}`, 140, infoY + 6)

    const tableBody = breakdown.map((row: any) => [
      format(new Date(row.date), 'EEEE (dd MMM)'),
      row.status,
      `Rs. ${row.baseWage || 0}`,
      row.overtimeHours || 0,
      `Rs. ${row.overtimeAmount || 0}`,
      `Rs. ${row.amount || 0}`,
      row.notes || '-'
    ])

    autoTable(doc, {
      startY: infoY + 14,
      head: [['Day', 'Status', 'Basic Wage', 'OT Hrs', 'OT Amount', 'Total', 'Remarks']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      styles: { cellPadding: 2.5 }
    })

    const tableEndY = (doc as any).lastAutoTable.finalY + 8
    const netPayable = totalPayable - (receiptData.advanceDeducted || 0)
    const isNegative = netPayable < 0

    const summaryBoxes = [
      { label: 'Gross Amount', value: `Rs.${totalPayable.toLocaleString()}` },
      { label: 'Deduction', value: `Rs.${(receiptData.advanceDeducted || 0).toLocaleString()}` },
      { label: isNegative ? 'WORKER OWES' : 'NET PAYABLE', value: `Rs.${isNegative ? Math.abs(netPayable).toLocaleString() : netPayable.toLocaleString()}`, hi: true }
    ]
    
    const bW = 60, bH = 20
    summaryBoxes.forEach((b, i) => {
      const bx = 14 + (i * (bW + 2))
      if (b.hi && isNegative) { doc.setFillColor(...PDF_COLORS.RED); doc.setTextColor(255, 255, 255) }
      else if (b.hi) { doc.setFillColor(...PDF_COLORS.BLUE); doc.setTextColor(255, 255, 255) }
      else { doc.setFillColor(235, 242, 255); doc.setTextColor(...PDF_COLORS.NAVY) }
      doc.roundedRect(bx, tableEndY, bW, bH, 1, 1, 'F')
      doc.setFontSize(7); doc.text(b.label, bx + bW / 2, tableEndY + 6, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(b.value, bx + bW / 2, tableEndY + 14, { align: 'center' })
    })

    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8); doc.text('Amount in Words:', 14, tableEndY + bH + 8)
    doc.setFont('helvetica', 'italic'); doc.text(numberToWords(Math.abs(netPayable)), 42, tableEndY + bH + 8)

    // Footer
    doc.setFillColor(...PDF_COLORS.NAVY)
    doc.rect(0, pageHeight - 14, 210, 14, 'F')
    doc.setTextColor(180, 200, 240)
    doc.setFontSize(7); doc.text(`Generated by SS CONSTRUCTIONS - Ph: 9849678296`, 105, pageHeight - 6, { align: 'center' })

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
        const gross = receiptData.totalPayable
        const ded = parseFloat(advanceAmount || '0') || 0
        const netAmt = gross - ded
        const netLabel = netAmt < 0 ? `*Worker Owes: Rs. ${Math.abs(netAmt).toLocaleString()}*` : `*Net Payable: Rs. ${netAmt.toLocaleString()}*`
        const message = `*SS CONSTRUCTIONS - Payment Receipt*\n\n` +
                        `Receipt No: ${receiptData.receiptNo}\n` +
                        `Worker: ${receiptData.worker.name}\n` +
                        `Period: ${receiptData.period}\n\n` +
                        `Gross Amount: Rs. ${gross.toLocaleString()}\n` +
                        `Deduction: Rs. ${ded.toLocaleString()}\n` +
                        `--------------------------\n` +
                        `${netLabel}\n\n` +
                        `View Digital Receipt:\n${publicUrl}\n\n` +
                        `THANK YOU!`
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

  const exportWeeklyPDF = () => {
    const doc = new jsPDF()
    drawPremiumHeader(doc, 'WEEKLY PAYMENT SUMMARY', '(PROJECT WISE)')
    
    let startY = 54
    weeklyReportData.forEach(proj => {
      if (startY > 250) {
        doc.addPage()
        startY = 20
      }
      
      doc.setTextColor(...PDF_COLORS.NAVY)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
      doc.text(`PROJECT: ${proj.projectName.toUpperCase()}`, 14, startY)
      
      autoTable(doc, {
        startY: startY + 4,
        head: [['Worker', 'Date', 'Type', 'Amount']],
        body: proj.payments.map((p: any) => [
          p.labour?.name || 'N/A',
          format(new Date(p.date), 'dd MMM yyyy'),
          p.payment_type || 'REGULAR',
          `Rs. ${Number(p.amount).toLocaleString()}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
        alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
        foot: [['', '', 'PROJECT TOTAL', `Rs. ${proj.totalAmount.toLocaleString()}`]],
        footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 }
      })
      
      startY = (doc as any).lastAutoTable.finalY + 12
    })
    
    drawPremiumFooter(doc)
    doc.save(`SS_Weekly_Payments_${startDate}.pdf`)
    toast.success('PDF exported')
  }

  const exportWeeklyExcel = () => {
    const rows: any[] = [['Weekly Payment Report'], [`Period: ${startDate} to ${endDate}`], []]
    weeklyReportData.forEach(proj => {
      rows.push([proj.projectName, '', `Total: ₹${proj.totalAmount.toLocaleString()}`])
      rows.push(['Worker', 'Date', 'Amount'])
      proj.payments.forEach((p: any) => {
        rows.push([p.labour?.name || 'N/A', format(new Date(p.date), 'dd/MM/yyyy'), Number(p.amount)])
      })
      rows.push([])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Report')
    XLSX.writeFile(wb, `weekly-report-${startDate}-${endDate}.xlsx`)
    toast.success('Excel exported')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-zinc-500">Create payments, preview calculations, and generate reports.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button className="btn-construction rounded-xl font-bold uppercase tracking-tight gap-2 px-6">
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
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-lg font-black uppercase tracking-tight">Create Payment</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handlePreview} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Worker</label>
                  <Select onValueChange={(v: string | null) => setSelectedWorkerId(v ?? '')} value={selectedWorkerId}>
                    <SelectTrigger className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Select worker" items={Object.fromEntries(labourers.map(l => [l.id, `${l.name} (${l.type})`]))} />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl">
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
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">End Date</label>
                  <Input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={calculating} 
                  className="w-full h-14 btn-construction rounded-xl font-black uppercase tracking-tight text-lg"
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
                 className="flex flex-col items-center justify-center p-24 bg-zinc-900 rounded-3xl text-zinc-600 border border-zinc-800 border-dashed h-full"
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
                 <Card className="panel-elevated text-white rounded-2xl overflow-hidden p-8">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-lg font-black uppercase tracking-tight">Payment Preview</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-y-10">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Worker</p>
                          <p className="text-xl font-bold flex items-center gap-2">
                             <User size={18} className="text-blue-400" />
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
                          <p className="text-2xl font-black text-blue-400">₹ {previewData.totalPayable.toFixed(2)}</p>
                       </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Advance / Deduction (₹)</p>
                           <input
                             type="number"
                             value={advanceAmount}
                             onChange={e => setAdvanceAmount(e.target.value)}
                             placeholder="0"
                             className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                             style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }}
                           />
                           <p className="text-[9px] text-zinc-500">Deducted from total. Leave 0 if no advance.</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Type</p>
                           <Select onValueChange={(v) => setPaymentType(v || 'REGULAR')} value={paymentType}>
                              <SelectTrigger className="h-11 bg-[#0d1018] border-[#1e2435] rounded-xl font-bold text-white">
                                 <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#111520] border-[#1e2435] text-white">
                                 <SelectItem value="REGULAR">Regular Payment</SelectItem>
                                 <SelectItem value="ADVANCE">Advance Given</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-1 col-span-2">
                           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Notes</p>
                           <input
                             type="text"
                             value={paymentNotes}
                             onChange={e => setPaymentNotes(e.target.value)}
                             placeholder="e.g. Paid in cash, Part of week 2, etc."
                             className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none"
                             style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }}
                           />
                        </div>
                       <div className={cn("space-y-1 col-span-2 p-4 rounded-xl border", 
                          (previewData.totalPayable - (parseFloat(advanceAmount || '0') || 0)) < 0 
                            ? "bg-red-950/30 border-red-500/30" 
                            : "bg-[#0d1018] border-blue-500/30"
                       )}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            {(previewData.totalPayable - (parseFloat(advanceAmount || '0') || 0)) < 0 ? 'Worker Owes Us' : 'Net Payable (After Deduction)'}
                          </p>
                          <p className={cn("text-3xl font-black", 
                            (previewData.totalPayable - (parseFloat(advanceAmount || '0') || 0)) < 0 ? "text-red-500" : "text-blue-400"
                          )}>
                            ₹ {(previewData.totalPayable - (parseFloat(advanceAmount || '0') || 0)).toFixed(2)}
                          </p>
                       </div>
                    </div>

                    {/* Daily Breakdown Table */}
                    <div className="mt-10 space-y-4">
                       <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Daily Details</p>
                       <div className="rounded-xl border border-zinc-800 overflow-hidden">
                          <Table>
                            <TableHeader className="bg-zinc-900/80">
                              <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
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
                      className="w-full h-14 btn-construction rounded-xl font-black uppercase tracking-tight text-lg mt-10"
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
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Weekly Payment Report</DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>
              Project-wise breakdown · {startDate} → {endDate}
            </DialogDescription>
          </DialogHeader>
          {weeklyReportData.length > 0 && (
            <div className="flex gap-2 pb-2 border-b" style={{ borderColor: '#1e2435' }}>
              <button onClick={exportWeeklyPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#3b82f6', border: '1px solid #1e2435' }}>
                <FileText size={12} /> Export PDF
              </button>
              <button onClick={exportWeeklyExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#60a5fa', border: '1px solid #1e2435' }}>
                <Download size={12} /> Export Excel
              </button>
            </div>
          )}
          {weeklyReportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: '#6b7280' }}>
              <p className="font-bold text-sm">No payments found for this period</p>
            </div>
          ) : (
            <div className="space-y-5">
              {weeklyReportData.map((project, idx) => (
                <div key={idx} style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', borderRadius: '0.75rem' }} className="overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b" style={{ borderColor: '#1e2435' }}>
                    <p className="font-black text-white text-sm">{project.projectName}</p>
                    <span className="font-black text-lg" style={{ color: '#3b82f6' }}>₹{project.totalAmount.toLocaleString()}</span>
                  </div>
                  <Table>
                    <TableHeader style={{ backgroundColor: '#111520' }}>
                      <TableRow style={{ borderColor: '#1e2435' }}>
                        <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Worker</TableHead>
                        <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Date</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.payments.map((payment: any, pIdx: number) => (
                        <TableRow key={pIdx} style={{ borderColor: '#1e2435' }}>
                          <TableCell className="font-bold text-white text-sm">{payment.labour?.name || 'N/A'}</TableCell>
                          <TableCell className="text-xs" style={{ color: '#6b7280' }}>{format(new Date(payment.date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-right font-black text-sm" style={{ color: '#3b82f6' }}>₹{Number(payment.amount).toLocaleString()}</TableCell>
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
                  <p className="font-bold text-lg">PAYMENT RECEIPT</p>
                  <p className="text-[10px] text-zinc-500">SRI SAI CONSTRUCTIONS</p>
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
                      <span>GROSS TOTAL</span>
                      <span>Rs. {receiptData.totalPayable.toLocaleString()}</span>
                   </div>
                   {(parseFloat(advanceAmount || '0') || 0) > 0 && (
                     <div className="flex justify-between text-sm text-red-500">
                       <span>Advance Deducted</span>
                       <span>- Rs. {(parseFloat(advanceAmount || '0') || 0).toLocaleString()}</span>
                     </div>
                   )}
                   {(() => {
                     const net = receiptData.totalPayable - (parseFloat(advanceAmount || '0') || 0)
                     const isNeg = net < 0
                     return (
                       <div className={cn("flex justify-between font-bold text-lg", isNeg ? "text-red-500" : "text-blue-600")}>
                         <span>{isNeg ? 'WORKER OWES' : 'NET PAYABLE'}</span>
                         <span>{isNeg ? `-` : ''}Rs. {Math.abs(net).toLocaleString()}</span>
                       </div>
                     )
                   })()}
                   
                   <div className="text-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <p className="text-lg font-bold">THANK YOU!</p>
                      <p className="text-[10px] text-zinc-400 mt-2">#{receiptData.receiptNo}#</p>
                   </div>
                 </>
               )}
            </div>
            
            <div className="grid grid-cols-1 gap-3">
               <Button 
                className="h-12 btn-construction rounded-xl font-bold uppercase tracking-tight gap-2"
                onClick={downloadReceipt}
               >
                 <FileText size={18} /> Download Individual Weekly PDF
               </Button>
               <Button 
                className="h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold uppercase tracking-tight gap-2"
                onClick={shareToWhatsApp}
                disabled={receiptLoading}
               >
                 {receiptLoading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                 Share via WhatsApp
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
