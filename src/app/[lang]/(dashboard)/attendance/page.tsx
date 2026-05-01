'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Loader2, 
  Table as TableIcon,
  Trash2,
  CheckSquare,
  Users2
} from 'lucide-react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { toast } from 'sonner'
import { addWeeks, format, endOfWeek, startOfWeek, eachDayOfInterval, parseISO } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'

export default function AttendancePage() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [projects, setProjects] = useState<any[]>([])
  const [labourers, setLabourers] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [status, setStatus] = useState<string>('full')
  const [overtimeHours, setOvertimeHours] = useState<string>('0')
  const [overtimeAmount, setOvertimeAmount] = useState<string>('0')
  const [customRate, setCustomRate] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [advanceAmount, setAdvanceAmount] = useState<string>('0')

  const today = new Date()
  const initialWeekStart = startOfWeek(today, { weekStartsOn: 0 })
  const initialWeekEnd = endOfWeek(today, { weekStartsOn: 0 })
  const [filterStart, setFilterStart] = useState<string>(format(initialWeekStart, 'yyyy-MM-dd'))
  const [filterEnd, setFilterEnd] = useState<string>(format(initialWeekEnd, 'yyyy-MM-dd'))

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [editStatus, setEditStatus] = useState('full')
  const [editOT, setEditOT] = useState('0')
  const [editOTAmt, setEditOTAmt] = useState('0')
  const [editAdv, setEditAdv] = useState('0')
  const [editNotes, setEditNotes] = useState('')
  const [bulkDate, setBulkDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [bulkProjectId, setBulkProjectId] = useState<string>('')
  const [bulkMarking, setBulkMarking] = useState(false)
  const [showAllWorkers, setShowAllWorkers] = useState(false)
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null)
  
  // Summary view states
  const [activeView, setActiveView] = useState<'mark' | 'summary'>('mark')
  const [summaryPeriod, setSummaryPeriod] = useState<'week' | 'month' | 'custom'>('month')
  const [summaryStart, setSummaryStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  const [summaryEnd, setSummaryEnd] = useState(format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  const [summaryData, setSummaryData] = useState<any[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [selectedSummaryProject, setSelectedSummaryProject] = useState('')
  
  const supabase = createClient()

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); fetchRecords(filterStart, filterEnd) }, [])

  async function fetchData() {
    setLoading(true)
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    setProjects(projData || [])
    setLabourers(labData || [])
    setLoading(false)
  }

  async function fetchRecords(start: string, end: string) {
    const { data } = await supabase
      .from('attendance')
      .select('*, labour(name), projects(name)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    setRecords(data || [])
  }

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkerId || !selectedProjectId) {
      toast.error('Worker and Project are required')
      return
    }

    setSaving(true)
    try {
      // Check for duplicate attendance
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('labour_id', selectedWorkerId)
        .eq('project_id', selectedProjectId)
        .eq('date', date)
        .single()

      if (existing) {
        toast.error('Attendance already marked for this worker on this date and project')
        setSaving(false)
        return
      }

      const daysWorked = status === 'full' ? 1 : status === 'half' ? 0.5 : 0
      const { error } = await supabase
        .from('attendance')
        .insert([{
          labour_id: selectedWorkerId,
          project_id: selectedProjectId,
          date: date,
          days_worked: daysWorked,
          overtime_hours: parseFloat(overtimeHours || '0'),
          overtime_amount: parseFloat(overtimeAmount || '0'),
          advance_amount: parseFloat(advanceAmount || '0'),
          custom_rate: customRate ? parseFloat(customRate) : null,
          notes: notes || null
        }])

      if (error) throw error
      toast.success('Attendance marked successfully')
      setSelectedWorkerId('')
      setSelectedProjectId('')
      setStatus('full')
      setOvertimeHours('0')
      setOvertimeAmount('0')
      setAdvanceAmount('0')
      setCustomRate('')
      setNotes('')
      fetchRecords(filterStart, filterEnd)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRecord = async () => {
    if (!deleteRecordId) return
    const { error } = await supabase.from('attendance').delete().eq('id', deleteRecordId)
    if (error) toast.error(error.message)
    else { toast.success('Record deleted'); fetchRecords(filterStart, filterEnd) }
    setDeleteRecordId(null)
  }

  const handleEditRecord = (rec: any) => {
    setEditingRecord(rec)
    setEditStatus(rec.days_worked === 1 ? 'full' : rec.days_worked === 0.5 ? 'half' : 'overtime')
    setEditOT(String(rec.overtime_hours || 0))
    setEditOTAmt(String(rec.overtime_amount || 0))
    setEditAdv(String(rec.advance_amount || 0))
    setEditNotes(rec.notes || '')
  }

  const handleSaveEdit = async () => {
    if (!editingRecord) return
    const daysWorked = editStatus === 'full' ? 1 : editStatus === 'half' ? 0.5 : 0
    const { error } = await supabase.from('attendance').update({
      days_worked: daysWorked,
      overtime_hours: parseFloat(editOT || '0'),
      overtime_amount: parseFloat(editOTAmt || '0'),
      advance_amount: parseFloat(editAdv || '0'),
      notes: editNotes || null
    }).eq('id', editingRecord.id)
    if (error) toast.error(error.message)
    else { toast.success('Updated'); setEditingRecord(null); fetchRecords(filterStart, filterEnd) }
  }

  const handleBulkMark = async () => {
    if (!bulkProjectId) { toast.error('Select a project'); return }
    setBulkMarking(true)
    let success = 0, skip = 0
    for (const worker of labourers) {
      const { data: existing } = await supabase.from('attendance').select('id')
        .eq('labour_id', worker.id).eq('project_id', bulkProjectId).eq('date', bulkDate).single()
      if (existing) { skip++; continue }
      await supabase.from('attendance').insert([{
        labour_id: worker.id, project_id: bulkProjectId, date: bulkDate,
        days_worked: 1, overtime_hours: 0, overtime_amount: 0, advance_amount: 0,
        custom_rate: worker.daily_rate || 0, notes: null
      }])
      success++
    }
    toast.success(`Bulk marked: ${success} workers (${skip} skipped)`)
    setBulkMarking(false)
    fetchRecords(filterStart, filterEnd)
  }

  const handleWorkerChange = (value: string) => {
    setSelectedWorkerId(value)
    const worker = labourers.find(l => l.id === value)
    if (worker) setCustomRate(worker.daily_rate.toString())
  }

  const setVisibleWeek = (baseDate: Date) => {
    const nextStart = startOfWeek(baseDate, { weekStartsOn: 0 })
    const nextEnd = endOfWeek(baseDate, { weekStartsOn: 0 })
    const start = format(nextStart, 'yyyy-MM-dd')
    const end = format(nextEnd, 'yyyy-MM-dd')
    setFilterStart(start)
    setFilterEnd(end)
    fetchRecords(start, end)
  }

  const handlePreviousWeek = () => setVisibleWeek(addWeeks(new Date(filterStart), -1))

  const handleNextWeek = () => setVisibleWeek(addWeeks(new Date(filterStart), 1))

  const applySummaryPeriod = (p: 'week' | 'month' | 'custom') => {
    setSummaryPeriod(p)
    if (p === 'week') {
      setSummaryStart(format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
      setSummaryEnd(format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    } else if (p === 'month') {
      const now = new Date()
      setSummaryStart(format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'))
      setSummaryEnd(format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'))
    }
  }

  const fetchSummary = async () => {
    setSummaryLoading(true)
    let q = supabase.from('attendance').select('*, labour(name, type, daily_rate), projects(name)')
      .gte('date', summaryStart).lte('date', summaryEnd).order('date', { ascending: true })
    if (selectedSummaryProject) q = q.eq('project_id', selectedSummaryProject)
    const { data } = await q

    // Group by project → worker
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
    setSummaryData(Object.entries(map).map(([project, workers]) => ({ project, workers: Object.values(workers) })))
    setSummaryLoading(false)
  }

  const exportSummaryPDF = async () => {
    if (summaryData.length === 0) {
      toast.error('Generate summary first')
      return
    }

    const doc = new jsPDF()
    drawPremiumHeader(doc, 'ATTENDANCE SUMMARY', `${format(new Date(summaryStart), 'dd MMM yyyy')} - ${format(new Date(summaryEnd), 'dd MMM yyyy')}`)

    let startY = 54
    summaryData.forEach((proj: any) => {
      if (startY > 235) {
        doc.addPage()
        drawPremiumHeader(doc, 'ATTENDANCE SUMMARY', 'Continued')
        startY = 54
      }

      doc.setTextColor(...PDF_COLORS.NAVY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`PROJECT: ${proj.project}`, 14, startY)

      autoTable(doc, {
        startY: startY + 5,
        head: [['Worker', 'Type', 'Days', 'OT Hrs', 'Advance', 'Total Wage']],
        body: proj.workers.map((w: any) => [
          w.name,
          w.type,
          w.days.toFixed(1),
          w.ot.toFixed(1),
          `Rs.${w.advance.toLocaleString()}`,
          `Rs.${Math.round(w.wage).toLocaleString()}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
        alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
        styles: { cellPadding: 2.5 },
        margin: { left: 14, right: 14 }
      })

      startY = (doc as any).lastAutoTable.finalY + 12
    })

    drawPremiumFooter(doc)
    
    doc.save(`Attendance_Summary_${summaryStart}_to_${summaryEnd}.pdf`)
    toast.success('Attendance summary PDF exported')
  }

  const visibleWeekLabel = `${format(new Date(filterStart), 'dd MMM yyyy')} - ${format(new Date(filterEnd), 'dd MMM yyyy')}`

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const GOLD = '#3b82f6'
  const DIM = '#6b7280'
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }
  const SC_ST = { backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }
  const { t } = useLang()

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t.attendance.title}</h1>
          <p className="mt-1 text-sm" style={{ color: DIM }}>{t.attendance.subtitle}</p>
        </div>
        {/* View Toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435' }}>
          <button onClick={() => setActiveView('mark')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeView === 'mark' ? 'bg-blue-500 text-white' : 'text-zinc-500 hover:text-white'}`}>Mark Attendance</button>
          <button onClick={() => { setActiveView('summary'); fetchSummary(); }} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeView === 'summary' ? 'bg-blue-500 text-white' : 'text-zinc-500 hover:text-white'}`}>Summary</button>
        </div>
      </div>

      {activeView === 'summary' ? (
        /* Summary View */
        <div className="space-y-6">
          <div style={PANEL} className="p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex gap-1">
                {(['week', 'month', 'custom'] as const).map(p => (
                  <button key={p} onClick={() => applySummaryPeriod(p)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${summaryPeriod === p ? 'bg-blue-500 text-white' : 'text-zinc-500'}`}>{p}</button>
                ))}
              </div>
              <select value={selectedSummaryProject} onChange={e => setSelectedSummaryProject(e.target.value)} className="styled-select h-10">
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={fetchSummary} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-blue-500 text-white">Generate</button>
              <button onClick={exportSummaryPDF} className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-[#1F2937] text-white border border-zinc-800">PDF</button>
            </div>
            {summaryLoading ? (
              <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto" style={{ color: GOLD }} /></div>
            ) : summaryData.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: DIM }}>No data for selected period</div>
            ) : (
              <div className="space-y-6">
                {summaryData.map((proj: any, idx: number) => (
                  <div key={idx} style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435' }} className="rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b flex justify-between" style={{ borderColor: '#1e2435' }}>
                      <p className="font-black text-white">{proj.project}</p>
                    </div>
                    <Table>
                      <TableHeader style={{ backgroundColor: '#111520' }}>
                        <TableRow style={{ borderColor: '#1e2435' }}>
                          <TableHead className="text-[10px] font-black uppercase" style={{ color: DIM }}>Worker</TableHead>
                          <TableHead className="text-[10px] font-black uppercase" style={{ color: DIM }}>Type</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-right" style={{ color: DIM }}>Days</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-right" style={{ color: DIM }}>OT Hrs</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-right" style={{ color: DIM }}>Advance</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-right" style={{ color: DIM }}>Total Wage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {proj.workers.map((w: any, i: number) => (
                          <TableRow key={i} style={{ borderColor: '#1e2435' }}>
                            <TableCell className="font-bold text-white text-sm">{w.name}</TableCell>
                            <TableCell className="text-xs" style={{ color: DIM }}>{w.type}</TableCell>
                            <TableCell className="text-right font-black text-sm" style={{ color: GOLD }}>{w.days.toFixed(1)}</TableCell>
                            <TableCell className="text-right font-black text-sm" style={{ color: '#a78bfa' }}>{w.ot.toFixed(1)}</TableCell>
                            <TableCell className="text-right font-black text-sm text-red-400">₹{w.advance.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-black text-sm text-emerald-400">₹{Math.round(w.wage).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <div className="lg:col-span-4">
          <div style={PANEL} className="p-6">
            <p className="text-sm font-black text-white mb-6 uppercase tracking-wide">{t.attendance.markAttendance}</p>
            <form onSubmit={handleMarkAttendance} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{t.attendance.worker}</label>
                <select value={selectedWorkerId} onChange={e => handleWorkerChange(e.target.value)} className="styled-select">
                  <option value="">{t.attendance.selectWorker}</option>
                  {labourers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{t.attendance.dailyRate}</label>
                <input type="number" value={customRate} onChange={e => setCustomRate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{t.common.project}</label>
                <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="styled-select">
                  <option value="">{t.attendance.selectProject}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{t.attendance.statusLabel}</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="styled-select">
                  <option value="full">{t.attendance.fullDay}</option>
                  <option value="half">{t.attendance.halfDay}</option>
                  <option value="overtime">{t.attendance.overtime}</option>
                </select>
              </div>

              {status === 'overtime' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>OT Hours</label>
                    <input type="number" value={overtimeHours} onChange={e => setOvertimeHours(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>OT Amount</label>
                    <input type="number" value={overtimeAmount} onChange={e => setOvertimeAmount(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Advance Given (₹)</label>
                <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-red-500/20" 
                  style={{ ...INPUT_ST, borderColor: 'rgba(239,68,68,0.2)' }} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Remarks (optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks..."
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
              </div>

              <button type="submit" disabled={saving}
                className="w-full h-12 rounded-xl text-sm font-black uppercase tracking-wide text-[#0a0c12] flex items-center justify-center gap-2 mt-2"
                style={{ backgroundColor: GOLD, boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
                {saving ? <Loader2 size={16} className="animate-spin text-[#0a0c12]" /> : null}
                Mark Attendance
              </button>
            </form>
          </div>
        </div>

        {/* Records Table */}
        <div className="lg:col-span-8">
          <div style={PANEL} className="overflow-hidden h-full">
            <div className="px-4 py-3 border-b" style={{ borderColor: '#1e2435' }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Visible Week</p>
                  <p className="mt-1 text-sm font-bold text-white">{visibleWeekLabel}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setShowAllWorkers(v => !v)}
                    className="h-8 px-3 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
                    style={{ backgroundColor: showAllWorkers ? GOLD : '#1a1f2e', color: showAllWorkers ? '#0a0c12' : '#f0f0f0', border: '1px solid #1e2435' }}>
                    <Users2 size={11} /> {showAllWorkers ? 'All Workers' : 'Present Only'}
                  </button>
                  <button onClick={handlePreviousWeek} className="h-8 px-3 rounded-lg text-[10px] font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                  <button onClick={handleNextWeek} className="h-8 px-3 rounded-lg text-[10px] font-black uppercase" style={{ backgroundColor: GOLD, color: '#0a0c12' }}>Next →</button>
                </div>
              </div>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader style={{ backgroundColor: '#0d1018' }}>
                  <TableRow style={{ borderColor: '#1e2435' }}>
                    <TableHead className="py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Worker</TableHead>
                    {eachDayOfInterval({ start: new Date(filterStart), end: new Date(filterEnd) }).map(d => (
                      <TableHead key={d.toISOString()} className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-center" style={{ color: DIM }}>
                        {format(d, 'EEE')}<br/><span className="text-[8px] font-normal">{format(d, 'dd MMM')}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} style={{ borderColor: '#1e2435' }}>
                        <TableCell colSpan={8} className="h-14 animate-pulse" style={{ backgroundColor: '#1a1f2e' }} />
                      </TableRow>
                    ))
                  ) : labourers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <TableIcon size={36} style={{ color: DIM, opacity: 0.3 }} />
                          <p className="text-sm font-bold" style={{ color: DIM }}>No workers found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    labourers.filter(worker => showAllWorkers || records.some(r => r.labour_id === worker.id)).map((worker) => {
                      const workerRecords = records.filter(r => r.labour_id === worker.id)
                      const weekDates = eachDayOfInterval({ start: new Date(filterStart), end: new Date(filterEnd) })
                      
                      return (
                        <TableRow key={worker.id} style={{ borderColor: '#1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                          <TableCell className="px-4 py-2 font-bold text-white text-sm">
                            {worker.name}
                            <p className="text-[9px] text-zinc-500 font-normal">{worker.type || 'Worker'}</p>
                          </TableCell>
                          {weekDates.map(d => {
                            const dateStr = format(d, 'yyyy-MM-dd')
                            const rec = workerRecords.find(r => r.date === dateStr)
                            const status = rec ? (rec.days_worked === 1 ? 'FULL' : rec.days_worked === 0.5 ? 'HALF' : 'ABSENT') : '-'
                            
                            return (
                              <TableCell key={dateStr} className="px-1 py-1 text-center">
                                {status === '-' ? (
                                  <span className="text-zinc-700 text-xs">—</span>
                                ) : (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <Badge onClick={() => rec && handleEditRecord(rec)}
                                      className={cn(
                                        "text-[8px] font-black px-1.5 py-0.5 border-none cursor-pointer hover:opacity-80",
                                        status === 'FULL' ? "bg-emerald-500/10 text-emerald-500" :
                                        status === 'HALF' ? "bg-amber-500/10 text-amber-500" :
                                        "bg-red-500/10 text-red-500"
                                      )}>{status}</Badge>
                                    {rec && <button onClick={() => setDeleteRecordId(rec.id)} className="text-red-500/30 hover:text-red-400 transition-colors mt-0.5"><Trash2 size={8} /></button>}
                                  </div>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="flex flex-col gap-3 p-4 md:hidden">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl" style={{ backgroundColor: '#1a1f2e' }} />
                ))
              ) : labourers.length === 0 ? (
                <div className="py-16 text-center text-sm font-bold" style={{ color: DIM }}>No workers found</div>
              ) : (
                labourers.filter(worker => records.some(r => r.labour_id === worker.id)).map((worker) => {
                  const workerRecords = records.filter(r => r.labour_id === worker.id)
                  const weekDates = eachDayOfInterval({ start: new Date(filterStart), end: new Date(filterEnd) })
                  
                  return (
                    <div key={worker.id} className="rounded-xl p-4 flex flex-col gap-3 border" style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}>
                      <div className="flex justify-between items-start border-b pb-2" style={{ borderColor: '#1e2435' }}>
                        <div>
                          <p className="font-bold text-white text-sm">{worker.name}</p>
                          <p className="text-[9px] text-zinc-500 font-normal mt-0.5">{worker.type || 'Worker'}</p>
                        </div>
                      </div>
                      <div className="flex justify-between mt-1">
                        {weekDates.map(d => {
                          const dateStr = format(d, 'yyyy-MM-dd')
                          const rec = workerRecords.find(r => r.date === dateStr)
                          const status = rec ? (rec.days_worked === 1 ? 'F' : rec.days_worked === 0.5 ? 'H' : 'A') : '-'
                          
                          return (
                            <div key={dateStr} className="flex flex-col items-center">
                              <p className="text-[8px] font-bold text-zinc-500 uppercase">{format(d, 'EE')}</p>
                              <div className={cn("w-6 h-6 rounded flex items-center justify-center mt-1 text-[10px] font-black", 
                                status === 'F' ? "bg-emerald-500/10 text-emerald-500" : 
                                status === 'H' ? "bg-amber-500/10 text-amber-500" : 
                                status === 'A' ? "bg-red-500/10 text-red-500" : 
                                "text-zinc-600"
                              )}>
                                {status}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
    {/* Delete Confirm Modal */}
    {deleteRecordId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteRecordId(null)}>
        <div className="rounded-2xl p-6 w-full max-w-xs space-y-4" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
          <p className="text-base font-black text-white">Delete Record?</p>
          <p className="text-sm" style={{ color: '#6b7280' }}>This attendance record will be permanently removed.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteRecordId(null)} className="flex-1 h-10 rounded-xl text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#6b7280', border: '1px solid #1e2435' }}>Cancel</button>
            <button onClick={handleDeleteRecord} className="flex-1 h-10 rounded-xl text-xs font-black uppercase" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>Delete</button>
          </div>
        </div>
      </div>
    )}
    {/* Edit Attendance Record Modal */}
    {editingRecord && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingRecord(null)}>
        <div className="rounded-2xl p-6 w-full max-w-sm space-y-4" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
          <p className="text-sm font-black text-white uppercase tracking-wide">Edit Attendance</p>
          <p className="text-xs font-bold" style={{ color: '#6b7280' }}>{editingRecord.labour?.name} — {editingRecord.date}</p>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Status</label>
            <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="styled-select">
              <option value="full">Full Day</option>
              <option value="half">Half Day</option>
              <option value="overtime">Overtime Only</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>OT Hours</label>
              <input type="number" value={editOT} onChange={e => setEditOT(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none font-semibold" style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>OT Amount</label>
              <input type="number" value={editOTAmt} onChange={e => setEditOTAmt(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none font-semibold" style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Advance Given (₹)</label>
            <input type="number" value={editAdv} onChange={e => setEditAdv(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none font-semibold" style={{ backgroundColor: '#0d1018', border: '1px solid rgba(239,68,68,0.3)', color: '#f0f0f0' }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Remarks</label>
            <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none font-semibold" style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditingRecord(null)} className="flex-1 h-10 rounded-xl text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#6b7280', border: '1px solid #1e2435' }}>Cancel</button>
            <button onClick={handleSaveEdit} className="flex-1 h-10 rounded-xl text-xs font-black uppercase text-[#0a0c12]" style={{ backgroundColor: '#3b82f6' }}>Save Changes</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
