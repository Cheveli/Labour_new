'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Download } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const DIM = '#6b7280'
const GOLD = '#3b82f6'

export default function AttendanceSummaryPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('month')
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [summary, setSummary] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('projects').select('*').order('name').then(({ data }) => setProjects(data || []))
  }, [])

  const applyPeriod = (p: 'week' | 'month' | 'custom') => {
    setPeriod(p)
    if (p === 'week') {
      setStartDate(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
      setEndDate(format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    } else if (p === 'month') {
      setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
    }
  }

  const fetchSummary = async () => {
    setLoading(true)
    let q = supabase.from('attendance').select('*, labour(name, type, daily_rate), projects(name)')
      .gte('date', startDate).lte('date', endDate).order('date', { ascending: true })
    if (selectedProject) q = q.eq('project_id', selectedProject)
    const { data } = await q

    // Group by project → worker type → worker
    const map: Record<string, Record<string, { name: string; type: string; days: number; ot: number; advance: number; wage: number }>> = {}
    ;(data || []).forEach((r: any) => {
      const proj = r.projects?.name || 'Unknown'
      const wid = r.labour_id
      if (!map[proj]) map[proj] = {}
      if (!map[proj][wid]) map[proj][wid] = { name: r.labour?.name || '?', type: r.labour?.type || '?', days: 0, ot: 0, advance: 0, wage: 0 }
      map[proj][wid].days += Number(r.days_worked || 0)
      map[proj][wid].ot += Number(r.overtime_hours || 0)
      map[proj][wid].advance += Number(r.advance_amount || 0)
      const rate = Number(r.custom_rate || r.labour?.daily_rate || 0)
      map[proj][wid].wage += Number(r.days_worked || 0) * rate + Number(r.overtime_amount || 0)
    })

    const rows: any[] = []
    Object.entries(map).forEach(([proj, workers]) => {
      const wlist = Object.values(workers)
      const mistry = wlist.filter(w => w.type?.includes('Mistry'))
      const labour = wlist.filter(w => w.type?.includes('Women') || w.type?.includes('Labour'))
      const helper = wlist.filter(w => w.type?.includes('Helper') || w.type?.includes('Parakadu'))
      rows.push({
        project: proj,
        workers: wlist,
        mistryCount: mistry.length,
        labourCount: labour.length,
        helperCount: helper.length,
        mistryDays: mistry.reduce((s, w) => s + w.days, 0),
        labourDays: labour.reduce((s, w) => s + w.days, 0),
        helperDays: helper.reduce((s, w) => s + w.days, 0),
        totalDays: wlist.reduce((s, w) => s + w.days, 0),
        totalWage: wlist.reduce((s, w) => s + w.wage, 0),
        totalAdvance: wlist.reduce((s, w) => s + w.advance, 0),
      })
    })
    setSummary(rows)
    setLoading(false)
  }

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('ATTENDANCE SUMMARY', 14, 15)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 22)
    let y = 28
    summary.forEach(row => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(row.project, 14, y)
      y += 6
      autoTable(doc, {
        startY: y,
        head: [['Worker', 'Type', 'Days', 'OT Hrs', 'Advance', 'Total Wage']],
        body: row.workers.map((w: any) => [w.name, w.type, w.days, w.ot.toFixed(1), `Rs.${w.advance}`, `Rs.${Math.round(w.wage).toLocaleString()}`]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 10
    })
    doc.save(`Attendance_Summary_${startDate}_${endDate}.pdf`)
  }

  const exportExcel = () => {
    const rows: any[] = []
    summary.forEach(row => {
      row.workers.forEach((w: any) => {
        rows.push({ Project: row.project, Worker: w.name, Type: w.type, Days: w.days, 'OT Hours': w.ot, Advance: w.advance, 'Total Wage': Math.round(w.wage) })
      })
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Summary')
    XLSX.writeFile(wb, `Attendance_Summary_${startDate}_${endDate}.xlsx`)
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Attendance Summary</h1>
        <p className="text-sm mt-0.5" style={{ color: DIM }}>Man-days per site — Mistry, Labour & Helpers</p>
      </div>

      {/* Filters */}
      <div style={PANEL} className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['week', 'month', 'custom'] as const).map(p => (
            <button key={p} onClick={() => applyPeriod(p)}
              className="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
              style={{ backgroundColor: period === p ? GOLD : '#1a1f2e', color: period === p ? '#fff' : DIM, border: '1px solid #1e2435' }}>
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project</label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="styled-select">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="styled-select" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="styled-select" />
          </div>
          <div className="flex items-end">
            <button onClick={fetchSummary} disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-black uppercase tracking-widest disabled:opacity-50"
              style={{ backgroundColor: GOLD, color: '#fff' }}>
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <>
          <div className="flex justify-end gap-2">
            <button onClick={exportExcel} className="px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2" style={{ backgroundColor: '#14532d', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
              <Download size={13} /> Excel
            </button>
            <button onClick={exportPDF} className="px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Download size={13} /> PDF
            </button>
          </div>

          {summary.map((row, i) => (
            <div key={i} style={PANEL} className="overflow-hidden">
              {/* Project header */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: '#0d1018', borderBottom: '1px solid #1e2435' }}>
                <p className="font-black text-white">{row.project}</p>
                <div className="flex gap-4 text-xs font-bold">
                  <span style={{ color: '#60a5fa' }}>Mistry: {row.mistryCount} workers · {row.mistryDays} days</span>
                  <span style={{ color: '#f59e0b' }}>Labour: {row.labourCount} workers · {row.labourDays} days</span>
                  <span style={{ color: '#a78bfa' }}>Helper: {row.helperCount} workers · {row.helperDays} days</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader style={{ backgroundColor: '#0d1018' }}>
                    <TableRow style={{ borderColor: '#1e2435' }}>
                      {['Worker', 'Type', 'Days Worked', 'OT Hours', 'Advance', 'Total Wage'].map(h => (
                        <TableHead key={h} className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.workers.map((w: any, j: number) => (
                      <TableRow key={j} style={{ borderColor: '#1e2435' }} className="hover:bg-white/[0.02]">
                        <TableCell className="font-bold text-white text-sm">{w.name}</TableCell>
                        <TableCell className="text-xs font-semibold" style={{ color: DIM }}>{w.type}</TableCell>
                        <TableCell className="font-black" style={{ color: '#22c55e' }}>{w.days}</TableCell>
                        <TableCell className="text-xs" style={{ color: DIM }}>{w.ot.toFixed(1)}</TableCell>
                        <TableCell className="text-xs font-bold" style={{ color: '#ef4444' }}>₹{w.advance.toLocaleString()}</TableCell>
                        <TableCell className="font-black text-sm" style={{ color: GOLD }}>₹{Math.round(w.wage).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Project totals */}
              <div className="px-5 py-3 flex flex-wrap gap-6 border-t" style={{ borderColor: '#1e2435', backgroundColor: '#0d1018' }}>
                <span className="text-xs font-black uppercase" style={{ color: DIM }}>Total: <span className="text-white">{row.totalDays} man-days</span></span>
                <span className="text-xs font-black uppercase" style={{ color: DIM }}>Advance: <span style={{ color: '#ef4444' }}>₹{row.totalAdvance.toLocaleString()}</span></span>
                <span className="text-xs font-black uppercase" style={{ color: DIM }}>Gross Wage: <span style={{ color: GOLD }}>₹{Math.round(row.totalWage).toLocaleString()}</span></span>
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && summary.length === 0 && (
        <div style={PANEL} className="py-16 text-center">
          <p className="text-sm font-bold" style={{ color: DIM }}>Click Generate to load attendance summary</p>
        </div>
      )}
    </div>
  )
}
