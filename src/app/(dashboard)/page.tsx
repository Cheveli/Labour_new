'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, CalendarCheck, Wallet, Package, TrendingUp, Briefcase, Zap, Search, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMemo } from 'react'

export default function DashboardPage() {
  const [chatQuery, setChatQuery] = useState('')
  const [chatResponse, setChatResponse] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [stats, setStats] = useState({ totalProjects: 0, totalRevenue: 0, totalLabourCost: 0, totalMaterialCost: 0, totalExtraWork: 0, netCash: 0 })
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsModalType, setDetailsModalType] = useState<string>('')
  const [detailsModalData, setDetailsModalData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectCosts, setProjectCosts] = useState<any[]>([])
  const supabase = createClient()

  const chatTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearChatTimer = () => {
    if (chatTimerRef.current) clearTimeout(chatTimerRef.current)
  }

  const startChatTimer = () => {
    clearChatTimer()
    chatTimerRef.current = setTimeout(() => {
      setChatResponse('')
    }, 60000)
  }

  useEffect(() => {
    const handleInteraction = () => {
      if (chatResponse) {
        startChatTimer()
      }
    }
    
    if (chatResponse) {
      startChatTimer()
      window.addEventListener('mousemove', handleInteraction)
      window.addEventListener('keydown', handleInteraction)
      window.addEventListener('touchstart', handleInteraction)
      window.addEventListener('click', handleInteraction)
    }

    return () => {
      window.removeEventListener('mousemove', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      window.removeEventListener('click', handleInteraction)
      clearChatTimer()
    }
  }, [chatResponse])

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatQuery.trim()) return
    setIsChatLoading(true)
    setChatResponse('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatQuery })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setChatResponse(data.reply)
    } catch (err: any) {
      toast.error(err.message || 'Failed to get answer')
    } finally {
      setIsChatLoading(false)
    }
  }

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

      setStats({ totalProjects: projectCount || 0, totalRevenue, totalLabourCost, totalMaterialCost, totalExtraWork, netCash })

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

      // Expense Distribution (Labour vs Material vs Extra Work)
      setProjectCosts([
        { name: 'Labour', value: totalLabourCost },
        { name: 'Material', value: totalMaterialCost },
        { name: 'Extra Work', value: totalExtraWork }
      ].filter(c => c.value > 0))
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
    { type: 'REVENUE', label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: <TrendingUp size={18} color="#22c55e" />, bg: '#1a2a1a', color: '#22c55e', clickable: true },
    { type: 'LABOUR', label: 'Labour Cost', value: `₹${stats.totalLabourCost.toLocaleString()}`, icon: <Wallet size={18} color={GOLD} />, bg: '#2a1e10', color: GOLD, clickable: true },
    { type: 'MATERIAL', label: 'Material Cost', value: `₹${stats.totalMaterialCost.toLocaleString()}`, icon: <Package size={18} color="#60a5fa" />, bg: '#151e2e', color: '#60a5fa', clickable: true },
    { type: 'EXTRA_WORK', label: 'Extra Work', value: `₹${stats.totalExtraWork.toLocaleString()}`, icon: <Zap size={18} color="#f59e0b" />, bg: '#292011', color: '#f59e0b', clickable: true },
    { type: 'NET_CASH', label: 'Net Cash', value: `₹${stats.netCash.toLocaleString()}`, icon: <TrendingUp size={18} color={stats.netCash >= 0 ? '#22c55e' : '#ef4444'} />, bg: '#111520', color: stats.netCash >= 0 ? '#22c55e' : '#ef4444', clickable: false },
    { type: 'SITES', label: 'Active Sites', value: stats.totalProjects, icon: <Briefcase size={18} color="#a78bfa" />, bg: '#1e1a2e', color: '#a78bfa', clickable: false },
  ]

  const handleCardClick = async (type: string) => {
    if (!['REVENUE', 'LABOUR', 'MATERIAL', 'EXTRA_WORK'].includes(type)) return;
    
    setDetailsModalType(type)
    setDetailsModalOpen(true)
    setDetailsModalData([])
    
    const start = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const end = format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    
    try {
      if (type === 'REVENUE') {
        const { data } = await supabase.from('income').select('date, amount, source, projects(name)').gte('date', start).lte('date', end).order('date', { ascending: false })
        setDetailsModalData(data || [])
      } else if (type === 'LABOUR') {
        const { data } = await supabase.from('payments').select('date, amount, payment_type, labour(name)').gte('date', start).lte('date', end).order('date', { ascending: false })
        setDetailsModalData(data || [])
      } else if (type === 'MATERIAL') {
        const { data } = await supabase.from('materials').select('date, total_amount, name, projects(name)').gte('date', start).lte('date', end).order('date', { ascending: false })
        setDetailsModalData(data || [])
      } else if (type === 'EXTRA_WORK') {
        const { data } = await supabase.from('extra_work').select('date, amount, work_name, projects(name)').gte('date', start).lte('date', end).order('date', { ascending: false })
        setDetailsModalData(data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Overview</h1>
        <p className="text-sm mt-0.5" style={{ color: DIM }}>Financial summary across all active sites.</p>
      </div>

      {/* AI Search Bar */}
      <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-emerald-500"></div>
        <form onSubmit={handleChat} className="relative flex items-center">
          <Sparkles className="absolute left-4 text-blue-500" size={20} />
          <input
            type="text"
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            placeholder="Ask anything about projects, worker advances, or material costs..."
            className="w-full bg-[#1a2030] text-white font-bold placeholder-zinc-500 rounded-xl py-4 pl-12 pr-32 outline-none border border-[#1e2435] focus:border-blue-500/50 transition-all"
            disabled={isChatLoading}
          />
          <button 
            type="submit" 
            disabled={isChatLoading || !chatQuery.trim()}
            className="absolute right-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
          >
            {isChatLoading ? <Loader2 size={16} className="animate-spin" /> : 'Ask AI'}
          </button>
        </form>
        {chatResponse && (
          <div className="mt-6 p-4 bg-[#1a2030] border border-[#1e2435] rounded-xl relative">
            <p className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">AI Response</p>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{chatResponse}</p>
          </div>
        )}
      </div>

      {/* Top 6 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {topCards.map((c, i) => (
          <div 
            key={i} 
            style={PANEL} 
            className={`p-5 ${c.clickable ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
            onClick={() => c.clickable && handleCardClick(c.type)}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: DIM }}>{c.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>{c.icon}</div>
            </div>
            <p className="text-2xl font-black" style={{ color: c.color }}>{loading ? '—' : c.value}</p>
            {c.clickable && (
              <p className="text-[8px] font-bold uppercase tracking-widest mt-2" style={{ color: DIM }}>Click for this week's report</p>
            )}
          </div>
        ))}
      </div>

      {/* Render Charts with useMemo to prevent re-renders during typing */}
      {useMemo(() => (
        <>
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
                  <Area type="monotone" dataKey="Revenue" stroke="#22c55e" fill="url(#revGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString()}`, name]} cursor={{ fill: 'transparent' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: DIM }} />
                  <Bar dataKey="Labour" fill={GOLD} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Material" fill="#60a5fa" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2: Project Cost Distribution + Monthly Cash Flow + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Expense Distribution */}
            <div style={PANEL} className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Expense Distribution</p>
              {projectCosts.length === 0 ? (
                <div className="h-[160px] flex items-center justify-center text-xs" style={{ color: DIM }}>No expenses yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={projectCosts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={3} isAnimationActive={false}>
                      {projectCosts.map((c, i) => <Cell key={c.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
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
                  <Area type="monotone" dataKey="Net" stroke={GOLD} fill="url(#netGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
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
            </div>
          </div>
        </>
      ), [monthlyData, projectCosts])}

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              This Week's {detailsModalType === 'REVENUE' ? 'Revenue' : detailsModalType === 'LABOUR' ? 'Labour Cost' : detailsModalType === 'MATERIAL' ? 'Material Cost' : 'Extra Work'} Report
            </DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>
              Showing records for the current week.
            </DialogDescription>
          </DialogHeader>
          {detailsModalData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: '#6b7280' }}>
              <p className="font-bold text-sm">No records found for this week</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div style={{ backgroundColor: '#0d1018', border: '1px solid #1e2435', borderRadius: '0.75rem' }} className="overflow-hidden">
                <Table>
                  <TableHeader style={{ backgroundColor: '#111520' }}>
                    <TableRow style={{ borderColor: '#1e2435' }}>
                      <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>
                        {detailsModalType === 'REVENUE' ? 'Source / Project' : detailsModalType === 'LABOUR' ? 'Worker' : detailsModalType === 'MATERIAL' ? 'Material / Project' : 'Work / Project'}
                      </TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailsModalData.map((row: any, idx: number) => (
                      <TableRow key={idx} style={{ borderColor: '#1e2435' }}>
                        <TableCell className="text-xs" style={{ color: '#6b7280' }}>{format(new Date(row.date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="font-bold text-white text-sm">
                          {detailsModalType === 'REVENUE' ? (row.source || row.projects?.name || 'General') :
                           detailsModalType === 'LABOUR' ? (row.labour?.name || 'Unknown') :
                           detailsModalType === 'MATERIAL' ? `${row.name} (${row.projects?.name || 'No Site'})` :
                           `${row.work_name} (${row.projects?.name || 'No Site'})`}
                        </TableCell>
                        <TableCell className="text-right font-black text-sm" style={{ color: '#3b82f6' }}>₹{Number(row.amount || row.total_amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
