'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, FileText, Download, Calculator, Package, Users } from 'lucide-react'
import { toast } from 'sonner'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS, numberToWords } from '@/lib/report-utils'

export default function ExportCalculationPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()

  useEffect(() => { setMounted(true); fetchProjects() }, [])

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*').order('name')
    setProjects(data || [])
  }

  const generateReport = async () => {
    setLoading(true)
    try {
      // 1. Fetch attendance (labour cost)
      let attQuery = supabase.from('attendance').select('*, labour(name, type, daily_rate), projects(name)')
        .gte('date', startDate).lte('date', endDate).order('date', { ascending: true })
      if (selectedProjectId) attQuery = attQuery.eq('project_id', selectedProjectId)
      const { data: attData } = await attQuery

      // 2. Fetch materials
      let matQuery = supabase.from('materials').select('*, projects(name)')
        .gte('date', startDate).lte('date', endDate).order('date', { ascending: true })
      if (selectedProjectId) matQuery = matQuery.eq('project_id', selectedProjectId)
      const { data: matData } = await matQuery

      // Group workers
      const workerMap = new Map()
      attData?.forEach(att => {
        const wid = att.labour_id
        if (!workerMap.has(wid)) {
          workerMap.set(wid, { worker: att.labour, days: 0, gross: 0, advances: 0 })
        }
        const entry = workerMap.get(wid)
        entry.days += Number(att.days_worked)
        const rate = att.custom_rate || att.labour.daily_rate
        entry.gross += (Number(att.days_worked) * Number(rate)) + Number(att.overtime_amount || 0)
        entry.advances += Number(att.advance_amount || 0)
      })

      const workers = Array.from(workerMap.values())
      const totalLabourCost = workers.reduce((a, w) => a + w.gross, 0)
      const totalMaterialCost = (matData || []).reduce((a: number, m: any) => a + Number(m.total_amount || 0), 0)

      setReportData({
        workers,
        materials: matData || [],
        totalLabourCost,
        totalMaterialCost,
        grandTotal: totalLabourCost + totalMaterialCost,
        project: projects.find(p => p.id === selectedProjectId)
      })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = () => {
    if (!reportData) return
    const { workers, materials, totalLabourCost, totalMaterialCost, grandTotal, project } = reportData
    const doc = new jsPDF()

    drawPremiumHeader(doc, 'EXPORT CALCULATION', '(COMBINED REPORT)')

    let y = 54
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold'); doc.text('Project', 14, y); doc.setFont('helvetica', 'normal'); doc.text(`: ${project?.name || 'All Projects'}`, 35, y)
    doc.setFont('helvetica', 'bold'); doc.text('Period', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(`: ${startDate} to ${endDate}`, 35, y + 6)

    // SECTION 1: Labour
    y += 18
    doc.setFillColor(...PDF_COLORS.BLUE)
    doc.roundedRect(14, y, 182, 8, 1, 1, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('SECTION A: LABOUR COST', 18, y + 5.5)
    y += 12

    autoTable(doc, {
      startY: y,
      head: [['S.No', 'Worker Name', 'Role', 'Days', 'Gross (Rs.)']],
      body: workers.map((w: any, i: number) => [
        i + 1, w.worker.name, w.worker.type || '-', w.days.toFixed(1), `Rs. ${w.gross.toLocaleString()}`
      ]),
      foot: [['', '', '', 'TOTAL', `Rs. ${totalLabourCost.toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.NAVY },
      footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT }
    })

    y = (doc as any).lastAutoTable.finalY + 10

    // SECTION 2: Materials
    doc.setFillColor(22, 163, 74)
    doc.roundedRect(14, y, 182, 8, 1, 1, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('SECTION B: MATERIAL COST', 18, y + 5.5)
    y += 12

    autoTable(doc, {
      startY: y,
      head: [['S.No', 'Material', 'Project', 'Date', 'Amount (Rs.)']],
      body: materials.map((m: any, i: number) => [
        i + 1, m.name, m.projects?.name || '-', format(new Date(m.date), 'dd MMM yyyy'), `Rs. ${Number(m.total_amount).toLocaleString()}`
      ]),
      foot: [['', '', '', 'TOTAL', `Rs. ${totalMaterialCost.toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [22, 100, 50], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.NAVY },
      footStyles: { fillColor: [22, 100, 50], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 255, 250] }
    })

    y = (doc as any).lastAutoTable.finalY + 12

    // GRAND TOTAL BOX
    if (y > 250) { doc.addPage(); y = 20 }
    const bW = 60, bH = 22
    // Labour total box
    doc.setFillColor(240, 245, 255); doc.roundedRect(14, y, bW, bH, 1, 1, 'F')
    doc.setTextColor(...PDF_COLORS.NAVY); doc.setFontSize(7); doc.text('Labour Cost', 14 + bW / 2, y + 7, { align: 'center' })
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(`Rs. ${totalLabourCost.toLocaleString()}`, 14 + bW / 2, y + 16, { align: 'center' })
    // Material total box
    doc.setFillColor(240, 255, 245); doc.roundedRect(76, y, bW, bH, 1, 1, 'F')
    doc.setTextColor(...PDF_COLORS.NAVY); doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.text('Material Cost', 76 + bW / 2, y + 7, { align: 'center' })
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(`Rs. ${totalMaterialCost.toLocaleString()}`, 76 + bW / 2, y + 16, { align: 'center' })
    // Grand total box
    doc.setFillColor(...PDF_COLORS.BLUE); doc.roundedRect(138, y, bW, bH, 1, 1, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.text('GRAND TOTAL', 138 + bW / 2, y + 7, { align: 'center' })
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(`Rs. ${grandTotal.toLocaleString()}`, 138 + bW / 2, y + 16, { align: 'center' })

    y += bH + 6
    doc.setTextColor(...PDF_COLORS.NAVY); doc.setFontSize(8); doc.setFont('helvetica', 'italic')
    doc.text(`Amount in Words: ${numberToWords(grandTotal)}`, 14, y)

    drawPremiumFooter(doc)
    doc.save(`Export_Calculation_${startDate}_to_${endDate}.pdf`)
    toast.success('PDF exported')
  }

  if (!mounted) return null

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const DIM = '#6b7280'
  const INPUT_ST: React.CSSProperties = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.75rem' }
  const SC_ST: React.CSSProperties = { backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Export Calculation</h1>
        <p className="mt-1 text-sm" style={{ color: DIM }}>Combined Labour + Material cost report for any period.</p>
      </div>

      {/* Filters */}
      <div style={PANEL} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project</label>
            <Select onValueChange={(v: string | null) => setSelectedProjectId(v ?? '')} value={selectedProjectId}>
              <SelectTrigger className="h-11 rounded-xl font-semibold text-sm" style={INPUT_ST}>
                <SelectValue placeholder="All Projects" items={Object.fromEntries(projects.map(p => [p.id, p.name]))} />
              </SelectTrigger>
              <SelectContent style={SC_ST}>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
          </div>
          <button onClick={generateReport} disabled={loading}
            className="h-11 rounded-xl text-sm font-black uppercase tracking-wide text-[#0a0c12] flex items-center justify-center gap-2"
            style={{ backgroundColor: '#3b82f6', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            Generate
          </button>
        </div>
      </div>

      {/* Report Output */}
      {reportData && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex justify-end gap-3">
            <button onClick={exportPDF}
              className="flex items-center gap-2 px-6 py-3 bg-[#111520] border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-all">
              <FileText size={16} className="text-blue-500" /> Download PDF
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div style={PANEL} className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                  <Users size={20} className="text-blue-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Labour Cost</p>
              </div>
              <p className="text-2xl font-black text-white">₹ {reportData.totalLabourCost.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 mt-1">{reportData.workers.length} workers</p>
            </div>
            <div style={PANEL} className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center border border-emerald-600/20">
                  <Package size={20} className="text-emerald-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Material Cost</p>
              </div>
              <p className="text-2xl font-black text-white">₹ {reportData.totalMaterialCost.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 mt-1">{reportData.materials.length} items</p>
            </div>
            <div className="p-6 rounded-[0.875rem] border border-blue-500/30" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0d1018)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                  <Calculator size={20} className="text-blue-400" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Grand Total</p>
              </div>
              <p className="text-3xl font-black text-white">₹ {reportData.grandTotal.toLocaleString()}</p>
              <p className="text-xs text-blue-300/60 mt-1">Labour + Materials</p>
            </div>
          </div>

          {/* Section A: Labour */}
          <div style={PANEL} className="overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
              <Users size={18} className="text-blue-500" />
              <p className="text-xs font-black uppercase tracking-widest text-white">Section A: Labour Cost</p>
            </div>
            <Table>
              <TableHeader className="bg-zinc-950/50">
                <TableRow className="border-zinc-800">
                  <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500 w-12">#</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Worker</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Role</TableHead>
                  <TableHead className="py-4 text-center text-[10px] font-black uppercase text-zinc-500">Days</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase text-zinc-500 pr-6">Gross (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.workers.map((w: any, i: number) => (
                  <TableRow key={i} className="border-zinc-800/50 hover:bg-white/5 transition-colors">
                    <TableCell className="py-4 text-xs text-zinc-500 font-bold">{i + 1}</TableCell>
                    <TableCell className="py-4 font-bold text-white text-sm">{w.worker.name}</TableCell>
                    <TableCell className="py-4 text-xs text-zinc-400">{w.worker.type || '-'}</TableCell>
                    <TableCell className="py-4 text-center text-xs font-bold text-white">{w.days.toFixed(1)}</TableCell>
                    <TableCell className="py-4 text-right pr-6 font-black text-blue-400 text-sm">₹ {w.gross.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-zinc-800 bg-zinc-950/80">
                  <TableCell colSpan={4} className="py-4 text-right pr-4 font-black text-xs uppercase tracking-widest text-zinc-400">Labour Total</TableCell>
                  <TableCell className="py-4 text-right pr-6 font-black text-blue-400 text-lg">₹ {reportData.totalLabourCost.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Section B: Materials */}
          <div style={PANEL} className="overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
              <Package size={18} className="text-emerald-500" />
              <p className="text-xs font-black uppercase tracking-widest text-white">Section B: Material Cost</p>
            </div>
            <Table>
              <TableHeader className="bg-zinc-950/50">
                <TableRow className="border-zinc-800">
                  <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500 w-12">#</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Material</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Project</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase text-zinc-500">Date</TableHead>
                  <TableHead className="py-4 text-right text-[10px] font-black uppercase text-zinc-500 pr-6">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.materials.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-12 text-center text-zinc-500 text-sm italic">No material records found</TableCell></TableRow>
                ) : reportData.materials.map((m: any, i: number) => (
                  <TableRow key={i} className="border-zinc-800/50 hover:bg-white/5 transition-colors">
                    <TableCell className="py-4 text-xs text-zinc-500 font-bold">{i + 1}</TableCell>
                    <TableCell className="py-4 font-bold text-white text-sm">{m.name}</TableCell>
                    <TableCell className="py-4 text-xs text-zinc-400">{m.projects?.name || '-'}</TableCell>
                    <TableCell className="py-4 text-xs text-zinc-400">{format(new Date(m.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="py-4 text-right pr-6 font-black text-emerald-400 text-sm">₹ {Number(m.total_amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-zinc-800 bg-zinc-950/80">
                  <TableCell colSpan={4} className="py-4 text-right pr-4 font-black text-xs uppercase tracking-widest text-zinc-400">Material Total</TableCell>
                  <TableCell className="py-4 text-right pr-6 font-black text-emerald-400 text-lg">₹ {reportData.totalMaterialCost.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
