'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  X,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { addWeeks, format, endOfWeek, startOfWeek, eachDayOfInterval, subWeeks, parseISO, subDays } from 'date-fns'

type AttendanceStatus = 'P' | 'H' | 'A' | ''

type DayRecord = {
  status: AttendanceStatus
  paid_amount?: number
}

type WorkerRow = {
  worker_id: string
  name: string
  type: string
  default_rate: number
  custom_rate: number
  phone?: string
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
  
  const [viewMode, setViewMode] = useState<'grid' | 'heatmap'>('grid')
  const [heatmapCursor, setHeatmapCursor] = useState<Date>(new Date())
  const [heatmapCounts, setHeatmapCounts] = useState<Record<string, number>>({})
  const [heatmapLoading, setHeatmapLoading] = useState(false)

  const fetchMonthHeatmap = async (projId: string, monthDate: Date) => {
    try {
      setHeatmapLoading(true)
      const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)
      
      const startStr = format(startOfMonth(monthDate), 'yyyy-MM-dd')
      const endStr = format(endOfMonth(monthDate), 'yyyy-MM-dd')
      
      const { data, error } = await supabase
        .from('attendance')
        .select('date, days_worked')
        .eq('project_id', projId)
        .gte('date', startStr)
        .lte('date', endStr)
        
      if (error) throw error
      
      const counts: Record<string, number> = {}
      data?.forEach((r: any) => {
        if (r.days_worked > 0) {
          counts[r.date] = (counts[r.date] || 0) + 1
        }
      })
      setHeatmapCounts(counts)
    } catch (e: any) {
      console.error('Failed to load heatmap:', e)
    } finally {
      setHeatmapLoading(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'heatmap' && selectedProject) {
      fetchMonthHeatmap(selectedProject, heatmapCursor)
    }
  }, [viewMode, selectedProject, heatmapCursor])
  
  const heatmapDays = useMemo(() => {
    const startOfHeatmapMonth = new Date(heatmapCursor.getFullYear(), heatmapCursor.getMonth(), 1)
    const endOfHeatmapMonth = new Date(heatmapCursor.getFullYear(), heatmapCursor.getMonth() + 1, 0)
    const startDayOfWeek = startOfHeatmapMonth.getDay()
    const padding = Array(startDayOfWeek).fill(null)
    const days = []
    for (let i = 1; i <= endOfHeatmapMonth.getDate(); i++) {
      days.push(new Date(heatmapCursor.getFullYear(), heatmapCursor.getMonth(), i))
    }
    return [...padding, ...days]
  }, [heatmapCursor])

  // Modals & Panels
  const [showAddWorker, setShowAddWorker] = useState(false)
  const [showAddTempWorker, setShowAddTempWorker] = useState(false)
  const [tempWorkerName, setTempWorkerName] = useState('')
  const [tempWorkerType, setTempWorkerType] = useState('Labour (Women)')
  const [tempWorkerRate, setTempWorkerRate] = useState('800')
  const [addingTemp, setAddingTemp] = useState(false)

  // Promotion State
  const [showPromoteModal, setShowPromoteModal] = useState(false)
  const [promoteWorkerId, setPromoteWorkerId] = useState<string | null>(null)
  const [promotePhone, setPromotePhone] = useState('')
  const [promoteName, setPromoteName] = useState('')
  const [promoteType, setPromoteType] = useState('')
  const [promoting, setPromoting] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [otMode, setOtMode] = useState(false)
  
  // Popup State
  const [activePopup, setActivePopup] = useState<{ worker_id: string, date: string } | null>(null)
  const [popupData, setPopupData] = useState<DayRecord>({ status: '', paid_amount: 0 })

  // Daily grouped notes: one note per date applies to ALL workers
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({})
  const [activeNotePopup, setActiveNotePopup] = useState<{ date: string } | null>(null)
  const [noteDraft, setNoteDraft] = useState<string>('')

  // Band Day & Calendar States
  const [bandDays, setBandDays] = useState<Record<string, { status: string, reason: string | null }>>({})
  const [calendarEvents, setCalendarEvents] = useState<Record<string, any>>({})
  const [showBandModal, setShowBandModal] = useState<{ date: string, isAmavasya: boolean } | null>(null)
  const [bandReason, setBandReason] = useState('Amavasya')
  const [bandCustomReason, setBandCustomReason] = useState('')

  const supabase = createClient()

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
    setLabourers(labData?.filter((l: any) => l.phone !== 'TEMPORARY') || [])

    const savedActive = localStorage.getItem('ssc_active_project_id')
    let currentId = selectedProject

    if (!currentId) {
      if (savedActive && projData?.some(p => p.id === savedActive)) {
        currentId = savedActive
      } else if (projData && projData.length > 0) {
        currentId = projData[0].id
      }
      setSelectedProject(currentId)
    }

    if (currentId) {
      localStorage.setItem('ssc_active_project_id', currentId)
      loadWeekData(currentId, currentWeekStart)
    }
  }

  // Effect to load week data when project or week changes
  useEffect(() => {
    if (selectedProject) {
      loadWeekData(selectedProject, currentWeekStart)
    }
  }, [selectedProject, currentWeekStart])

  useEffect(() => {
    const handleProjectChanged = () => {
      const activeProjId = localStorage.getItem('ssc_active_project_id')
      if (activeProjId && activeProjId !== selectedProject) {
        setSelectedProject(activeProjId || '')
      } else if (selectedProject) {
        loadWeekData(selectedProject, currentWeekStart)
      }
    }
    window.addEventListener('ssc_project_changed', handleProjectChanged)
    return () => {
      window.removeEventListener('ssc_project_changed', handleProjectChanged)
    }
  }, [selectedProject, currentWeekStart])

  useEffect(() => {
    const onSave = () => handleSave()
    const onCopyPrev = () => copyYesterdayAttendance()
    const onAddWorker = () => setShowAddWorker(true)
    const onToggleOt = () => setOtMode(prev => !prev)

    window.addEventListener('ssc_attendance_save', onSave)
    window.addEventListener('ssc_attendance_copy_prev', onCopyPrev)
    window.addEventListener('ssc_attendance_add_worker', onAddWorker)
    window.addEventListener('ssc_attendance_toggle_ot', onToggleOt)

    return () => {
      window.removeEventListener('ssc_attendance_save', onSave)
      window.removeEventListener('ssc_attendance_copy_prev', onCopyPrev)
      window.removeEventListener('ssc_attendance_add_worker', onAddWorker)
      window.removeEventListener('ssc_attendance_toggle_ot', onToggleOt)
    }
  }, [gridData, selectedProject, currentWeekStart, dailyNotes])

  async function loadWeekData(projectId: string, weekStart: Date) {
    setLoading(true)
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const endStr = format(endOfWeek(weekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('attendance')
      .select('*, labour(name, type, daily_rate, phone)')
      .eq('project_id', projectId)
      .gte('date', startStr)
      .lte('date', endStr)

    const newGrid: Record<string, WorkerRow> = {}
    const notesByDate: Record<string, string> = {}

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
            phone: r.labour?.phone || '',
            days: {}
          }
        }
        
        let status: AttendanceStatus = ''
        if (r.days_worked === 1) status = 'P'
        else if (r.days_worked === 0.5) status = 'H'
        else if (r.days_worked === 0) status = 'A' // Pure absent

        newGrid[wId].days[r.date] = {
          status,
          paid_amount: 0
        }
        // Extract per-date note (all workers on same date share same note)
        if (r.notes && r.notes.trim() && !notesByDate[r.date]) {
          notesByDate[r.date] = r.notes.trim()
        }
      })
    }

    // Load payments for this week
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)

    if (paymentsData) {
      paymentsData.forEach((p: any) => {
        const wId = p.labour_id
        if (newGrid[wId]) {
          if (!newGrid[wId].days[p.date]) {
            newGrid[wId].days[p.date] = { status: '', paid_amount: 0 }
          }
          newGrid[wId].days[p.date].paid_amount = Number(p.amount) || 0
        }
      })
    }

    // Load Band Days
    const { data: bandData } = await supabase
      .from('project_day_status')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'BAND')
      .gte('date', startStr)
      .lte('date', endStr)

    const newBandDays: Record<string, { status: string, reason: string | null }> = {}
    if (bandData) {
      bandData.forEach((b: any) => {
        newBandDays[b.date] = { status: b.status, reason: b.reason }
      })
    }

    // Load Calendar Events
    const { data: calData } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)

    const newCalendarEvents: Record<string, any> = {}
    if (calData) {
      calData.forEach((c: any) => {
        newCalendarEvents[c.date] = c
      })
    }

    setGridData(newGrid)
    setDailyNotes(notesByDate)
    setBandDays(newBandDays)
    setCalendarEvents(newCalendarEvents)
    setLoading(false)
  }

  // Interactions
  const handleCellClick = (workerId: string, dateStr: string) => {
    if (bandDays[dateStr]?.status === 'BAND') {
      toast.error('Cannot mark attendance on a BAND DAY. Unmark it first.')
      return
    }
    const current = gridData[workerId]?.days[dateStr] || { status: '', paid_amount: 0 }
    setPopupData({
      status: current.status,
      paid_amount: current.paid_amount || 0
    })
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
            phone: worker.phone || '',
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

  const handleAddTempWorker = async () => {
    if (!tempWorkerName.trim()) {
      toast.error('Name is required')
      return
    }
    setAddingTemp(true)
    try {
      // Insert worker in database
      const { data: newWorker, error } = await supabase
        .from('labour')
        .insert([{
          name: tempWorkerName.trim(),
          phone: 'TEMPORARY',
          type: tempWorkerType,
          gender: tempWorkerType.toLowerCase().includes('women') ? 'Female' : 'Male',
          daily_rate: Number.parseFloat(tempWorkerRate || '0')
        }])
        .select()
        .single()

      if (error) throw error

      if (newWorker) {
        // Add worker to the active week grid
        setGridData(prev => ({
          ...prev,
          [newWorker.id]: {
            worker_id: newWorker.id,
            name: newWorker.name,
            type: newWorker.type,
            default_rate: newWorker.daily_rate,
            custom_rate: newWorker.daily_rate,
            phone: 'TEMPORARY',
            days: {}
          }
        }))
        toast.success('Temporary worker added to grid')
        // Close dialog and reset form
        setShowAddTempWorker(false)
        setTempWorkerName('')
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to add temporary worker')
    } finally {
      setAddingTemp(false)
    }
  }

  const handlePromoteWorker = async () => {
    if (!promoteWorkerId) return
    if (!promotePhone.trim() || promotePhone.trim().length < 10) {
      toast.error('Please enter a valid 10-digit mobile number')
      return
    }
    setPromoting(true)
    try {
      // 1. Update worker's phone number in labour table
      const { error: updErr } = await supabase
        .from('labour')
        .update({ phone: promotePhone.trim() })
        .eq('id', promoteWorkerId)

      if (updErr) throw updErr

      // 2. Add to contacts
      const { error: cntErr } = await supabase
        .from('contacts')
        .insert([{
          name: promoteName,
          phone: promotePhone.trim(),
          type: promoteType
        }])

      if (cntErr) throw cntErr

      // 3. Update local gridData phone
      setGridData(prev => {
        const next = { ...prev }
        if (next[promoteWorkerId]) {
          next[promoteWorkerId].phone = promotePhone.trim()
        }
        return next
      })

      toast.success('Worker successfully promoted to permanent contact!')
      setShowPromoteModal(false)
      setPromoteWorkerId(null)
      setPromotePhone('')
    } catch (e: any) {
      toast.error(e.message || 'Failed to promote worker')
    } finally {
      setPromoting(false)
    }
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
          const currentDay = newDays[dateStr] || { status: '', paid_amount: 0 }
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
            newDays[dateStr] = { ...newDays[dateStr], status: '', paid_amount: 0 }
          }
        })
        next[wId] = { ...next[wId], days: newDays }
      })
      return next
    })
  }

  const copyYesterdayAttendance = async () => {
    if (!selectedProject) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayDate = subDays(new Date(), 1)
    const yesterdayStr = format(yesterdayDate, 'yyyy-MM-dd')

    // Find if today is in the current weekDates
    const hasToday = weekDates.some(d => format(d, 'yyyy-MM-dd') === todayStr)
    if (!hasToday) {
      toast.error("Today's date is not in the currently displayed week.")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('labour_id, days_worked, notes')
        .eq('project_id', selectedProject)
        .eq('date', yesterdayStr)

      if (error) throw error

      if (data && data.length > 0) {
        setGridData(prev => {
          const next = { ...prev }
          data.forEach((r: any) => {
            const wId = r.labour_id
            if (next[wId]) {
              let status: AttendanceStatus = ''
              if (r.days_worked === 1) status = 'P'
              else if (r.days_worked === 0.5) status = 'H'
              else if (r.days_worked === 0) status = 'A'

              if (!next[wId].days[todayStr]) {
                next[wId].days[todayStr] = { status: '', paid_amount: 0 }
              }
              next[wId].days[todayStr].status = status
            }
          })
          return next
        })
        toast.success(`Copied yesterday's (${format(yesterdayDate, 'dd MMM')}) attendance to today`)
      } else {
        toast.error(`No attendance records found for yesterday (${format(yesterdayDate, 'dd MMM')})`)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to copy yesterday's attendance")
    } finally {
      setLoading(false)
    }
  }

  const copyPreviousDayColumn = (targetDateStr: string) => {
    const targetDate = parseISO(targetDateStr)
    const prevDate = subDays(targetDate, 1)
    const prevDateStr = format(prevDate, 'yyyy-MM-dd')

    setGridData(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(wId => {
        const prevCell = next[wId].days[prevDateStr]
        const status = prevCell ? prevCell.status : ''
        
        if (!next[wId].days[targetDateStr]) {
          next[wId].days[targetDateStr] = { status: '', paid_amount: 0 }
        }
        next[wId].days[targetDateStr].status = status
      })
      return next
    })
    toast.success(`Copied attendance from ${format(prevDate, 'EEE')} to ${format(targetDate, 'EEE')}`)
  }

  
  // Band Day Actions
  const handleMarkBandDay = async () => {
    if (!showBandModal || !selectedProject) return
    const { date, isAmavasya } = showBandModal
    const finalReason = bandReason === 'Other' ? bandCustomReason : bandReason
    
    try {
      setSaving(true)
      
      // Upsert into project_day_status
      const { error: upsertErr } = await supabase
        .from('project_day_status')
        .upsert({
          project_id: selectedProject,
          date,
          status: 'BAND',
          reason: finalReason,
          source: isAmavasya ? 'CALENDAR' : 'MANUAL'
        }, { onConflict: 'project_id,date' })
        
      if (upsertErr) throw upsertErr

      // Delete any existing attendance records for this date to clear 'A' or accidental marks
      await supabase
        .from('attendance')
        .delete()
        .eq('project_id', selectedProject)
        .eq('date', date)

      // Clear local state for this date
      setGridData(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(wId => {
          if (next[wId].days[date]) {
            next[wId].days[date] = { status: '', paid_amount: 0 }
          }
        })
        return next
      })

      setBandDays(prev => ({
        ...prev,
        [date]: { status: 'BAND', reason: finalReason }
      }))

      setShowBandModal(null)
      setBandReason('Amavasya')
      setBandCustomReason('')
      toast.success(`${format(parseISO(date), 'dd MMM')} marked as BAND DAY.`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark Band Day')
    } finally {
      setSaving(false)
    }
  }

  const handleUnmarkBandDay = async (date: string) => {
    if (!selectedProject) return
    if (!confirm('Are you sure you want to unmark this Band Day?')) return
    
    try {
      setSaving(true)
      const { error } = await supabase
        .from('project_day_status')
        .delete()
        .eq('project_id', selectedProject)
        .eq('date', date)
        
      if (error) throw error
      
      setBandDays(prev => {
        const next = { ...prev }
        delete next[date]
        return next
      })
      toast.success('Band Day removed. You can now mark attendance.')
    } catch (e: any) {
      toast.error(e.message || 'Failed to unmark Band Day')
    } finally {
      setSaving(false)
    }
  }

