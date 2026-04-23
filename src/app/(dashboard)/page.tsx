'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  Package, 
  CreditCard,
  Plus,
  ArrowUpRight,
  Calendar,
  CalendarCheck,
  Wallet
} from 'lucide-react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { format } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalLabour: 0,
    totalProjects: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalMaterials: 0,
    pendingPayments: 0
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      
      // Fetch total labour
      const { count: labourCount } = await supabase.from('labour').select('*', { count: 'exact', head: true })
      
      // Fetch total projects
      const { count: projectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
      
      // Fetch income
      const { data: incomeData } = await supabase.from('income').select('amount')
      const totalIncome = incomeData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
      
      // Fetch materials & attendance (for expenses)
      const { data: materialData } = await supabase.from('materials').select('total_cost')
      const totalMaterialCost = materialData?.reduce((acc, curr) => acc + Number(curr.total_cost), 0) || 0
      
      const { data: paymentData } = await supabase.from('payments').select('amount')
      const totalPaid = paymentData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

      setStats({
        totalLabour: labourCount || 0,
        totalProjects: projectCount || 0,
        totalIncome: totalIncome || 0,
        totalExpenses: totalMaterialCost + totalPaid,
        totalMaterials: totalMaterialCost,
        pendingPayments: 0
      })
      setLoading(false)
    }

    fetchStats()
  }, [])

  const chartData = [
    { name: 'Mon', attendance: 0, payments: 0 },
    { name: 'Tue', attendance: 0, payments: 0 },
    { name: 'Wed', attendance: 0, payments: 0 },
    { name: 'Thu', attendance: 0, payments: 0 },
    { name: 'Fri', attendance: 0, payments: 0 },
    { name: 'Sat', attendance: 0, payments: 0 },
    { name: 'Sun', attendance: 0, payments: 0 },
  ]

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
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button render={<Link href="/attendance" />} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none">
            <Plus className="mr-2 h-4 w-4" /> Mark Attendance
          </Button>
          <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50" suppressHydrationWarning>
            <Calendar className="mr-2 h-4 w-4" /> {format(new Date(), 'MMM dd, yyyy')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard 
          title="Total Labour" 
          value={stats.totalLabour} 
          icon={<Users className="text-blue-600" />} 
          trend="Active workers"
          variants={item}
        />
        <StatCard 
          title="Total Income" 
          value={`₹${stats.totalIncome.toLocaleString()}`} 
          icon={<TrendingUp className="text-emerald-600" />} 
          trend="Site revenue"
          variants={item}
        />
        <StatCard 
          title="Total Payouts" 
          value={`₹${stats.totalExpenses.toLocaleString()}`} 
          icon={<Wallet className="text-purple-600" />} 
          trend="Wages and Materials"
          variants={item}
        />
        <StatCard 
          title="Material Cost" 
          value={`₹${stats.totalMaterials.toLocaleString()}`} 
          icon={<Package className="text-orange-600" />} 
          trend="Tracking inventory"
          variants={item}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Trend Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center justify-between">
                Weekly Performance
                <div className="flex gap-2 text-xs font-normal">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-600 rounded-full"></span> Attendance</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Payments</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} hide />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="attendance" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="payments" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Navigation Boxes */}
        <div className="grid grid-cols-2 gap-4">
          <QuickNavLink 
            title="Labour Records" 
            desc="Manage workforce" 
            icon={<Users className="w-8 h-8" />} 
            href="/labour" 
            color="bg-blue-50 text-blue-600"
          />
          <QuickNavLink 
            title="Attendance" 
            desc="Track daily work" 
            icon={<CalendarCheck className="w-8 h-8" />} 
            href="/attendance" 
            color="bg-emerald-50 text-emerald-600"
          />
          <QuickNavLink 
            title="Payments" 
            desc="Financial tracking" 
            icon={<Wallet className="w-8 h-8" />} 
            href="/payments" 
            color="bg-purple-50 text-purple-600"
          />
          <QuickNavLink 
            title="Projects" 
            desc="View all sites" 
            icon={<Briefcase className="w-8 h-8" />} 
            href="/projects" 
            color="bg-orange-50 text-orange-600"
          />
        </div>
      </div>

      {/* Ongoing Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ongoing Projects</h2>
          <Link href="/projects" className="text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ProjectCard 
            name="Green Valley Apartment" 
            status="In Progress" 
            completion={65} 
            labour={14}
            id="proj-1"
          />
          <ProjectCard 
            name="Sunrise Shopping Mall" 
            status="Early Stages" 
            completion={12} 
            labour={8}
            id="proj-2"
          />
          <ProjectCard 
            name="Lakeview Villa" 
            status="Finishing" 
            completion={92} 
            labour={4}
            id="proj-3"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, trend, variants }: any) {
  return (
    <motion.div variants={variants}>
      <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black group hover:scale-[1.02] transition-transform duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gray-50 dark:bg-zinc-900 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
              {icon}
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 rounded-full">
              {trend}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500 dark:text-zinc-400">{title}</p>
            <h3 className="text-2xl font-bold dark:text-white">{value}</h3>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function QuickNavLink({ title, desc, icon, href, color }: any) {
  return (
    <Link href={href}>
      <Card className="h-full border-none shadow-lg shadow-gray-100 dark:shadow-none bg-white dark:bg-black hover:ring-2 hover:ring-blue-600 transition-all group overflow-hidden">
        <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
          <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300", color)}>
            {icon}
          </div>
          <div>
            <h4 className="font-bold dark:text-white">{title}</h4>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function ProjectCard({ name, status, completion, labour, id }: any) {
  return (
    <Link href={`/projects/${id}`}>
      <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black hover:translate-y-[-4px] transition-all duration-300">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg dark:text-white">{name}</h3>
            <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none">{status}</Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Progress</span>
              <span className="font-semibold">{completion}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-blue-600 rounded-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users size={16} />
            <span>{labour} Workers active</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function Badge({ children, className }: any) {
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", className)}>
      {children}
    </span>
  )
}

