'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek as import_startOfWeek, endOfWeek as import_endOfWeek } from 'date-fns'
import { FileText, Download, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'
import { toast } from 'sonner'

const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const GOLD = '#3b82f6'
const DIM = '#6b7280'
const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

type ReportType = 'labour' | 'materials' | 'revenue' | 'extra_work' | 'attendance_cost'

export default function ReportsPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<any[]>([])
  const [reportType, setReportType] = useState<ReportType>('materials')
  const [projectId, setProjectId] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    setData([])
  }, [reportType, projectId, startDate, endDate])

  useEffect(() => { supabase.from('projects').select('*').order('name').then(({ data }) => setProjects(data || [])) }, [])

  // Auto-set dates
  useEffect(() => {
    if (reportType === 'labour' || reportType === 'attendance_cost') {
      const now = new Date()
      setStartDate(format(import_startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
      setEndDate(format(import_endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    } else {
      if (projectId && projects.length > 0) {
        const p = projects.find(x => x.id === projectId)
        if (p && p.created_at) {
          // Use a very early date just in case
          setStartDate('2020-01-01')
        }
      } else {
        setStartDate('2020-01-01')
      }
      setEndDate(format(new Date(new Date().getFullYear() + 1, 11, 31), 'yyyy-MM-dd'))
    }
  }, [reportType, projectId, projects])

  const setThisWeek = () => {
    const now = new Date()
    setStartDate(format(import_startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    setEndDate(format(import_endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  }

  const setPrevWeek = () => {
    const prev = new Date();
    prev.setDate(prev.getDate() - 7);
    setStartDate(format(import_startOfWeek(prev, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    setEndDate(format(import_endOfWeek(prev, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  }

  const fetchReport = async () => {
    setLoading(true)
    setPage(0)
    let q: any
    if (reportType === 'materials') {
      q = supabase.from('materials').select('date, name, quantity, unit, total_amount, notes, projects(name)').order('date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
    } else if (reportType === 'revenue') {
      q = supabase.from('income').select('date, amount, notes, projects(name)').order('date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
    } else if (reportType === 'extra_work') {
      q = supabase.from('extra_work').select('date, work_name, amount, notes, projects(name)').order('date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
    }
    const { data: rows } = await q
    
    // Transform attendance_cost to standard format
    if (reportType === 'attendance_cost' && rows) {
      setData(rows.map((r: any) => {
        const rate = r.custom_rate || r.labour?.daily_rate || 0
        const gross = (Number(r.days_worked || 0) * rate) + Number(r.overtime_amount || 0)
        return {
          ...r,
          amount: gross,
          description: `${r.labour?.name || '—'} · ${r.projects?.name || '—'} (${r.days_worked} days)`
        }
      }))
      setLoading(false)
      return
    }

    setData(rows || [])
    setLoading(false)
  }

  const getTotal = () => data.reduce((s, r) => s + (r.amount || r.total_amount || 0), 0)

  const getLabel = (r: any) => {
    if (reportType === 'labour') return `${r.labour?.name || '—'} (${r.payment_type || 'Cash'})`
    if (reportType === 'attendance_cost') return r.description
    if (reportType === 'materials') return `${r.name} · ${r.projects?.name || '—'}`
    if (reportType === 'revenue') return r.projects?.name || '—'
    return `${r.work_name} · ${r.projects?.name || '—'}`
  }

  const exportPDF = async () => {
    const doc = new jsPDF()
    const titles: Record<ReportType, string> = { labour: 'LABOUR PAYMENTS', materials: 'MATERIALS REPORT', revenue: 'REVENUE REPORT', extra_work: 'EXTRA WORK REPORT', attendance_cost: 'ATTENDANCE COST REPORT' }
    const subtitle = 'ALL TIME REPORT'
    drawPremiumHeader(doc, titles[reportType], subtitle)
    
    let head = [['#', 'Date', 'Description', 'Notes', 'Amount']]
    let body = data.map((r, i) => [i + 1, format(new Date(r.date), 'dd/MM/yyyy'), getLabel(r), r.notes || '—', `Rs.${Number(r.amount || r.total_amount || 0).toLocaleString()}`])
    let foot = [['', '', '', 'TOTAL', `Rs.${getTotal().toLocaleString()}`]]

    if (reportType === 'materials') {
      head = [['#', 'Date', 'Supplier', 'Project', 'Material/Qty', 'Cost', 'Remarks', 'Grand Total']]
      body = data.map((r, i) => {
        const notes = r.notes || ''
        const sMatch = notes.match(/Supplier:\s(.*?)(?:\s\||$)/)
        const mMatch = notes.match(/Material Amount:\sRs\.([\d,.]+)/)
        const tMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/)
        const hMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/)
        
        const supp = sMatch ? sMatch[1] : '—'
        const matAmt = mMatch ? `Material Amount: Rs.${mMatch[1]}` : ''
        const tr = tMatch ? `Transport: Rs.${tMatch[1]}` : ''
        const ha = hMatch ? `Hamali: Rs.${hMatch[1]}` : ''
        const cost = [matAmt, tr, ha].filter(Boolean).join('\n') || '—'
        
        const cleanNotes = notes.replace(/Supplier:\s(.*?)(?:\s\||$)/, '').replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/^[\s\|]+|[\s\|]+$/g, '').trim()
        
        const materialQty = `${r.name}\n${r.quantity} ${r.unit}`
        const project = r.projects?.name || '—'

        return [i + 1, format(new Date(r.date), 'dd/MM/yyyy'), supp, project, materialQty, cost, cleanNotes || '—', `Rs.${Number(r.total_amount || 0).toLocaleString()}`]
      })
      foot = [['', '', '', '', '', '', 'TOTAL', `Rs.${getTotal().toLocaleString()}`]]
    }

    autoTable(doc, {
      startY: 54,
      head: head,
      body: body,
      foot: foot,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
      footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      styles: { cellPadding: 2.5 }
    })
    drawPremiumFooter(doc)
    
    const fileNameSuffix = reportType === 'labour' ? `${startDate}-to-${endDate}` : 'all-time'
    doc.save(`${reportType}-report-${fileNameSuffix}.pdf`)
    toast.success('PDF exported')
  }

  const exportExcel = () => {
    const periodStr = 'All Time'
    const rows: any[][] = [['SRI SAI CONSTRUCTIONS - Report'], [`Type: ${reportType} | ${periodStr}`], [], ['#', 'Date', 'Description', 'Notes', 'Amount']]
    data.forEach((r, i) => rows.push([i + 1, format(new Date(r.date), 'dd/MM/yyyy'), getLabel(r), r.notes || '—', Number(r.amount || r.total_amount || 0)]))
    rows.push(['', '', '', 'TOTAL', getTotal()])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    const fileNameSuffix = reportType === 'labour' ? startDate : 'all-time'
    XLSX.writeFile(wb, `${reportType}-report-${fileNameSuffix}.xlsx`)
    toast.success('Excel exported')
  }

  const reportTypes: { value: ReportType, label: string }[] = [
    { value: 'materials', label: 'Materials' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'extra_work', label: 'Extra Work' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Reports</h1>
        <p className="text-sm mt-1" style={{ color: DIM }}>Filter by type, project and date range. Export to PDF or Excel.</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-5 space-y-4" style={PANEL}>
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Filter Options</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`col-span-2 md:col-span-1 space-y-1.5 ${(reportType !== 'labour' && reportType !== 'attendance_cost') ? 'md:col-span-2' : ''}`}>
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)}
              className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST}>
              {reportTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className={`space-y-1.5 md:col-span-3`}>
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project (optional)</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">

          <button onClick={fetchReport} disabled={loading}
            className="h-10 px-6 rounded-xl text-sm font-black uppercase flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: '#0a0c12' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />} Generate Report
          </button>
          {data.length > 0 && (
            <>
              <button onClick={exportPDF} className="h-10 px-5 rounded-xl text-sm font-black uppercase flex items-center gap-2" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>
                <FileText size={14} /> PDF
              </button>
              <button onClick={exportExcel} className="h-10 px-5 rounded-xl text-sm font-black uppercase flex items-center gap-2" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>
                <Download size={14} /> Excel
              </button>
              <span className="text-xs font-bold ml-auto" style={{ color: DIM }}>{data.length} records · Total: <span className="text-white font-black">₹{getTotal().toLocaleString()}</span></span>
            </>
          )}
        </div>
      </div>

      {/* Results Table */}
      {data.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={PANEL}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#0d1018' }}>
                <tr style={{ borderBottom: '1px solid #1e2435' }}>
                  <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>#</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Date</th>
                  {reportType === 'materials' ? (
                    <>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Supplier</th>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project</th>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Material / Qty</th>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Cost</th>
                    </>
                  ) : (
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Description</th>
                  )}
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Notes</th>
                  <th className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{reportType === 'materials' ? 'Grand Total' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(page * 15, page * 15 + 15).map((r, i) => {
                  if (reportType === 'materials') {
                    const notes = r.notes || ''
                    const sMatch = notes.match(/Supplier:\s(.*?)(?:\s\||$)/)
                    const mMatch = notes.match(/Material Amount:\sRs\.([\d,.]+)/)
                    const tMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/)
                    const hMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/)
                    
                    const supp = sMatch ? sMatch[1] : '—'
                    const matAmt = mMatch ? `Material Amount: ₹${mMatch[1]}` : ''
                    const tr = tMatch ? `Transport: ₹${tMatch[1]}` : ''
                    const ha = hMatch ? `Hamali: ₹${hMatch[1]}` : ''
                    
                    const cleanNotes = notes.replace(/Supplier:\s(.*?)(?:\s\||$)/, '').replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/^[\s\|]+|[\s\|]+$/g, '').trim() || '—'

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-3 text-xs font-bold" style={{ color: DIM }}>{page * 15 + i + 1}</td>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: DIM }}>{format(new Date(r.date), 'dd MMM yyyy')}</td>
                        <td className="px-4 py-3 text-sm font-bold text-white max-w-[150px] truncate">{supp}</td>
                        <td className="px-4 py-3 text-sm font-bold text-white max-w-[150px] truncate lowercase">{r.projects?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <p className="font-black text-gray-200 text-xs tracking-tight uppercase">{r.name}</p>
                          <p className="font-bold text-zinc-500 text-[10px] uppercase mt-1">{r.quantity} {r.unit}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[10px] font-bold" style={{ color: DIM }}>
                            {matAmt && <div><span className="text-emerald-400">{matAmt}</span></div>}
                            {tr && <div><span className="text-white">{tr}</span></div>}
                            {ha && <div><span className="text-white">{ha}</span></div>}
                            {!matAmt && !tr && !ha && '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: DIM }}>{cleanNotes}</td>
                        <td className="px-6 py-3 text-right font-black text-sm" style={{ color: GOLD }}>₹{Number(r.total_amount || 0).toLocaleString()}</td>
                      </tr>
                    )
                  }

                  // Other report types
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-xs font-bold" style={{ color: DIM }}>{page * 15 + i + 1}</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: DIM }}>{format(new Date(r.date), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3 text-sm font-bold text-white max-w-[200px] truncate">{getLabel(r)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: DIM }}>{r.notes || '—'}</td>
                      <td className="px-6 py-3 text-right font-black text-sm" style={{ color: GOLD }}>₹{Number(r.amount || r.total_amount || 0).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#0d1018', borderTop: '1px solid #1e2435' }}>
                  <td colSpan={reportType === 'materials' ? 7 : 4} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-right" style={{ color: DIM }}>Total</td>
                  <td className="px-6 py-3 text-right font-black" style={{ color: '#22c55e' }}>₹{getTotal().toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {data.length > 15 && (
            <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: '#1e2435' }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
              <span className="text-xs" style={{ color: DIM }}>Page {page + 1} / {Math.ceil(data.length / 15)}</span>
              <button disabled={(page + 1) * 15 >= data.length} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
            </div>
          )}
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={PANEL}>
          <FileText size={40} style={{ color: DIM, opacity: 0.2, margin: '0 auto 12px' }} />
          <p className="text-sm font-bold" style={{ color: DIM }}>Set filters above and click Generate Report</p>
        </div>
      )}
    </div>
  )
}
