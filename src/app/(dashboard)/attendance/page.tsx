'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Loader2, 
  Table as TableIcon
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
import { addWeeks, format, endOfWeek, startOfWeek } from 'date-fns'

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

  const visibleWeekLabel = `${format(new Date(filterStart), 'dd MMM yyyy')} - ${format(new Date(filterEnd), 'dd MMM yyyy')}`

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const GOLD = '#3b82f6'
  const DIM = '#6b7280'
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }
  const SC_ST = { backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Attendance</h1>
        <p className="mt-1 text-sm" style={{ color: DIM }}>Mark daily attendance for workers on projects.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <div className="lg:col-span-4">
          <div style={PANEL} className="p-6">
            <p className="text-sm font-black text-white mb-6 uppercase tracking-wide">Mark Attendance</p>
            <form onSubmit={handleMarkAttendance} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Worker</label>
                <Select onValueChange={(v) => handleWorkerChange(v || '')} value={selectedWorkerId}>
                  <SelectTrigger className="h-11 rounded-xl font-semibold text-sm" style={INPUT_ST}>
                    <SelectValue placeholder="Select worker" items={Object.fromEntries(labourers.map(l => [l.id, l.name]))} />
                  </SelectTrigger>
                  <SelectContent style={SC_ST}>
                    {labourers.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Daily Rate (₹)</label>
                <input type="number" value={customRate} onChange={e => setCustomRate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project</label>
                <Select onValueChange={(v: string | null) => setSelectedProjectId(v ?? '')} value={selectedProjectId}>
                  <SelectTrigger className="h-11 rounded-xl font-semibold text-sm" style={INPUT_ST}>
                    <SelectValue placeholder="Select project" items={Object.fromEntries(projects.map(p => [p.id, p.name]))} />
                  </SelectTrigger>
                  <SelectContent style={SC_ST}>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Status</label>
                <Select onValueChange={(v: string | null) => setStatus(v ?? 'full')} value={status}>
                  <SelectTrigger className="h-11 rounded-xl font-semibold text-sm" style={INPUT_ST}>
                    <SelectValue placeholder="Full Day" items={{ full: 'Full Day', half: 'Half Day', overtime: 'Overtime' }} />
                  </SelectTrigger>
                  <SelectContent style={SC_ST}>
                    <SelectItem value="full">Full Day</SelectItem>
                    <SelectItem value="half">Half Day</SelectItem>
                    <SelectItem value="overtime">Overtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                  <p className="text-[11px] mt-1" style={{ color: DIM }}>Sunday to Saturday</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePreviousWeek}
                    className="h-9 px-4 rounded-lg text-[10px] font-black uppercase"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>
                    Previous Week
                  </button>
                  <button onClick={handleNextWeek}
                    className="h-9 px-4 rounded-lg text-[10px] font-black uppercase"
                    style={{ backgroundColor: GOLD, color: '#0a0c12' }}>
                    Next Week
                  </button>
                </div>
              </div>
            </div>
            <Table>
              <TableHeader style={{ backgroundColor: '#0d1018' }}>
                <TableRow style={{ borderColor: '#1e2435' }}>
                  {['Date', 'Worker', 'Project', 'Status', 'Overtime', 'Adv', 'Remarks'].map(h => (
                    <TableHead key={h} className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-center" style={{ color: DIM }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i} style={{ borderColor: '#1e2435' }}>
                      <TableCell colSpan={6} className="h-14 animate-pulse" style={{ backgroundColor: '#1a1f2e' }} />
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <TableIcon size={36} style={{ color: DIM, opacity: 0.3 }} />
                        <p className="text-sm font-bold" style={{ color: DIM }}>No records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((rec) => (
                    <TableRow key={rec.id} style={{ borderColor: '#1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-4 py-4 text-xs font-semibold" style={{ color: DIM }}>{format(new Date(rec.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="px-4 py-4 font-bold text-white text-sm">{rec.labour?.name}</TableCell>
                      <TableCell className="px-4 py-4 text-xs" style={{ color: DIM }}>{rec.projects?.name}</TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <Badge className={cn(
                          "text-[8px] font-black px-2 py-0.5 border-none",
                          rec.days_worked === 1 ? "bg-emerald-500/10 text-emerald-500" : 
                          rec.days_worked === 0.5 ? "bg-amber-500/10 text-amber-500" : 
                          "bg-red-500/10 text-red-500"
                        )}>
                          {rec.days_worked === 1 ? 'FULL' : rec.days_worked === 0.5 ? 'HALF' : 'ABSENT'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-xs font-bold text-center text-white">₹{rec.overtime_amount || 0}</TableCell>
                      <TableCell className="px-4 py-4 text-xs font-bold text-center text-red-500">₹{rec.advance_amount || 0}</TableCell>
                      <TableCell className="px-4 py-4 text-[10px] italic text-zinc-500 max-w-[120px] truncate">{rec.notes || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
