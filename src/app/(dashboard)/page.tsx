'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, CalendarCheck, Wallet, Package, TrendingUp, Briefcase } from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalProjects: 0, totalRevenue: 0, totalLabourCost: 0, totalMaterialCost: 0, netCash: 0 })
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectCosts, setProjectCosts] = useState<any[]>([])
  const supabase = createClient()

  async function fetchStats() {
    try {
      const { count: projectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
      const { data: incomeData } = await supabase.from('income').select('amount, date')
      const { data: paymentData } = await supabase.from('payments').select('amount, date')
      const { data: materialData } = await supabase.from('materials').select('total_amount, date')
      const { data: extraWorkData } = await supabase.from('extra_work').select('amount')
      const { data: projectsData } = await supabase.from('projects').select('id, name')

      const totalRevenue = incomeData?.reduce((a, c) => a + Number(c.amount), 0) || 0
      const totalLabourCost = paymentData?.reduce((a, c) => a + Number(c.amount), 0) || 0
      const totalMaterialCost = materialData?.reduce((a, c) => a + Number(c.total_amount || 0), 0) || 0
      const totalExtraWork = extraWorkData?.reduce((a, c) => a + Number(c.amount), 0) || 0
      const netCash = totalRevenue - (totalLabourCost + totalMaterialCost + totalExtraWork)

      setStats({ totalProjects: projectCount || 0, totalRevenue, totalLabourCost, totalMaterialCost, netCash })

      // Build last-6-months monthly data
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i)
        return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM'), start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') }
      })
      const monthly = months.map(m => ({
        month: m.label,
        Revenue: incomeData?.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.amount), 0) || 0,
        Labour: paymentData?.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.amount), 0) || 0,
        Material: materialData?.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.total_amount || 0), 0) || 0,
      }))
      setMonthlyData(monthly)

      // Project-wise cost (payments + materials per project)
      const { data: projPay } = await supabase.from('payments').select('amount, project_id')
      const { data: projMat } = await supabase.from('materials').select('total_amount, project_id')
      const costMap: Record<string, number> = {}
      projPay?.forEach(p => { costMap[p.project_id] = (costMap[p.project_id] || 0) + Number(p.amount) })
      projMat?.forEach(m => { costMap[m.project_id] = (costMap[m.project_id] || 0) + Number(m.total_amount || 0) })
      const projCosts = (projectsData || [])
        .map(p => ({ name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name, value: costMap[p.id] || 0 }))
        .filter(p => p.value > 0)
      setProjectCosts(projCosts)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchStats() }, [])

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const GOLD = '#3b82f6'
  const DIM = '#6b7280'
  const CHART_COLORS = ['#3b82f6', '#22c55e', '#60a5fa', '#a78bfa', '#f87171']
  const tooltipStyle = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '8px', color: '#f0f0f0', fontSize: 12 }

  const topCards = [
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: <TrendingUp size={18} color="#22c55e" />, bg: '#1a2a1a', color: '#22c55e' },
    { label: 'Labour Cost', value: `₹${stats.totalLabourCost.toLocaleString()}`, icon: <Wallet size={18} color={GOLD} />, bg: '#2a1e10', color: GOLD },
    { label: 'Material Cost', value: `₹${stats.totalMaterialCost.toLocaleString()}`, icon: <Package size={18} color="#60a5fa" />, bg: '#151e2e', color: '#60a5fa' },
    { label: 'Active Sites', value: stats.totalProjects, icon: <Briefcase size={18} color="#a78bfa" />, bg: '#1e1a2e', color: '#a78bfa' },
  ]

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Overview</h1>
        <p className="text-sm mt-0.5" style={{ color: DIM }}>Financial summary across all active sites.</p>
      </div>

      {/* Top 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((c, i) => (
          <div key={i} style={PANEL} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: DIM }}>{c.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>{c.icon}</div>
            </div>
            <p className="text-2xl font-black" style={{ color: c.color }}>{loading ? '—' : c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Monthly Revenue Trend + Labour vs Material */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Revenue Trend */}
        <div style={PANEL} className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Monthly Revenue Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2435" />
              <XAxis dataKey="month" tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="Revenue" stroke="#22c55e" fill="url(#revGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Labour vs Material Cost */}
        <div style={PANEL} className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Labour vs Material Cost</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2435" />
              <XAxis dataKey="month" tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString()}`, name]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: DIM }} />
              <Bar dataKey="Labour" fill={GOLD} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Material" fill="#60a5fa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Project Cost Distribution + Monthly Cash Flow + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Project-wise Cost Distribution */}
        <div style={PANEL} className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Project Cost Distribution</p>
          {projectCosts.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-xs" style={{ color: DIM }}>No project data</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={projectCosts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={3}>
                  {projectCosts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Cost']} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: DIM }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly Cash Flow */}
        <div style={PANEL} className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Monthly Cash Flow</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyData.map(m => ({ ...m, Net: m.Revenue - m.Labour - m.Material }))} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2435" />
              <XAxis dataKey="month" tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Net Cash']} />
              <Area type="monotone" dataKey="Net" stroke={GOLD} fill="url(#netGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div style={PANEL} className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Quick Actions</p>
          <div className="space-y-2">
            {[
              { href: '/labour', label: 'Add Worker', icon: <Users size={14} /> },
              { href: '/attendance', label: 'Mark Attendance', icon: <CalendarCheck size={14} /> },
              { href: '/materials', label: 'Add Material', icon: <Package size={14} /> },
              { href: '/payments', label: 'Create Payment', icon: <Wallet size={14} /> },
              { href: '/income', label: 'Record Revenue', icon: <TrendingUp size={14} /> },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white transition-all"
                style={{ backgroundColor: '#1a1f2e' }}
              >
                <span style={{ color: GOLD }}>{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: '#1e2435' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: DIM }}>Net Cash</p>
            <p className="text-xl font-black" style={{ color: stats.netCash >= 0 ? '#22c55e' : '#ef4444' }}>
              {loading ? '—' : `₹${stats.netCash.toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
