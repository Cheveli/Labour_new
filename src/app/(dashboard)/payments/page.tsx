'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Plus, 
  Search, 
  History, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft,
  MessageCircle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

export default function PaymentsPage() {
  const [labourers, setLabourers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [paymentData, setPaymentData] = useState({
    labour_id: '',
    project_id: '',
    amount: '',
    payment_type: 'weekly',
    date: format(new Date(), 'yyyy-MM-dd')
  })
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    // Fetch labour info
    const { data: labs } = await supabase.from('labour').select('*')
    // Fetch projects
    const { data: projs } = await supabase.from('projects').select('*')
    
    // Fetch all attendance for calculation
    const { data: atten } = await supabase.from('attendance').select('labour_id, days_worked')
    // Fetch all payments for calculation
    const { data: pmnts } = await supabase.from('payments').select('labour_id, amount')

    const processedLabs = labs?.map(lab => {
      const totalDays = atten?.filter(a => a.labour_id === lab.id).reduce((acc, curr) => acc + Number(curr.days_worked), 0) || 0
      const totalEarned = totalDays * Number(lab.daily_rate)
      const totalPaid = pmnts?.filter(p => p.labour_id === lab.id).reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
      
      return {
        ...lab,
        totalEarned,
        totalPaid,
        balance: totalEarned - totalPaid
      }
    })

    setLabourers(processedLabs || [])
    setProjects(projs || [])
    setLoading(false)
  }

  const handleMakePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase
      .from('payments')
      .insert([{
        ...paymentData,
        amount: parseFloat(paymentData.amount),
        project_id: paymentData.project_id || null
      }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Payment recorded successfully')
      setIsPayDialogOpen(false)
      setPaymentData({
        labour_id: '',
        project_id: '',
        amount: '',
        payment_type: 'weekly',
        date: format(new Date(), 'yyyy-MM-dd')
      })
      fetchData()
    }
    setLoading(false)
  }

  const filteredLabourers = labourers.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sendWhatsApp = (worker: any) => {
    const msg = `*Payment Summary - ProBuild*\n\nWorker: ${worker.name}\nTotal Earned: ₹${worker.totalEarned}\nTotal Paid: ₹${worker.totalPaid}\n*Balance: ₹${worker.balance}*\n\nDate: ${format(new Date(), 'dd/MM/yyyy')}`
    window.open(`https://wa.me/${worker.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payments & Payroll</h1>
          <p className="text-gray-500">Manage worker balances and record payouts.</p>
        </div>
        
        <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 rounded-xl shadow-lg shadow-emerald-100 dark:shadow-none">
              <Plus className="mr-2 h-5 w-5" /> Make a Payment
            </Button>
          } />
          <DialogContent className="rounded-3xl border-none shadow-2xl p-8 bg-white dark:bg-zinc-950">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-emerald-600">Record Payout</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleMakePayment} className="space-y-5 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Select Worker</label>
                <Select onValueChange={(v: string | null) => setPaymentData({...paymentData, labour_id: v ?? ''})}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue placeholder="Chose worker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {labourers.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} (Bal: ₹{l.balance})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Amount (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="5000" 
                    value={paymentData.amount}
                    onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Project (Optional)</label>
                  <Select onValueChange={(v: string | null) => setPaymentData({...paymentData, project_id: v ?? ''})}>
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="All/General" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Type</label>
                  <Select 
                    defaultValue="weekly" 
                    onValueChange={v => setPaymentData({...paymentData, payment_type: (v as any) || 'weekly'})}
                   >
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="advance">Advance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Date</label>
                  <Input 
                    type="date" 
                    value={paymentData.date}
                    onChange={e => setPaymentData({...paymentData, date: e.target.value})}
                    className="rounded-xl h-12"
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl text-lg mt-4">
                {loading ? <Loader2 className="animate-spin" /> : 'Record Payment'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SummaryCard 
          title="Total Paid" 
          value={`₹${labourers.reduce((acc, l) => acc + l.totalPaid, 0).toLocaleString()}`} 
          icon={<ArrowUpRight className="text-emerald-500" />}
        />
        <SummaryCard 
          title="Outstanding Balance" 
          value={`₹${labourers.reduce((acc, l) => acc + l.balance, 0).toLocaleString()}`} 
          icon={<Wallet className="text-red-500" />}
        />
        <div className="lg:col-span-2">
           <Card className="border-none shadow-xl bg-blue-600 text-white rounded-3xl h-full flex flex-col justify-center p-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-white/20 rounded-2xl">
                 <History size={24} />
               </div>
               <div>
                 <h4 className="font-bold text-xl uppercase tracking-wider opacity-80 decoration-slice">Settlement Overview</h4>
                 <p className="text-blue-100">Weekly payroll settlement status</p>
               </div>
             </div>
           </Card>
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black rounded-3xl overflow-hidden">
        <CardHeader className="p-6 border-b border-gray-50 dark:border-zinc-900">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search worker name..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-gray-50 dark:bg-zinc-900 border-none rounded-xl"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50">
                <TableHead className="px-6 py-4">Worker</TableHead>
                <TableHead>Total Earned</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead className="text-right px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {filteredLabourers.map(worker => (
                  <motion.tr 
                    key={worker.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group"
                  >
                    <TableCell className="px-6 py-4">
                      <div className="font-bold text-gray-900 dark:text-zinc-100">{worker.name}</div>
                      <div className="text-xs text-gray-500">₹{worker.daily_rate}/day</div>
                    </TableCell>
                    <TableCell className="font-medium text-blue-600">₹{worker.totalEarned}</TableCell>
                    <TableCell className="font-medium text-emerald-600">₹{worker.totalPaid}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "font-extrabold",
                        worker.balance > 0 ? "text-red-500" : "text-emerald-500"
                      )}>
                        ₹{worker.balance}
                      </span>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl text-emerald-600 hover:bg-emerald-50/50 gap-2"
                        onClick={() => sendWhatsApp(worker)}
                      >
                        <MessageCircle size={16} />
                        Summary
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, icon }: any) {
  return (
    <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black rounded-3xl">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <div className="p-2 bg-gray-50 dark:bg-zinc-900 rounded-lg">{icon}</div>
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{value}</h3>
      </CardContent>
    </Card>
  )
}
