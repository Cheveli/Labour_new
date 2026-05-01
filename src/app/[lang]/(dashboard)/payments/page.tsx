'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n'
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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Loader2, 
  Wallet, 
  Plus, 
  Calendar,
  FileText,
  User,
  CheckCircle2,
  History,
  MessageCircle
} from 'lucide-react'
import { format, eachDayOfInterval, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState<string>('0')
  const paymentType = 'REGULAR'
  const [paymentNotes, setPaymentNotes] = useState<string>('')
  const [advHistoryOpen, setAdvHistoryOpen] = useState(false)
  const [advHistoryData, setAdvHistoryData] = useState<any[]>([])
  const [advHistoryLoading, setAdvHistoryLoading] = useState(false)
  const { t } = useLang()
  
  const supabase = createClient()

  const fetchAdvanceHistory = async (workerId: string) => {
    if (!workerId) { toast.error('Select a worker first'); return }
    setAdvHistoryLoading(true)
    setAdvHistoryOpen(true)
    setAdvHistoryData([])
    const { data } = await supabase
      .from('attendance')
      .select('date, advance_amount, projects(name)')
      .eq('labour_id', workerId)
      .gt('advance_amount', 0)
      .order('date', { ascending: false })
    setAdvHistoryData(data || [])
    setAdvHistoryLoading(false)
  }

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
        .order('date', { ascending: true })
      
      // Build detailed advance records with date, amount, and source
      const advanceDetails: { date: string; amount: number; source: string }[] = []
      
      // Advances from attendance table (daily advance_amount field)
      attData?.forEach(att => {
        const amt = Number(att.advance_amount || 0)
        if (amt > 0) {
          advanceDetails.push({ date: att.date, amount: amt, source: 'Attendance' })
        }
      })
      
      // Advances from payments table (explicit ADVANCE payments)
      advanceData?.forEach(pay => {
        advanceDetails.push({ date: pay.date, amount: Number(pay.amount), source: 'Payment' })
      })
      
      // Sort by date
      advanceDetails.sort((a, b) => a.date.localeCompare(b.date))
      
      const totalAdvanceAmount = advanceDetails.reduce((acc, curr) => acc + curr.amount, 0)
      setAdvanceAmount(totalAdvanceAmount.toString())

      setSelectedWorkerId(selectedWorkerId)
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
        breakdown,
        advanceDetails
      })
      setIsPreviewMode(true)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCalculating(false)
    }
  }

  const handleWhatsAppSend = () => {
    if (!previewData) return
    const w = previewData.worker
    const lines = [
      `🏗️ *SSC CONSTRUCTIONS — SALARY SLIP*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👷 *Worker:* ${w.name}`,
      `📋 *Type:* ${w.type}`,
      `📅 *Period:* ${startDate} to ${endDate}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ *Days Worked:* ${previewData.totalDays}`,
      `💰 *Daily Rate:* ₹${w.daily_rate}`,
      `🔧 *Wage Amount:* ₹${previewData.wageAmount.toLocaleString()}`,
      previewData.totalOvertimeAmount > 0 ? `⏱️ *Overtime:* ₹${previewData.totalOvertimeAmount.toLocaleString()}` : '',
      `📉 *Advance Deducted:* ₹${(parseFloat(advanceAmount || '0')).toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💵 *Net Payable: ₹${(previewData.totalPayable - (parseFloat(advanceAmount || '0') || 0)).toLocaleString()}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `_Generated by SSC Labour Manager_`
    ].filter(Boolean).join('\n')
    const phone = w.phone ? w.phone.replace(/[^0-9]/g, '') : ''
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`
    window.open(url, '_blank')
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
      
      // Prepare receipt data (include advanceDetails for PDF/receipt/WhatsApp)
      setReceiptData({
        ...previewData,
        advanceDeducted: parseFloat(advanceAmount || '0'),
        advanceDetails: previewData.advanceDetails || [],
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
    
    // Calculate Dynamic Height (account for advance details table if present)
    const advanceRows = (receiptData.advanceDetails || []).length
    const advanceTableHeight = advanceRows > 0 ? (advanceRows + 2) * 8 + 16 : 0
    const tableHeight = (breakdown.length + 1) * 8
    const requiredHeight = 44 + 10 + 15 + tableHeight + advanceTableHeight + 40 + 20
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

    // Check if any overtime exists
    const hasOvertime = breakdown.some((row: any) => (row.overtimeHours || 0) > 0 || (row.overtimeAmount || 0) > 0)
    
    const tableBody = breakdown.map((row: any) => {
      const base = [
        format(new Date(row.date), 'EEEE (dd MMM)'),
        row.status
      ]
      if (hasOvertime) {
        base.push(row.overtimeHours || 0, `Rs. ${row.overtimeAmount || 0}`)
      }
      base.push(`Rs. ${row.amount || 0}`, row.notes || '-')
      return base
    })

    const head = hasOvertime 
      ? [['Day', 'Status', 'OT Hrs', 'OT Amount', 'Total', 'Remarks']]
      : [['Day', 'Status', 'Total', 'Remarks']]

    autoTable(doc, {
      startY: infoY + 14,
      head,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      styles: { cellPadding: 2.5 }
    })

    let currentY = (doc as any).lastAutoTable.finalY + 8
    const netPayable = Math.round(totalPayable - (receiptData.advanceDeducted || 0))
    const isNegative = netPayable < 0

    // --- ADVANCE DETAILS TABLE (show date-wise advance breakdown in PDF) ---
    const advDetails: { date: string; amount: number; source: string }[] = receiptData.advanceDetails || []
    if (advDetails.length > 0) {
      doc.setTextColor(...PDF_COLORS.NAVY)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
      doc.text('ADVANCE / DEDUCTION DETAILS', 14, currentY)
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Date', 'Amount (Rs.)', 'Source']],
        body: advDetails.map(adv => [
          format(new Date(adv.date), 'dd MMM yyyy (EEEE)'),
          `Rs. ${adv.amount.toLocaleString()}`,
          adv.source
        ]),
        foot: [['', `Total: Rs. ${(receiptData.advanceDeducted || 0).toLocaleString()}`, '']],
        theme: 'grid',
        headStyles: { fillColor: [220, 53, 69] as any, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
        footStyles: { fillColor: [220, 53, 69] as any, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [255, 240, 240] as any },
        styles: { cellPadding: 2.5 }
      })
      
      currentY = (doc as any).lastAutoTable.finalY + 8
    }

    // --- SUMMARY BOXES ---
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
      doc.roundedRect(bx, currentY, bW, bH, 1, 1, 'F')
      doc.setFontSize(7); doc.text(b.label, bx + bW / 2, currentY + 6, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(b.value, bx + bW / 2, currentY + 14, { align: 'center' })
    })

    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8); doc.text('Amount in Words:', 14, currentY + bH + 8)
    doc.setFont('helvetica', 'italic'); doc.text(numberToWords(Math.abs(netPayable)), 42, currentY + bH + 8)

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
      const safeName = receiptData.worker.name.replace(/[^a-zA-Z0-9]/g, '_')
      const safePeriod = receiptData.period.replace(/[^a-zA-Z0-9]/g, '_')
      doc.save(`${safeName}-${safePeriod}-Payment.pdf`)
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
        const netAmt = Math.round(gross - ded)
        const netLabel = netAmt < 0 ? `*Worker Owes: Rs. ${Math.abs(netAmt).toLocaleString()}*` : `*Net Payable: Rs. ${netAmt.toLocaleString()}*`
        
        // Build advance detail lines for WhatsApp message
        const advDetails: { date: string; amount: number; source: string }[] = receiptData.advanceDetails || []
        let advanceLines = ''
        if (advDetails.length > 0) {
          advanceLines = `\n📌 *Advance Details:*\n`
          advDetails.forEach((adv: any) => {
            advanceLines += `  • ${format(new Date(adv.date), 'dd MMM yyyy')} — Rs. ${adv.amount.toLocaleString()}\n`
          })
          advanceLines += `  *Total Deduction: Rs. ${ded.toLocaleString()}*\n`
        }
        
        const message = `*SS CONSTRUCTIONS - Payment Receipt*\n\n` +
                        `Receipt No: ${receiptData.receiptNo}\n` +
                        `Worker: ${receiptData.worker.name}\n` +
                        `Period: ${receiptData.period}\n\n` +
                        `Gross Amount: Rs. ${gross.toLocaleString()}\n` +
                        (advDetails.length > 0 ? advanceLines : `Deduction: Rs. ${ded.toLocaleString()}\n`) +
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

  const exportWeekGroupedPDF = async () => {
    // Fetch ALL attendance data for range, group into Sun–Sat weeks
    if (!startDate || !endDate) { toast.error('Set start and end dates first'); return }
    setCalculating(true)
    try {
      const { data: attData } = await supabase
        .from('attendance')
        .select('*, labour(name, type, daily_rate), projects(name)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (!attData || attData.length === 0) { toast.error('No attendance data in this range'); return }

      // Group into Sun-Sat weeks
      const { startOfWeek: sowFn, endOfWeek: eowFn, addWeeks, isWithinInterval, parseISO: parseFn } = await import('date-fns')
      const rangeStart = parseFn(startDate)
      const rangeEnd = parseFn(endDate)
      const weeks: { label: string; start: Date; end: Date; rows: any[] }[] = []
      let wStart = sowFn(rangeStart, { weekStartsOn: 0 })
      while (wStart <= rangeEnd) {
        const wEnd = eowFn(wStart, { weekStartsOn: 0 })
        const wRows = attData.filter(a => {
          const d = parseFn(a.date)
          return isWithinInterval(d, { start: wStart, end: wEnd })
        })
        if (wRows.length > 0) {
          weeks.push({ label: `Week: ${format(wStart, 'dd MMM')} - ${format(wEnd, 'dd MMM yyyy')}`, start: wStart, end: wEnd, rows: wRows })
        }
        wStart = addWeeks(wStart, 1)
      }

      const doc = new jsPDF()
      drawPremiumHeader(doc, 'WEEKLY LABOUR SUMMARY', `${format(parseFn(startDate), 'dd MMM')} - ${format(parseFn(endDate), 'dd MMM yyyy')}`)
      let curY = 54

      weeks.forEach((week, wi) => {
        if (curY > 240) { doc.addPage(); drawPremiumHeader(doc, 'WEEKLY LABOUR SUMMARY', `Continued`); curY = 54 }
        doc.setTextColor(...PDF_COLORS.NAVY)
        doc.setFillColor(235, 242, 255)
        doc.roundedRect(14, curY, 182, 8, 1, 1, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        doc.text(week.label, 17, curY + 5.5)

        // Group by worker
        const workerMap = new Map<string, any>()
        week.rows.forEach(r => {
          const wid = r.labour_id
          if (!workerMap.has(wid)) workerMap.set(wid, { name: r.labour?.name || 'Unknown', type: r.labour?.type || '', dates: new Set<string>(), days: 0, otHours: 0, otAmount: 0, deductions: 0, total: 0 })
          const w = workerMap.get(wid)!
          const rate = r.custom_rate || r.labour?.daily_rate || 0
          w.days += Number(r.days_worked)
          w.dates.add(format(parseFn(r.date), 'dd MMM'))
          w.otHours += Number(r.overtime_hours || 0)
          w.otAmount += Number(r.overtime_amount || 0)
          w.deductions += Number(r.advance_amount || 0)
          w.total += Number(r.days_worked) * Number(rate) + Number(r.overtime_amount || 0) - Number(r.advance_amount || 0)
        })

        const workers = Array.from(workerMap.values())
        const hasOT = workers.some(w => w.otHours > 0 || w.otAmount > 0)
        const hasDeductions = workers.some(w => w.deductions > 0)
        const weekTotal = workers.reduce((s, w) => s + w.total, 0)
        const head = ['Worker', 'Dates', 'Days']
        if (hasOT) head.push('OT Hrs', 'OT Amt')
        if (hasDeductions) head.push('Deductions')
        head.push('Total')

        autoTable(doc, {
          startY: curY + 10,
          head: [head],
          body: workers.map(w => {
            const row = [w.name, Array.from(w.dates).join(', '), w.days.toFixed(1)]
            if (hasOT) row.push(w.otHours.toFixed(1), `Rs.${w.otAmount.toLocaleString()}`)
            if (hasDeductions) row.push(`Rs.${w.deductions.toLocaleString()}`)
            row.push(`Rs.${w.total.toLocaleString()}`)
            return row
          }),
          foot: [[...Array(head.length - 2).fill(''), 'WEEK TOTAL', `Rs.${weekTotal.toLocaleString()}`]],
          theme: 'grid',
          headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
          footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
          styles: { cellPadding: 2.5 },
          margin: { left: 14, right: 14 }
        })
        curY = (doc as any).lastAutoTable.finalY + 10
      })

      const grandTotal = attData.reduce((sum, r: any) => {
        const rate = r.custom_rate || r.labour?.daily_rate || 0
        return sum + (Number(r.days_worked || 0) * Number(rate)) + Number(r.overtime_amount || 0) - Number(r.advance_amount || 0)
      }, 0)

      if (curY > 245) { doc.addPage(); drawPremiumHeader(doc, 'WEEKLY LABOUR SUMMARY', `Continued`); curY = 54 }
      doc.setFillColor(...PDF_COLORS.BLUE)
      doc.roundedRect(14, curY, 182, 14, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`GRAND TOTAL: Rs.${grandTotal.toLocaleString()}`, 105, curY + 9, { align: 'center' })

      drawPremiumFooter(doc)
      
      doc.save(`Labour-WeekGrouped-${startDate}-to-${endDate}.pdf`)
      toast.success('Week-grouped PDF exported')
    } catch (e: any) { toast.error(e.message) } finally { setCalculating(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t.payments.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.payments.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
           <Button 
             variant="outline"
             className="border-zinc-800 bg-[#1F2937] text-gray-300 rounded-xl font-bold uppercase tracking-tight px-4 text-xs gap-2"
             onClick={exportWeekGroupedPDF}
             disabled={calculating}
           >
             <FileText size={14} /> Week-Grouped PDF
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
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Worker</label>
                  <select 
                    value={selectedWorkerId}
                    onChange={e => setSelectedWorkerId(e.target.value)}
                    className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl font-bold text-white px-4 outline-none"
                  >
                    <option value="">Choose worker</option>
                    {labourers.map(l => (
                      <option key={l.id} value={l.id}>{l.name} - ₹{l.daily_rate}/day</option>
                    ))}
                  </select>
                </div>
                {selectedWorkerId && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => fetchAdvanceHistory(selectedWorkerId)}
                      className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1"
                      style={{ backgroundColor: '#1a2a4a', color: '#60a5fa', border: '1px solid #2563eb' }}>
                      <History size={10} /> Advance History
                    </button>
                  </div>
                )}

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
                          <p className="text-2xl font-black text-blue-400">₹ {Math.round(previewData.totalPayable).toLocaleString()}</p>
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
                            ₹ {Math.round(previewData.totalPayable - (parseFloat(advanceAmount || '0') || 0)).toLocaleString()}
                          </p>
                       </div>
                    </div>

                    {/* Daily Breakdown Table */}
                    <div className="mt-10 space-y-4">
                       <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Daily Details</p>
                       {/* Desktop Table */}
                       <div className="hidden md:block rounded-xl border border-zinc-800 overflow-hidden">
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

                       {/* Mobile Cards */}
                       <div className="grid grid-cols-1 gap-3 md:hidden">
                         {previewData.breakdown.map((row: any, idx: number) => (
                           <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                             <div className="flex items-center justify-between">
                               <p className="text-xs font-bold text-zinc-400">{row.date}</p>
                               <Badge className={cn("px-3 py-0.5 rounded text-[8px] font-black uppercase border-none", row.status === 'ABSENT' ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-400")}>
                                 {row.status}
                               </Badge>
                             </div>
                             <div className="flex items-center justify-between">
                               <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 truncate max-w-[60%]">{row.project}</p>
                               <p className="text-sm font-black text-blue-400">₹ {row.amount.toLocaleString()}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>

                    <div className="flex gap-3 mt-10">
                      <Button 
                        onClick={handleCreatePayment}
                        className="flex-1 h-14 btn-construction rounded-xl font-black uppercase tracking-tight text-base"
                      >
                        {calculating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={18} />}
                        Mark as Paid
                      </Button>
                      <button
                        type="button"
                        onClick={handleWhatsAppSend}
                        className="h-14 px-5 rounded-xl font-black flex items-center gap-2 text-sm transition-all"
                        style={{ backgroundColor: '#128C7E', color: '#fff' }}
                        title="Send salary slip via WhatsApp">
                        <MessageCircle size={20} /> WhatsApp
                      </button>
                    </div>
                 </Card>
               </motion.div>
             )}

           </AnimatePresence>
        </div>
      </div>

      {/* Advance History Modal */}
      <Dialog open={advHistoryOpen} onOpenChange={setAdvHistoryOpen}>
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Advance History</DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>
              {labourers.find(l => l.id === selectedWorkerId)?.name || 'Worker'} — all advances given on attendance
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {advHistoryLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-blue-400" /></div>
            ) : advHistoryData.length === 0 ? (
              <div className="text-center py-10 text-sm font-bold" style={{ color: '#6b7280' }}>No advances found for this worker</div>
            ) : (
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#0d1018' }}>
                  <tr style={{ borderBottom: '1px solid #1e2435' }}>
                    {['Date', 'Project', 'Advance'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advHistoryData.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e2435' }}>
                      <td className="px-4 py-2.5 text-xs font-bold" style={{ color: '#6b7280' }}>{format(new Date(r.date), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-2.5 text-sm font-bold text-white">{r.projects?.name || '—'}</td>
                      <td className="px-4 py-2.5 font-black text-sm" style={{ color: '#ef4444' }}>₹{Number(r.advance_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#0d1018', borderTop: '1px solid #1e2435' }}>
                    <td colSpan={2} className="px-4 py-3 text-xs font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Total Advance Given</td>
                    <td className="px-4 py-3 font-black" style={{ color: '#ef4444' }}>
                      ₹{advHistoryData.reduce((s, r) => s + Number(r.advance_amount), 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
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
                     <div className="space-y-1">
                       <div className="flex justify-between text-sm text-red-500 font-bold">
                         <span>Advance Deducted</span>
                         <span>- Rs. {(parseFloat(advanceAmount || '0') || 0).toLocaleString()}</span>
                       </div>
                       {/* Show individual advance dates */}
                       {(receiptData.advanceDetails || []).length > 0 && (
                         <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-2 space-y-0.5">
                           <p className="text-[8px] font-bold uppercase text-red-400 tracking-widest mb-1">Advance Breakdown</p>
                           {receiptData.advanceDetails.map((adv: any, i: number) => (
                             <div key={i} className="flex justify-between text-[10px] text-red-400">
                               <span>{format(new Date(adv.date), 'dd MMM yyyy (EEE)')}</span>
                               <span>Rs. {adv.amount.toLocaleString()}</span>
                             </div>
                           ))}
                         </div>
                       )}
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
