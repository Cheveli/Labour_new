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
import { 
  drawPremiumHeader, 
  drawPremiumFooter,
  PDF_COLORS, 
  numberToWords,
  COMPANY_DETAILS
} from '@/lib/report-utils'

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
    const mAttDays = filteredAtt.reduce((s, r) => s + (r.days_worked || 0), 0)
    const mOT = filteredAtt.reduce((s, r) => s + (r.overtime_amount || 0), 0)
    const mAdv = filteredAtt.reduce((s, r) => s + (r.advance_amount || 0), 0)
    const mPaid = filteredPay.reduce((s, r) => s + (r.amount || 0), 0)
    const mGross = mAttDays * (worker?.daily_rate || 0) + mOT
    
    const hasOT = mOT > 0
    const tableHeight = (filteredAtt.length + 1) * 8.5
    const summaryBoxH = hasOT ? 42 : 35
    const requiredHeight = 44 + 16 + tableHeight + 10 + summaryBoxH + 18 + 24 + 10 + 14
    const pageHeight = Math.max(160, requiredHeight)

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [210, pageHeight]
    })
    
    drawPremiumHeader(doc, 'SALARY STATEMENT', '(INDIVIDUAL)')

    let y = 54
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text('Worker Name', 14, y); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.name}`, 40, y)
    doc.setFont('helvetica', 'bold'); doc.text('Role', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.type || 'N/A'}`, 40, y + 6)
    
    doc.setFont('helvetica', 'bold'); doc.text('Filter Month', 110, y)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${monthFilter}`, 140, y)
    doc.setFont('helvetica', 'bold'); doc.text('Report Date', 110, y + 6)
    doc.setFont('helvetica', 'normal'); doc.text(`: ${format(new Date(), 'dd MMM yyyy')}`, 140, y + 6)

    const head = hasOT 
      ? [['Date', 'Project', 'Status', 'Wages on the day', 'OT Amount', 'Deduction', 'Giveable Amount', 'Grand Total']]
      : [['Date', 'Project', 'Status', 'Wages on the day', 'Deduction', 'Giveable Amount', 'Grand Total']]

    const body = filteredAtt.map((r: any) => {
      const rate = r.custom_rate || worker.daily_rate || 0
      const daysWorked = Number(r.days_worked || 0)
      const otAmt = Number(r.overtime_amount || 0)
      const advAmt = Number(r.advance_amount || 0)
      const status = daysWorked === 1 ? 'P' : daysWorked === 0.5 ? 'H' : 'A'

      const row = [
        r.date,
        r.projects?.name || '—',
        status,
        `Rs. ${(daysWorked * rate || 0).toLocaleString('en-IN')}`
      ]
      if (hasOT) {
        row.push(otAmt > 0 ? `Rs. ${(otAmt || 0).toLocaleString('en-IN')}` : '-')
      }
      row.push(
        advAmt > 0 ? `Rs. ${(advAmt || 0).toLocaleString('en-IN')}` : '-',
        `Rs. ${((daysWorked * rate) + otAmt - advAmt || 0).toLocaleString('en-IN')}`,
        `Rs. ${((daysWorked * rate) + otAmt || 0).toLocaleString('en-IN')}`
      )
      return row
    })

    autoTable(doc, {
      startY: y + 14,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      didDrawPage: (pageData) => {
        if (pageData.pageNumber > 1) {
          drawPremiumHeader(doc, 'SALARY STATEMENT (CONT.)', '(INDIVIDUAL)')
        }
        drawPremiumFooter(doc)
      },
      margin: { top: 50, left: 14, right: 14, bottom: 20 },
      didParseCell: (cellData) => {
        const deductionColIdx = hasOT ? 5 : 4
        const giveableColIdx = hasOT ? 6 : 5
        const grandTotalColIdx = hasOT ? 7 : 6
        if (cellData.section === 'body') {
          if (cellData.column.index === 2) { // Status column
            const val = cellData.cell.text[0]
            if (val === 'P') cellData.cell.styles.textColor = [34, 197, 94]
            else if (val === 'A') cellData.cell.styles.textColor = [239, 68, 68]
            else if (val === 'H') cellData.cell.styles.textColor = [245, 158, 11]
            cellData.cell.styles.fontStyle = 'bold'
          }
          if (cellData.column.index === deductionColIdx) {
            const val = cellData.cell.text[0]
            if (val && val !== '-') {
              cellData.cell.styles.textColor = PDF_COLORS.RED
              cellData.cell.styles.fontStyle = 'bold'
            }
          }
          if (cellData.column.index === giveableColIdx) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.textColor = PDF_COLORS.GREEN
          }
          if (cellData.column.index === grandTotalColIdx) {
            cellData.cell.styles.fontStyle = 'bold'
            cellData.cell.styles.textColor = PDF_COLORS.BLUE
          }
        }
      }
    })

    let finalY = (doc as any).lastAutoTable.finalY + 10
    const H = doc.internal.pageSize.getHeight()

    // Add new page if summary box & signatures don't fit
    if (finalY + summaryBoxH > H - 25) {
      doc.addPage()
      drawPremiumHeader(doc, 'SALARY STATEMENT (CONT.)', '(STATEMENT)')
      drawPremiumFooter(doc)
      finalY = 50
    }
    
    // Summary Box
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(110, finalY, 86, summaryBoxH, 2, 2, 'F')
    
    const summaryGross = mGross
    let boxY = finalY + 7
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_COLORS.BLUE)
    doc.text('GRAND TOTAL:', 115, boxY); doc.setFontSize(12); doc.text(`Rs. ${summaryGross.toLocaleString('en-IN')}`, 185, boxY, { align: 'right' })
    
    boxY += 8
    if (hasOT) {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_COLORS.NAVY)
      doc.text('Total Overtime:', 115, boxY); doc.text(`Rs. ${mOT.toLocaleString('en-IN')}`, 185, boxY, { align: 'right' })
      boxY += 7
    }
    
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_COLORS.NAVY)
    doc.text('Total Deduction:', 115, boxY); doc.setTextColor(220, 53, 69); doc.text(`Rs. ${mAdv.toLocaleString('en-IN')}`, 185, boxY, { align: 'right' })
    
    boxY += 4
    doc.setDrawColor(200, 200, 200); doc.line(115, boxY, 185, boxY)
    
    boxY += 6
    doc.setTextColor(...PDF_COLORS.GREEN); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text('NET PAYMENT:', 115, boxY); doc.text(`Rs. ${(mGross - mAdv).toLocaleString('en-IN')}`, 185, boxY, { align: 'right' })

    doc.setTextColor(...PDF_COLORS.NAVY); doc.setFontSize(8); doc.setFont('helvetica', 'italic')
    doc.text(`Amount in words: ${numberToWords(Math.abs(mGross - mAdv))}`, 14, finalY + 48)

    // Signatory Area
    const sigY = H - 48
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PDF_COLORS.NAVY)
    doc.setFontSize(8)
    doc.text('FOR ' + COMPANY_DETAILS.name, 160, sigY + 5, { align: 'center' })

    doc.setFont('times', 'italic')
    doc.setFontSize(12)
    doc.text(COMPANY_DETAILS.contractorRaw, 160, sigY + 16, { align: 'center' })
    doc.line(140, sigY + 18, 180, sigY + 18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7); doc.text('Authorized Signatory', 160, sigY + 22, { align: 'center' })

    drawPremiumFooter(doc)
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
      `💰 Gross Earned: ₹${Math.round(mGross).toLocaleString('en-IN')}`,
      `📉 Advance: ₹${mAdv.toLocaleString('en-IN')}`,
      `💳 Paid: ₹${mPaid.toLocaleString('en-IN')}`,
      `━━━━━━━━━━━━━━━━`,
      `💵 *Net Balance: ₹${Math.round(mGross - mAdv - mPaid).toLocaleString('en-IN')}*`,
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
          { label: 'Gross Earned', value: `₹${grossEarned.toLocaleString('en-IN')}`, icon: <TrendingUp size={16} color={GOLD} />, color: GOLD, bg: '#0d1530' },
          { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, icon: <Wallet size={16} color="#a78bfa" />, color: '#a78bfa', bg: '#1a1430' },
          { label: 'Net Balance', value: `₹${netBalance.toLocaleString('en-IN')}`, icon: <IndianRupee size={16} color={netBalance >= 0 ? '#22c55e' : '#ef4444'} />, color: netBalance >= 0 ? '#22c55e' : '#ef4444', bg: netBalance >= 0 ? '#0d1f14' : '#1f0d0d' },
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
                    <TableCell className="py-2 text-right pr-4 font-black text-sm" style={{ color: GOLD }}>₹{Number(pay.amount).toLocaleString('en-IN')}</TableCell>
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