// Save Logic
  const handleSave = async () => {
    if (!selectedProject) return
    
    const workerIds = Object.keys(gridData)
    if (workerIds.length === 0) {
      toast.error('Cannot save: Please add at least one worker to the grid to save attendance and daily logs.')
      return
    }

    setSaving(true)
    
    const startStr = format(currentWeekStart, 'yyyy-MM-dd')
    const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')

    try {
      // Delete ALL existing attendance records for this project and week
      // This ensures that if a worker was removed from the grid, their records are gone
      await supabase.from('attendance')
        .delete()
        .eq('project_id', selectedProject)
        .gte('date', startStr)
        .lte('date', endStr)

      // Delete payments for this week and project's workers
      await supabase.from('payments')
        .delete()
        .in('labour_id', workerIds)
        .gte('date', startStr)
        .lte('date', endStr)

      const inserts: any[] = []
      const paymentInserts: any[] = []

      Object.values(gridData).forEach(row => {
        weekDates.forEach(d => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const cell = row.days[dateStr] || { status: '', paid_amount: 0 }
          // All workers on same day share the same grouped note
          const sharedNote = dailyNotes[dateStr] || null
          
          // Do not save attendance if it's a BAND day
          if (bandDays[dateStr]?.status === 'BAND') return;
          
          // Save every day. If not P or H, it defaults to 0 (Absent)
          inserts.push({
            labour_id: row.worker_id,
            project_id: selectedProject,
            date: dateStr,
            days_worked: cell.status === 'P' ? 1 : cell.status === 'H' ? 0.5 : 0,
            overtime_hours: 0,
            overtime_amount: 0,
            custom_rate: row.custom_rate,
            advance_amount: 0,
            notes: sharedNote
          })

          if (cell.paid_amount && cell.paid_amount > 0) {
            paymentInserts.push({
              labour_id: row.worker_id,
              amount: cell.paid_amount,
              date: dateStr,
              payment_type: 'REGULAR',
              notes: `Spot payment for work on ${dateStr}`
            })
          }
        })
      })

      if (inserts.length > 0) {
        const { error } = await supabase.from('attendance').insert(inserts)
        if (error) throw error
      }

      if (paymentInserts.length > 0) {
        const { error: payErr } = await supabase.from('payments').insert(paymentInserts)
        if (payErr) throw payErr
      }

      toast.success('Week saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Calculations
  const calcRowGross = (row: WorkerRow) => {
    let days = 0
    Object.values(row.days).forEach(d => {
      if (d.status === 'P') days += 1
      else if (d.status === 'H') days += 0.5
    })
    return days * row.custom_rate
  }

  const calcRowPaid = (row: WorkerRow) => {
    let paid = 0
    Object.values(row.days).forEach(d => {
      paid += d.paid_amount || 0
    })
    return paid
  }

  const calcRowGiveable = (row: WorkerRow) => {
    return calcRowGross(row) - calcRowPaid(row)
  }

  // Weekly tasks summary is now date-based (grouped, not per worker)
  const getWeeklyTasksSummary = () => {
    const tasks: string[] = []
    weekDates.forEach(d => {
      const dateStr = format(d, 'yyyy-MM-dd')
      const note = dailyNotes[dateStr]
      if (note && note.trim()) {
        tasks.push(`${format(d, 'EEE')}: ${note.trim()}`)
      }
    })
    return tasks.join(' | ')
  }

  const totals = useMemo(() => {
    let wCount = 0
    let mDays = 0 // Mistry
    let lDays = 0 // Labour
    let pDays = 0 // Parakadu
    let cost = 0 // Net due cost
    let grossCost = 0 // Gross cost
    let totalPaid = 0

    Object.values(gridData).forEach(row => {
      let activeInWeek = false
      const type = (row.type || '').toLowerCase()
      
      Object.values(row.days).forEach(d => {
        if (d.status !== '' || (d.paid_amount && d.paid_amount > 0)) activeInWeek = true
        
        let dayVal = 0
        if (d.status === 'P') dayVal = 1
        else if (d.status === 'H') dayVal = 0.5
        
        if (type.includes('mistry') || type.includes('skilled')) mDays += dayVal
        else if (type.includes('women') || type.includes('labour')) lDays += dayVal
        else pDays += dayVal
      })
      if (activeInWeek) wCount++
      cost += calcRowGiveable(row)
      grossCost += calcRowGross(row)
      totalPaid += calcRowPaid(row)
    })

    return { wCount, mDays, lDays, pDays, ot: 0, cost, grossCost, totalPaid }
  }, [gridData])

  // UI Styles
  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Bar Controller */}
      <div style={PANEL} className="p-4 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shadow-2xl">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full xl:w-auto">
          <select 
            value={selectedProject} 
            onChange={e => setSelectedProject(e.target.value)}
            className="styled-select h-11 w-full sm:w-auto sm:min-w-[200px]"
          >
            <option value="" disabled>Select Project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div className="flex bg-[#0d1018] rounded-xl border border-[#1e2435] p-0.5 h-11 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn("px-4 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all", viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white')}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={cn("px-4 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all", viewMode === 'heatmap' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white')}
            >
              Heatmap
            </button>
          </div>

          {viewMode === 'grid' ? (
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
          ) : (
            <div className="flex items-center gap-2 bg-[#0d1018] rounded-xl border border-[#1e2435] p-1 h-11">
              <button 
                onClick={() => setHeatmapCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} 
                className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-3 text-xs font-black uppercase tracking-widest text-white whitespace-nowrap">
                {format(heatmapCursor, 'MMMM yyyy')}
              </div>
              <button 
                onClick={() => setHeatmapCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} 
                className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <button onClick={() => setShowAddWorker(true)} className="whitespace-nowrap h-11 px-4 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-white border border-[#1e2435] flex items-center gap-2 hover:bg-[#23293b] transition-colors">
            <Plus size={16} /> Add Worker
          </button>
          <button onClick={() => setShowAddTempWorker(true)} className="whitespace-nowrap h-11 px-4 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-amber-500 border border-[#1e2435] flex items-center gap-2 hover:bg-[#23293b] transition-colors">
            <Zap size={16} /> + Temp Worker
          </button>
          <button onClick={handleSave} disabled={saving || !selectedProject} className="whitespace-nowrap h-11 px-6 rounded-xl text-xs font-black uppercase bg-blue-500 text-white flex items-center gap-2 disabled:opacity-50 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] transition-all">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Week
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <>
          {/* Week Summary Panel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Workers', value: totals.wCount },
          { label: 'Grand Total (Earned)', value: `₹${totals.grossCost.toLocaleString('en-IN')}` },
          { label: 'Spot Paid This Week', value: `₹${totals.totalPaid.toLocaleString('en-IN')}` },
          { label: 'Net Outstanding Due', value: `₹${totals.cost.toLocaleString('en-IN')}` }
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
        <button onClick={copyYesterdayAttendance} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 hover:bg-blue-500/20 flex items-center gap-1 transition-colors"><Copy size={12}/> Copy Yesterday</button>
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
            <div className="hidden xl:block hide-scrollbar" style={PANEL}>
              <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1e2435] bg-[#0d1018]">
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 sticky left-0 bg-[#0d1018] z-10 min-w-[200px]">Worker Details</th>
                {weekDates.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd')
                  return (
                    <th key={d.toISOString()} className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center min-w-[65px] group/col hover:bg-white/[0.01] transition-colors relative">
                      <div className="flex flex-col items-center justify-between min-h-[56px]">
                        <span>{format(d, 'EEE')}</span>
                        <span className="text-[9px] font-bold text-zinc-600 tracking-normal flex flex-col items-center">
                          {format(d, 'd MMM')}
                          {calendarEvents[dateStr] && calendarEvents[dateStr].event_type === 'AMAVASYA' && (
                            <span title="Amavasya Today" className="mt-0.5 text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded cursor-help">
                              🌑 AMAVASYA
                            </span>
                          )}
                        </span>
                        {bandDays[dateStr]?.status === 'BAND' ? (
                          <button
                            onClick={() => handleUnmarkBandDay(dateStr)}
                            className="mt-1 px-1.5 py-0.5 rounded bg-red-500/20 text-[7px] text-red-400 font-bold uppercase whitespace-nowrap hover:bg-red-500 hover:text-white transition-all"
                          >
                            🔴 UNMARK
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowBandModal({ date: dateStr, isAmavasya: !!calendarEvents[dateStr] })}
                            className="opacity-0 group-hover/col:opacity-100 mt-1 px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-red-500/20 text-[7px] text-zinc-500 hover:text-red-400 font-bold transition-all uppercase whitespace-nowrap"
                          >
                            Mark Band
                          </button>
                        )}
                        <button
                          onClick={() => copyPreviousDayColumn(dateStr)}
                          title={`Copy attendance from previous day to ${format(d, 'EEEE')}`}
                          className="opacity-0 group-hover/col:opacity-100 px-1 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-[7px] text-blue-400 font-bold transition-all uppercase tracking-wider whitespace-nowrap mt-1 cursor-pointer"
                        >
                          Copy Prev
                        </button>
                      </div>
                    </th>
                  )
                })}
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right min-w-[100px]">Custom Rate</th>
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right min-w-[110px]">Grand Total (₹)</th>
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right min-w-[110px]">Spot Paid (₹)</th>
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right min-w-[110px]">Giveable (₹)</th>
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
                        <p className="text-sm font-bold text-white whitespace-nowrap flex items-center gap-1.5">
                          {row.name}
                          {row.phone === 'TEMPORARY' && (
                            <span className="text-[8px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1 py-0.5 rounded font-black uppercase tracking-wider shrink-0">Temp</span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-wider mt-0.5">{row.type}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {row.phone === 'TEMPORARY' && (
                          <button 
                            onClick={() => {
                              setPromoteWorkerId(row.worker_id)
                              setPromoteName(row.name)
                              setPromoteType(row.type)
                              setPromotePhone('')
                              setShowPromoteModal(true)
                            }}
                            title="Promote to Contact"
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 rounded transition-all"
                          >
                            <Zap size={14}/>
                          </button>
                        )}
                        <button onClick={() => removeWorkerFromGrid(row.worker_id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded transition-all">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  </td>
                  
                  {weekDates.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd')
                    const cell = row.days[dateStr] || { status: '', paid_amount: 0 }
                    
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
                              {bandDays[dateStr]?.status === 'BAND' ? 'B' : (cell.status || '-')}
                            </span>
                          </div>
                          {cell.paid_amount && cell.paid_amount > 0 ? (
                            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_4px_rgba(16,185,129,0.5)]" title={`Spot Paid: ₹${cell.paid_amount}`} />
                          ) : null}
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
                  <td className="py-3 px-4 text-right text-sm font-black text-blue-400 whitespace-nowrap">
                    ₹{Math.round(calcRowGross(row)).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-black text-emerald-400 whitespace-nowrap">
                    {calcRowPaid(row) > 0 ? `₹${Math.round(calcRowPaid(row)).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-black text-amber-500 whitespace-nowrap">
                    ₹{Math.round(calcRowGiveable(row)).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
              {/* Work Done Row — one square input per day for the whole group */}
              <tr className="border-t-2 border-blue-500/20 bg-blue-500/5">
                <td className="py-3 px-4 sticky left-0 bg-[#0d0f16] z-10">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Work Done</p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">All workers · Per day</p>
                  </div>
                </td>
                {weekDates.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd')
                  const hasNote = !!(dailyNotes[dateStr] && dailyNotes[dateStr].trim())
                  return (
                    <td key={dateStr} className="py-2 px-1 text-center">
                      <div className="flex flex-col items-center gap-1 mx-auto" style={{ width: '44px' }}>
                        <button
                          onClick={() => {
                            setNoteDraft(dailyNotes[dateStr] || '')
                            setActiveNotePopup({ date: dateStr })
                          }}
                          title={dailyNotes[dateStr] || "Click to add work log"}
                          className={cn(
                            "w-11 h-11 rounded-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all border-2 relative overflow-hidden group/note",
                            hasNote 
                              ? "bg-blue-500/10 border-blue-500/40 text-blue-300 hover:border-blue-400 hover:bg-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.15)]" 
                              : "bg-[#0d1018] border-[#1e2435] border-dashed text-zinc-500 hover:border-zinc-500 hover:bg-[#1a1f2e]"
                          )}
                        >
                          {hasNote ? (
                            <span className="text-[9px] font-bold tracking-tight px-1 truncate w-full text-center">
                              {dailyNotes[dateStr]}
                            </span>
                          ) : (
                            <span className="text-xs font-black text-zinc-600 group-hover/note:text-zinc-400 transition-colors">✎</span>
                          )}
                        </button>
                        {hasNote && (
                          <button
                            onClick={() => setDailyNotes(prev => ({ ...prev, [dateStr]: '' }))}
                            title="Clear this day's note"
                            className="text-[8px] font-black uppercase text-red-400/50 hover:text-red-400 transition-colors leading-none"
                          >
                            ✕ clear
                          </button>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td colSpan={4} className="py-3 px-4 text-left text-[10px] text-zinc-500 italic">
                  {getWeeklyTasksSummary() ? (
                    <span className="text-blue-400/70 block whitespace-normal" title={getWeeklyTasksSummary()}>{getWeeklyTasksSummary()}</span>
                  ) : 'Enter daily tasks above'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="xl:hidden space-y-4">
          {/* Daily Work Done section — mobile */}
          <div style={PANEL} className="p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Work Done · Per Day (All Workers)</p>
            <div className="grid grid-cols-2 gap-2">
              {weekDates.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd')
                const hasNote = !!(dailyNotes[dateStr] && dailyNotes[dateStr].trim())
                return (
                  <div key={dateStr} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                            {format(d, 'EEE dd MMM')}
                          </label>
                          {calendarEvents[dateStr] && calendarEvents[dateStr].event_type === 'AMAVASYA' && (
                            <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded">
                              🌑 AMAVASYA
                            </span>
                          )}
                          {bandDays[dateStr]?.status === 'BAND' ? (
                            <button onClick={() => handleUnmarkBandDay(dateStr)} className="text-[8px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                              🔴 UNMARK
                            </button>
                          ) : (
                            <button onClick={() => setShowBandModal({ date: dateStr, isAmavasya: !!calendarEvents[dateStr] })} className="text-[8px] font-bold text-zinc-500 hover:text-red-400 bg-zinc-800/50 px-1.5 py-0.5 rounded transition-colors">
                              MARK BAND
                            </button>
                          )}
                        </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => copyPreviousDayColumn(dateStr)}
                          title={`Copy attendance from previous day to this day`}
                          className="text-[8px] font-black uppercase text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Copy Prev
                        </button>
                        {hasNote && (
                          <button
                            onClick={() => setDailyNotes(prev => ({ ...prev, [dateStr]: '' }))}
                            title="Clear note"
                            className="flex items-center gap-0.5 text-[8px] font-black uppercase text-red-400/60 hover:text-red-400 transition-colors"
                          >
                            <X size={9} /> Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setNoteDraft(dailyNotes[dateStr] || '')
                        setActiveNotePopup({ date: dateStr })
                      }}
                      className={cn(
                        "w-full h-9 px-3 rounded-xl text-[10px] font-semibold text-left transition-all border flex items-center justify-between outline-none",
                        hasNote 
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-300 shadow-[0_0_6px_rgba(59,130,246,0.1)]" 
                          : "bg-[#0d1018] border-[#1e2435] border-dashed text-zinc-500 hover:border-zinc-700"
                      )}
                    >
                      <span className="truncate pr-2">
                        {hasNote ? dailyNotes[dateStr] : "Add work log..."}
                      </span>
                      <span className="text-zinc-600 font-bold shrink-0">✎</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {Object.values(gridData).sort((a, b) => a.name.localeCompare(b.name)).map(row => (
            <div key={row.worker_id} style={PANEL} className="p-4 space-y-4">
              <div className="flex justify-between items-start border-b border-[#1e2435] pb-3">
                <div>
                  <p className="text-sm font-black text-white flex items-center gap-1.5">
                    {row.name}
                    {row.phone === 'TEMPORARY' && (
                      <span className="text-[8px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1 py-0.5 rounded font-black uppercase tracking-wider shrink-0">Temp</span>
                    )}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">{row.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  {row.phone === 'TEMPORARY' && (
                    <button 
                      onClick={() => {
                        setPromoteWorkerId(row.worker_id)
                        setPromoteName(row.name)
                        setPromoteType(row.type)
                        setPromotePhone('')
                        setShowPromoteModal(true)
                      }}
                      title="Promote to Contact"
                      className="p-2 text-amber-500/70 hover:text-amber-500 bg-amber-500/5 rounded-lg transition-colors"
                    >
                      <Zap size={14}/>
                    </button>
                  )}
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
                  const cell = row.days[dateStr] || { status: '', overtime_amount: 0, advance_amount: 0, paid_amount: 0 }
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
                        <span className="text-xs font-black">{bandDays[dateStr]?.status === 'BAND' ? 'B' : (cell.status || '-')}</span>
                        {cell.paid_amount && cell.paid_amount > 0 ? (
                          <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-emerald-500 rounded-full" title={`Spot Paid: ₹${cell.paid_amount}`} />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Totals Row */}
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-[#1e2435]/50">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-black text-zinc-500 uppercase">Gross</span>
                  <div className="w-full h-9 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-center justify-center">
                    <span className="text-[9px] font-black text-blue-400">₹{Math.round(calcRowGross(row)).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-black text-zinc-500 uppercase">Paid</span>
                  <div className="w-full h-9 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
                    <span className="text-[9px] font-black text-emerald-400">₹{Math.round(calcRowPaid(row)).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-black text-zinc-500 uppercase">Net Due</span>
                  <div className="w-full h-9 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-center justify-center">
                    <span className="text-[9px] font-black text-amber-500 font-mono">₹{Math.round(calcRowGiveable(row)).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      </>
    )}
  </div>
  </>
) : (
  <div style={PANEL} className="p-6 shadow-2xl space-y-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#1e2435]">
      <div>
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Attendance Heatmap</h3>
        <p className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5">Workforce strength color scale per day</p>
      </div>
      
      {/* Color Legend key */}
      <div className="flex items-center gap-3 bg-[#0d1018] p-2 rounded-xl border border-[#1e2435] self-start sm:self-auto">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-[#161a26]" />
          <span className="text-[8px] font-black uppercase text-zinc-500">0</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-blue-950/40 border border-blue-900/30" />
          <span className="text-[8px] font-black uppercase text-zinc-500">1-4</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-blue-600/20 border border-blue-500/40" />
          <span className="text-[8px] font-black uppercase text-zinc-500">5-9</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]" />
          <span className="text-[8px] font-black uppercase text-zinc-500">10+</span>
        </div>
      </div>
    </div>

    {heatmapLoading ? (
      <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
    ) : (
      <div className="space-y-4">
        {/* Day names row */}
        <div className="grid grid-cols-7 gap-2 text-center text-zinc-600 text-[10px] font-black uppercase tracking-wider">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Day cells grid */}
        <div className="grid grid-cols-7 gap-2.5">
          {heatmapDays.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="aspect-square bg-transparent" />
            }
            
            const dateStr = format(day, 'yyyy-MM-dd')
            const count = heatmapCounts[dateStr] || 0
            
            // Color scale computation
            let cellStyle = "bg-[#111520] border-[#1e2435] text-zinc-500"
            if (count > 0 && count <= 4) {
              cellStyle = "bg-blue-950/30 border-blue-900/30 text-blue-400"
            } else if (count > 4 && count <= 9) {
              cellStyle = "bg-blue-600/20 border-blue-500/40 text-blue-300"
            } else if (count > 9) {
              cellStyle = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
            }
            
            return (
              <div 
                key={dateStr}
                className={cn(
                  "aspect-square rounded-xl border flex flex-col items-center justify-between p-2 transition-all hover:scale-[1.03] active:scale-95",
                  cellStyle
                )}
              >
                <span className="text-[10px] font-black self-start">{day.getDate()}</span>
                <div className="flex flex-col items-center justify-center w-full flex-1">
                  <span className="text-xs font-black">{count > 0 ? count : ''}</span>
                  {count > 0 && <span className="text-[6px] font-black uppercase tracking-widest text-zinc-500">crew</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}
  </div>
)}

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
          <div className="rounded-2xl p-6 w-full max-w-[340px] space-y-6 shadow-2xl animate-in zoom-in-95" style={PANEL} onClick={e => e.stopPropagation()}>
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

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Spot Payment (₹)</label>
                <input 
                  type="number" 
                  value={popupData.paid_amount || ''}
                  onChange={e => setPopupData({ ...popupData, paid_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full h-11 text-center font-black rounded-xl outline-none text-emerald-500 font-mono text-lg" 
                  style={INPUT_ST} 
                  placeholder="0"
                />
              </div>

            </div>

            <div className="flex gap-2">
              <button onClick={() => setActivePopup(null)} className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-zinc-800 text-white hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={handleApplyPopup} className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Work Done Log Popup */}
      {activeNotePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActiveNotePopup(null)}>
          <div className="rounded-2xl p-6 w-full max-w-[380px] space-y-6 shadow-2xl animate-in zoom-in-95" style={PANEL} onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1 border-b border-[#1e2435] pb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
              <p className="text-sm font-bold text-white">Daily Work Done Log</p>
              <p className="text-[10px] text-zinc-500 font-bold">{format(parseISO(activeNotePopup.date), 'EEEE, dd MMM yyyy')}</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Work Details</label>
                <textarea 
                  value={noteDraft}
                  autoFocus
                  onChange={e => setNoteDraft(e.target.value)}
                  placeholder="Type today's work details (e.g. granite plastering, wall construction, watering, etc.)..."
                  className="w-full h-24 p-3 bg-[#0d1018] border border-[#1e2435] rounded-xl text-xs font-semibold text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setDailyNotes(prev => ({ ...prev, [activeNotePopup.date]: noteDraft }));
                      setActiveNotePopup(null);
                    }
                  }}
                />
              </div>

              {/* Quick suggestions row */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Quick Suggestions</label>
                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                  {[
                    "granite",
                    "lental",
                    "wall",
                    "water",
                    "sanna mal",
                    "doddu ma",
                    "sand filter"
                  ].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const current = noteDraft.trim();
                        if (current) {
                          if (current.toLowerCase().includes(tag.toLowerCase())) return;
                          setNoteDraft(current + ", " + tag);
                        } else {
                          setNoteDraft(tag);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-[9px] font-black text-zinc-400 uppercase tracking-wider hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 transition-all"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Empty grid warning warning */}
              {Object.keys(gridData).length === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                  <span className="text-amber-500 text-sm shrink-0">⚠️</span>
                  <p className="text-[9px] font-semibold text-amber-300/80 leading-relaxed">
                    No workers are in the grid. Please add at least one worker first so your daily work log can be saved to Supabase.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => {
                  setNoteDraft('');
                }} 
                className="px-3 h-11 rounded-xl text-xs font-black uppercase bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 transition-colors"
                title="Clear draft text"
              >
                Clear
              </button>
              <button 
                type="button"
                onClick={() => setActiveNotePopup(null)} 
                className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  setDailyNotes(prev => ({ ...prev, [activeNotePopup.date]: noteDraft }));
                  setActiveNotePopup(null);
                }} 
                className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddTempWorker && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddTempWorker(false)}>
          <div className="rounded-2xl p-6 w-full max-w-[340px] space-y-4 shadow-2xl animate-in zoom-in-95" style={PANEL} onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1 border-b border-[#1e2435] pb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Casual Labour</p>
              <p className="text-sm font-bold text-white">Add Temporary Worker</p>
              <p className="text-[9px] text-zinc-500">This worker will only exist in this attendance grid</p>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Worker Name</label>
                <input 
                  type="text" 
                  value={tempWorkerName}
                  onChange={e => setTempWorkerName(e.target.value)}
                  className="w-full h-11 px-3 bg-[#0d1018] border border-[#1e2435] rounded-xl text-white outline-none font-bold"
                  placeholder="e.g. Raju Helper"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Worker Type</label>
                <select 
                  value={tempWorkerType}
                  onChange={e => setTempWorkerType(e.target.value)}
                  className="w-full h-11 px-3 bg-[#0d1018] border border-[#1e2435] rounded-xl text-white outline-none font-bold"
                >
                  <option value="Mistry (Skilled)">Mistry (Skilled)</option>
                  <option value="Labour (Women)">Labour (Women)</option>
                  <option value="Helper (Unskilled)">Helper (Unskilled)</option>
                  <option value="Parakadu (Skilled)">Parakadu (Skilled)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Daily Rate (₹)</label>
                <input 
                  type="number" 
                  value={tempWorkerRate}
                  onChange={e => setTempWorkerRate(e.target.value)}
                  className="w-full h-11 px-3 bg-[#0d1018] border border-[#1e2435] rounded-xl text-white outline-none font-bold"
                  placeholder="800"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowAddTempWorker(false)} 
                className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddTempWorker} 
                disabled={addingTemp}
                className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-amber-500 text-black hover:bg-amber-400 transition-colors font-bold flex items-center justify-center gap-1 shadow-lg shadow-amber-500/10"
              >
                {addingTemp ? <Loader2 size={14} className="animate-spin" /> : null} Add Worker
              </button>
            </div>
          </div>
        </div>
      )}

      {showPromoteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPromoteModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-[340px] space-y-4 shadow-2xl animate-in zoom-in-95" style={PANEL} onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1 border-b border-[#1e2435] pb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Promote to Contact</p>
              <p className="text-sm font-bold text-white">Convert to Regular Worker</p>
              <p className="text-[9px] text-zinc-500">Attendance history will carry over automatically</p>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-[#0d1018] rounded-xl border border-[#1e2435]">
                <p className="font-bold text-white text-xs">{promoteName}</p>
                <p className="text-[9px] font-black text-zinc-500 uppercase mt-0.5">{promoteType}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mobile Phone Number</label>
                <input 
                  type="text" 
                  maxLength={10}
                  value={promotePhone}
                  onChange={e => setPromotePhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-11 px-3 bg-[#0d1018] border border-[#1e2435] rounded-xl text-white outline-none font-bold"
                  placeholder="Enter 10 digit number"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowPromoteModal(false)} 
                className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePromoteWorker} 
                disabled={promoting}
                className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-bold flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10"
              >
                {promoting ? <Loader2 size={14} className="animate-spin" /> : null} Save Contact
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Band Day Modal */}
      {showBandModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111520] border border-[#1e2435] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setShowBandModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-white mb-2">🔴 Mark BAND DAY</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to mark <strong>{format(parseISO(showBandModal.date), 'dd MMM yyyy')}</strong> as a Band Day? 
              This means the site is closed and no attendance records will be saved.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Reason</label>
                <select 
                  value={bandReason}
                  onChange={e => setBandReason(e.target.value)}
                  className="w-full bg-[#0d1018] border border-[#1e2435] rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="Amavasya">Amavasya</option>
                  <option value="Festival">Festival</option>
                  <option value="Heavy Rain">Heavy Rain</option>
                  <option value="Material Delay">Material Delay</option>
                  <option value="Labour Unavailable">Labour Unavailable</option>
                  <option value="Site Closed">Site Closed</option>
                  <option value="Personal Reason">Personal Reason</option>
                  <option value="Other">Other...</option>
                </select>
              </div>

              {bandReason === 'Other' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Custom Reason</label>
                  <input 
                    type="text"
                    value={bandCustomReason}
                    onChange={e => setBandCustomReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full bg-[#0d1018] border border-[#1e2435] rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBandModal(null)} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleMarkBandDay}
                disabled={saving || (bandReason === 'Other' && !bandCustomReason.trim())}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm BAND DAY
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  )
}
