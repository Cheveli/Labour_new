'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Loader2, 
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageCircle,
  Printer,
  Download
} from 'lucide-react'
import { format, eachDayOfInterval, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { 
  drawPremiumHeader, 
  drawPremiumFooter,
  PDF_COLORS, 
  numberToWords,
  COMPANY_DETAILS
} from '@/lib/report-utils'

export default function PaymentsPage() {
  const supabase = createClient()

  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }))
  
  const [viewMode, setViewMode] = useState<'individual' | 'summary'>('individual')
  const [summaryData, setSummaryData] = useState<any[]>([])
  
  const [availableWorkers, setAvailableWorkers] = useState<any[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [workerData, setWorkerData] = useState<any>(null)
  const [bandDaysSet, setBandDaysSet] = useState<Set<string>>(new Set())

  // UI Styles
  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    const handleDownload = () => generatePDF('download')
    const handleToggleMode = () => setViewMode(prev => prev === 'individual' ? 'summary' : 'individual')
    
    window.addEventListener('ssc_payments_download_pdf', handleDownload)
    window.addEventListener('ssc_payments_toggle_mode', handleToggleMode)
    
    return () => {
      window.removeEventListener('ssc_payments_download_pdf', handleDownload)
      window.removeEventListener('ssc_payments_toggle_mode', handleToggleMode)
    }
  }, [selectedWorkerId, selectedProjectId, currentWeekStart])

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*').order('name')
    setProjects(data || [])
    if (data && data.length > 0) setSelectedProjectId(data[0].id)
  }

  // Fetch workers who have attendance in this week/project
  useEffect(() => {
    if (selectedProjectId) {
      fetchAvailableWorkers()
    }
  }, [selectedProjectId, currentWeekStart])

  async function fetchAvailableWorkers() {
    setLoading(true)
    const startStr = format(currentWeekStart, 'yyyy-MM-dd')
    const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('attendance')
      .select('*, labour(name, type, daily_rate, phone)')
      .eq('project_id', selectedProjectId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })

    const { data: bandData } = await supabase
      .from('project_day_status')
      .select('*')
      .eq('project_id', selectedProjectId)
      .eq('status', 'BAND')
      .gte('date', startStr)
      .lte('date', endStr)
      
    const bandSet = new Set<string>(bandData?.map((b: any) => b.date) || [])
    setBandDaysSet(bandSet)


    if (data) {
      // Unique workers for dropdown
      const unique = new Map()
      const summaryMap = new Map()
      
      data.forEach((r: any) => {
        if (r.labour) {
          unique.set(r.labour_id, r.labour)
          
          // Group for summary
          if (!summaryMap.has(r.labour_id)) {
            summaryMap.set(r.labour_id, {
              id: r.labour_id,
              name: r.labour.name,
              type: r.labour.type,
              rate: r.custom_rate || r.labour.daily_rate || 0,
              days: {},
              maxDate: r.date,
              totalDays: 0,
              totalOt: 0,
              totalDed: 0,
              net: 0
            })
          }
          const s = summaryMap.get(r.labour_id)
          if (r.date > s.maxDate) s.maxDate = r.date
          const daysWorked = Number(r.days_worked || 0)
          const ot = Number(r.overtime_amount || 0)
          const ded = Number(r.advance_amount || 0)
          
          s.days[r.date] = { status: daysWorked === 1 ? 'P' : daysWorked === 0.5 ? 'H' : 'A', ded, ot }
          s.totalDays += daysWorked
          s.totalOt += ot
          s.totalDed += ded
        }
      })

      const list = Array.from(unique.values()).map((l, idx) => ({
        id: Array.from(unique.keys())[idx],
        ...l
      }))
      setAvailableWorkers(list)
      
      const summaryList = Array.from(summaryMap.values()).map(s => ({
        ...s,
        net: (s.totalDays * s.rate) + s.totalOt - s.totalDed
      }))
      setSummaryData(summaryList)

      if (list.length > 0 && !selectedWorkerId) setSelectedWorkerId(list[0].id)
    }
    setLoading(false)
  }

  // Fetch full data for the selected worker to generate PDF
  async function fetchWorkerReportData() {
    if (!selectedWorkerId || !selectedProjectId) return null
    setPdfLoading(true)
    
    const startStr = format(currentWeekStart, 'yyyy-MM-dd')
    const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')

    const { data: attData } = await supabase
      .from('attendance')
      .select('*, projects(name), labour(name, type, daily_rate, phone)')
      .eq('labour_id', selectedWorkerId)
      .eq('project_id', selectedProjectId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })

    if (!attData || attData.length === 0) {
      setPdfLoading(false)
      toast.error('No attendance found for this worker in the selected week.')
      return null
    }

    const worker = attData[0].labour
    const project = attData[0].projects
    const maxDate = attData.reduce((max, r) => r.date > max ? r.date : max, attData[0].date)
    const days = eachDayOfInterval({ 
      start: currentWeekStart, 
      end: endOfWeek(currentWeekStart, { weekStartsOn: 0 }) 
    })

    const breakdown = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const att = attData.find(a => a.date === dateStr)
      const rate = att?.custom_rate || worker.daily_rate || 0
      const daysWorked = Number(att?.days_worked || 0)
      const otAmt = Number(att?.overtime_amount || 0)
      const advAmt = Number(att?.advance_amount || 0)
      
      let status = '-'
      if (bandDaysSet.has(dateStr)) {
        status = 'B'
      } else if (att) {
        status = daysWorked === 1 ? 'P' : daysWorked === 0.5 ? 'H' : 'A'
      } else if (dateStr < maxDate) {
        status = 'A'
      }

      return {
        date: dateStr,
        status,
        daysWorked,
        rate,
        wage: daysWorked * rate,
        ot: otAmt,
        adv: advAmt,
        total: (daysWorked * rate) + otAmt - advAmt,
        notes: att?.notes || ''
      }
    })

    const result = {
      worker,
      project,
      breakdown,
      period: `${format(currentWeekStart, 'dd MMM')} - ${format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'dd MMM yyyy')}`,
      totalWage: breakdown.reduce((acc, curr) => acc + curr.wage, 0),
      totalOt: breakdown.reduce((acc, curr) => acc + curr.ot, 0),
      totalAdv: breakdown.reduce((acc, curr) => acc + curr.adv, 0),
      netPayable: breakdown.reduce((acc, curr) => acc + curr.total, 0)
    }
    setPdfLoading(false)
    return result
  }  const generatePDF = async (mode: 'download' | 'whatsapp') => {
    const data = await fetchWorkerReportData()
    if (!data) return

    const hasOT = (data.totalOt || 0) > 0
    const tableHeight = (data.breakdown.length + 1) * 8.5
    const summaryBoxH = hasOT ? 42 : 35
    const detailsHeight = 22
    const requiredHeight = 44 + detailsHeight + tableHeight + 10 + summaryBoxH + 18 + 24 + 10 + 14
    const pageHeight = Math.max(160, requiredHeight)

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [210, pageHeight]
    })
    drawPremiumHeader(doc, 'SALARY SLIP / RECEIPT', '(AUTO-GENERATED)')

    // ── Worker Details Table (Tabular Form) ──────────────────
    autoTable(doc, {
      startY: 52,
      head: [],
      body: [
        ['Worker Name', data.worker.name, 'Period', data.period],
        ['Project', data.project.name, 'Role', data.worker.type || '-']
      ],
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: PDF_COLORS.NAVY,
        lineColor: [210, 215, 225],
        lineWidth: 0.15
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [243, 246, 253], cellWidth: 30 },
        1: { cellWidth: 61 },
        2: { fontStyle: 'bold', fillColor: [243, 246, 253], cellWidth: 30 },
        3: { cellWidth: 61 }
      },
      margin: { left: 14, right: 14 }
    })

    const detailsEndY = (doc as any).lastAutoTable.finalY

    // Daily breakdown table (Date, Status, Wages on the day, OT Amount, Reductions, Giveable Amount, Grand Total)
    const tableBody = data.breakdown.map((row: any) => {
      const r = [
        format(new Date(row.date), 'EEEE (dd MMM)'),
        row.status,
        `Rs. ${(row.wage || 0).toLocaleString('en-IN')}`
      ]
      if (hasOT) {
        r.push(row.ot > 0 ? `Rs. ${(row.ot || 0).toLocaleString('en-IN')}` : '-')
      }
      r.push(
        row.adv > 0 ? `Rs. ${(row.adv || 0).toLocaleString('en-IN')}` : '-',
        `Rs. ${(row.total || 0).toLocaleString('en-IN')}`,
        `Rs. ${(row.wage + row.ot || 0).toLocaleString('en-IN')}`
      )
      return r
    })

    const head = hasOT 
      ? [['Date', 'Stat', 'Wages on the day', 'OT Amount', 'Deduction', 'Giveable Amount', 'Grand Total']]
      : [['Date', 'Stat', 'Wages on the day', 'Deduction', 'Giveable Amount', 'Grand Total']]

    autoTable(doc, {
      startY: detailsEndY + 8,
      head: head,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      styles: { cellPadding: 2.5 },
      didDrawPage: (pageData) => {
        if (pageData.pageNumber > 1) {
          drawPremiumHeader(doc, 'SALARY SLIP / RECEIPT (CONT.)', '(AUTO-GENERATED)')
        }
        drawPremiumFooter(doc)
      },
      margin: { top: 50, left: 14, right: 14, bottom: 20 },
      didParseCell: (cellData) => {
        const deductionColIdx = hasOT ? 4 : 3
        const giveableColIdx = hasOT ? 5 : 4
        const grandTotalColIdx = hasOT ? 6 : 5
        if (cellData.section === 'body') {
          if (cellData.column.index === 1) { // Stat column
            const val = cellData.cell.text[0]
            if (val === 'P') cellData.cell.styles.textColor = [34, 197, 94] // Emerald 500
            else if (val === 'A') cellData.cell.styles.textColor = [239, 68, 68] // Red 500
            else if (val === 'H') cellData.cell.styles.textColor = [245, 158, 11] // Amber 500
            else if (val === 'B') cellData.cell.styles.textColor = [161, 161, 170] // Zinc 400
            cellData.cell.styles.fontStyle = 'bold'
          }
          if (cellData.column.index === deductionColIdx) {
            const val = cellData.cell.text[0]
            if (val && val !== '-') {
              cellData.cell.styles.textColor = PDF_COLORS.RED
              cellData.cell.styles.fontStyle = 'bold'
            }
          }
          if (cellData.column.index === giveableColIdx) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.textColor = PDF_COLORS.GREEN
          }
          if (cellData.column.index === grandTotalColIdx) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.textColor = PDF_COLORS.BLUE
          }
        }
      }
    })

    let finalY = (doc as any).lastAutoTable.finalY + 10
    const H = doc.internal.pageSize.getHeight()

    // Add new page if summary box & signatures don't fit
    if (finalY + summaryBoxH > H - 25) {
      doc.addPage()
      drawPremiumHeader(doc, 'SALARY SLIP / RECEIPT (CONT.)', '(STATEMENT)')
      drawPremiumFooter(doc)
      finalY = 50
    }

    // ── Payment Summary Table (Tabular Form) ──────────────────
    const totalDays = data.breakdown.reduce((acc: number, curr: any) => acc + curr.daysWorked, 0)
    const rate = data.worker.daily_rate || 0
    const summaryGross = data.totalWage + data.totalOt

    const summaryBody = [
      [
        'Wages Calculation',
        `${totalDays} days × Rs. ${rate.toLocaleString('en-IN')}`,
        `Rs. ${(totalDays * rate).toLocaleString('en-IN')}`
      ]
    ]

    if (hasOT) {
      summaryBody.push([
        'Overtime Payout',
        '-',
        `Rs. ${data.totalOt.toLocaleString('en-IN')}`
      ])
    }

    summaryBody.push([
      'Less: Advance / Deduction',
      '-',
      `- Rs. ${data.totalAdv.toLocaleString('en-IN')}`
    ])

    summaryBody.push([
      'NET PAYABLE',
      '-',
      `Rs. ${data.netPayable.toLocaleString('en-IN')}`
    ])

    autoTable(doc, {
      startY: finalY,
      head: [[{ content: 'PAYMENT SUMMARY', colSpan: 3, styles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8.5 } }]],
      body: summaryBody,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: PDF_COLORS.NAVY,
        lineColor: [210, 215, 225],
        lineWidth: 0.15
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 50, halign: 'center' as const },
        2: { cellWidth: 52, halign: 'right' as const }
      },
      margin: { left: 14, right: 14 },
      didParseCell: (cellData) => {
        if (cellData.section === 'body') {
          const rowText = cellData.row.cells[0]?.text[0] || ''
          if (rowText.includes('Less:')) {
            cellData.cell.styles.textColor = PDF_COLORS.RED
            cellData.cell.styles.fontStyle = 'bold'
          } else if (rowText.includes('NET PAYABLE')) {
            cellData.cell.styles.textColor = PDF_COLORS.GREEN
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.fontSize = 9.5
          } else {
            if (cellData.column.index === 0) {
              cellData.cell.styles.fontStyle = 'bold'
            }
          }
        }
      }
    })

    const summaryEndY = (doc as any).lastAutoTable.finalY

    doc.setTextColor(...PDF_COLORS.NAVY); doc.setFontSize(8); doc.setFont('helvetica', 'italic')
    doc.text(`Amount in words: ${numberToWords(Math.abs(data.netPayable))}`, 14, summaryEndY + 6)

    // Legends
    let legendY = summaryEndY + 14
    let legendX = 14
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    
    // B - Band Day
    doc.setTextColor(161, 161, 170)
    doc.text('B', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Band Day', legendX + 3, legendY)
    
    // P - Present
    legendX += 25
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 197, 94)
    doc.text('P', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Present', legendX + 3, legendY)
    
    // H - Half Day
    legendX += 25
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(245, 158, 11)
    doc.text('H', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Half Day', legendX + 3, legendY)
    
    // A - Absent
    legendX += 25
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(239, 68, 68)
    doc.text('A', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Absent', legendX + 3, legendY)

    // Signatory Area
    const sigY = H - 48
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8)
    doc.text('FOR ' + COMPANY_DETAILS.name, 160, sigY + 5, { align: 'center' })

    doc.setFont('times', 'italic')
    doc.setFontSize(12)
    doc.text(COMPANY_DETAILS.contractorRaw, 160, sigY + 16, { align: 'center' })
    doc.line(140, sigY + 18, 180, sigY + 18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7); doc.text('Authorized Signatory', 160, sigY + 22, { align: 'center' })

    drawPremiumFooter(doc)

    if (mode === 'download') {
      doc.save(`${data.worker.name}_Receipt_${format(currentWeekStart, 'dd_MMM')}.pdf`)
      toast.success('Receipt downloaded')
    } else {
      // Create PDF file object
      const pdfBlob = doc.output('blob')
      const fileName = `${data.worker.name.replace(/\s+/g, '_')}_Receipt_${format(currentWeekStart, 'dd_MMM')}.pdf`
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

      const totalDays = data.breakdown.reduce((acc: number, curr: any) => acc + curr.daysWorked, 0)
      const rate = data.worker.daily_rate || 0
      const wageText = `${totalDays} days × ₹${rate} = ₹${(totalDays * rate).toLocaleString('en-IN')}`
      const grandTotal = (totalDays * rate) + data.totalOt
      
      let phone = data.worker.phone || ''
      phone = phone.replace(/\D/g, '')
      if (phone.startsWith('0') && phone.length === 11) {
        phone = phone.substring(1)
      }
      if (phone.length === 10) {
        phone = '91' + phone
      }

      // 1. Try native Web Share API first so the user can send the actual PDF document directly (Option A)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          const shareMsg = `*SS CONSTRUCTIONS - PAYMENT SLIP*\n\n` +
                           `👷 *Worker:* ${data.worker.name}\n` +
                           `📅 *Period:* ${data.period}\n\n` +
                           `*Overview:*\n` +
                           `- Work: ${wageText}\n` +
                           (data.totalOt > 0 ? `- Overtime: ₹${data.totalOt.toLocaleString('en-IN')}\n` : '') +
                           (data.totalAdv > 0 ? `- Advance/Deduction: -₹${data.totalAdv.toLocaleString('en-IN')}\n` : '') +
                           `- Grand Total: ₹${grandTotal.toLocaleString('en-IN')}\n` +
                           `*Net Payable:* *₹${data.netPayable.toLocaleString('en-IN')}*\n\n` +
                           `_Please find the detailed PDF receipt attached._`

          await navigator.share({
            files: [file],
            title: `${data.worker.name} Payment Receipt`,
            text: shareMsg
          })
          toast.success('Opened share options')
          return
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Web Share failed, falling back:', err)
          } else {
            return // User cancelled the share dialog
          }
        }
      }

      // 2. Fallback: If Web Share is not supported by the browser (e.g. Desktop Chrome):
      // Download the PDF file directly, then open the targeted WhatsApp chat.
      doc.save(fileName)

      if (phone) {
        toast.info('Receipt PDF downloaded. Opening WhatsApp chat... Please attach the PDF.')
        const message = `*SS CONSTRUCTIONS - PAYMENT SLIP*\n\n` +
                        `👷 *Worker:* ${data.worker.name}\n` +
                        `📅 *Period:* ${data.period}\n\n` +
                        `*Overview:*\n` +
                        `- Work: ${wageText}\n` +
                        (data.totalOt > 0 ? `- Overtime: ₹${data.totalOt.toLocaleString('en-IN')}\n` : '') +
                        (data.totalAdv > 0 ? `- Advance/Deduction: -₹${data.totalAdv.toLocaleString('en-IN')}\n` : '') +
                        `- Grand Total: ₹${grandTotal.toLocaleString('en-IN')}\n` +
                        `*Net Payable:* *₹${data.netPayable.toLocaleString('en-IN')}*\n\n` +
                        `_Please attach the downloaded PDF receipt below._`

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
      } else {
        toast.error('No phone number registered for this worker, and native sharing is not supported by your browser. PDF downloaded.')
      }
    }
  }

  const generateSummaryPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4')
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()

    const weekDays = eachDayOfInterval({ 
      start: currentWeekStart, 
      end: endOfWeek(currentWeekStart, { weekStartsOn: 0 }) 
    })

    const hasOT = summaryData.some(s => s.totalOt > 0)

    const head = hasOT
      ? [['#', 'Worker Name', ...weekDays.map(d => format(d, 'EEE (dd)')), 'Days', 'OT Amount', 'Deduction', 'Giveable Amount', 'Grand Total']]
      : [['#', 'Worker Name', ...weekDays.map(d => format(d, 'EEE (dd)')), 'Days', 'Deduction', 'Giveable Amount', 'Grand Total']]
    
    const grandOt = summaryData.reduce((acc, s) => acc + s.totalOt, 0)
    const grandDed = summaryData.reduce((acc, s) => acc + s.totalDed, 0)
    const grandNet = summaryData.reduce((acc, s) => acc + s.net, 0)
    const grandGross = summaryData.reduce((acc, s) => acc + (s.totalDays * s.rate + s.totalOt), 0)

    const body = summaryData.map((s, i) => {
      const row = [
        i + 1,
        s.name,
        ...weekDays.map(d => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const isBandDay = bandDaysSet.has(dateStr)
          if (isBandDay) return 'B'
          
          const day = s.days[dateStr]
          if (!day) {
            return dateStr < s.maxDate ? 'A' : '-'
          }
          return day.status 
        }),
        s.totalDays,
      ]
      if (hasOT) {
        row.push(`Rs. ${s.totalOt.toLocaleString('en-IN')}`)
      }
      row.push(
        `Rs. ${s.totalDed.toLocaleString('en-IN')}`,
        `Rs. ${s.net.toLocaleString('en-IN')}`,
        `Rs. ${(s.totalDays * s.rate + s.totalOt).toLocaleString('en-IN')}`
      )
      return row
    })

    // Add Grand Total row (Remove Days total as requested)
    const grandTotalRow = [
      '',
      'GRAND TOTAL',
      ...weekDays.map(() => ''),
      '', // Total days removed as requested
    ]
    if (hasOT) {
      grandTotalRow.push(`Rs. ${grandOt.toLocaleString('en-IN')}`)
    }
    grandTotalRow.push(
      `Rs. ${grandDed.toLocaleString('en-IN')}`,
      `Rs. ${grandNet.toLocaleString('en-IN')}`,
      `Rs. ${grandGross.toLocaleString('en-IN')}`
    )
    body.push(grandTotalRow)

    const columnStyles: any = {
      0: { cellWidth: 8 }, // #
      1: { halign: 'left', fontStyle: 'bold' }, // Name
      ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 2, { cellWidth: 16 }])), // Days
      9: { cellWidth: 12 }, // Days count
    }
    if (hasOT) {
      columnStyles[10] = { cellWidth: 20 } // OT
      columnStyles[11] = { cellWidth: 20 } // Ded
      columnStyles[12] = { cellWidth: 26, halign: 'right', fontStyle: 'bold' } // Net
      columnStyles[13] = { cellWidth: 26, halign: 'right', fontStyle: 'bold' } // Gross
    } else {
      columnStyles[10] = { cellWidth: 24 } // Ded
      columnStyles[11] = { cellWidth: 28, halign: 'right', fontStyle: 'bold' } // Net
      columnStyles[12] = { cellWidth: 28, halign: 'right', fontStyle: 'bold' } // Gross
    }

    autoTable(doc, {
      startY: 50,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8, cellPadding: 3, textColor: PDF_COLORS.NAVY, halign: 'center' },
      columnStyles,
      alternateRowStyles: { fillColor: [248, 250, 255] },
      didParseCell: (cellData) => {
        // Attendance columns (indices 2 to 8)
        if (cellData.column.index >= 2 && cellData.column.index <= 8 && cellData.row.index < body.length - 1) {
          const val = cellData.cell.text[0]
          if (val === 'P') cellData.cell.styles.textColor = [34, 197, 94]
          else if (val === 'A') cellData.cell.styles.textColor = [239, 68, 68]
          else if (val === 'H') cellData.cell.styles.textColor = [245, 158, 11]
          else if (val === 'B') cellData.cell.styles.textColor = [161, 161, 170]
          cellData.cell.styles.fontStyle = 'bold'
        }

        const grandTotalIdx = hasOT ? 13 : 12
        const giveableIdx = hasOT ? 12 : 11
        const deductionIdx = hasOT ? 11 : 10

        if (cellData.section === 'body' && cellData.row.index < body.length - 1) {
          if (cellData.column.index === deductionIdx) {
            const val = cellData.cell.text[0]
            if (val && val !== 'Rs. 0' && val !== 'Rs.0' && !val.includes('Rs. 0') && val !== '-') {
              cellData.cell.styles.textColor = PDF_COLORS.RED
              cellData.cell.styles.fontStyle = 'bold'
            }
          }
          if (cellData.column.index === giveableIdx) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.textColor = PDF_COLORS.GREEN
          }
          if (cellData.column.index === grandTotalIdx) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.textColor = PDF_COLORS.BLUE
          }
        }

        if (cellData.row.index === body.length - 1) {
          cellData.cell.styles.fillColor = PDF_COLORS.BLUE;
          cellData.cell.styles.textColor = 255;
          cellData.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { top: 50, left: 10, right: 10, bottom: 20 },
      didDrawPage: (pageData) => {
        const period = `${format(currentWeekStart, 'dd MMM')} - ${format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'dd MMM yyyy')}`
        drawPremiumHeader(doc, 'WEEKLY LABOUR REGISTER', `${period} (Page ${pageData.pageNumber})`)
        drawPremiumFooter(doc)
      }
    })

    let finalY = (doc as any).lastAutoTable.finalY + 10

    if (finalY > H - 35) {
      doc.addPage()
      drawPremiumHeader(doc, 'WEEKLY LABOUR REGISTER (CONT.)', 'SIGNATURE PAGE')
      drawPremiumFooter(doc)
      finalY = 55
    }

    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...PDF_COLORS.MUTED)
    doc.text(`Total Amount in Words: ${numberToWords(Math.abs(grandNet))}`, 14, finalY)

    // Legends
    let legendY = finalY + 8
    let legendX = 14
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    
    // B - Band Day
    doc.setTextColor(161, 161, 170)
    doc.text('B', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Band Day', legendX + 3, legendY)
    
    // P - Present
    legendX += 25
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 197, 94)
    doc.text('P', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Present', legendX + 3, legendY)
    
    // H - Half Day
    legendX += 25
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(245, 158, 11)
    doc.text('H', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Half Day', legendX + 3, legendY)
    
    // A - Absent
    legendX += 25
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(239, 68, 68)
    doc.text('A', legendX, legendY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text(' - Absent', legendX + 3, legendY)

    // Signatory Area in Weekly Register
    let sigY = legendY + 15
    if (sigY > H - 35) {
      doc.addPage()
      drawPremiumHeader(doc, 'WEEKLY LABOUR REGISTER (CONT.)', 'SIGNATURE PAGE')
      drawPremiumFooter(doc)
      sigY = 55
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8)
    doc.text('FOR ' + COMPANY_DETAILS.name, 245, sigY + 5, { align: 'center' })

    doc.setFont('times', 'italic')
    doc.setFontSize(12)
    doc.text(COMPANY_DETAILS.contractorRaw, 245, sigY + 16, { align: 'center' })
    doc.line(225, sigY + 18, 265, sigY + 18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7); doc.text('Authorized Signatory', 245, sigY + 22, { align: 'center' })

    drawPremiumFooter(doc)
    doc.save(`Weekly_Register_${format(currentWeekStart, 'dd_MMM')}.pdf`)
  }
  const weekDates = useMemo(() => {
    return eachDayOfInterval({ 
      start: currentWeekStart, 
      end: endOfWeek(currentWeekStart, { weekStartsOn: 0 }) 
    })
  }, [currentWeekStart])

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-white tracking-tight">WEEKLY SALARY RECEIPTS</h1>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Generate and share worker receipts based on attendance</p>
      </div>

      <div style={PANEL} className="p-8 space-y-8 shadow-2xl border-blue-500/10">
        {/* Toggle Mode */}
        <div className="flex justify-center">
          <div className="bg-[#0d1018] p-1 rounded-xl border border-[#1e2435] flex gap-1">
            <button 
              onClick={() => setViewMode('individual')}
              className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", viewMode === 'individual' ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-white")}
            >
              Individual Receipt
            </button>
            <button 
              onClick={() => setViewMode('summary')}
              className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", viewMode === 'summary' ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-white")}
            >
              Weekly Summary
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Project Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Select Project</label>
            <select 
              value={selectedProjectId} 
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full h-12 px-4 rounded-xl text-sm font-bold outline-none appearance-none cursor-pointer"
              style={INPUT_ST}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Week Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Select Week</label>
            <div className="flex items-center gap-2 bg-[#0d1018] rounded-xl border border-[#1e2435] p-1 h-12">
              <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 text-center text-xs font-black uppercase tracking-widest text-white">
                {format(currentWeekStart, 'dd MMM')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'dd MMM yyyy')}
              </div>
              <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'individual' ? (
          <>
            {/* Worker Selector */}
            <div className="space-y-3 pt-4 border-t border-[#1e2435]">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Worker List (Present this week)</label>
                {loading && <Loader2 size={14} className="animate-spin text-blue-500 mb-1" />}
              </div>
              
              <select 
                value={selectedWorkerId}
                onChange={e => setSelectedWorkerId(e.target.value)}
                disabled={availableWorkers.length === 0}
                className="w-full h-14 px-5 rounded-xl text-lg font-black outline-none appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ ...INPUT_ST, color: availableWorkers.length > 0 ? '#fff' : '#444' }}
              >
                {availableWorkers.length === 0 ? (
                  <option value="">No workers found for this week</option>
                ) : (
                  availableWorkers.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                  ))
                )}
              </select>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <button 
                onClick={() => generatePDF('download')}
                disabled={!selectedWorkerId || pdfLoading}
                className="h-14 rounded-xl flex items-center justify-center gap-3 bg-[#1a1f2e] text-white font-black uppercase text-xs tracking-widest border border-[#1e2435] hover:bg-[#23293b] transition-all disabled:opacity-30 shadow-lg"
              >
                {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                Download PDF
              </button>
              
              <button 
                onClick={() => generatePDF('whatsapp')}
                disabled={!selectedWorkerId || pdfLoading}
                className="h-14 rounded-xl flex items-center justify-center gap-3 bg-emerald-600 text-white font-black uppercase text-xs tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-30 shadow-lg shadow-emerald-500/20"
              >
                {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                Share on WhatsApp
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-6 pt-4 border-t border-[#1e2435]">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Weekly Register Summary</p>
              <button onClick={generateSummaryPDF} className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase text-white hover:bg-blue-500 transition-all">
                <Printer size={14} /> Export Register PDF
              </button>
            </div>
            
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto border border-[#1e2435] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0d1018] text-zinc-500">
                  <tr>
                    <th className="py-3 px-4 font-black uppercase sticky left-0 bg-[#0d1018]">Worker</th>
                    {weekDates.map(d => (
                      <th key={d.toISOString()} className="py-3 px-2 font-black uppercase text-center min-w-[50px]">
                        {format(d, 'EEE')}<br/>{format(d, 'dd')}
                      </th>
                    ))}
                    <th className="py-3 px-2 font-black uppercase text-center">Days</th>
                    <th className="py-3 px-2 font-black uppercase text-center">OT</th>
                    <th className="py-3 px-2 font-black uppercase text-center">Ded</th>
                    <th className="py-3 px-4 font-black uppercase text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2435]">
                  {summaryData.map(s => (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold text-white sticky left-0 bg-[#111520]">{s.name}</td>
                      {weekDates.map(d => {
                        const dateStr = format(d, 'yyyy-MM-dd')
                        const isBandDay = bandDaysSet.has(dateStr)
                        const day = s.days[dateStr]
                        const status = isBandDay ? 'B' : (day ? day.status : (dateStr < s.maxDate ? 'A' : '-'))
                        
                        return (
                          <td key={d.toISOString()} className="py-3 px-2 text-center align-top">
                            <div className="space-y-0.5">
                              <span className={cn("font-black", status === 'A' ? "text-red-500" : status === '-' ? "text-zinc-700" : status === 'B' ? "text-zinc-500" : "text-emerald-500")}>
                                {status}
                              </span>
                              {day?.ot > 0 && <p className="text-[8px] font-bold text-amber-500 leading-none">+{day.ot}</p>}
                              {day?.ded > 0 && <p className="text-[8px] font-bold text-red-500 leading-none">{day.ded}</p>}
                            </div>
                          </td>
                        )
                      })}
                      <td className="py-3 px-2 text-center font-bold text-zinc-400">{s.totalDays}</td>
                      <td className="py-3 px-2 text-center font-bold text-amber-500">{s.totalOt}</td>
                      <td className="py-3 px-2 text-center font-bold text-red-500">{s.totalDed}</td>
                      <td className="py-3 px-4 text-right font-black text-blue-400">₹{s.net.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {summaryData.length > 0 && (
                    <tr className="bg-blue-600 font-black border-t-2 border-blue-400">
                      <td className="py-4 px-4 text-white sticky left-0 bg-blue-600 z-20">GRAND TOTAL</td>
                      {weekDates.map(d => <td key={d.toISOString()} className=""></td>)}
                      <td className="py-4 px-2 text-center text-white">
                        {/* Total days removed as requested */}
                      </td>
                      <td className="py-4 px-2 text-center text-white">
                        ₹{summaryData.reduce((acc, s) => acc + s.totalOt, 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-2 text-center text-red-200">
                        ₹{summaryData.reduce((acc, s) => acc + s.totalDed, 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-4 text-right text-white">
                        ₹{summaryData.reduce((acc, s) => acc + s.net, 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
              {summaryData.map(s => (
                <div key={s.id} style={PANEL} className="p-4 space-y-4">
                  <div className="flex justify-between items-start border-b border-[#1e2435] pb-3">
                    <div>
                      <p className="text-sm font-black text-white">{s.name}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">{s.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase text-zinc-500">Net Payable</p>
                      <p className="text-sm font-black text-blue-400">₹{s.net.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-[#0d1018] p-2 rounded-lg">
                    {weekDates.map(d => {
                      const dateStr = format(d, 'yyyy-MM-dd')
                      const day = s.days[dateStr]
                      const status = day ? day.status : (dateStr < s.maxDate ? 'A' : '-')
                      return (
                        <div key={dateStr} className="flex flex-col items-center gap-1">
                          <span className="text-[7px] font-black text-zinc-600 uppercase">{format(d, 'EE')[0]}</span>
                          <span className={cn("text-[10px] font-black", status === 'A' ? "text-red-500" : status === '-' ? "text-zinc-800" : "text-emerald-500")}>
                            {status}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[8px] font-black uppercase text-zinc-500">Days</p>
                      <p className="text-xs font-bold text-white">{s.totalDays}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-zinc-500">OT</p>
                      <p className="text-xs font-bold text-amber-500">₹{s.totalOt}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase text-zinc-500">Ded</p>
                      <p className="text-xs font-bold text-red-500">₹{s.totalDed}</p>
                    </div>
                  </div>
                </div>
              ))}

              {summaryData.length > 0 && (
                <div className="bg-blue-600 rounded-xl p-4 shadow-lg">
                   <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-2">Grand Total Summary</p>
                   <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold text-blue-100">OT: ₹{summaryData.reduce((acc, s) => acc + s.totalOt, 0).toLocaleString('en-IN')}</p>
                        <p className="text-[8px] font-bold text-blue-100">DED: ₹{summaryData.reduce((acc, s) => acc + s.totalDed, 0).toLocaleString('en-IN')}</p>
                      </div>
                      <p className="text-xl font-black text-white">₹{summaryData.reduce((acc, s) => acc + s.net, 0).toLocaleString('en-IN')}</p>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}

        {availableWorkers.length === 0 && !loading && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">No attendance data found for this week and project.</p>
            <p className="text-[10px] text-amber-500/70 mt-1">Make sure you have marked attendance in the Attendance tab first.</p>
          </div>
        )}
      </div>

      <div className="text-center opacity-30">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Receipts are automatically calculated: (Days × Rate) + OT - Deduction</p>
      </div>
    </div>
  )
}
