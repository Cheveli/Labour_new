'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, User, IndianRupee, Calendar, TrendingUp, Wallet, AlertCircle, Download, MessageCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const GOLD = '#3b82f6'
const DIM = '#6b7280'

export default function WorkerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const workerId = params.id as string
  const supabase = createClient()

  const [worker, setWorker] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [attPage, setAttPage] = useState(0)
  const [payPage, setPayPage] = useState(0)
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId])

  async function fetchAll() {
    setLoading(true)
    const [{ data: w }, { data: att }, { data: pay }] = await Promise.all([
      supabase.from('labour').select('*').eq('id', workerId).single(),
      supabase.from('attendance').select('*, projects(name)').eq('labour_id', workerId).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('labour_id', workerId).order('date', { ascending: false }),
    ])
    setWorker(w)
    setAttendance(att || [])
    setPayments(pay || [])
    setLoading(false)
  }

  const filteredAtt = attendance.filter(r => r.date.startsWith(monthFilter))
  const filteredPay = payments.filter(r => r.date.startsWith(monthFilter))

  const totalDays = attendance.reduce((s, r) => s + (r.days_worked || 0), 0)
  const totalOT = attendance.reduce((s, r) => s + (r.overtime_amount || 0), 0)
  const totalAdvance = attendance.reduce((s, r) => s + (r.advance_amount || 0), 0)
  const totalPaid = payments.reduce((s, r) => s + (r.amount || 0), 0)
  const grossEarned = totalDays * (worker?.daily_rate || 0) + totalOT
  const netBalance = grossEarned - totalAdvance - totalPaid

  const generateSalaryStatement = () => {
    const doc = new jsPDF()
    const mAttDays = filteredAtt.reduce((s, r) => s + (r.days_worked || 0), 0)
    const mOT = filteredAtt.reduce((s, r) => s + (r.overtime_amount || 0), 0)
    const mAdv = filteredAtt.reduce((s, r) => s + (r.advance_amount || 0), 0)
    const mPaid = filteredPay.reduce((s, r) => s + (r.amount || 0), 0)
    const mGross = mAttDays * (worker?.daily_rate || 0) + mOT
    doc.setFillColor(10, 12, 18); doc.rect(0, 0, 210, 297, 'F')
    doc.setFillColor(59, 130, 246); doc.rect(0, 0, 210, 20, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text('SSC CONSTRUCTIONS — SALARY STATEMENT', 105, 13, { align: 'center' })
    doc.setTextColor(240, 240, 240); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
    doc.text(`Worker: ${worker.name}`, 14, 32)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(160, 160, 160)
    doc.text(`Type: ${worker.type}   |   Daily Rate: Rs.${worker.daily_rate}   |   Month: ${monthFilter}`, 14, 39)
    autoTable(doc, {
      startY: 48,
      head: [['Date', 'Project', 'Status', 'Days', 'OT Amt', 'Advance', 'Earned']],
      body: filteredAtt.map(r => [
        r.date,
        r.projects?.name || '—',
        r.days_worked === 1 ? 'Full Day' : r.days_worked === 0.5 ? 'Half Day' : 'Overtime',
        r.days_worked,
        `Rs.${r.overtime_amount || 0}`,
        `Rs.${r.advance_amount || 0}`,
        `Rs.${Math.round((r.days_worked || 0) * (worker.daily_rate || 0) + (r.overtime_amount || 0))}`,
      ]),
      styles: { fontSize: 8, fillColor: [17, 21, 32], textColor: [240, 240, 240], lineColor: [30, 36, 53] },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [13, 16, 24] },
    })
    const sy = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(240, 240, 240)
    doc.text('PAYMENT SUMMARY', 14, sy)
    autoTable(doc, {
      startY: sy + 5,
      head: [['Description', 'Amount']],
      body: [
        ['Gross Earned', `Rs.${Math.round(mGross).toLocaleString()}`],
        ['Advance Deducted', `Rs.${mAdv.toLocaleString()}`],
        ['Payments Made', `Rs.${mPaid.toLocaleString()}`],
        ['Net Balance', `Rs.${Math.round(mGross - mAdv - mPaid).toLocaleString()}`],
      ],
      styles: { fontSize: 9, fillColor: [17, 21, 32], textColor: [240, 240, 240] },
      headStyles: { fillColor: [30, 36, 53], textColor: [107, 114, 128] },
    })
    doc.save(`Salary_${worker.name.replace(/\s+/g, '_')}_${monthFilter}.pdf`)
  }

  const sendWhatsApp = () => {
    const mAttDays = filteredAtt.reduce((s, r) => s + (r.days_worked || 0), 0)
    const mOT = filteredAtt.reduce((s, r) => s + (r.overtime_amount || 0), 0)
    const mAdv = filteredAtt.reduce((s, r) => s + (r.advance_amount || 0), 0)
    const mPaid = filteredPay.reduce((s, r) => s + (r.amount || 0), 0)
    const mGross = mAttDays * (worker?.daily_rate || 0) + mOT
    const msg = [
      `🏗️ *SSC CONSTRUCTIONS — SALARY STATEMENT*`,
      `👷 *${worker.name}* (${worker.type})`,
      `📅 Month: ${monthFilter}`,
      `━━━━━━━━━━━━━━━━`,
      `✅ Days Worked: ${mAttDays}`,
      `💰 Gross Earned: ₹${Math.round(mGross).toLocaleString()}`,
      `📉 Advance: ₹${mAdv.toLocaleString()}`,
      `💳 Paid: ₹${mPaid.toLocaleString()}`,
      `━━━━━━━━━━━━━━━━`,
      `💵 *Net Balance: ₹${Math.round(mGross - mAdv - mPaid).toLocaleString()}*`,
    ].join('\n')
    const phone = worker.phone ? worker.phone.replace(/[^0-9]/g, '') : ''
    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!worker) return (
    <div className="text-center py-24 text-zinc-500">Worker not found</div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors" style={{ border: '1px solid #1e2435' }}>
          <ArrowLeft size={18} style={{ color: DIM }} />
        </button>
        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{worker.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: DIM }}>{worker.type || 'Worker'} · ₹{worker.daily_rate}/day{worker.phone ? ` · ${worker.phone}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="space-y-0.5">
              <label className="text-[9px] font-black uppercase tracking-widest" style={{ color: DIM }}>Month</label>
              <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                className="styled-select" style={{ height: '2.25rem', fontSize: '0.8rem', width: '9rem' }} />
            </div>
            <button onClick={generateSalaryStatement}
              className="h-9 px-4 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Download size={13} /> Salary PDF
            </button>
            <button onClick={sendWhatsApp}
              className="h-9 px-4 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all"
              style={{ backgroundColor: '#128C7E', color: '#fff' }}>
              <MessageCircle size={13} /> WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Days', value: totalDays.toFixed(1), icon: <Calendar size={16} color="#22c55e" />, color: '#22c55e', bg: '#0d1f14' },
          { label: 'Gross Earned', value: `₹${grossEarned.toLocaleString()}`, icon: <TrendingUp size={16} color={GOLD} />, color: GOLD, bg: '#0d1530' },
          { label: 'Total Paid', value: `₹${totalPaid.toLocaleString()}`, icon: <Wallet size={16} color="#a78bfa" />, color: '#a78bfa', bg: '#1a1430' },
          { label: 'Net Balance', value: `₹${netBalance.toLocaleString()}`, icon: <IndianRupee size={16} color={netBalance >= 0 ? '#22c55e' : '#ef4444'} />, color: netBalance >= 0 ? '#22c55e' : '#ef4444', bg: netBalance >= 0 ? '#0d1f14' : '#1f0d0d' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ ...PANEL, backgroundColor: card.bg }}>
            <div className="flex items-center gap-2 mb-2">{card.icon}<span className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{card.label}</span></div>
            <p className="text-xl font-black" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance History */}
        <div className="rounded-2xl overflow-hidden" style={PANEL}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1e2435' }}>
            <p className="text-sm font-black text-white uppercase tracking-wide">Attendance History</p>
            <span className="text-xs font-bold" style={{ color: DIM }}>{attendance.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader style={{ backgroundColor: '#0d1018' }}>
                <TableRow style={{ borderColor: '#1e2435' }}>
                  <TableHead className="py-3 px-4 text-[10px] font-black uppercase" style={{ color: DIM }}>Date</TableHead>
                  <TableHead className="py-3 text-[10px] font-black uppercase" style={{ color: DIM }}>Project</TableHead>
                  <TableHead className="py-3 text-[10px] font-black uppercase text-center" style={{ color: DIM }}>Status</TableHead>
                  <TableHead className="py-3 text-[10px] font-black uppercase text-right" style={{ color: DIM }}>Advance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.slice(attPage * 10, attPage * 10 + 10).map(rec => (
                  <TableRow key={rec.id} style={{ borderColor: '#1e2435' }}>
                    <TableCell className="px-4 py-2 text-xs font-bold" style={{ color: DIM }}>{format(new Date(rec.date), 'dd MMM yy')}</TableCell>
                    <TableCell className="py-2 text-xs font-bold text-white">{rec.projects?.name || '—'}</TableCell>
                    <TableCell className="py-2 text-center">
                      <Badge className={cn('text-[8px] font-black px-1.5 py-0.5 border-none',
                        rec.days_worked === 1 ? 'bg-emerald-500/10 text-emerald-500' :
                        rec.days_worked === 0.5 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500')}>
                        {rec.days_worked === 1 ? 'FULL' : rec.days_worked === 0.5 ? 'HALF' : 'ABS'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs font-bold" style={{ color: rec.advance_amount > 0 ? '#ef4444' : DIM }}>
                      {rec.advance_amount > 0 ? `₹${rec.advance_amount}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {attendance.length > 10 && (
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#1e2435' }}>
              <button disabled={attPage === 0} onClick={() => setAttPage(p => p - 1)} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
              <span className="text-xs" style={{ color: DIM }}>Page {attPage + 1} / {Math.ceil(attendance.length / 10)}</span>
              <button disabled={(attPage + 1) * 10 >= attendance.length} onClick={() => setAttPage(p => p + 1)} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
            </div>
          )}
        </div>

        {/* Payments History */}
        <div className="rounded-2xl overflow-hidden" style={PANEL}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1e2435' }}>
            <p className="text-sm font-black text-white uppercase tracking-wide">Payment History</p>
            <span className="text-xs font-bold" style={{ color: DIM }}>{payments.length} payments</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader style={{ backgroundColor: '#0d1018' }}>
                <TableRow style={{ borderColor: '#1e2435' }}>
                  <TableHead className="py-3 px-4 text-[10px] font-black uppercase" style={{ color: DIM }}>Date</TableHead>
                  <TableHead className="py-3 text-[10px] font-black uppercase" style={{ color: DIM }}>Type</TableHead>
                  <TableHead className="py-3 text-[10px] font-black uppercase text-right pr-4" style={{ color: DIM }}>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12 text-center text-xs font-bold" style={{ color: DIM }}>No payments recorded</TableCell>
                  </TableRow>
                ) : payments.slice(payPage * 10, payPage * 10 + 10).map(pay => (
                  <TableRow key={pay.id} style={{ borderColor: '#1e2435' }}>
                    <TableCell className="px-4 py-2 text-xs font-bold" style={{ color: DIM }}>{format(new Date(pay.date), 'dd MMM yy')}</TableCell>
                    <TableCell className="py-2 text-xs font-bold text-white">{pay.payment_type || 'Cash'}</TableCell>
                    <TableCell className="py-2 text-right pr-4 font-black text-sm" style={{ color: GOLD }}>₹{Number(pay.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {payments.length > 10 && (
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#1e2435' }}>
              <button disabled={payPage === 0} onClick={() => setPayPage(p => p - 1)} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
              <span className="text-xs" style={{ color: DIM }}>Page {payPage + 1} / {Math.ceil(payments.length / 10)}</span>
              <button disabled={(payPage + 1) * 10 >= payments.length} onClick={() => setPayPage(p => p + 1)} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
