'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Loader2, 
  ChevronLeft,
  ChevronRight,
  Search,
  Save,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { addWeeks, format, endOfWeek, startOfWeek, eachDayOfInterval, subWeeks, parseISO } from 'date-fns'

type AttendanceStatus = 'P' | 'H' | 'A' | ''

type DayRecord = {
  status: AttendanceStatus
  overtime_amount: number
  advance_amount: number
}

type WorkerRow = {
  worker_id: string
  name: string
  type: string
  default_rate: number
  custom_rate: number
  days: Record<string, DayRecord> // Date strings as keys
}

export default function AttendancePage() {
  const [projects, setProjects] = useState<any[]>([])
  const [labourers, setLabourers] = useState<any[]>([])
  
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }))
  
  const [gridData, setGridData] = useState<Record<string, WorkerRow>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([])
  
  // Modals & Panels
  const [showAddWorker, setShowAddWorker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [otMode, setOtMode] = useState(false)
  
  // Popup State
  const [activePopup, setActivePopup] = useState<{ worker_id: string, date: string } | null>(null)
  const [popupData, setPopupData] = useState<DayRecord>({ status: '', overtime_amount: 0, advance_amount: 0 })

  const supabase = createClient()
  const { t } = useLang()

  const weekDates = useMemo(() => {
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: currentWeekStart, end })
  }, [currentWeekStart])

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    setProjects(projData || [])
    setLabourers(labData || [])
    if (projData && projData.length > 0) {
      setSelectedProject(projData[0].id)
    }
  }

  // Effect to load week data when project or week changes
  useEffect(() => {
    if (selectedProject) {
      loadWeekData(selectedProject, currentWeekStart)
    }
  }, [selectedProject, currentWeekStart])

  async function loadWeekData(projectId: string, weekStart: Date) {
    setLoading(true)
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const endStr = format(endOfWeek(weekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('attendance')
      .select('*, labour(name, type, daily_rate)')
      .eq('project_id', projectId)
      .gte('date', startStr)
      .lte('date', endStr)

    const newGrid: Record<string, WorkerRow> = {}

    if (data) {
      data.forEach((r: any) => {
        const wId = r.labour_id
        if (!newGrid[wId]) {
          newGrid[wId] = {
            worker_id: wId,
            name: r.labour?.name || 'Unknown',
            type: r.labour?.type || 'Worker',
            default_rate: r.labour?.daily_rate || 0,
            custom_rate: r.custom_rate || r.labour?.daily_rate || 0,
            days: {}
          }
        }
        
        let status: AttendanceStatus = ''
        if (r.days_worked === 1) status = 'P'
        else if (r.days_worked === 0.5) status = 'H'
        else if (r.days_worked === 0 && r.overtime_amount === 0) status = 'A' // Pure absent
        else if (r.days_worked === 0 && r.overtime_amount > 0) status = 'A' // Absent but has OT

        newGrid[wId].days[r.date] = {
          status,
          overtime_amount: Number(r.overtime_amount) || 0,
          advance_amount: Number(r.advance_amount) || 0
        }
      })
    }

    setGridData(newGrid)
    setLoading(false)
  }

  // Interactions
  const handleCellClick = (workerId: string, dateStr: string) => {
    const current = gridData[workerId]?.days[dateStr] || { status: '', overtime_amount: 0, advance_amount: 0 }
    setPopupData(current)
    setActivePopup({ worker_id: workerId, date: dateStr })
  }

  const handleApplyPopup = () => {
    if (!activePopup) return
    const { worker_id, date } = activePopup
    
    setGridData(prev => {
      const worker = prev[worker_id]
      if (!worker) return prev
      return {
        ...prev,
        [worker_id]: {
          ...worker,
          days: {
            ...worker.days,
            [date]: { ...popupData }
          }
        }
      }
    })
    setActivePopup(null)
  }

  // Removed handleSaveOT as it's merged into popup logic

  const addSelectedWorkersToGrid = () => {
    setGridData(prev => {
      const next = { ...prev }
      labourers.filter(l => selectedWorkers.includes(l.id)).forEach(worker => {
        if (!next[worker.id]) {
          next[worker.id] = {
            worker_id: worker.id,
            name: worker.name,
            type: worker.type || 'Worker',
            default_rate: worker.daily_rate || 0,
            custom_rate: worker.daily_rate || 0,
            days: {}
          }
        }
      })
      return next
    })
    setShowAddWorker(false)
    setSearchQuery('')
    setSelectedWorkers([])
  }

  const removeWorkerFromGrid = (workerId: string) => {
    setGridData(prev => {
      const next = { ...prev }
      delete next[workerId]
      return next
    })
  }

  const updateCustomRate = (workerId: string, rateStr: string) => {
    setGridData(prev => {
      const next = { ...prev }
      if (next[workerId]) {
        next[workerId].custom_rate = parseFloat(rateStr) || 0
      }
      return next
    })
  }

  // Quick Actions
  const markFullWeekPresent = (workerId?: string) => {
    setGridData(prev => {
      const next = { ...prev }
      const targets = workerId ? [workerId] : Object.keys(next)
      
      targets.forEach(wId => {
        const newDays = { ...next[wId].days }
        weekDates.forEach(d => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const currentDay = newDays[dateStr] || { status: '', overtime_amount: 0, advance_amount: 0 }
          if (currentDay.status === '') {
            newDays[dateStr] = { ...currentDay, status: 'P' }
          }
        })
        next[wId] = { ...next[wId], days: newDays }
      })
      return next
    })
  }

  const clearWeek = (workerId?: string) => {
    setGridData(prev => {
      const next = { ...prev }
      const targets = workerId ? [workerId] : Object.keys(next)
      
      targets.forEach(wId => {
        const newDays = { ...next[wId].days }
        weekDates.forEach(d => {
          const dateStr = format(d, 'yyyy-MM-dd')
          if (newDays[dateStr]) {
            newDays[dateStr] = { ...newDays[dateStr], status: '', overtime_amount: 0, advance_amount: 0 }
          }
        })
        next[wId] = { ...next[wId], days: newDays }
      })
      return next
    })
  }

  const copyPreviousWeek = async () => {
    if (!selectedProject) return
    setLoading(true)
    const prevStart = subWeeks(currentWeekStart, 1)
    const startStr = format(prevStart, 'yyyy-MM-dd')
    const endStr = format(endOfWeek(prevStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('attendance')
      .select('*, labour(name, type, daily_rate)')
      .eq('project_id', selectedProject)
      .gte('date', startStr)
      .lte('date', endStr)

    if (data && data.length > 0) {
      setGridData(prev => {
        const next = { ...prev }
        data.forEach((r: any) => {
          const wId = r.labour_id
          if (!next[wId]) {
            next[wId] = {
              worker_id: wId,
              name: r.labour?.name || 'Unknown',
              type: r.labour?.type || 'Worker',
              default_rate: r.labour?.daily_rate || 0,
              custom_rate: r.custom_rate || r.labour?.daily_rate || 0,
              days: {}
            }
          }
          
          const prevDateObj = new Date(r.date)
          const dayIndex = prevDateObj.getDay()
          const targetDateStr = format(weekDates[dayIndex], 'yyyy-MM-dd')

          let status: AttendanceStatus = ''
          if (r.days_worked === 1) status = 'P'
          else if (r.days_worked === 0.5) status = 'H'
          else if (r.days_worked === 0 && r.overtime_amount === 0) status = 'A'

          if (!next[wId].days[targetDateStr] || next[wId].days[targetDateStr].status === '') {
            next[wId].days[targetDateStr] = {
              status,
              overtime_amount: Number(r.overtime_amount) || 0,
              advance_amount: Number(r.advance_amount) || 0
            }
          }
        })
        return next
      })
      toast.success('Previous week patterns copied')
    } else {
      toast.error('No data found in previous week')
    }
    setLoading(false)
  }

  // Save Logic
  const handleSave = async () => {
    if (!selectedProject) return
    setSaving(true)
    
    const startStr = format(currentWeekStart, 'yyyy-MM-dd')
    const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const workerIds = Object.keys(gridData)

    try {
      if (workerIds.length > 0) {
        await supabase.from('attendance')
          .delete()
          .in('labour_id', workerIds)
          .eq('project_id', selectedProject)
          .gte('date', startStr)
          .lte('date', endStr)
      }

      const inserts: any[] = []
      Object.values(gridData).forEach(row => {
        weekDates.forEach(d => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const cell = row.days[dateStr] || { status: '', overtime_amount: 0 }
          
          // Save every day. If not P or H, it defaults to 0 (Absent)
          inserts.push({
            labour_id: row.worker_id,
            project_id: selectedProject,
            date: dateStr,
            days_worked: cell.status === 'P' ? 1 : cell.status === 'H' ? 0.5 : 0,
            overtime_hours: 0,
            overtime_amount: cell.overtime_amount || 0,
            custom_rate: row.custom_rate,
            advance_amount: cell.advance_amount || 0,
            notes: null
          })
        })
      })

      if (inserts.length > 0) {
        const { error } = await supabase.from('attendance').insert(inserts)
        if (error) throw error
      }

      toast.success('Week saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Calculations
  const calcRowTotal = (row: WorkerRow) => {
    let days = 0
    let ot = 0
    let adv = 0
    Object.values(row.days).forEach(d => {
      if (d.status === 'P') days += 1
      else if (d.status === 'H') days += 0.5
      ot += d.overtime_amount || 0
      adv += d.advance_amount || 0
    })
    return (days * row.custom_rate) + ot - adv
  }

  const totals = useMemo(() => {
    let wCount = 0
    let days = 0
    let ot = 0
    let cost = 0

    Object.values(gridData).forEach(row => {
      let activeInWeek = false
      Object.values(row.days).forEach(d => {
        if (d.status !== '' || d.overtime_amount > 0 || d.advance_amount > 0) activeInWeek = true
        if (d.status === 'P') days += 1
        else if (d.status === 'H') days += 0.5
        ot += d.overtime_amount || 0
      })
      if (activeInWeek) wCount++
      cost += calcRowTotal(row)
    })

    return { wCount, days, ot, cost }
  }, [gridData])

  // UI Styles
  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Bar Controller */}
      <div style={PANEL} className="p-4 flex flex-col xl:flex-row gap-4 items-center justify-between sticky top-4 z-40 shadow-2xl">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full xl:w-auto">
          <select 
            value={selectedProject} 
            onChange={e => setSelectedProject(e.target.value)}
            className="styled-select h-11 min-w-[200px]"
          >
            <option value="" disabled>Select Project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="flex items-center gap-2 bg-[#0d1018] rounded-xl border border-[#1e2435] p-1 h-11">
            <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 text-xs font-black uppercase tracking-widest text-white whitespace-nowrap">
              {format(currentWeekStart, 'dd MMM')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'dd MMM yyyy')}
            </div>
            <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 hide-scrollbar">
          <button onClick={() => setShowAddWorker(true)} className="whitespace-nowrap h-11 px-4 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-white border border-[#1e2435] flex items-center gap-2 hover:bg-[#23293b] transition-colors">
            <Plus size={16} /> Add Worker
          </button>
          <button onClick={handleSave} disabled={saving || !selectedProject} className="whitespace-nowrap h-11 px-6 rounded-xl text-xs font-black uppercase bg-blue-500 text-white flex items-center gap-2 disabled:opacity-50 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] transition-all">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Week
          </button>
        </div>
      </div>

      {/* Week Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Workers', value: totals.wCount },
          { label: 'Total Days', value: totals.days.toFixed(1) },
          { label: 'Total Overtime', value: `₹${totals.ot.toLocaleString()}` },
          { label: 'Week Labour Cost', value: `₹${totals.cost.toLocaleString()}` }
        ].map((stat, i) => (
          <div key={i} style={PANEL} className="p-4 flex flex-col justify-center shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{stat.label}</p>
            <p className="text-xl font-black text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions & Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => markFullWeekPresent()} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Mark All Present</button>
        <button onClick={copyPreviousWeek} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 hover:bg-blue-500/20 flex items-center gap-1 transition-colors"><Copy size={12}/> Copy Prev Week</button>
      </div>

      {/* Dynamic Grid */}
      <div className="shadow-2xl">
        {loading ? (
          <div style={PANEL} className="py-24 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
        ) : Object.keys(gridData).length === 0 ? (
          <div style={PANEL} className="py-24 text-center flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-zinc-500 mb-6">No workers loaded for this week.</p>
            <button onClick={() => { setShowAddWorker(true); setSelectedWorkers([]); }} className="h-11 px-6 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-white border border-[#1e2435] hover:bg-[#23293b] transition-colors shadow-lg">Add Worker to Grid</button>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden xl:block overflow-x-auto hide-scrollbar" style={PANEL}>
              <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1e2435] bg-[#0d1018]">
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 sticky left-0 bg-[#0d1018] z-10 min-w-[200px]">Worker Details</th>
                {weekDates.map(d => (
                  <th key={d.toISOString()} className="py-4 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center min-w-[55px]">
                    {format(d, 'EEE')}<br/><span className="text-[9px] font-bold text-zinc-600 tracking-normal">{format(d, 'd MMM')}</span>
                  </th>
                ))}
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right min-w-[100px]">Custom Rate</th>
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right min-w-[100px]">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(gridData).sort((a, b) => {
                const getSortWeight = (type: string) => {
                  const t = (type || '').toLowerCase()
                  if (t.includes('mistry') || t.includes('skilled')) return 1
                  if (t.includes('women') || t.includes('woman') || t.includes('labour')) return 2
                  if (t.includes('helper')) return 3
                  return 4
                }
                const wA = getSortWeight(a.type)
                const wB = getSortWeight(b.type)
                if (wA !== wB) return wA - wB
                return a.name.localeCompare(b.name)
              }).map(row => (
                <tr key={row.worker_id} className="border-b border-[#1e2435] hover:bg-white/[0.02] group transition-colors">
                  <td className="py-3 px-4 sticky left-0 bg-[#111520] group-hover:bg-[#1a1f2e] transition-colors z-10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-white whitespace-nowrap">{row.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-wider mt-0.5">{row.type}</p>
                      </div>
                      <button onClick={() => removeWorkerFromGrid(row.worker_id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded transition-all">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                  
                  {weekDates.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd')
                    const cell = row.days[dateStr] || { status: '', overtime_amount: 0, advance_amount: 0 }
                    
                    return (
                      <td key={dateStr} className="py-2 px-1 text-center">
                        <div 
                          onClick={() => handleCellClick(row.worker_id, dateStr)}
                          className={cn(
                            "mx-auto w-11 h-11 rounded-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all border-2 relative",
                            cell.status === 'P' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
                            cell.status === 'H' ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" :
                            cell.status === 'A' ? "bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                            "bg-[#0d1018] border-[#1e2435] text-zinc-600 hover:border-zinc-500 hover:bg-[#1a1f2e]"
                          )}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-black leading-none">
                              {cell.status || '-'}
                            </span>
                            {cell.advance_amount > 0 && (
                              <span className="text-[9px] font-bold text-red-500 mt-0.5 leading-none">
                                {cell.advance_amount}
                              </span>
                            )}
                            {cell.overtime_amount > 0 && (
                              <span className="text-[9px] font-bold text-amber-500 mt-0.5 leading-none">
                                +{cell.overtime_amount}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                  
                  <td className="py-3 px-4 text-right">
                    <input 
                      type="number" 
                      value={row.custom_rate || ''} 
                      onChange={e => updateCustomRate(row.worker_id, e.target.value)}
                      className="w-20 h-9 text-right bg-[#0d1018] border border-[#1e2435] rounded-lg px-2 text-sm font-bold text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-black text-emerald-400 whitespace-nowrap">
                    ₹{Math.round(calcRowTotal(row)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="xl:hidden space-y-4">
          {Object.values(gridData).sort((a, b) => a.name.localeCompare(b.name)).map(row => (
            <div key={row.worker_id} style={PANEL} className="p-4 space-y-4">
              <div className="flex justify-between items-start border-b border-[#1e2435] pb-3">
                <div>
                  <p className="text-sm font-black text-white">{row.name}</p>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">{row.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    placeholder="Rate"
                    value={row.custom_rate || ''} 
                    onChange={e => updateCustomRate(row.worker_id, e.target.value)}
                    className="w-16 h-8 text-right bg-[#0d1018] border border-[#1e2435] rounded px-2 text-[10px] font-bold text-white outline-none"
                  />
                  <button onClick={() => removeWorkerFromGrid(row.worker_id)} className="p-2 text-red-500/50 hover:text-red-500 bg-red-500/5 rounded-lg transition-colors">
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {weekDates.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd')
                  const cell = row.days[dateStr] || { status: '', overtime_amount: 0, advance_amount: 0 }
                  return (
                    <div key={dateStr} className="flex flex-col items-center gap-1">
                      <span className="text-[8px] font-black text-zinc-600 uppercase">{format(d, 'EEE')}</span>
                      <div 
                        onClick={() => handleCellClick(row.worker_id, dateStr)}
                        className={cn(
                          "w-full h-10 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all border relative",
                          cell.status === 'P' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
                          cell.status === 'H' ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
                          cell.status === 'A' ? "bg-red-500/10 border-red-500/30 text-red-500" :
                          "bg-[#0d1018] border-[#1e2435] text-zinc-700"
                        )}
                      >
                        <span className="text-xs font-black">{cell.status || '-'}</span>
                        {(cell.advance_amount > 0 || cell.overtime_amount > 0) && (
                          <div className="absolute -top-1.5 -right-1.5 flex flex-col gap-0.5">
                             {cell.overtime_amount > 0 && <span className="w-4 h-4 bg-amber-500 text-[7px] text-white rounded-full flex items-center justify-center font-bold">OT</span>}
                             {cell.advance_amount > 0 && <span className="w-4 h-4 bg-red-500 text-[7px] text-white rounded-full flex items-center justify-center font-bold">AD</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Total</span>
                  <div className="w-full h-10 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-black text-emerald-400">₹{Math.round(calcRowTotal(row))}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </div>

      {/* Add Worker Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddWorker(false)}>
          <div className="rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 flex flex-col" style={{ ...PANEL, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4 border-b border-[#1e2435]">
              <p className="text-sm font-black text-white uppercase tracking-wide">Add Workers to Grid</p>
              <button onClick={() => setShowAddWorker(false)} className="text-zinc-500 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"><X size={18}/></button>
            </div>
            
            <div className="p-6 pt-4 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search worker name..." 
                  value={searchQuery}
                  autoFocus
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-xl text-sm font-semibold outline-none" 
                  style={INPUT_ST} 
                />
              </div>
            </div>

            <div className="overflow-y-auto px-6 pb-4 flex-1 space-y-1.5 custom-scrollbar">
              {labourers
                .filter(l => !gridData[l.id]) // Only show ones not in grid
                .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(l => (
                  <button 
                    key={l.id} 
                    onClick={() => {
                      if (selectedWorkers.includes(l.id)) {
                        setSelectedWorkers(prev => prev.filter(id => id !== l.id))
                      } else {
                        setSelectedWorkers(prev => [...prev, l.id])
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      selectedWorkers.includes(l.id) 
                        ? "bg-blue-500/10 border-blue-500/50" 
                        : "bg-[#0d1018] hover:bg-[#1a1f2e] border-[#1e2435] hover:border-zinc-700"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                      selectedWorkers.includes(l.id) 
                        ? "bg-blue-500 border-blue-500" 
                        : "bg-[#111520] border-[#1e2435]"
                    )}>
                      {selectedWorkers.includes(l.id) && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{l.name}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mt-1">{l.type} • ₹{l.daily_rate}/day</p>
                    </div>
                  </button>
              ))}
              {labourers.filter(l => !gridData[l.id]).length === 0 && (
                <div className="py-8 text-center bg-[#0d1018] rounded-xl border border-[#1e2435]">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-zinc-500">All available workers<br/>are already in the grid.</p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-[#1e2435] bg-[#111520] rounded-b-2xl">
              <button 
                disabled={selectedWorkers.length === 0}
                onClick={addSelectedWorkersToGrid} 
                className="w-full h-12 rounded-xl text-xs font-black uppercase bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add {selectedWorkers.length} Worker{selectedWorkers.length !== 1 ? 's' : ''} to Grid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Detail Popup */}
      {activePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActivePopup(null)}>
          <div className="rounded-2xl p-6 w-full max-w-[320px] space-y-6 shadow-2xl animate-in zoom-in-95" style={PANEL} onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1 border-b border-[#1e2435] pb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Attendance Details</p>
              <p className="text-sm font-bold text-white">{gridData[activePopup.worker_id]?.name}</p>
              <p className="text-[10px] text-zinc-500 font-bold">{format(new Date(activePopup.date), 'EEEE, dd MMM')}</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 'P', label: 'P', color: 'bg-emerald-500' },
                    { val: 'H', label: 'H', color: 'bg-amber-500' },
                    { val: 'A', label: 'A', color: 'bg-red-500' },
                    { val: '', label: 'None', color: 'bg-zinc-700' }
                  ].map(s => {
                    const isDisabled = popupData.status === 'P' && (s.val === 'H' || s.val === 'A');
                    return (
                      <button
                        key={s.val}
                        disabled={isDisabled}
                        onClick={() => setPopupData({ ...popupData, status: s.val as AttendanceStatus })}
                        className={cn(
                          "h-10 rounded-lg text-xs font-black transition-all border-2",
                          popupData.status === s.val 
                            ? `${s.color} border-white text-white` 
                            : "bg-[#0d1018] border-[#1e2435] text-zinc-500 hover:border-zinc-600",
                          isDisabled && "opacity-20 cursor-not-allowed"
                        )}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">OT (₹)</label>
                  <input 
                    type="number" 
                    disabled={popupData.status === 'P'}
                    value={popupData.overtime_amount || ''}
                    onChange={e => setPopupData({ ...popupData, overtime_amount: parseFloat(e.target.value) || 0 })}
                    className={cn("w-full h-11 text-center font-bold rounded-xl outline-none transition-all", popupData.status === 'P' && "opacity-20")}
                    style={INPUT_ST} 
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deduction (₹)</label>
                  <input 
                    type="number" 
                    value={popupData.advance_amount || ''}
                    onChange={e => setPopupData({ ...popupData, advance_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full h-11 text-center font-bold rounded-xl outline-none text-red-500" 
                    style={INPUT_ST} 
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setActivePopup(null)} className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={handleApplyPopup} className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
