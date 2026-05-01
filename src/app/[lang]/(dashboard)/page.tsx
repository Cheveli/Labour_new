'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, CalendarCheck, Wallet, Package, TrendingUp, Briefcase, Zap, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalProjects: 0, totalRevenue: 0, totalLabourCost: 0, totalMaterialCost: 0, totalExtraWork: 0, netCash: 0 })
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsModalType, setDetailsModalType] = useState<string>('')
  const [detailsModalData, setDetailsModalData] = useState<any[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsPage, setDetailsPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectCosts, setProjectCosts] = useState<any[]>([])
  const [projectBreakdown, setProjectBreakdown] = useState<any[]>([])
  const supabase = createClient()

  async function fetchStats() {
    try {
      const { count: projectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true })
      const { data: incomeData } = await supabase.from('income').select('amount, date')
      const { data: paymentData } = await supabase.from('payments').select('amount, date')
      const { data: materialData } = await supabase.from('materials').select('total_amount, date')
      const { data: extraWorkData } = await supabase.from('extra_work').select('amount, date')
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
        ExtraWork: extraWorkData?.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.amount), 0) || 0,
      }))
      setMonthlyData(monthly)

      // Expense Distribution (Labour vs Material vs Extra Work)
      setProjectCosts([
        { name: 'Labour', value: totalLabourCost },
        { name: 'Material', value: totalMaterialCost },
        { name: 'Extra Work', value: totalExtraWork }
      ].filter(c => c.value > 0))

      // Project-wise breakdown
      const { data: projList } = await supabase.from('projects').select('id, name, status')
      const { data: incomeAll } = await supabase.from('income').select('project_id, amount')
      const { data: matAll } = await supabase.from('materials').select('project_id, total_amount')
      const { data: ewAll } = await supabase.from('extra_work').select('project_id, amount')
      const breakdown = (projList || []).map(p => {
        const rev = (incomeAll || []).filter(r => r.project_id === p.id).reduce((s, r) => s + Number(r.amount), 0)
        const mat = (matAll || []).filter(r => r.project_id === p.id).reduce((s, r) => s + Number(r.total_amount || 0), 0)
        const ew = (ewAll || []).filter(r => r.project_id === p.id).reduce((s, r) => s + Number(r.amount), 0)
        return { name: p.name, status: p.status, revenue: rev, material: mat, extraWork: ew, net: rev - mat - ew }
      }).filter(p => p.revenue > 0 || p.material > 0 || p.extraWork > 0)
      setProjectBreakdown(breakdown)
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

  const fetchDetailsData = async (type: string, filterStart?: string, filterEnd?: string) => {
    setDetailsLoading(true)
    try {
      let q: any
      if (type === 'REVENUE') {
        q = supabase.from('income').select('date, amount, notes, projects(name)').order('date', { ascending: false })
      } else if (type === 'LABOUR') {
        q = supabase.from('payments').select('date, amount, payment_type, notes, labour(name)').order('date', { ascending: false })
      } else if (type === 'MATERIAL') {
        q = supabase.from('materials').select('date, total_amount, name, quantity, unit, notes, projects(name)').order('date', { ascending: false })
      } else if (type === 'EXTRA_WORK') {
        q = supabase.from('extra_work').select('date, amount, work_name, notes, projects(name)').order('date', { ascending: false })
      }
      if (filterStart) q = q.gte('date', filterStart)
      if (filterEnd) q = q.lte('date', filterEnd)
      const { data } = await q
      setDetailsModalData(data || [])
      setDetailsPage(0)
    } catch (err) { console.error(err) } finally { setDetailsLoading(false) }
  }

  const handleCardClick = async (type: string) => {
    if (!['REVENUE', 'LABOUR', 'MATERIAL', 'EXTRA_WORK'].includes(type)) return
    setDetailsModalType(type)
    setDetailsModalOpen(true)
    setDetailsModalData([])
    fetchDetailsData(type)
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Overview</h1>
        <p className="text-sm mt-0.5" style={{ color: DIM }}>Financial summary across all active sites.</p>
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
              <p className="text-[8px] font-bold uppercase tracking-widest mt-2" style={{ color: DIM }}>Click for full history</p>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row: Labour vs Material vs Extra Work + Expense Pie + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Labour vs Material vs Extra Work */}
        <div style={PANEL} className="p-5 lg:col-span-2">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Labour vs Material vs Extra Work (Monthly)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2435" />
              <XAxis dataKey="month" tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString()}`, name]} cursor={{ fill: 'transparent' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: DIM }} />
              <Bar dataKey="Labour" fill={GOLD} radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="Material" fill="#60a5fa" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="ExtraWork" fill="#f59e0b" radius={[3,3,0,0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Distribution pie */}
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
      </div>

      {/* Quick Actions */}
      <div style={PANEL} className="p-5">
        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: DIM }}>Quick Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { href: '/labour', label: 'Add Worker', icon: <Users size={14} /> },
            { href: '/attendance', label: 'Mark Attendance', icon: <CalendarCheck size={14} /> },
            { href: '/materials', label: 'Add Material', icon: <Package size={14} /> },
            { href: '/payments', label: 'Create Payment', icon: <Wallet size={14} /> },
            { href: '/income', label: 'Record Revenue', icon: <TrendingUp size={14} /> },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all"
              style={{ backgroundColor: '#1a1f2e' }}
            >
              <span style={{ color: GOLD }}>{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Project-Wise Breakdown */}
      {projectBreakdown.length > 0 && (
        <div style={PANEL} className="overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: '#1e2435' }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project-Wise Breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#0d1018' }}>
                <tr style={{ borderBottom: '1px solid #1e2435' }}>
                  {['Project', 'Revenue', 'Material', 'Extra Work', 'Net P&L'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectBreakdown.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-bold text-white">{p.name}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#22c55e' }}>₹{p.revenue.toLocaleString()}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#60a5fa' }}>₹{p.material.toLocaleString()}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#f59e0b' }}>₹{p.extraWork.toLocaleString()}</td>
                    <td className="px-5 py-3 font-black" style={{ color: p.net >= 0 ? '#22c55e' : '#ef4444' }}>₹{p.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">
              {detailsModalType === 'REVENUE' ? 'Total Revenue' : detailsModalType === 'LABOUR' ? 'Labour Cost' : detailsModalType === 'MATERIAL' ? 'Material Cost' : 'Extra Work'} — Full History
            </DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>All records from start to today — {detailsModalData.length} records</DialogDescription>
          </DialogHeader>

          {/* Scrollable Table */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: '55vh' }}>
            {detailsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin" style={{ color: '#3b82f6' }} /></div>
            ) : detailsModalData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12" style={{ color: '#6b7280' }}>
                <p className="font-bold text-sm">No records found</p>
              </div>
            ) : (
              <Table>
                <TableHeader style={{ backgroundColor: '#111520', position: 'sticky', top: 0, zIndex: 10 }}>
                  <TableRow style={{ borderColor: '#1e2435' }}>
                    <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>
                      {detailsModalType === 'REVENUE' ? 'Source / Project' : detailsModalType === 'LABOUR' ? 'Worker / Project' : detailsModalType === 'MATERIAL' ? 'Material / Project' : 'Work / Project'}
                    </TableHead>
                    {detailsModalType === 'MATERIAL' && <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Qty</TableHead>}
                    <TableHead className="text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Notes</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase" style={{ color: '#6b7280' }}>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsModalData.slice(detailsPage * 10, detailsPage * 10 + 10).map((row: any, idx: number) => (
                    <TableRow key={idx} style={{ borderColor: '#1e2435' }}>
                      <TableCell className="text-xs" style={{ color: '#6b7280' }}>{format(new Date(row.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-bold text-white text-sm">
                        {detailsModalType === 'REVENUE' ? `${row.projects?.name || 'General'} ${row.notes ? '· ' + row.notes : ''}` :
                         detailsModalType === 'LABOUR' ? `${row.labour?.name || 'Unknown'} ${row.payment_type ? '· ' + row.payment_type : ''}` :
                         detailsModalType === 'MATERIAL' ? `${row.name} · ${row.projects?.name || 'No Site'}` :
                         `${row.work_name} · ${row.projects?.name || 'No Site'}`}
                      </TableCell>
                      {detailsModalType === 'MATERIAL' && <TableCell className="text-xs" style={{ color: '#6b7280' }}>{row.quantity} {row.unit}</TableCell>}
                      <TableCell className="text-xs max-w-[120px] truncate" style={{ color: '#6b7280' }}>
                        {detailsModalType === 'REVENUE' ? '—' : (row.notes || '—')}
                      </TableCell>
                      <TableCell className="text-right font-black text-sm" style={{ color: '#3b82f6' }}>₹{Number(row.amount || row.total_amount || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {detailsModalData.length > 10 && (
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#1e2435' }}>
              <button disabled={detailsPage === 0} onClick={() => setDetailsPage(p => p - 1)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
              <span className="text-xs" style={{ color: '#6b7280' }}>Page {detailsPage + 1} of {Math.ceil(detailsModalData.length / 10)}</span>
              <button disabled={(detailsPage + 1) * 10 >= detailsModalData.length} onClick={() => setDetailsPage(p => p + 1)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
