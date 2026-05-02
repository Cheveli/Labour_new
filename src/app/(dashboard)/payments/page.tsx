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
  numberToWords
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

  // UI Styles
  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

  useEffect(() => {
    fetchProjects()
  }, [])

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
      .select('*, labour(name, type, daily_rate)')
      .eq('project_id', selectedProjectId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })

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
      .select('*, projects(name), labour(name, type, daily_rate)')
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
      if (att) {
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
  }

  const generatePDF = async (mode: 'download' | 'whatsapp') => {
    const data = await fetchWorkerReportData()
    if (!data) return

    const doc = new jsPDF()
    drawPremiumHeader(doc, 'SALARY SLIP / RECEIPT', '(AUTO-GENERATED)')

    const infoY = 54
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text('Worker Name', 14, infoY); doc.setFont('helvetica', 'normal'); doc.text(`: ${data.worker.name}`, 45, infoY)
    doc.setFont('helvetica', 'bold'); doc.text('Project', 14, infoY + 7); doc.setFont('helvetica', 'normal'); doc.text(`: ${data.project.name}`, 45, infoY + 7)
    doc.setFont('helvetica', 'bold'); doc.text('Period', 120, infoY); doc.setFont('helvetica', 'normal'); doc.text(`: ${data.period}`, 145, infoY)
    doc.setFont('helvetica', 'bold'); doc.text('Role', 120, infoY + 7); doc.setFont('helvetica', 'normal'); doc.text(`: ${data.worker.type || '-'}`, 145, infoY + 7)

    // Daily breakdown table
    const tableBody = data.breakdown.map((row: any) => [
      format(new Date(row.date), 'EEEE (dd MMM)'),
      row.status,
      `Rs. ${row.rate}`,
      `Rs. ${row.wage}`,
      row.ot > 0 ? `Rs. ${row.ot}` : '-',
      row.adv > 0 ? `Rs. ${row.adv}` : '-',
      `Rs. ${row.total}`
    ])

    autoTable(doc, {
      startY: infoY + 16,
      head: [['Date', 'Stat', 'Rate', 'Wage', 'OT', 'Deduction', 'Total']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      styles: { cellPadding: 2.5 },
      didParseCell: (data) => {
        if (data.column.index === 1) { // Stat column
          const val = data.cell.text[0]
          if (val === 'P') data.cell.styles.textColor = [34, 197, 94] // Emerald 500
          else if (val === 'A') data.cell.styles.textColor = [239, 68, 68] // Red 500
          else if (val === 'H') data.cell.styles.textColor = [245, 158, 11] // Amber 500
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    
    // Summary Box
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(120, finalY, 76, 35, 2, 2, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    doc.text('Gross Wage:', 125, finalY + 8); doc.text(`Rs. ${data.totalWage.toLocaleString()}`, 190, finalY + 8, { align: 'right' })
    doc.text('Total Overtime:', 125, finalY + 15); doc.text(`Rs. ${data.totalOt.toLocaleString()}`, 190, finalY + 15, { align: 'right' })
    doc.text('Total Deductions:', 125, finalY + 22); doc.setTextColor(220, 53, 69); doc.text(`Rs. ${data.totalAdv.toLocaleString()}`, 190, finalY + 22, { align: 'right' })
    
    doc.setDrawColor(200, 200, 200); doc.line(125, finalY + 26, 191, finalY + 26)
    doc.setTextColor(...PDF_COLORS.BLUE); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text('NET PAID:', 125, finalY + 31); doc.text(`Rs. ${data.netPayable.toLocaleString()}`, 190, finalY + 31, { align: 'right' })

    doc.setTextColor(...PDF_COLORS.NAVY); doc.setFontSize(8); doc.setFont('helvetica', 'italic')
    doc.text(`Amount in words: ${numberToWords(Math.abs(data.netPayable))}`, 14, finalY + 45)

    if (mode === 'download') {
      doc.save(`${data.worker.name}_Receipt_${format(currentWeekStart, 'dd_MMM')}.pdf`)
      toast.success('Receipt downloaded')
    } else {
      // WhatsApp logic
      const pdfBlob = doc.output('blob')
      const fileName = `Receipt_${data.worker.id}_${Date.now()}.pdf`
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (uploadError) {
        toast.error('Failed to upload PDF for sharing')
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
      
      const message = `*SS CONSTRUCTIONS - PAYMENT SLIP*\n\n` +
                      `👷 *Worker:* ${data.worker.name}\n` +
                      `📅 *Period:* ${data.period}\n` +
                      `💰 *Net Amount:* Rs. ${data.netPayable.toLocaleString()}\n\n` +
                      `View / Download Receipt:\n${publicUrl}\n\n` +
                      `_This is an auto-generated receipt based on attendance records._`
      
      const phone = data.worker.phone?.replace(/\D/g, '') || ''
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, '_blank')
      toast.success('Shared to WhatsApp')
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

    const head = [['#', 'Worker Name', ...weekDays.map(d => format(d, 'EEE (dd)')), 'Days', 'OT', 'Ded', 'Net Total']]
    
    const grandOt = summaryData.reduce((acc, s) => acc + s.totalOt, 0)
    const grandDed = summaryData.reduce((acc, s) => acc + s.totalDed, 0)
    const grandNet = summaryData.reduce((acc, s) => acc + s.net, 0)

    const body = summaryData.map((s, i) => [
      i + 1,
      s.name,
      ...weekDays.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd')
        const day = s.days[dateStr]
        if (!day) {
          return dateStr < s.maxDate ? 'A' : '-'
        }
        return day.status 
      }),
      s.totalDays,
      `Rs.${s.totalOt.toLocaleString()}`,
      `Rs.${s.totalDed.toLocaleString()}`,
      `Rs.${s.net.toLocaleString()}`
    ])

    // Add Grand Total row (Remove Days total as requested)
    body.push([
      '',
      'GRAND TOTAL',
      ...weekDays.map(() => ''),
      '', // Total days removed as requested
      `Rs.${grandOt.toLocaleString()}`,
      `Rs.${grandDed.toLocaleString()}`,
      `Rs.${grandNet.toLocaleString()}`
    ])

    autoTable(doc, {
      startY: 50,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8, cellPadding: 3, textColor: PDF_COLORS.NAVY, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 8 }, // #
        1: { cellWidth: 35, halign: 'left', fontStyle: 'bold' }, // Name
        ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 2, { cellWidth: 18 }])), // Days
        9: { cellWidth: 12 }, // Days count
        10: { cellWidth: 22 }, // OT
        11: { cellWidth: 22 }, // Ded
        12: { cellWidth: 28, halign: 'right', fontStyle: 'bold' } // Net
      },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      didParseCell: (data) => {
        // Attendance columns (indices 2 to 8)
        if (data.column.index >= 2 && data.column.index <= 8 && data.row.index < body.length - 1) {
          const val = data.cell.text[0]
          if (val === 'P') data.cell.styles.textColor = [34, 197, 94]
          else if (val === 'A') data.cell.styles.textColor = [239, 68, 68]
          else if (val === 'H') data.cell.styles.textColor = [245, 158, 11]
          data.cell.styles.fontStyle = 'bold'
        }

        if (data.row.index === body.length - 1) {
          data.cell.styles.fillColor = PDF_COLORS.BLUE;
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { top: 50, left: 10, right: 10, bottom: 20 },
      didDrawPage: (data) => {
        const period = `${format(currentWeekStart, 'dd MMM')} - ${format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'dd MMM yyyy')}`
        drawPremiumHeader(doc, 'WEEKLY LABOUR REGISTER', `${period} (Page ${data.pageNumber})`)
        drawPremiumFooter(doc)
      }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 15
    if (finalY < H - 25) {
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...PDF_COLORS.MUTED)
      doc.text(`Total Amount in Words: ${numberToWords(Math.abs(grandNet))}`, 14, finalY)
    }

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
                        const day = s.days[dateStr]
                        const status = day ? day.status : (dateStr < s.maxDate ? 'A' : '-')
                        
                        return (
                          <td key={d.toISOString()} className="py-3 px-2 text-center align-top">
                            <div className="space-y-0.5">
                              <span className={cn("font-black", status === 'A' ? "text-red-500" : status === '-' ? "text-zinc-700" : "text-emerald-500")}>
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
                      <td className="py-3 px-4 text-right font-black text-blue-400">₹{s.net.toLocaleString()}</td>
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
                        ₹{summaryData.reduce((acc, s) => acc + s.totalOt, 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-2 text-center text-red-200">
                        ₹{summaryData.reduce((acc, s) => acc + s.totalDed, 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right text-white">
                        ₹{summaryData.reduce((acc, s) => acc + s.net, 0).toLocaleString()}
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
                      <p className="text-sm font-black text-blue-400">₹{s.net.toLocaleString()}</p>
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
                        <p className="text-[8px] font-bold text-blue-100">OT: ₹{summaryData.reduce((acc, s) => acc + s.totalOt, 0).toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-blue-100">DED: ₹{summaryData.reduce((acc, s) => acc + s.totalDed, 0).toLocaleString()}</p>
                      </div>
                      <p className="text-xl font-black text-white">₹{summaryData.reduce((acc, s) => acc + s.net, 0).toLocaleString()}</p>
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
