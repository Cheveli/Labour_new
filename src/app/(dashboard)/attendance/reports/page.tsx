'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Download, FileText, Calendar } from 'lucide-react'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function AttendanceReportsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [labourers, setLabourers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any[]>([])

  const [startDate, setStartDate] = useState<string>(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [selectedProject, setSelectedProject] = useState<string>('')
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    const { data: labData } = await supabase.from('labour').select('*').order('name')
    setProjects(projData || [])
    setLabourers(labData || [])
  }

  const generateReport = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          labour(name, phone, daily_rate, type),
          projects(name)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (selectedProject) {
        query = query.eq('project_id', selectedProject)
      }

      const { data, error } = await query

      if (error) throw error

      // Group by worker
      const workerMap = new Map()
      data?.forEach(record => {
        const workerId = record.labour_id
        if (!workerMap.has(workerId)) {
          workerMap.set(workerId, {
            worker: record.labour,
            project: record.projects,
            records: []
          })
        }
        workerMap.get(workerId).records.push(record)
      })

      const report = Array.from(workerMap.values()).map(({ worker, project, records }) => {
        const totalDays = records.reduce((acc: number, r: any) => acc + Number(r.days_worked), 0)
        const totalAmount = records.reduce((acc: number, r: any) => {
          const rate = r.custom_rate || worker.daily_rate
          return acc + (Number(r.days_worked) * Number(rate)) + Number(r.overtime_amount || 0)
        }, 0)

        return {
          workerName: worker.name,
          phone: worker.phone,
          projectName: project?.name || 'N/A',
          totalDays,
          totalAmount,
          records
        }
      })

      setReportData(report)
      toast.success('Report generated successfully')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(18)
    doc.text('Attendance Report', 14, 20)
    
    doc.setFontSize(10)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 30)
    if (selectedProject) {
      const proj = projects.find(p => p.id === selectedProject)
      doc.text(`Project: ${proj?.name || 'All Projects'}`, 14, 36)
    }

    // Table
    const tableData = reportData.map((row, idx) => [
      idx + 1,
      row.workerName,
      row.phone || 'N/A',
      row.projectName,
      row.totalDays.toFixed(1),
      `Rs. ${row.totalAmount.toLocaleString()}`
    ])

    autoTable(doc, {
      startY: 45,
      head: [['#', 'Worker Name', 'Phone', 'Project', 'Total Days', 'Total Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 163, 255], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    })

    doc.save(`attendance-report-${startDate}-to-${endDate}.pdf`)
    toast.success('PDF exported successfully')
  }

  const exportExcel = () => {
    const worksheetData = [
      ['Attendance Report'],
      [`Period: ${startDate} to ${endDate}`],
      [],
      ['#', 'Worker Name', 'Phone', 'Project', 'Total Days', 'Total Amount']
    ]

    reportData.forEach((row, idx) => {
      worksheetData.push([
        idx + 1,
        row.workerName,
        row.phone || 'N/A',
        row.projectName,
        row.totalDays.toFixed(1),
        row.totalAmount
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report')
    XLSX.writeFile(wb, `attendance-report-${startDate}-to-${endDate}.xlsx`)
    toast.success('Excel exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Attendance Reports</h1>
          <p className="mt-2 text-zinc-500 font-medium">Generate weekly reports and export to PDF or Excel.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-xl bg-white dark:bg-zinc-950 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Project (Optional)</label>
              <Select onValueChange={(v) => setSelectedProject(v || '')} value={selectedProject}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Projects</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <Button
                onClick={generateReport}
                disabled={loading}
                className="w-full h-12 bg-[#00A3FF] hover:bg-[#0092E6]"
              >
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Calendar className="mr-2" />}
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      {reportData.length > 0 && (
        <Card className="border-none shadow-xl bg-white dark:bg-zinc-950 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Report Results ({reportData.length} workers)</CardTitle>
            <div className="flex gap-2">
              <Button onClick={exportPDF} variant="outline" className="gap-2">
                <FileText size={16} /> Export PDF
              </Button>
              <Button onClick={exportExcel} variant="outline" className="gap-2">
                <Download size={16} /> Export Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Worker Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-center">Total Days</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-bold">{idx + 1}</TableCell>
                    <TableCell className="font-bold">{row.workerName}</TableCell>
                    <TableCell>{row.phone || 'N/A'}</TableCell>
                    <TableCell>{row.projectName}</TableCell>
                    <TableCell className="text-center font-bold">{row.totalDays.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-black text-[#00A3FF]">₹{row.totalAmount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
