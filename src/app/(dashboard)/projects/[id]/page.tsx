'use client'

import React, { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Package,
  TrendingUp,
  Users,
  Wallet,
  Calendar,
  FileText,
  Loader2,
  Trash2,
  ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { motion } from 'framer-motion'

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [extraWork, setExtraWork] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Real-time synchronization states
  const [progressUpdates, setProgressUpdates] = useState<any[]>([])
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [moneyRequests, setMoneyRequests] = useState<any[]>([])
  const [materialRequests, setMaterialRequests] = useState<any[]>([])

  const [newProgressText, setNewProgressText] = useState('')
  const [newProgressDate, setNewProgressDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [newChatMessage, setNewChatMessage] = useState('')

  const [reqMoneyAmount, setReqMoneyAmount] = useState('')
  const [reqMoneyReason, setReqMoneyReason] = useState('')
  const [reqMoneyDate, setReqMoneyDate] = useState('')

  const [reqMatName, setReqMatName] = useState('')
  const [reqMatQty, setReqMatQty] = useState('')
  const [reqMatRemarks, setReqMatRemarks] = useState('')

  const getProjectType = (desc: string | null) => {
    if (!desc) return 'Material Contract'
    if (desc.startsWith('{')) {
      try {
        const parsed = JSON.parse(desc)
        return parsed.project_type || 'Material Contract'
      } catch (e) {
        return 'Material Contract'
      }
    }
    return 'Material Contract'
  }

  const getProjectAddress = (desc: string | null) => {
    if (!desc) return ''
    if (desc.startsWith('{')) {
      try {
        const parsed = JSON.parse(desc)
        return parsed.address || ''
      } catch (e) {
        return desc
      }
    }
    return desc
  }

  const updateProjectMetadata = async (newMeta: any) => {
    const { data: currentProj } = await supabase.from('projects').select('description').eq('id', id).single()
    let parsed = {
      address: '',
      project_type: 'Material Contract',
      client_email: '',
      client_mobile: '',
      client_password: '',
      client_id: null,
      progress_updates: [],
      chat: [],
      money_requests: [],
      material_requests: []
    }
    
    if (currentProj?.description && currentProj.description.startsWith('{')) {
      try {
        parsed = JSON.parse(currentProj.description)
      } catch (e) {}
    } else {
      parsed.address = currentProj?.description || ''
    }

    const updatedPayload = JSON.stringify({
      ...parsed,
      ...newMeta
    })

    const { error } = await supabase
      .from('projects')
      .update({ description: updatedPayload })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update project metadata: ' + error.message)
      return false
    }
    return true
  }

  async function fetchProjectDetails() {
    setLoading(true)

    // Fetch individual records
    const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single()
    const { data: atten } = await supabase.from('attendance').select('*, labour(name)').eq('project_id', id).order('date', { ascending: false })
    const { data: mats } = await supabase.from('materials').select('*').eq('project_id', id).order('date', { ascending: false })
    const { data: subs } = await supabase.from('contractor_payments').select('*')

    const subWorkEntries: any[] = []
    subs?.forEach((sub: any) => {
      let parsedNotes = { description: '', project_id: '', project_name: '' }
      try {
        if (sub.notes && (sub.notes.startsWith('{') || sub.notes.startsWith('['))) {
          parsedNotes = JSON.parse(sub.notes)
        } else {
          parsedNotes = {
            description: sub.notes || '',
            project_id: '',
            project_name: ''
          }
        }
      } catch (e) {
        parsedNotes = {
          description: sub.notes || '',
          project_id: '',
          project_name: ''
        }
      }

      let installments = sub.installments || []
      const sumInstallments = installments.reduce((sum: number, inst: any) => sum + Number(inst.amount || 0), 0)

      // Inject legacy balance payment if total_amount is greater than recorded installments
      if (sub.total_amount > sumInstallments) {
        const diff = sub.total_amount - sumInstallments
        installments = [
          {
            amount: diff,
            date: sub.date || format(new Date(sub.created_at), 'yyyy-MM-dd'),
            receipt_number: 1,
            site_project: parsedNotes.project_name || 'Legacy Project',
            notes: 'Legacy Balance / Migrated Payout'
          },
          ...installments.map((inst: any, idx: number) => ({ ...inst, receipt_number: idx + 2 }))
        ]
      }

      installments.forEach((inst: any) => {
        const isCurrentProject = (parsedNotes.project_id === id) || (inst.site_project === proj?.name)
        if (isCurrentProject) {
          subWorkEntries.push({
            id: `${sub.id}-${inst.receipt_number}`,
            work_name: `${sub.name} - Payment #${inst.receipt_number}`,
            amount: inst.amount,
            date: inst.date,
            notes: inst.notes || ''
          })
        }
      })
    })

    subWorkEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (proj?.description && proj.description.startsWith('{')) {
      try {
        const parsed = JSON.parse(proj.description)
        setProgressUpdates(parsed.progress_updates || [])
        setChatMessages(parsed.chat || [])
        setMoneyRequests(parsed.money_requests || [])
        setMaterialRequests(parsed.material_requests || [])
      } catch (e) {}
    }

    setProject(proj)
    setAttendance(atten || [])
    setMaterials(mats || [])
    setExtraWork(subWorkEntries)
    setLoading(false)
  }

  // Subscribe to real-time updates from client portal
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`project-sync-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${id}`
        },
        (payload) => {
          const desc = payload.new.description
          if (desc && desc.startsWith('{')) {
            try {
              const parsed = JSON.parse(desc)
              setChatMessages(parsed.chat || [])
              setProgressUpdates(parsed.progress_updates || [])
              setMoneyRequests(parsed.money_requests || [])
              setMaterialRequests(parsed.material_requests || [])
            } catch (e) {
              console.error('Error parsing channel update:', e)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchProjectDetails() }, [id])

  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProgressText.trim()) return
    const newUpdate = {
      id: `p-${Date.now()}`,
      date: newProgressDate || format(new Date(), 'yyyy-MM-dd'),
      remarks: newProgressText.trim()
    }
    const updatedList = [newUpdate, ...progressUpdates]
    const success = await updateProjectMetadata({ progress_updates: updatedList })
    if (success) {
      setProgressUpdates(updatedList)
      setNewProgressText('')
      toast.success('Progress update recorded!')
    }
  }

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatMessage.trim()) return
    const newMessage = {
      sender: 'contractor',
      text: newChatMessage.trim(),
      timestamp: new Date().toISOString()
    }
    const updatedList = [...chatMessages, newMessage]
    const success = await updateProjectMetadata({ chat: updatedList })
    if (success) {
      setChatMessages(updatedList)
      setNewChatMessage('')
    }
  }

  const handleRaiseMoneyRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqMoneyAmount || !reqMoneyReason.trim() || !reqMoneyDate) {
      toast.error('All money request fields are required')
      return
    }
    const newRequest = {
      id: `mon-${Date.now()}`,
      amount: parseFloat(reqMoneyAmount),
      reason: reqMoneyReason.trim(),
      required_date: reqMoneyDate,
      created_at: new Date().toISOString()
    }
    const updatedList = [newRequest, ...moneyRequests]
    const success = await updateProjectMetadata({ money_requests: updatedList })
    if (success) {
      setMoneyRequests(updatedList)
      setReqMoneyAmount('')
      setReqMoneyReason('')
      setReqMoneyDate('')
      toast.success('Money request raised to Client!')
    }
  }

  const handleRaiseMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqMatName.trim() || !reqMatQty.trim()) {
      toast.error('Material name and quantity are required')
      return
    }
    const newRequest = {
      id: `mat-${Date.now()}`,
      material_name: reqMatName.trim(),
      quantity: reqMatQty.trim(),
      remarks: reqMatRemarks.trim(),
      created_at: new Date().toISOString()
    }
    const updatedList = [newRequest, ...materialRequests]
    const success = await updateProjectMetadata({ material_requests: updatedList })
    if (success) {
      setMaterialRequests(updatedList)
      setReqMatName('')
      setReqMatQty('')
      setReqMatRemarks('')
      toast.success('Material request raised to Client!')
    }
  }

  if (loading) return (
    <div className="h-[80vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  if (!project) return <div>Project not found</div>

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" render={<Link href="/projects" />} className="rounded-xl border-gray-200">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{project.name}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase"
              style={getProjectType(project.description) === 'Labour Contract'
                ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                : { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
              {getProjectType(project.description)}
            </span>
          </div>
          <p className="text-gray-500 font-medium mt-1">{getProjectAddress(project.description)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryIconCard title="Total Spent" value={`₹${(materials.reduce((acc, m) => acc + Number(m.total_cost), 0) + extraWork.reduce((acc, e) => acc + Number(e.amount), 0)).toLocaleString('en-IN')}`} icon={<Wallet className="text-blue-600" />} />
        <SummaryIconCard title="Labour Active" value={new Set(attendance.map(a => a.labour_id)).size.toString()} icon={<Users className="text-emerald-600" />} />
        <SummaryIconCard title="Mat. Records" value={materials.length.toString()} icon={<Package className="text-orange-600" />} />
        <SummaryIconCard title="Subcontracts" value={extraWork.length.toString()} icon={<TrendingUp className="text-purple-600" />} />
      </div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-gray-100 dark:border-zinc-800 w-full lg:w-auto h-14 shadow-sm overflow-x-auto overflow-y-hidden no-scrollbar">
          <TabsTrigger value="attendance" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Attendance</TabsTrigger>
          <TabsTrigger value="materials" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Materials</TabsTrigger>
          <TabsTrigger value="extra" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Subcontracts</TabsTrigger>
          <TabsTrigger value="progress" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Progress</TabsTrigger>
          <TabsTrigger value="chat" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Owner Chat</TabsTrigger>
          {getProjectType(project.description) === 'Labour Contract' && (
            <TabsTrigger value="requests" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Owner Requests</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="attendance">
          <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl overflow-hidden">
            <CardHeader className="p-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Labour Attendance History</CardTitle>
                <Button size="sm" render={<Link href="/attendance" />} className="bg-blue-600 rounded-xl">Mark Attendance</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50">
                    <TableHead className="px-6 py-4">Date</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Days Worked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-10">No records found</TableCell></TableRow> :
                    attendance.map(record => (
                      <TableRow key={record.id}>
                        <TableCell className="px-6 py-4 font-medium">{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{record.labour?.name}</TableCell>
                        <TableCell>
                          <Badge variant={record.days_worked === 1 ? 'default' : 'secondary'} className="rounded-lg">
                            {record.days_worked} Day
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials">
          <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-50 dark:border-zinc-900">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Inbound Materials</CardTitle>
                <Button size="sm" variant="outline" className="rounded-xl border-blue-200 text-blue-600 gap-2">
                  <Plus size={16} /> Add Material
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50">
                    <TableHead className="px-6 py-4">Item</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead className="text-right px-6">Bill</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-400">No materials recorded</TableCell></TableRow> :
                    materials.map(mat => (
                      <TableRow key={mat.id}>
                        <TableCell className="px-6 py-4 font-bold">{mat.name}</TableCell>
                        <TableCell className="text-xs text-gray-500">{format(new Date(mat.date), 'dd/MM/yy')}</TableCell>
                        <TableCell>{mat.quantity} {mat.unit}</TableCell>
                        <TableCell className="font-bold">₹{mat.total_cost}</TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                            <FileText size={18} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extra">
          <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl overflow-hidden">
            <CardHeader className="p-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Subcontract Milestones</CardTitle>
                <Button size="sm" render={<Link href="/contractor-payments" />} className="bg-blue-600 rounded-xl gap-2 text-white">
                  Manage Subcontracts
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 text-center">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50">
                    <TableHead className="px-6 py-4">Task Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right px-6">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extraWork.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-20 text-gray-400">No subcontracts logged</TableCell></TableRow> :
                    extraWork.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="px-6 font-bold">{e.work_name}</TableCell>
                        <TableCell className="text-xs text-gray-500">{format(new Date(e.date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="font-bold text-emerald-600">₹{e.amount}</TableCell>
                        <TableCell className="text-right px-6 text-gray-500 italic text-xs">{e.notes || '---'}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-zinc-800">
              <CardTitle className="text-xl">Project Progress Timeline</CardTitle>
            </div>
            
            {/* Add Progress Form */}
            <form onSubmit={handleAddProgress} className="flex flex-col sm:flex-row gap-4 items-end bg-gray-50/50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div className="flex-1 space-y-1 w-full">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Progress Remark</label>
                <input
                  type="text"
                  placeholder="e.g. Excavation complete / Brickwork started..."
                  value={newProgressText}
                  onChange={e => setNewProgressText(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                />
              </div>
              <div className="w-full sm:w-44 space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
                <input
                  type="date"
                  value={newProgressDate}
                  onChange={e => setNewProgressDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                />
              </div>
              <Button type="submit" className="bg-blue-600 rounded-xl px-6 h-11 text-white font-bold w-full sm:w-auto">Add Remark</Button>
            </form>

            {/* Remarks Timeline */}
            <div className="relative pl-6 border-l border-blue-500/20 space-y-6 ml-2 pt-2">
              {progressUpdates.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-4">No progress remarks logged yet.</p>
              ) : (
                progressUpdates.map((upd, idx) => (
                  <div key={upd.id || idx} className="relative space-y-1">
                    <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/10" />
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">{format(new Date(upd.date), 'dd MMM yyyy')}</p>
                    <p className="text-sm text-gray-900 dark:text-white font-bold leading-relaxed">{upd.remarks}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden flex flex-col h-[550px] border border-gray-100 dark:border-zinc-800">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Owner Chat Room</p>
                <p className="text-sm font-black text-gray-900 dark:text-white uppercase mt-0.5">{project.name} — {project.owner_name || 'Client'}</p>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/20 dark:bg-zinc-950/10 custom-scrollbar flex flex-col">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-8 flex-1">
                  <p className="text-sm text-gray-500 italic">No messages exchanged yet. Send a greeting to the client!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((msg, idx) => {
                    const isContractor = msg.sender === 'contractor'
                    return (
                      <div key={idx} className={`flex ${isContractor ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl p-4 space-y-1 shadow-sm ${
                          isContractor 
                            ? 'bg-blue-600 text-white rounded-tr-none font-semibold' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-tl-none font-semibold'
                        }`}>
                          <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                          <p className={`text-[8px] text-right font-bold mt-1 opacity-70`}>
                            {format(new Date(msg.timestamp), 'hh:mm a')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChatMessage} className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex gap-3">
              <input
                type="text"
                placeholder="Type your message here..."
                value={newChatMessage}
                onChange={e => setNewChatMessage(e.target.value)}
                className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white"
              />
              <Button type="submit" className="bg-blue-600 rounded-xl px-6 h-11 text-white font-bold">Send</Button>
            </form>
          </Card>
        </TabsContent>

        {getProjectType(project.description) === 'Labour Contract' && (
          <TabsContent value="requests">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Form Side */}
              <div className="space-y-6">
                
                {/* Raise Money Request */}
                <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-gray-100 dark:border-zinc-800">
                  <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 mb-4">
                    <CardTitle className="text-lg">Raise Money Request</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">Request funds for site operations from the owner.</p>
                  </div>
                  <form onSubmit={handleRaiseMoneyRequest} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount (₹)</label>
                        <input
                          type="number"
                          placeholder="e.g. 50000"
                          value={reqMoneyAmount}
                          onChange={e => setReqMoneyAmount(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Required Date</label>
                        <input
                          type="date"
                          value={reqMoneyDate}
                          onChange={e => setReqMoneyDate(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Reason / Details</label>
                      <input
                        type="text"
                        placeholder="e.g. For slab casting labor wages / sand supply payment"
                        value={reqMoneyReason}
                        onChange={e => setReqMoneyReason(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 rounded-xl h-11 text-white font-bold">Raise Money Request</Button>
                  </form>
                </Card>

                {/* Raise Material Request */}
                <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-gray-100 dark:border-zinc-800">
                  <div className="pb-4 border-b border-gray-100 dark:border-zinc-800 mb-4">
                    <CardTitle className="text-lg">Raise Material Request</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">Request owner-supplied materials for construction.</p>
                  </div>
                  <form onSubmit={handleRaiseMaterialRequest} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Material Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Portland Cement / TMT Steel"
                          value={reqMatName}
                          onChange={e => setReqMatName(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quantity</label>
                        <input
                          type="text"
                          placeholder="e.g. 150 bags / 3 tonnes"
                          value={reqMatQty}
                          onChange={e => setReqMatQty(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Remarks / Supplier Pref</label>
                      <input
                        type="text"
                        placeholder="e.g. Grade 53 cement, Ultratech brand preferred"
                        value={reqMatRemarks}
                        onChange={e => setReqMatRemarks(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-orange-600 rounded-xl h-11 text-white font-bold">Raise Material Request</Button>
                  </form>
                </Card>

              </div>

              {/* Log Side */}
              <div className="space-y-6">
                <Card className="border-none shadow-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-gray-100 dark:border-zinc-800 flex flex-col space-y-6">
                  
                  {/* Money request log */}
                  <div>
                    <div className="pb-3 border-b border-gray-100 dark:border-zinc-800 mb-3">
                      <CardTitle className="text-md">Raised Money Requests</CardTitle>
                    </div>
                    <div className="space-y-3 overflow-y-auto max-h-[250px] custom-scrollbar pr-1">
                      {moneyRequests.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-2">No money requests raised yet.</p>
                      ) : (
                        moneyRequests.map((r, idx) => (
                          <div key={r.id || idx} className="p-3 border border-gray-100 dark:border-zinc-800 rounded-2xl bg-gray-50/50 dark:bg-zinc-950/30 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-black text-blue-600">₹{r.amount.toLocaleString('en-IN')}</p>
                              <p className="text-[10px] text-zinc-400 font-bold mt-0.5">Required: {format(new Date(r.required_date), 'dd MMM yyyy')}</p>
                              <p className="text-xs text-gray-700 dark:text-zinc-300 font-bold mt-1">"{r.reason}"</p>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">Active</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Material request log */}
                  <div>
                    <div className="pb-3 border-b border-gray-100 dark:border-zinc-800 mb-3">
                      <CardTitle className="text-md">Raised Material Requests</CardTitle>
                    </div>
                    <div className="space-y-3 overflow-y-auto max-h-[250px] custom-scrollbar pr-1">
                      {materialRequests.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-2">No material requests raised yet.</p>
                      ) : (
                        materialRequests.map((r, idx) => (
                          <div key={r.id || idx} className="p-3 border border-gray-100 dark:border-zinc-800 rounded-2xl bg-gray-50/50 dark:bg-zinc-950/30 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-black text-orange-600">{r.material_name} ({r.quantity})</p>
                              <p className="text-[10px] text-zinc-400 font-bold mt-0.5">Raised: {format(new Date(r.created_at), 'dd MMM yyyy')}</p>
                              {r.remarks && <p className="text-xs text-gray-700 dark:text-zinc-300 font-bold mt-1">"{r.remarks}"</p>}
                            </div>
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">Active</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </Card>
              </div>

            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function SummaryIconCard({ title, value, icon }: any) {
  return (
    <Card className="border-none shadow-xl bg-white dark:bg-zinc-950 rounded-3xl">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl">{icon}</div>
        <div>
          <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">{title}</p>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">{value}</h3>
        </div>
      </CardContent>
    </Card>
  )
}
