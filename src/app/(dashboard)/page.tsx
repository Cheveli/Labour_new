'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Wallet,
  ArrowUpRight,
  TrendingDown,
  Package,
  Activity,
  Zap,
  ChevronRight
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalLabour: 0,
    totalProjects: 0,
    totalRevenue: 0,
    totalLabourCost: 0,
    totalMaterialCost: 0,
    netCash: 0
  })
  const [loading, setLoading] = useState(true)
  const [labourCostModalOpen, setLabourCostModalOpen] = useState(false)
  const [materialCostModalOpen, setMaterialCostModalOpen] = useState(false)
  const [labourCostBreakdown, setLabourCostBreakdown] = useState<any[]>([])
  const [materialCostBreakdown, setMaterialCostBreakdown] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const { count: labourCount } = await supabase.from('labour').select('*', { count: 'exact', head: true })
      const { count: projectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
      
      // INCOMING: Total Revenue (only from income table - money received from clients)
      const { data: incomeData } = await supabase.from('income').select('amount')
      const totalRevenue = incomeData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
      
      // OUTGOING: Total Labour Cost (payments to workers)
      const { data: paymentData } = await supabase.from('payments').select('amount')
      const totalLabourCost = paymentData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

      // OUTGOING: Total Material Cost (materials purchased)
      const { data: materialData } = await supabase.from('materials').select('total_amount')
      const totalMaterialCost = materialData?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0
      
      // OUTGOING: Extra Work Cost (additional work expenses)
      const { data: extraWorkData } = await supabase.from('extra_work').select('amount')
      const totalExtraWorkCost = extraWorkData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
      
      // Net Cash = Revenue - (Labour + Material + Extra Work)
      const totalExpenses = totalLabourCost + totalMaterialCost + totalExtraWorkCost
      const netCash = totalRevenue - totalExpenses

      setStats({
        totalLabour: labourCount || 0,
        totalProjects: projectCount || 0,
        totalRevenue,
        totalLabourCost,
        totalMaterialCost,
        netCash
      })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const openLabourCostModal = async () => {
    setLabourCostModalOpen(true)
    // Fetch project-wise labour cost
    const { data } = await supabase
      .from('payments')
      .select(`
        amount,
        labour_id,
        labour(name),
        projects(name)
      `)
      .order('created_at', { ascending: false })
    setLabourCostBreakdown(data || [])
  }

  const openMaterialCostModal = async () => {
    setMaterialCostModalOpen(true)
    // Fetch project-wise material cost
    const { data } = await supabase
      .from('materials')
      .select(`
        total_amount,
        name,
        projects(name)
      `)
      .order('created_at', { ascending: false })
    setMaterialCostBreakdown(data || [])
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="space-y-10 pb-10">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Live Dashboard</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase leading-none">
            Analytics <span className="text-indigo-600">Overview</span>
          </h1>
          <p className="mt-4 text-zinc-500 font-medium max-w-md">
            Manage your site operations, tracking labour, materials, and finances in real-time.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-zinc-900 px-6 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center gap-6"
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Active Sites</span>
            <span className="text-2xl font-black text-indigo-600">{stats.totalProjects}</span>
          </div>
          <div className="w-px h-10 bg-zinc-100 dark:bg-zinc-800" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Workforce</span>
            <span className="text-2xl font-black text-zinc-900 dark:text-white">{stats.totalLabour}</span>
          </div>
        </motion.div>
      </div>

      {/* Primary Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard 
          title="Total Revenue" 
          value={`₹${stats.totalRevenue.toLocaleString()}`} 
          icon={<TrendingUp className="text-emerald-500" />} 
          color="emerald"
          subtitle="Income + Extra Work"
        />
        <StatCard 
          title="Total Labour Cost" 
          value={`₹${stats.totalLabourCost.toLocaleString()}`} 
          icon={<Wallet className="text-indigo-500" />} 
          color="indigo"
          subtitle="Click for breakdown"
          onClick={openLabourCostModal}
        />
        <StatCard 
          title="Total Material Cost" 
          value={`₹${stats.totalMaterialCost.toLocaleString()}`} 
          icon={<Package className="text-amber-500" />} 
          color="amber"
          subtitle="Click for breakdown"
          onClick={openMaterialCostModal}
        />
        <StatCard 
          title="Net Cash" 
          value={`₹${stats.netCash.toLocaleString()}`} 
          icon={<Activity className="text-blue-500" />} 
          color="blue"
          subtitle="Revenue - Costs"
        />
      </motion.div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Column */}
        <div className="space-y-8">
           <Card className="border-none bg-indigo-600 rounded-3xl text-white p-8 relative overflow-hidden group">
              <Zap className="absolute top-[-20px] right-[-20px] w-48 h-48 text-white/5 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 relative z-10">Quick Actions</h3>
              <p className="text-indigo-100 text-sm font-medium mb-8 relative z-10">Frequently used operations.</p>
              
              <div className="space-y-3 relative z-10">
                 <QuickActionLink href="/attendance" label="Mark Attendance" icon={<Calendar />} />
                 <QuickActionLink href="/labour" label="Add New Worker" icon={<Users />} />
                 <QuickActionLink href="/payments" label="Record Payout" icon={<Wallet />} />
                 <QuickActionLink href="/materials" label="Update Stock" icon={<Package />} />
              </div>
           </Card>
        </div>
      </div>

      {/* Labour Cost Breakdown Modal */}
      <Dialog open={labourCostModalOpen} onOpenChange={setLabourCostModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Labour Cost Breakdown</DialogTitle>
            <DialogDescription>Project-wise and payment details</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labourCostBreakdown.map((payment, idx) => (
                <TableRow key={idx}>
                  <TableCell>{payment.labour?.name || 'N/A'}</TableCell>
                  <TableCell>{payment.projects?.name || 'N/A'}</TableCell>
                  <TableCell className="text-right font-bold">₹{Number(payment.amount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Material Cost Breakdown Modal */}
      <Dialog open={materialCostModalOpen} onOpenChange={setMaterialCostModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Material Cost Breakdown</DialogTitle>
            <DialogDescription>Project-wise material expenses</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialCostBreakdown.map((material, idx) => (
                <TableRow key={idx}>
                  <TableCell>{material.name}</TableCell>
                  <TableCell>{material.projects?.name || 'N/A'}</TableCell>
                  <TableCell className="text-right font-bold">₹{Number(material.total_amount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ title, value, icon, color, subtitle, onClick }: any) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
      }}
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-50 dark:border-zinc-900/50 shadow-xl shadow-zinc-100/20 dark:shadow-none hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all duration-300 group",
        onClick && "cursor-pointer hover:shadow-2xl"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:rotate-12",
        `bg-${color}-50 dark:bg-${color}-900/10`
      )}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}
      </div>
      <p className="text-xs font-black uppercase text-zinc-400 tracking-widest mb-1">{title}</p>
      <h3 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white mb-2">{value}</h3>
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{subtitle}</p>
    </motion.div>
  )
}

function QuickActionLink({ href, label, icon }: any) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all group/link"
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 18, className: "text-indigo-200" })}
        <span className="font-bold text-sm tracking-tight">{label}</span>
      </div>
      <ChevronRight size={14} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
    </Link>
  )
}
