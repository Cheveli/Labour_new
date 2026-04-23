'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Save, 
  Users, 
  Briefcase 
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export default function AttendancePage() {
  const [date, setDate] = useState<Date>(new Date())
  const [projects, setProjects] = useState<any[]>([])
  const [labourers, setLabourers] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [attendance, setAttendance] = useState<Record<string, number>>({}) // labour_id -> days_worked
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedProjectId && date) {
      fetchExistingAttendance()
    }
  }, [selectedProjectId, date])

  async function fetchData() {
    setLoading(true)
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    
    setProjects(projData || [])
    setLabourers(labData || [])
    setLoading(false)
  }

  async function fetchExistingAttendance() {
    const formattedDate = format(date, 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('attendance')
      .select('labour_id, days_worked')
      .eq('project_id', selectedProjectId)
      .eq('date', formattedDate)
    
    if (error) {
       toast.error('Failed to fetch existing attendance')
       return
    }

    const newAttendance: Record<string, number> = {}
    data?.forEach(record => {
      newAttendance[record.labour_id] = Number(record.days_worked)
    })
    setAttendance(newAttendance)
  }

  const handleAttendanceChange = (labourId: string, value: number) => {
    setAttendance(prev => ({
      ...prev,
      [labourId]: value
    }))
  }

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project first')
      return
    }

    setSaving(true)
    const formattedDate = format(date, 'yyyy-MM-dd')
    const records = Object.entries(attendance)
      .filter(([_, val]) => val > 0)
      .map(([labourId, val]) => ({
        labour_id: labourId,
        project_id: selectedProjectId,
        date: formattedDate,
        days_worked: val
      }))

    try {
      // Use upsert to handle updates if records already exist
      // Note: We need a unique constraint on (labour_id, project_id, date) in Supabase
      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'labour_id, project_id, date' })

      if (error) throw error
      toast.success('Attendance saved successfully')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Daily Attendance</h1>
          <p className="text-gray-500">Select a project and date to mark attendance.</p>
        </div>
        
        <Button 
          onClick={handleSave} 
          disabled={saving || !selectedProjectId}
          className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-xl shadow-lg shadow-blue-100 dark:shadow-none min-w-[150px]"
        >
          {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Sidebar */}
        <div className="space-y-6">
          <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black rounded-3xl overflow-hidden">
            <CardHeader className="bg-blue-600 text-white p-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarIcon size={20} />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Select Date</label>
                <div className="flex flex-col gap-2">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    className="rounded-xl border border-gray-100 dark:border-zinc-800"
                  />
                  <div 
                    className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 text-sm font-bold text-center"
                    suppressHydrationWarning
                  >
                    {format(date, 'EEEE, MMM dd, yyyy')}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300 flex items-center gap-2">
                  <Briefcase size={16} />
                  Project Site
                </label>
                <Select onValueChange={(v: string | null) => setSelectedProjectId(v ?? '')} value={selectedProjectId}>
                  <SelectTrigger className="rounded-xl h-12 bg-gray-50 dark:bg-zinc-900 border-none">
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance List */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-gray-50 dark:border-zinc-900 p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users size={20} className="text-blue-600" />
                  Workforce List
                </CardTitle>
                <CardDescription>Click on buttons to mark full or partial days.</CardDescription>
              </div>
              <Badge variant="secondary" className="px-4 py-1 rounded-full bg-blue-50 text-blue-600 border-none">
                {labourers.length} Registered
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 flex flex-col items-center gap-4 text-gray-400">
                  <Loader2 className="animate-spin h-8 w-8" />
                  <p>Loading workforce...</p>
                </div>
              ) : labourers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  No labourers registered yet.
                </div>
              ) : !selectedProjectId ? (
                <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                  <Briefcase size={48} className="text-gray-200" />
                  <p>Please select a project to start marking attendance.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-zinc-900">
                  {labourers.map((worker) => (
                    <div 
                      key={worker.id} 
                      className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-gray-50/50 dark:hover:bg-zinc-900/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-blue-600 font-bold text-lg">
                          {worker.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-zinc-100">{worker.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{worker.type} • ₹{worker.daily_rate}/day</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <AttendanceButton 
                          active={attendance[worker.id] === 0 || !attendance[worker.id]} 
                          onClick={() => handleAttendanceChange(worker.id, 0)}
                          label="Absent"
                          color="gray"
                        />
                         <AttendanceButton 
                          active={attendance[worker.id] === 0.5} 
                          onClick={() => handleAttendanceChange(worker.id, 0.5)}
                          label="Half Day"
                          color="orange"
                        />
                        <AttendanceButton 
                          active={attendance[worker.id] === 1} 
                          onClick={() => handleAttendanceChange(worker.id, 1)}
                          label="Full Day"
                          color="blue"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function AttendanceButton({ active, onClick, label, color }: any) {
  const getStyles = () => {
    if (!active) return "bg-gray-100/50 text-gray-400 hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-500"
    
    switch(color) {
      case 'orange': return "bg-orange-500 text-white shadow-lg shadow-orange-100 dark:shadow-none"
      case 'blue': return "bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none"
      default: return "bg-gray-600 text-white shadow-md dark:bg-zinc-700"
    }
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 min-w-[90px]",
        getStyles()
      )}
    >
      {label}
    </button>
  )
}
