'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Save, 
  Users, 
  Briefcase,
  Clock,
  Search,
  Filter,
  CheckCircle2,
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
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function AttendancePage() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [projects, setProjects] = useState<any[]>([])
  const [labourers, setLabourers] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [status, setStatus] = useState<string>('1') // 1 = Full Day, 0.5 = Half Day
  const [overtimeHours, setOvertimeHours] = useState<string>('0')
  const [overtimeAmount, setOvertimeAmount] = useState<string>('0')
  const [customRate, setCustomRate] = useState<string>('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    const { data: attData } = await supabase.from('attendance').select('*, labour(name), projects(name)').order('date', { ascending: false }).limit(20)
    
    setProjects(projData || [])
    setLabourers(labData || [])
    setRecords(attData || [])
    setLoading(false)
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

      const { error } = await supabase
        .from('attendance')
        .insert([{
          labour_id: selectedWorkerId,
          project_id: selectedProjectId,
          date: date,
          days_worked: parseFloat(status),
          overtime_hours: parseFloat(overtimeHours || '0'),
          overtime_amount: parseFloat(overtimeAmount || '0'),
          custom_rate: customRate ? parseFloat(customRate) : null
        }])

      if (error) throw error
      toast.success('Attendance marked successfully')
      // Reset form
      setSelectedWorkerId('')
      setSelectedProjectId('')
      setStatus('1')
      setOvertimeHours('0')
      setOvertimeAmount('0')
      setCustomRate('')
      fetchData() // Refresh list
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleWorkerChange = (value: string) => {
    setSelectedWorkerId(value)
    const worker = labourers.find(l => l.id === value)
    if (worker) {
      setCustomRate(worker.daily_rate.toString())
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Attendance</h1>
        <p className="mt-2 text-zinc-500 font-medium">Mark daily attendance for workers on projects.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Mark Attendance Form */}
        <div className="lg:col-span-4">
          <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-lg font-black uppercase tracking-tight">Mark Attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleMarkAttendance} className="space-y-6">
                {/* Worker Select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Worker</label>
                  <Select onValueChange={(v) => handleWorkerChange(v || '')} value={selectedWorkerId}>
                    <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Select worker" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                      {labourers.map(l => (
                        <SelectItem key={l.id} value={l.id} className="py-3 font-bold hover:bg-zinc-800">{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Rate */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Daily Rate (₹)</label>
                  <Input 
                    type="number"
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white"
                  />
                  <p className="text-[9px] font-medium text-zinc-500 italic mt-1 leading-tight">Override default rate for this entry.</p>
                </div>

                {/* Project Select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Project</label>
                  <Select onValueChange={(v: string | null) => setSelectedProjectId(v ?? '')} value={selectedProjectId}>
                    <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold hover:bg-zinc-800">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Date</label>
                  <Input 
                    type="date"
                    value={date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                    className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>

                {/* Status Select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</label>
                  <Select onValueChange={(v: string | null) => setStatus(v ?? '1')} value={status}>
                    <SelectTrigger className="h-12 bg-[#0F172A] border-zinc-800 rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-zinc-800 text-white rounded-xl">
                      <SelectItem value="1" className="py-3 font-bold">Full Day</SelectItem>
                      <SelectItem value="0.5" className="py-3 font-bold">Half Day</SelectItem>
                      <SelectItem value="0" className="py-3 font-bold">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Overtime Fields (Optional) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Overtime Hours (optional)</label>
                    <Input 
                      type="number"
                      value={overtimeHours}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOvertimeHours(e.target.value)}
                      className="h-12 bg-[#030712] border-zinc-800 rounded-xl font-bold text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none">Overtime Amount (optional)</label>
                    <Input 
                      type="number"
                      value={overtimeAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOvertimeAmount(e.target.value)}
                      className="h-12 bg-[#030712] border-zinc-800 rounded-xl font-bold text-white"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={saving} 
                  className="w-full h-14 bg-[#00A3FF] hover:bg-[#0092E6] text-white rounded-xl font-black uppercase tracking-tight text-lg shadow-xl shadow-blue-500/20"
                >
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Mark Attendance
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Attendance Records List */}
        <div className="lg:col-span-8">
          <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden h-full">
            <CardHeader className="p-8 border-b border-zinc-800 flex flex-row items-center justify-between">
               <CardTitle className="text-lg font-black uppercase tracking-tight">Attendance Records</CardTitle>
               <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-[#0F172A] border border-zinc-800 rounded-xl px-4 py-2 text-xs font-bold">
                    <span className="text-zinc-500">16-04-2026</span>
                    <span className="text-zinc-600 font-medium italic">to</span>
                    <span className="text-zinc-200">23-04-2026</span>
                    <CalendarIcon size={14} className="text-[#00A3FF] ml-1" />
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-[#111827]">
                    <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Worker</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Project</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400 text-center">Status</TableHead>
                    <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400 text-center">Overtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} className="animate-pulse border-zinc-800">
                        <TableCell colSpan={5} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                      </TableRow>
                    ))
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-24 text-center">
                         <div className="flex flex-col items-center gap-4 text-zinc-500">
                            <TableIcon size={48} className="opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest">No matching records</p>
                         </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((rec) => (
                      <TableRow key={rec.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                        <TableCell className="px-8 py-5 font-bold text-zinc-400">
                          {format(new Date(rec.date), 'M/d/yyyy')}
                        </TableCell>
                        <TableCell className="py-5 font-bold text-white capitalize">{rec.labour?.name}</TableCell>
                        <TableCell className="py-5 font-bold text-zinc-500 lowercase">{rec.projects?.name}</TableCell>
                        <TableCell className="py-5 text-center">
                          <Badge className={cn(
                            "rounded-full px-4 py-1 font-black text-[9px] uppercase tracking-tighter border-none",
                            rec.days_worked === 1 ? "bg-emerald-500/20 text-emerald-400" : 
                            rec.days_worked === 0.5 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-500"
                          )}>
                            {rec.days_worked === 1 ? 'Full Day' : rec.days_worked === 0.5 ? 'Half Day' : 'Absent'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5 text-center font-bold text-zinc-500">
                          {rec.overtime_hours > 0 ? `${rec.overtime_hours} hrs` : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
