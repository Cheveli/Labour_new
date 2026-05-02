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

  async function fetchProjectDetails() {
    setLoading(true)
    
    // Fetch individual records
    const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single()
    const { data: atten } = await supabase.from('attendance').select('*, labour(name)').eq('project_id', id).order('date', { ascending: false })
    const { data: mats } = await supabase.from('materials').select('*').eq('project_id', id).order('date', { ascending: false })
    const { data: extra } = await supabase.from('extra_work').select('*').eq('project_id', id).order('date', { ascending: false })

    setProject(proj)
    setAttendance(atten || [])
    setMaterials(mats || [])
    setExtraWork(extra || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchProjectDetails() }, [id])

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
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{project.name}</h1>
          <p className="text-gray-500 font-medium">{project.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryIconCard title="Total Spent" value={`₹${(materials.reduce((acc, m) => acc + Number(m.total_cost), 0) + extraWork.reduce((acc, e) => acc + Number(e.amount), 0)).toLocaleString()}`} icon={<Wallet className="text-blue-600" />} />
        <SummaryIconCard title="Labour Active" value={new Set(attendance.map(a => a.labour_id)).size.toString()} icon={<Users className="text-emerald-600" />} />
        <SummaryIconCard title="Mat. Records" value={materials.length.toString()} icon={<Package className="text-orange-600" />} />
        <SummaryIconCard title="Extra Works" value={extraWork.length.toString()} icon={<TrendingUp className="text-purple-600" />} />
      </div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-gray-100 dark:border-zinc-800 w-full lg:w-auto h-14 shadow-sm overflow-x-auto overflow-y-hidden no-scrollbar">
          <TabsTrigger value="attendance" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Attendance</TabsTrigger>
          <TabsTrigger value="materials" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Materials</TabsTrigger>
          <TabsTrigger value="extra" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold h-full">Extra Work</TabsTrigger>
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
                 <CardTitle className="text-xl">Lumpsum Extra Work</CardTitle>
                 <Button size="sm" variant="outline" className="rounded-xl border-purple-200 text-purple-600 gap-2">
                   <Plus size={16} /> Add One-time Work
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
                  {extraWork.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-20 text-gray-400">No extra work logged</TableCell></TableRow> : 
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
