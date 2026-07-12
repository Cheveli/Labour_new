'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Loader2, Wallet, Download, Info } from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS, COMPANY_DETAILS } from '@/lib/report-utils'

export default function ClientPaymentsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/client/project-data')
        if (!res.ok) throw new Error('Failed to load project details.')
        const resData = await res.json()
        setData(resData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  if (!data?.project) return (
    <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl mt-12 space-y-4 max-w-md mx-auto text-white">
      <Info className="mx-auto text-zinc-500" size={32} />
      <h2 className="text-lg font-bold">No Project Associated</h2>
      <p className="text-xs text-zinc-400">Please contact the administrator or your contractor to link this client profile to your active site project.</p>
    </div>
  )

  const { project, payments, companyDetails } = data
  const totalPaid = payments.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)

  const downloadPaymentsPDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    })

    // Draw premium styled PDF report header
    drawPremiumHeader(doc, 'CLIENT PAYMENT RECEIPTS HISTORY', project.name)

    // Add Project metadata text on PDF
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59)
    doc.text('PROJECT DETAILS:', 14, 45)

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Project Name: ${project.name}`, 14, 50)
    doc.text(`Owner / Client: ${project.owner_name}`, 14, 55)
    doc.text(`Address: ${project.address || 'Uppal, Hyderabad'}`, 14, 60)

    doc.setFont('Helvetica', 'bold')
    doc.text('BUILDER DETAILS:', 110, 45)
    doc.setFont('Helvetica', 'normal')
    doc.text(`Company Name: ${companyDetails.name}`, 110, 50)
    doc.text(`Contractor Name: ${companyDetails.contractor}`, 110, 55)
    doc.text(`Phone Contact: ${companyDetails.phone1}`, 110, 60)

    // Draw Payments receipts table
    autoTable(doc, {
      startY: 70,
      head: [['#', 'Payment Date', 'Paid Amount', 'Payment Method / Remarks']],
      body: payments.map((item: any, idx: number) => [
        idx + 1,
        format(new Date(item.date), 'dd/MM/yyyy'),
        `Rs. ${Number(item.amount).toLocaleString('en-IN')}`,
        item.notes || 'Online Transfer'
      ]),
      foot: [['', 'TOTAL CONTRACT REVENUES RECEIVED', `Rs. ${totalPaid.toLocaleString('en-IN')}`, '']],
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [13, 27, 62], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3.5, font: 'Helvetica' }
    })

    // Draw premium footer at bottom of PDF page
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      drawPremiumFooter(doc, companyDetails)
    }

    doc.save(`SSC_Payment_History_${project.name.replace(/\s+/g, '_')}.pdf`)
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }
  const DIM = '#6b7280'

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Financials,</p>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-1">Payment History</h1>
          <p className="text-xs text-zinc-400 mt-1">Receipt records of payments made to Sri Sai Constructions.</p>
        </div>
        <button
          onClick={downloadPaymentsPDF}
          disabled={payments.length === 0}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase text-white cursor-pointer bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/10 disabled:opacity-40 self-start sm:self-auto"
        >
          <Download size={14} /> Download PDF History
        </button>
      </div>

      {/* Summary Stat Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card style={PANEL} className="border-none shadow-xl p-6">
          <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Total Capital Paid</p>
          <h3 className="text-2xl font-black text-blue-500 mt-2">₹{totalPaid.toLocaleString('en-IN')}</h3>
        </Card>
        <Card style={PANEL} className="border-none shadow-xl p-6">
          <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Installments Logged</p>
          <h3 className="text-2xl font-black text-white mt-2">{payments.length} receipts</h3>
        </Card>
      </div>

      {/* Receipts Table */}
      <div style={PANEL} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e2435] flex items-center gap-3">
          <Wallet className="text-blue-500 shrink-0" size={18} />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Receipts Log — Scoped Capital Only</p>
        </div>
        
        {/* Table View */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader style={{ backgroundColor: '#0d1018' }}>
              <TableRow style={{ borderColor: '#1e2435' }}>
                {['#', 'Payment Date', 'Amount Paid', 'Payment Remarks / Method'].map(h => (
                  <TableHead key={h} className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-16 text-center text-sm font-bold text-zinc-500">No payment receipts found yet.</TableCell>
                </TableRow>
              ) : (
                payments.map((item: any, idx: number) => (
                  <TableRow key={item.id} style={{ borderColor: '#1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-4 py-4 text-xs font-bold text-zinc-400">{idx + 1}</TableCell>
                    <TableCell className="px-4 py-4 text-xs text-white font-semibold">{format(new Date(item.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="px-4 py-4 text-xs font-bold text-emerald-500">₹{item.amount.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="px-4 py-4 text-xs text-zinc-400 font-semibold">{item.notes || 'Online / Cash'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards View */}
        <div className="flex flex-col gap-3 p-4 sm:hidden">
          {payments.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-zinc-500">No payment receipts found yet.</div>
          ) : (
            payments.map((item: any, idx: number) => (
              <div key={item.id} className="rounded-xl p-4 flex flex-col gap-2 border border-[#1e2435]" style={{ backgroundColor: '#0d1018' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-black">RECEIPT #{idx + 1}</p>
                    <p className="text-xs text-white font-bold mt-1">{format(new Date(item.date), 'dd MMM yyyy')}</p>
                  </div>
                  <span className="text-sm font-black text-emerald-500">₹{item.amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-xs text-zinc-400 font-semibold mt-1 border-t border-[#1e2435]/50 pt-2">
                  <span className="text-[9px] uppercase font-black tracking-wider text-zinc-600 block mb-0.5">Payment Details:</span>
                  {item.notes || 'Online / Cash'}
                </div>
              </div>
            ))
          )}
        </div>

      </div>

    </div>
  )
}
