'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Download, FileText, Calendar, User, Search } from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, addDays } from 'date-fns'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  drawPremiumHeader, 
  drawPremiumFooter, 
  PDF_COLORS, 
  numberToWords, 
  exportToExcel,
  COMPANY_DETAILS
} from '@/lib/report-utils'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type TabType = 'INDIVIDUAL' | 'PROJECT_WEEKLY' | 'MATERIAL'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('INDIVIDUAL')
  const [projects, setProjects] = useState<any[]>([])
  const [labourers, setLabourers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // Filters
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  // Data
  const [reportData, setReportData] = useState<any>(null)
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
    setStartDate(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    setEndDate(format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  }, [])

  async function fetchData() {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    setProjects(projData || [])
    setLabourers(labData || [])
  }

  const handleGenerate = async () => {
    setLoading(true)
    setReportData(null)
    
    try {
      if (activeTab === 'INDIVIDUAL') {
        if (!selectedWorkerId) {
          toast.error('Please select a worker')
          setLoading(false)
          return
        }
        await fetchIndividualReport()
      } else if (activeTab === 'PROJECT_WEEKLY') {
        if (!selectedProjectId) {
          toast.error('Please select a project')
          setLoading(false)
          return
        }
        await fetchProjectWeeklyReport()
      } else if (activeTab === 'MATERIAL') {
        await fetchMaterialReport()
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchIndividualReport = async () => {
    const worker = labourers.find(l => l.id === selectedWorkerId)
    
    // 1. Fetch attendance
    const { data: attData } = await supabase
      .from('attendance')
      .select('*, projects(name)')
      .eq('labour_id', selectedWorkerId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    // 2. Fetch advances (payments within range that are marked as ADVANCE or just any payment)
    // Actually, usually advances taken during the week are deducted from the weekend payout.
    const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .eq('labour_id', selectedWorkerId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('payment_type', 'ADVANCE')

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
        total: baseWage + otAmount
      }
    })

    const totalDays = attData?.reduce((acc, curr) => acc + Number(curr.days_worked), 0) || 0
    const totalOTAmount = attData?.reduce((acc, curr) => acc + Number(curr.overtime_amount || 0), 0) || 0
    const totalWages = attData?.reduce((acc, att) => {
      const rate = att.custom_rate || worker.daily_rate
      return acc + (Number(att.days_worked) * Number(rate))
    }, 0) || 0
    
    // Sum advances from attendance table + any explicit payments
    const attAdvances = attData?.reduce((acc, att) => acc + Number(att.advance_amount || 0), 0) || 0
    const payAdvances = payData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
    const totalAdvances = attAdvances + payAdvances

    setReportData({
      type: 'INDIVIDUAL',
      worker,
      breakdown: attData?.map(att => {
        const rate = att.custom_rate || worker.daily_rate
        const baseWage = Number(att.days_worked) * Number(rate)
        const otAmount = Number(att.overtime_amount || 0)
        return {
          date: att.date,
          project: att.projects?.name || '—',
          status: att.days_worked === 1 ? 'PRESENT' : att.days_worked === 0.5 ? 'HALF_DAY' : 'ABSENT',
          baseWage,
          overtimeAmount: otAmount,
          advance: Number(att.advance_amount || 0),
          total: baseWage + otAmount,
          notes: att.notes
        }
      }) || [],
      summary: {
        totalDays,
        totalWages,
        totalOTAmount,
        totalAdvances,
        netPayable: totalWages + totalOTAmount - totalAdvances
      }
    })
  }

  const fetchProjectWeeklyReport = async () => {
    const project = projects.find(p => p.id === selectedProjectId)
    
    // Fetch all attendance for this project in range
    const { data: attData } = await supabase
      .from('attendance')
      .select('*, labour(name, type, daily_rate)')
      .eq('project_id', selectedProjectId)
      .gte('date', startDate)
      .lte('date', endDate)

    // Fetch all advances for these workers in this range
    const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_type', 'ADVANCE')
      .gte('date', startDate)
      .lte('date', endDate)

    // Group by worker
    const workerMap = new Map()
    attData?.forEach(att => {
      if (!workerMap.has(att.labour_id)) {
        const workerAdvances = payData?.filter(p => p.labour_id === att.labour_id)
          .reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
        
        workerMap.set(att.labour_id, {
          worker: att.labour,
          attendance: {},
          totals: { days: 0, ot: 0, gross: 0, advances: workerAdvances, net: 0 }
        })
      }
      const entry = workerMap.get(att.labour_id)
      entry.attendance[att.date] = att
      entry.totals.days += Number(att.days_worked)
      entry.totals.ot += Number(att.overtime_amount || 0)
      entry.totals.advances += Number(att.advance_amount || 0)
      const rate = att.custom_rate || att.labour.daily_rate
      entry.totals.gross += (Number(att.days_worked) * Number(rate)) + Number(att.overtime_amount || 0)
    })

    // Calculate final net per worker
    workerMap.forEach(entry => {
      entry.totals.net = entry.totals.gross - entry.totals.advances
    })

    setReportData({
      type: 'PROJECT',
      project,
      days: eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }),
      workers: Array.from(workerMap.values())
    })
  }

  const fetchMaterialReport = async () => {
    let query = supabase.from('materials').select('*, projects(name)').order('date', { ascending: true })
    if (selectedProjectId) query = query.eq('project_id', selectedProjectId)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    
    const { data } = await query
    setReportData({
      type: 'MATERIAL',
      items: data || [],
      project: projects.find(p => p.id === selectedProjectId)
    })
  }

  const exportIndividualPDF = () => {
    if (!reportData) return
    const { worker, breakdown, summary } = reportData
    
    // Calculate Dynamic Height (approximate)
    // Header (44) + Gap (10) + Info (15) + Table (~7 per row) + Summary (30) + Footer (14)
    const tableHeight = (breakdown.length + 1) * 7
    const requiredHeight = 44 + 10 + 15 + tableHeight + 40 + 20 
    const pageHeight = Math.max(297, requiredHeight) // Minimum A4
    
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [210, pageHeight]
    })
    
    drawPremiumHeader(doc, 'LABOUR WEEKLY REPORT', '(INDIVIDUAL)')
    
    let y = 54
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text('Worker Name', 14, y); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.name}`, 40, y)
    doc.setFont('helvetica', 'bold'); doc.text('Role', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.type || 'N/A'}`, 40, y + 6)
    
    doc.setFont('helvetica', 'bold'); doc.text('Date Range', 110, y)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${format(new Date(startDate), 'dd MMM')} - ${format(new Date(endDate), 'dd MMM yyyy')}`, 140, y)
    doc.setFont('helvetica', 'bold'); doc.text('Report Date', 110, y + 6)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${format(new Date(), 'dd MMM yyyy')}`, 140, y + 6)

    autoTable(doc, {
      startY: y + 14,
      head: [['Day', 'Status', 'Basic Wage', 'OT Amount', 'Adv Taken', 'Gross Total', 'Remarks']],
      body: breakdown.map((r: any) => [
        format(new Date(r.date), 'EEEE (dd MMM)'),
        r.status,
        `Rs. ${(r.baseWage || 0).toLocaleString()}`,
        `Rs. ${(r.overtimeAmount || 0).toLocaleString()}`,
        `Rs. ${(r.advance || 0).toLocaleString()}`,
        `Rs. ${(r.total || 0).toLocaleString()}`,
        r.notes || '-'
      ]),
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    
    // Summary Boxes
    const boxW = 45, boxH = 20
    const boxes = [
      { l: 'Gross Amount', v: `Rs. ${(summary.totalWages + summary.totalOTAmount || 0).toLocaleString()}` },
      { l: 'Advances', v: `Rs. ${(summary.totalAdvances || 0).toLocaleString()}` },
      { l: 'NET PAYABLE', v: `Rs. ${(summary.netPayable || 0).toLocaleString()}`, hi: true }
    ]
    
    boxes.forEach((b, i) => {
      const bx = 14 + (i * (boxW + 2))
      if (b.hi) { doc.setFillColor(...PDF_COLORS.BLUE); doc.setTextColor(255, 255, 255) }
      else { doc.setFillColor(240, 245, 255); doc.setTextColor(...PDF_COLORS.NAVY) }
      doc.roundedRect(bx, finalY, boxW, boxH, 1, 1, 'F')
      doc.setFontSize(7); doc.text(b.l, bx + boxW / 2, finalY + 6, { align: 'center' })
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(b.v, bx + boxW / 2, finalY + 14, { align: 'center' })
    })

    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8); doc.text('Amount in Words:', 14, finalY + boxH + 8)
    doc.setFont('helvetica', 'italic'); doc.text(numberToWords(summary.netPayable), 42, finalY + boxH + 8)

    // Dynamic Footer positioning
    doc.setFillColor(...PDF_COLORS.NAVY)
    doc.rect(0, pageHeight - 14, 210, 14, 'F')
    doc.setTextColor(180, 200, 240)
    doc.setFontSize(7); doc.text(`Generated by SS CONSTRUCTIONS - Ph: 9849678296`, 105, pageHeight - 6, { align: 'center' })

    doc.save(`Labour_Report_${worker.name}_${startDate}.pdf`)
  }

  const exportProjectPDF = () => {
    if (!reportData) return
    const { project, days, workers } = reportData
    const doc = new jsPDF({ orientation: 'landscape' })
    
    drawPremiumHeader(doc, 'PROJECT WEEKLY REPORT', '(ALL WORKERS)')
    
    let y = 54
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold'); doc.text('Project Name', 14, y); doc.setFont('helvetica', 'normal'); doc.text(`: ${project?.name || 'All Projects'}`, 40, y)
    doc.setFont('helvetica', 'bold'); doc.text('Week Range', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(`: ${startDate} to ${endDate}`, 40, y + 6)

    const head = [['S.No', 'Worker Name', 'Role', ...days.map((d: any) => format(d, 'EEE (dd)')), 'Days', 'Total (Gross)']]
    const body = workers.map((w: any, i: number) => [
      i + 1,
      w.worker.name,
      w.worker.type || '-',
      ...days.map((d: any) => {
        const att = w.attendance[format(d, 'yyyy-MM-dd')]
        if (!att) return 'A'
        return att.days_worked === 1 ? 'P' : att.days_worked === 0.5 ? 'H' : 'A'
      }),
      w.totals.days.toFixed(1),
      `Rs. ${w.totals.gross.toLocaleString()}`
    ])

    const totalGross = workers.reduce((acc: number, w: any) => acc + w.totals.gross, 0)

    autoTable(doc, {
      startY: y + 14,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      foot: [['', '', '', ...days.map(() => ''), 'TOTAL', `Rs. ${totalGross.toLocaleString()}`]],
      footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 2 && data.column.index < 3 + days.length) {
          if (data.cell.text[0] === 'A') data.cell.styles.textColor = PDF_COLORS.RED
          if (data.cell.text[0] === 'P') data.cell.styles.textColor = PDF_COLORS.GREEN
        }
      }
    })

    drawPremiumFooter(doc)
    doc.save(`Project_Report_${project?.name || 'All'}_${startDate}.pdf`)
  }

  const exportMaterialPDF = () => {
    if (!reportData) return
    const { items, project } = reportData
    const doc = new jsPDF()
    
    drawPremiumHeader(doc, 'MATERIAL COST REPORT', '(DETAILED)')
    
    let y = 54
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold'); doc.text('Project', 14, y); doc.setFont('helvetica', 'normal'); doc.text(`: ${project?.name || 'All Projects'}`, 40, y)
    doc.setFont('helvetica', 'bold'); doc.text('Date Range', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(`: ${startDate} to ${endDate}`, 40, y + 6)

    const total = items.reduce((acc: number, r: any) => acc + Number(r.total_amount || 0), 0)

    autoTable(doc, {
      startY: y + 14,
      head: [['Date', 'Material Name', 'Quantity', 'Unit', 'Rate', 'Total Cost']],
      body: items.map((r: any) => [
        format(new Date(r.date), 'dd MMM yyyy'),
        r.name,
        r.quantity || '-',
        r.unit || '-',
        r.cost_per_unit ? `Rs. ${r.cost_per_unit}` : '-',
        `Rs. ${Number(r.total_amount).toLocaleString()}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE },
      bodyStyles: { fontSize: 8 },
      foot: [['', '', '', '', 'TOTAL COST', `Rs. ${total.toLocaleString()}`]],
      footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold' }
    })

    drawPremiumFooter(doc)
    doc.save(`Material_Report_${startDate}.pdf`)
  }

  const exportExcelWrapper = () => {
    if (!reportData) return
    let rows: any[][] = []
    let fileName = 'Report'
    
    if (activeTab === 'INDIVIDUAL') {
      rows = [
        ['Individual Labour Weekly Report'],
        ['Worker', reportData.worker.name],
        ['Period', `${startDate} to ${endDate}`],
        [],
        ['Date', 'Status', 'Basic Wage', 'OT Amount', 'Total', 'Notes'],
        ...reportData.breakdown.map((r: any) => [r.date, r.status, r.baseWage, r.overtimeAmount, r.total, r.notes])
      ]
      fileName = `Labour_${reportData.worker.name}`
    } else if (activeTab === 'PROJECT_WEEKLY') {
      rows = [
        ['Project Weekly Report'],
        ['Project', reportData.project?.name || 'All'],
        ['Period', `${startDate} to ${endDate}`],
        [],
        ['Worker', 'Type', ...reportData.days.map((d: any) => format(d, 'EEE dd')), 'Total Days', 'Total Amount'],
        ...reportData.workers.map((w: any) => [
          w.worker.name,
          w.worker.type,
          ...reportData.days.map((d: any) => {
            const att = w.attendance[format(d, 'yyyy-MM-dd')]
            return att ? att.days_worked : 0
          }),
          w.totals.days,
          w.totals.amount
        ])
      ]
      fileName = `Project_${reportData.project?.name || 'All'}`
    } else {
      rows = [
        ['Material Report'],
        ['Period', `${startDate} to ${endDate}`],
        [],
        ['Date', 'Material', 'Qty', 'Unit', 'Cost'],
        ...reportData.items.map((r: any) => [r.date, r.name, r.quantity, r.unit, r.total_amount])
      ]
      fileName = 'Materials'
    }
    
    exportToExcel(rows, fileName)
    toast.success('Excel exported')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="h-14 w-14 bg-blue-600 rounded-2xl flex flex-col items-center justify-center text-white font-black leading-none shadow-xl shadow-blue-600/20">
              <span className="text-xl">SS</span>
              <span className="text-[8px] opacity-50">ESTD</span>
           </div>
           <div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">{COMPANY_DETAILS.name}</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500/80">{COMPANY_DETAILS.tagline}</p>
           </div>
        </div>
        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
           {(['INDIVIDUAL', 'PROJECT_WEEKLY', 'MATERIAL'] as TabType[]).map(tab => (
             <button
               key={tab}
               onClick={() => { setActiveTab(tab); setReportData(null); }}
               className={cn(
                 "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                 activeTab === tab ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-zinc-500 hover:text-white"
               )}
             >
               {tab.replace('_', ' ')}
             </button>
           ))}
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-[#111520] border border-zinc-800 rounded-2xl p-8 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Start Date</label>
            <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 text-sm font-bold text-white focus:border-blue-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">End Date</label>
            <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 text-sm font-bold text-white focus:border-blue-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {activeTab === 'INDIVIDUAL' ? 'Select Worker' : 'Select Project'}
            </label>
            {activeTab === 'INDIVIDUAL' ? (
              <Select onValueChange={(v) => setSelectedWorkerId(v ?? '')} value={selectedWorkerId}>
                <SelectTrigger className="h-12 bg-zinc-950 border-zinc-800 rounded-xl font-bold text-white pl-4">
                  <SelectValue placeholder="Choose Worker" items={Object.fromEntries(labourers.map(l => [l.id, l.name]))} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  {labourers.map(l => (
                    <SelectItem key={l.id} value={l.id} className="py-3 font-bold hover:bg-zinc-900 cursor-pointer">{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select onValueChange={(v) => setSelectedProjectId(v ?? '')} value={selectedProjectId}>
                <SelectTrigger className="h-12 bg-zinc-950 border-zinc-800 rounded-xl font-bold text-white pl-4">
                  <SelectValue placeholder="All Projects" items={Object.fromEntries(projects.map(p => [p.id, p.name]))} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  {activeTab === 'MATERIAL' && <SelectItem value="" className="py-3 font-bold hover:bg-zinc-900 cursor-pointer">All Projects</SelectItem>}
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id} className="py-3 font-bold hover:bg-zinc-900 cursor-pointer">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-zinc-950/20 backdrop-blur-[1px] flex items-center justify-center rounded-3xl z-10 min-h-[400px]">
             <div className="bg-[#111520] p-8 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-blue-500" size={48} />
                <p className="text-sm font-black uppercase tracking-widest text-white">Processing Data...</p>
             </div>
          </div>
        )}

        {reportData ? (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex justify-end gap-3">
               <button 
                onClick={activeTab === 'INDIVIDUAL' ? exportIndividualPDF : activeTab === 'PROJECT_WEEKLY' ? exportProjectPDF : exportMaterialPDF}
                className="flex items-center gap-2 px-6 py-3 bg-[#111520] border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-all"
               >
                 <FileText size={16} className="text-blue-500" /> Download PDF
               </button>
               <button 
                onClick={exportExcelWrapper}
                className="flex items-center gap-2 px-6 py-3 bg-[#111520] border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-all"
               >
                 <Download size={16} className="text-emerald-500" /> Export Excel
               </button>
            </div>

            {/* Content Preview */}
            <div className="bg-[#111520] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
              {activeTab === 'INDIVIDUAL' && (
                <div className="p-8 space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-8 gap-6">
                    <div className="flex items-center gap-4">
                       <div className="h-16 w-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-600/20">
                          <User size={32} className="text-blue-500" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Weekly Summary For</p>
                          <h2 className="text-2xl font-black text-white">{reportData.worker.name}</h2>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                       <p className="text-[10px] font-black text-zinc-500 uppercase">Period</p>
                       <p className="text-sm font-bold text-white">{format(new Date(startDate), 'dd MMM')} - {format(new Date(endDate), 'dd MMM yyyy')}</p>
                       <p className="text-[10px] font-black text-zinc-500 uppercase">Role</p>
                       <p className="text-sm font-bold text-zinc-400">{reportData.worker.type || 'N/A'}</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800">
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Date (Day)</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Project</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500 text-center">Status</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500 text-right">Earned</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500 text-right text-red-500">Adv Taken</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.breakdown.map((row: any, i: number) => (
                        <TableRow key={i} className="border-zinc-800/50 hover:bg-white/5 transition-colors">
                          <TableCell className="py-4 font-bold text-white text-xs">
                             {format(new Date(row.date), 'EEEE (dd MMM)')}
                          </TableCell>
                          <TableCell className="py-4 text-xs text-zinc-400">{row.project}</TableCell>
                          <TableCell className="py-4 text-center">
                             <Badge className={cn(
                               "px-2 py-0.5 rounded text-[8px] font-black uppercase border-none",
                               row.status === 'ABSENT' ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-400"
                             )}>
                               {row.status}
                             </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right font-black text-xs text-zinc-200">
                             ₹ {row.total.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-4 text-right font-black text-xs text-red-500">
                             {row.advance > 0 ? `₹ ${row.advance.toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell className="py-4 text-[10px] text-zinc-500 italic max-w-[150px] truncate">
                             {row.notes || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-zinc-800">
                    <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800">
                       <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Wages</p>
                       <p className="text-xl font-black text-white mt-1">₹ {reportData.summary.totalWages.toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800">
                       <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Overtime</p>
                       <p className="text-xl font-black text-white mt-1">₹ {reportData.summary.totalOTAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-red-500/5 p-6 rounded-2xl border border-red-500/10">
                       <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Advances</p>
                       <p className="text-xl font-black text-red-500 mt-1">₹ {reportData.summary.totalAdvances.toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-600 p-6 rounded-2xl border border-blue-500 shadow-lg shadow-blue-600/20">
                       <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Net Payable</p>
                       <p className="text-2xl font-black text-white mt-1">₹ {reportData.summary.netPayable.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'PROJECT_WEEKLY' && (
                <div className="p-0">
                  <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                     <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">{reportData.project?.name || 'All Sites'}</h2>
                        <p className="text-xs font-bold text-zinc-500 mt-1">{startDate} → {endDate}</p>
                     </div>
                     <Badge className="bg-blue-600/10 text-blue-500 border-none font-black px-4 py-1 uppercase text-[10px]">
                        {reportData.workers.length} WORKERS ACTIVE
                     </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-zinc-950/50">
                        <TableRow className="border-zinc-800">
                          <TableHead className="py-4 pl-8 text-[10px] font-black uppercase text-zinc-500 sticky left-0 bg-zinc-950 z-20">Worker Name</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Role</TableHead>
                          {reportData.days.map((d: any) => (
                            <TableHead key={d.toString()} className="py-4 text-center text-[10px] font-black uppercase text-zinc-500 w-12">
                               {format(d, 'EEE')}<br/>{format(d, 'dd')}
                            </TableHead>
                          ))}
                          <TableHead className="py-4 text-center text-[10px] font-black uppercase text-zinc-500">Days</TableHead>
                          <TableHead className="py-4 text-right pr-8 text-[10px] font-black uppercase text-zinc-500">Total (Gross)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.workers.map((w: any, idx: number) => (
                          <TableRow key={idx} className="border-zinc-800/50 hover:bg-white/5 transition-colors">
                            <TableCell className="py-5 pl-8 font-bold text-white text-sm sticky left-0 bg-[#111520] z-10 border-r border-zinc-800">{w.worker.name}</TableCell>
                            <TableCell className="py-5 text-xs text-zinc-500">{w.worker.type || '-'}</TableCell>
                            {reportData.days.map((d: any) => {
                              const att = w.attendance[format(d, 'yyyy-MM-dd')]
                              const status = att ? (att.days_worked === 1 ? 'P' : att.days_worked === 0.5 ? 'H' : 'A') : 'A'
                              return (
                                <TableCell key={d.toString()} className="py-5 text-center">
                                   <span className={cn(
                                     "text-[10px] font-black",
                                     status === 'P' ? "text-emerald-500" : status === 'H' ? "text-amber-500" : "text-zinc-700"
                                   )}>
                                     {status}
                                   </span>
                                </TableCell>
                              )
                            })}
                            <TableCell className="py-5 text-center font-bold text-white text-xs">{w.totals.days.toFixed(1)}</TableCell>
                            <TableCell className="py-5 text-right pr-8 font-black text-blue-400 text-xs leading-none">
                               ₹ {w.totals.gross.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-8 bg-zinc-950/30 flex justify-end items-center gap-4">
                     <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Project Liability (Gross)</p>
                     <p className="text-3xl font-black text-white">₹ {reportData.workers.reduce((acc: number, w: any) => acc + w.totals.gross, 0).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {activeTab === 'MATERIAL' && (
                <div className="p-8 space-y-8">
                   <div className="flex items-center justify-between border-b border-zinc-800 pb-8">
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Material Procurement Report</p>
                        <h2 className="text-2xl font-black text-white">{reportData.project?.name || 'All Projects'}</h2>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Expenditure</p>
                        <p className="text-3xl font-black text-emerald-400">₹ {reportData.items.reduce((acc: number, r: any) => acc + Number(r.total_amount || 0), 0).toLocaleString()}</p>
                     </div>
                   </div>

                   <Table>
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800">
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Date</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Material</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Qty / Unit</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500 text-right">Total Cost</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.items.map((r: any, i: number) => (
                        <TableRow key={i} className="border-zinc-800/50 hover:bg-white/5 transition-colors">
                          <TableCell className="py-4 font-bold text-gray-400 text-xs">
                             {format(new Date(r.date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="py-4 font-black text-white text-xs uppercase tracking-tight">{r.name}</TableCell>
                          <TableCell className="py-4 text-xs text-zinc-500">{r.quantity} {r.unit}</TableCell>
                          <TableCell className="py-4 text-right font-black text-white text-xs leading-none">
                             ₹ {Number(r.total_amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="py-4 text-[10px] text-zinc-500 italic max-w-[200px] truncate">
                             {r.notes || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                   </Table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-32 bg-[#111520] border border-zinc-800 rounded-3xl text-zinc-600 border-dashed">
             <div className="h-20 w-20 bg-zinc-950 rounded-full flex items-center justify-center border border-zinc-800 mb-6">
                <FileText size={40} className="opacity-20" />
             </div>
             <p className="font-black uppercase tracking-widest text-sm text-zinc-500">Select filters and click Generate</p>
             <p className="text-xs text-zinc-600 mt-2">Professional reports for Sri Sai Constructions</p>
          </div>
        )}
      </div>
    </div>
  )
}
