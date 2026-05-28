'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Zap, Plus, Search, Loader2, Calendar, Briefcase, History, FileText, Download, Edit2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'

export default function ExtraWorkPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [taskPage, setTaskPage] = useState(0)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({ project_id: '', work_name: '', amount: '', date: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const [formData, setFormData] = useState({
    project_id: '',
    work_name: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [selectedProjectId])
  async function fetchData() {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setProjects(projData || [])

    const savedActive = localStorage.getItem('ssc_active_project_id')
    let currentId = selectedProjectId

    if (!currentId) {
      if (savedActive && projData?.some(p => p.id === savedActive)) {
        currentId = savedActive
      } else if (projData && projData.length > 0) {
        currentId = projData[0].id
      }
      setSelectedProjectId(currentId)
    }

    setLoading(true)
    let q = supabase.from('extra_work').select('*, projects(name)').order('date', { ascending: true })
    if (currentId) {
      q = q.eq('project_id', currentId)
      localStorage.setItem('ssc_active_project_id', currentId)
    }
    const { data: workData } = await q
    setTasks(workData || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id || !formData.work_name || !formData.amount) {
      toast.error('All required fields are needed')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('extra_work').insert([{
      ...formData,
      amount: parseFloat(formData.amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Extra task recorded')
      setFormData({ project_id: '', work_name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      setShowAddModal(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this extra work entry?')) return
    const { error } = await supabase.from('extra_work').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Entry deleted'); fetchData() }
  }

  const handleOpenEdit = (task: any) => {
    setEditingTask(task)
    setEditFormData({ project_id: task.project_id, work_name: task.work_name, amount: String(task.amount), date: task.date, notes: task.notes || '' })
  }

  const handleSaveEdit = async () => {
    if (!editingTask) return
    setEditSaving(true)
    const { error } = await supabase.from('extra_work').update({
      project_id: editFormData.project_id,
      work_name: editFormData.work_name,
      amount: parseFloat(editFormData.amount),
      date: editFormData.date,
      notes: editFormData.notes
    }).eq('id', editingTask.id).select()
    if (error) toast.error(error.message)
    else { toast.success('Entry updated'); setEditingTask(null); fetchData() }
    setEditSaving(false)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    
    drawPremiumHeader(doc, 'EXTRA WORK REPORT', format(new Date(), 'dd MMM yyyy'))

    const tableData = tasks.map((row, idx) => [
      idx + 1,
      format(new Date(row.date), 'dd MMM yyyy'),
      row.projects?.name || 'N/A',
      row.work_name,
      `Rs. ${Number(row.amount).toLocaleString()}`,
      row.notes || '-'
    ])

    autoTable(doc, {
      startY: 54,
      head: [['S.No', 'Date', 'Project', 'Work Description', 'Amount', 'Notes']],
      body: tableData,
      foot: [['', '', '', 'TOTAL', `Rs. ${tasks.reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}`, '']],
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
      footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      styles: { cellPadding: 2.5 }
    })

    drawPremiumFooter(doc)
    doc.save(`Extra_Work_Report_${format(new Date(), 'dd-MMM-yyyy')}.pdf`)
    toast.success('PDF exported successfully')
  }

  const exportExcel = () => {
    const worksheetData = [
      ['Extra Work Report'],
      [`Generated: ${format(new Date(), 'MMM dd, yyyy')}`],
      [],
      ['#', 'Date', 'Project', 'Work Description', 'Amount', 'Notes']
    ]

    tasks.forEach((row, idx) => {
      worksheetData.push([
        idx + 1,
        row.date,
        row.projects?.name || 'N/A',
        row.work_name,
        Number(row.amount),
        row.notes || '-'
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Extra Work Report')
    XLSX.writeFile(wb, `extra-work-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    toast.success('Excel exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Extra Tasks</h1>
            <p className="mt-1 text-sm text-zinc-500">Record lumpsum payments for extra works and ad-hoc tasks.</p>
          </div>
          <span className="text-xl font-black text-blue-400">₹{tasks.reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-10 px-4 rounded-xl text-xs font-bold bg-[#111520] border border-[#1e2435] text-white outline-none focus:border-blue-500 transition-all flex-1 min-w-[140px]"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Button
            onClick={() => {
              setFormData({ project_id: selectedProjectId || '', work_name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
              setShowAddModal(true);
            }}
            className="h-10 px-5 rounded-xl text-xs font-black uppercase bg-blue-500 text-white flex items-center gap-2 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] transition-all cursor-pointer"
          >
            <Plus size={14} /> Record Task
          </Button>
          {tasks.length > 0 && (
            <>
              <Button onClick={exportPDF} variant="outline" className="border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight px-4 gap-2 h-10">
                <FileText size={14} /> PDF
              </Button>
              <Button onClick={exportExcel} variant="outline" className="border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight px-4 gap-2 h-10">
                <Download size={14} /> Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Task History - Full Width */}
        <div className="lg:col-span-12">
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Historical Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-zinc-900/80">
                    <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
                      <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Site/Project</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Task Name</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Remarks</TableHead>
                      <TableHead className="text-right px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Valuation</TableHead>
                      <TableHead className="py-6 w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-zinc-800">
                          <TableCell colSpan={6} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                        </TableRow>
                      ))
                    ) : tasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                              <Zap size={48} className="opacity-10" />
                              <p className="text-sm font-bold uppercase tracking-widest">No extra task history</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tasks.slice(taskPage * 10, taskPage * 10 + 10).map((task) => (
                        <TableRow key={task.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                          <TableCell className="px-8 py-5 font-bold text-gray-400 text-xs">
                            {format(new Date(task.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="py-5 font-bold text-white text-sm lowercase">{task.projects?.name}</TableCell>
                          <TableCell className="py-5 font-black text-xs text-gray-300 uppercase tracking-tighter">{task.work_name}</TableCell>
                          <TableCell className="py-5 text-xs text-zinc-400 max-w-[220px] truncate">{task.notes || '—'}</TableCell>
                          <TableCell className="py-5 text-right px-8 font-black text-blue-400 text-sm">₹ {task.amount.toLocaleString()}</TableCell>
                          <TableCell className="py-3 pr-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => handleOpenEdit(task)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 transition-colors"><Edit2 size={13} /></button>
                              <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {tasks.length > 10 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800">
                  <button disabled={taskPage === 0} onClick={() => setTaskPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>Page {taskPage + 1} / {Math.ceil(tasks.length / 10)}</span>
                  <button disabled={(taskPage + 1) * 10 >= tasks.length} onClick={() => setTaskPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
                </div>
              )}

              {/* Mobile Cards */}
              <div className="flex flex-col gap-3 p-4 md:hidden bg-[#05070B]">
                {loading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="h-24 animate-pulse bg-zinc-900 rounded-xl" />)
                ) : tasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 text-zinc-600 py-10">
                    <Zap size={48} className="opacity-10" />
                    <p className="text-sm font-bold uppercase tracking-widest">No extra task history</p>
                  </div>
                ) : (
                  tasks.slice(taskPage * 10, taskPage * 10 + 10).map((task) => (
                    <div key={task.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{task.projects?.name}</p>
                          <p className="font-black text-gray-200 text-[10px] tracking-tight uppercase mt-0.5 truncate">{task.work_name}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-1">{format(new Date(task.date), 'MMM dd, yyyy')}</p>
                          {task.notes && <p className="text-xs text-zinc-400 mt-1 truncate">{task.notes}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <p className="font-black text-blue-400 text-lg">₹ {task.amount.toLocaleString()}</p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOpenEdit(task)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 transition-colors"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Mobile Pagination */}
              {tasks.length > 10 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 md:hidden">
                  <button disabled={taskPage === 0} onClick={() => setTaskPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>{taskPage + 1} / {Math.ceil(tasks.length / 10)}</span>
                  <button disabled={(taskPage + 1) * 10 >= tasks.length} onClick={() => setTaskPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Extra Work Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowAddModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">Record Workload</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                <select value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})}
                  className="w-full h-12 px-3 rounded-xl text-sm font-semibold outline-none" style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }}>
                  <option value="">Execution site</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Work Title / Description</label>
                <Input 
                  placeholder="e.g. Wall Piling, Foundation etc." 
                  value={formData.work_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, work_name: e.target.value})}
                  className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Amount (₹)</label>
                <Input 
                  placeholder="Lumpsum amount" 
                  type="number"
                  value={formData.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, amount: e.target.value})}
                  className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Execution Date</label>
                <Input 
                  type="date"
                  value={formData.date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, date: e.target.value})}
                  className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Notes (optional)</label>
                <Textarea 
                  placeholder="Specific details about the extra work" 
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 h-12 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-[#6b7280] border border-[#1e2435]">Cancel</button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 btn-construction rounded-xl font-black uppercase tracking-tight text-sm">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Record Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Extra Work Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingTask(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-white uppercase tracking-wide">Edit Extra Work Entry</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Project</label>
                <select value={editFormData.project_id} onChange={e => setEditFormData({ ...editFormData, project_id: e.target.value })} className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0' }}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Work Name</label>
                <Input value={editFormData.work_name} onChange={e => setEditFormData({ ...editFormData, work_name: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Amount</label>
                <Input type="number" value={editFormData.amount} onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</label>
                <Input type="date" value={editFormData.date} onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Notes</label>
                <Textarea value={editFormData.notes} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setEditingTask(null)} variant="outline" className="flex-1 border-zinc-700 bg-zinc-900 text-gray-300 rounded-xl font-bold uppercase tracking-tight">Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={editSaving} className="flex-1 btn-construction rounded-xl font-black uppercase tracking-tight">{editSaving ? <Loader2 className="animate-spin mr-2" /> : null} Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
