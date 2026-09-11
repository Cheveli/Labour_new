'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek as import_startOfWeek, endOfWeek as import_endOfWeek } from 'date-fns'
import { FileText, Download, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS, COMPANY_DETAILS, numberToWords } from '@/lib/report-utils'
import { toast } from 'sonner'

const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const GOLD = '#3b82f6'
const DIM = '#6b7280'
const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

type ReportType = 'labour' | 'materials' | 'revenue' | 'subcontracts' | 'attendance_cost'

export default function ReportsPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<any[]>([])
  const [reportType, setReportType] = useState<ReportType>('materials')
  const [projectId, setProjectId] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    setData([])
  }, [reportType, projectId, startDate, endDate])

  useEffect(() => {
    const onGenerate = () => fetchReport()
    const onPDF = () => exportPDF()
    const onExcel = () => exportExcel()

    window.addEventListener('ssc_reports_generate', onGenerate)
    window.addEventListener('ssc_reports_pdf', onPDF)
    window.addEventListener('ssc_reports_excel', onExcel)

    return () => {
      window.removeEventListener('ssc_reports_generate', onGenerate)
      window.removeEventListener('ssc_reports_pdf', onPDF)
      window.removeEventListener('ssc_reports_excel', onExcel)
    }
  }, [data, reportType, projectId, startDate, endDate])

  useEffect(() => { 
    supabase.from('projects').select('*').order('name').then(({ data }) => setProjects(data || [])) 
  }, [])

  // Auto-set dates
  useEffect(() => {
    if (reportType === 'labour' || reportType === 'attendance_cost') {
      const now = new Date()
      setStartDate(format(import_startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
      setEndDate(format(import_endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    } else {
      if (projectId && projects.length > 0) {
        const p = projects.find(x => x.id === projectId)
        if (p && p.created_at) {
          setStartDate(format(new Date(p.created_at), 'yyyy-MM-dd'))
        } else {
          setStartDate('2020-01-01')
        }
      } else {
        setStartDate('2020-01-01')
      }
      setEndDate(format(new Date(), 'yyyy-MM-dd'))
    }
  }, [reportType, projectId, projects])

  const setThisWeek = () => {
    const now = new Date()
    setStartDate(format(import_startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    setEndDate(format(import_endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  }

  const setPrevWeek = () => {
    const prev = new Date()
    prev.setDate(prev.getDate() - 7)
    setStartDate(format(import_startOfWeek(prev, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
    setEndDate(format(import_endOfWeek(prev, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
  }

  const fetchReport = async () => {
    setLoading(true)
    setPage(0)
    let q: any
    if (reportType === 'materials') {
      q = supabase.from('materials').select('date, name, quantity, unit, total_amount, notes, payment_system_v2, payment_status, projects(name)').order('date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
    } else if (reportType === 'revenue') {
      q = supabase.from('income').select('date, amount, notes, projects(name)').order('date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
    } else if (reportType === 'subcontracts') {
      const { data: subDataRaw, error: subError } = await supabase.from('contractor_payments').select('*')
      if (subError) throw subError
      
      const subWorkEntries: any[] = []
      subDataRaw?.forEach((sub: any) => {
        let parsedNotes = { description: '', project_id: '', project_name: '' }
        try {
          if (sub.notes && (sub.notes.startsWith('{') || sub.notes.startsWith('['))) {
            parsedNotes = JSON.parse(sub.notes)
          } else {
            parsedNotes = {
              description: sub.notes || '',
              project_id: '',
              project_name: ''
            }
          }
        } catch (e) {
          parsedNotes = {
            description: sub.notes || '',
            project_id: '',
            project_name: ''
          }
        }

        let installments = sub.installments || []
        const sumInstallments = installments.reduce((sum: number, inst: any) => sum + Number(inst.amount || 0), 0)
        
        // Inject legacy balance payment if total_amount is greater than recorded installments
        if (sub.total_amount > sumInstallments) {
          const diff = sub.total_amount - sumInstallments
          installments = [
            {
              amount: diff,
              date: sub.date || format(new Date(sub.created_at), 'yyyy-MM-dd'),
              receipt_number: 1,
              site_project: parsedNotes.project_name || 'Legacy Project',
              notes: 'Legacy Balance / Migrated Payout'
            },
            ...installments.map((inst: any, idx: number) => ({ ...inst, receipt_number: idx + 2 }))
          ]
        }

        installments.forEach((inst: any) => {
          const matchedProj = projects.find(p => p.name === inst.site_project)
          const projId = matchedProj ? matchedProj.id : parsedNotes.project_id
          const projName = matchedProj ? matchedProj.name : (inst.site_project || parsedNotes.project_name || '—')

          subWorkEntries.push({
            id: `${sub.id}-${inst.receipt_number}`,
            date: inst.date || format(new Date(sub.created_at), 'yyyy-MM-dd'),
            work_name: `${sub.name} - Payment #${inst.receipt_number}`,
            amount: inst.amount,
            notes: inst.notes || '',
            project_id: projId,
            projects: {
              name: projName
            }
          })
        })
      })

      let filtered = subWorkEntries
      if (projectId) {
        filtered = subWorkEntries.filter(e => e.project_id === projectId)
      }
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setData(filtered)
      setLoading(false)
      return
    }
    const { data: rows } = await q
    
    // Transform attendance_cost to standard format
    if (reportType === 'attendance_cost' && rows) {
      setData(rows.map((r: any) => {
        const rate = r.custom_rate || r.labour?.daily_rate || 0
        const gross = (Number(r.days_worked || 0) * rate) + Number(r.overtime_amount || 0)
        return {
          ...r,
          amount: gross,
          description: `${r.labour?.name || '—'} · ${r.projects?.name || '—'} (${r.days_worked} days)`
        }
      }))
      setLoading(false)
      return
    }

    let finalRows = rows || []
    if (reportType === 'materials') {
      finalRows = finalRows.filter((r: any) => !(r.payment_system_v2 && r.payment_status !== 'paid'))
    }
    setData(finalRows)
    setLoading(false)
  }

  const parseMaterialInfo = (r: any) => {
    const notesStr = r.notes || ''
    const totalAmount = Number(r.total_amount || 0)
    
    if (notesStr && typeof notesStr === 'string' && notesStr.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(notesStr)
        if (parsed.is_erp_v3 || parsed.purchase_id || parsed.supplier) {
          const trans = Number(parsed.transportation_cost || 0)
          const loading = Number(parsed.loading_cost || 0)
          const disc = Number(parsed.discount || 0)
          const finalAmt = Number(parsed.final_paid_amount || parsed.calculated_total || totalAmount)
          const base = Math.max(0, finalAmt - trans - loading + disc)
          
          let rem = parsed.remarks
          if (rem === null || rem === 'null' || rem === undefined || rem === '-') rem = ''
          
          let supp = parsed.supplier
          if (supp === '-' || supp === 'null' || !supp) supp = '—'

          let br = parsed.brand
          if (br === '-' || br === 'null' || !br) br = ''
          
          return {
            supplier: supp,
            supplierPhone: parsed.supplier_phone || '',
            brand: br,
            transportationCost: trans,
            loadingCost: loading,
            discount: disc,
            baseCost: base,
            totalAmount: finalAmt > 0 ? finalAmt : totalAmount,
            remarks: rem ? String(rem).trim() : '',
            receiptUrl: parsed.receipt_url || null
          }
        }
      } catch (e) {}
    }

    // Legacy regex parsing
    const sMatch = notesStr.match(/Supplier:\s(.*?)(?:\s\(|\s\||$)/)
    const sPhoneMatch = notesStr.match(/\((\d{10,})\)/)
    const mMatch = notesStr.match(/Material Amount:\sRs\.([\d,.]+)/)
    const tMatch = notesStr.match(/Transportation:\sRs\.([\d,.]+)/)
    const hMatch = notesStr.match(/Hamali:\sRs\.([\d,.]+)/)
    const dMatch = notesStr.match(/Discount:\sRs\.([\d,.]+)/)
    const receiptMatch = notesStr.match(/Receipt:\s(.*?)(?:\s\||$)/)

    const rawSupp = sMatch ? sMatch[1].trim() : '—'
    const supplier = rawSupp !== '-' && rawSupp !== '' ? rawSupp : '—'
    const supplierPhone = sPhoneMatch ? sPhoneMatch[1].trim() : ''
    const trans = tMatch ? parseFloat(tMatch[1].replace(/,/g, '')) || 0 : 0
    const loading = hMatch ? parseFloat(hMatch[1].replace(/,/g, '')) || 0 : 0
    const discount = dMatch ? parseFloat(dMatch[1].replace(/,/g, '')) || 0 : 0
    const baseCost = mMatch ? parseFloat(mMatch[1].replace(/,/g, '')) || (totalAmount - trans - loading + discount) : (totalAmount - trans - loading + discount)

    const cleanRemarks = notesStr
      .replace(/Supplier:\s(.*?)(?:\s\(|\s\||$)/, '')
      .replace(/\(\d+\)/, '')
      .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
      .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
      .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
      .replace(/Discount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
      .replace(/Receipt:\s(.*?)(?:\s\||$)/, '')
      .replace(/^[\s\|]+|[\s\|]+$/g, '')
      .trim()

    return {
      supplier,
      supplierPhone,
      brand: '',
      transportationCost: trans,
      loadingCost: loading,
      discount,
      baseCost: Math.max(0, baseCost),
      totalAmount,
      remarks: cleanRemarks,
      receiptUrl: receiptMatch ? receiptMatch[1].trim() : null
    }
  }

  const getTotal = () => data.reduce((s, r) => s + (r.amount || r.total_amount || 0), 0)

  const getLabel = (r: any) => {
    if (reportType === 'labour') return `${r.labour?.name || '—'} (${r.payment_type || 'Cash'})`
    if (reportType === 'attendance_cost') return r.description
    if (reportType === 'materials') return `${r.name} · ${r.projects?.name || '—'}`
    if (reportType === 'revenue') return r.projects?.name || '—'
    return `${r.work_name} · ${r.projects?.name || '—'}`
  }

  const exportPDF = async () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()

    const titles: Record<ReportType, string> = {
      labour: 'LABOUR PAYMENTS',
      materials: 'MATERIALS REPORT',
      revenue: 'REVENUE REPORT',
      subcontracts: 'SUBCONTRACTS & MILESTONES REPORT',
      attendance_cost: 'ATTENDANCE COST REPORT'
    }
    const currentProjectObj = projects.find(p => p.id === projectId)
    const projName = currentProjectObj ? currentProjectObj.name : 'All Projects'
    const periodStr = (reportType === 'labour' || reportType === 'attendance_cost')
      ? `${format(new Date(startDate), 'dd MMM yyyy')} — ${format(new Date(endDate), 'dd MMM yyyy')}`
      : 'ALL TIME REGISTER'

    drawPremiumHeader(doc, titles[reportType], periodStr)

    // ── MATERIALS REPORT SPECIFIC ULTRA-PROFESSIONAL TEMPLATE ──
    if (reportType === 'materials') {
      const grandTotal = getTotal()
      const totalCount = data.length

      // Top Tabular Project & Metadata Form (matching Labour Slip styling)
      autoTable(doc, {
        startY: 50,
        head: [],
        body: [
          ['Project Name', projName, 'Report Type', 'Materials Register'],
          ['Period Scope', periodStr, 'Generated On', format(new Date(), 'dd/MM/yyyy hh:mm a')]
        ],
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: PDF_COLORS.NAVY,
          lineColor: [210, 215, 225],
          lineWidth: 0.15
        },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [243, 246, 253], cellWidth: 32 },
          1: { cellWidth: 61, fontStyle: 'bold' },
          2: { fontStyle: 'bold', fillColor: [243, 246, 253], cellWidth: 32 },
          3: { cellWidth: 61 }
        },
        margin: { left: 12, right: 12 }
      })

      const detailsEndY = (doc as any).lastAutoTable.finalY

      // Prepare Rows (No Project Column - extra space given to Material, Cost & Supplier)
      const parsedItems = data.map((r, i) => {
        const p = parseMaterialInfo(r)
        const qtyText = r.quantity > 0 ? ` (${r.quantity} ${r.unit || ''})` : ''
        const brandText = p.brand ? `\nBrand: ${p.brand}` : ''
        const matDisplay = `${r.name || '—'}${qtyText}${brandText}`
        const suppDisplay = p.supplier !== '—' 
          ? (p.supplierPhone ? `${p.supplier}\nPh: ${p.supplierPhone}` : p.supplier)
          : '—'

        const costParts: string[] = []
        if (p.baseCost > 0 && (p.loadingCost > 0 || p.transportationCost > 0 || p.discount > 0)) {
          costParts.push(`Base: Rs.${p.baseCost.toLocaleString('en-IN')}`)
        }
        if (p.loadingCost > 0) costParts.push(`Loading: Rs.${p.loadingCost.toLocaleString('en-IN')}`)
        if (p.transportationCost > 0) costParts.push(`Trans: Rs.${p.transportationCost.toLocaleString('en-IN')}`)
        if (p.discount > 0) costParts.push(`Discount: -Rs.${p.discount.toLocaleString('en-IN')}`)

        const costDisplay = costParts.length > 0 ? costParts.join('\n') : (p.baseCost > 0 ? `Base: Rs.${p.baseCost.toLocaleString('en-IN')}` : '—')

        return {
          index: i + 1,
          date: format(new Date(r.date), 'dd/MM/yyyy'),
          material: matDisplay,
          supplier: suppDisplay,
          cost: costDisplay,
          hasDiscount: p.discount > 0,
          remarks: p.remarks || '—',
          amountNum: p.totalAmount,
          total: `Rs. ${p.totalAmount.toLocaleString('en-IN')}`
        }
      })

      const head = [['S.No', 'Date', 'Material & Brand / Qty', 'Supplier', 'Cost Breakdown', 'Remarks', 'Total (Rs.)']]
      const body = parsedItems.map(p => [
        p.index,
        p.date,
        p.material,
        p.supplier,
        p.cost,
        p.remarks,
        p.total
      ])

      const pageSubtotals: Record<number, number> = {}

      autoTable(doc, {
        startY: detailsEndY + 5,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: {
          fillColor: PDF_COLORS.BLUE,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
          valign: 'middle'
        },
        bodyStyles: {
          textColor: PDF_COLORS.NAVY,
          fontSize: 7.5,
          cellPadding: 2.2,
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 255]
        },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' }, // S.No
          1: { cellWidth: 19 },                                      // Date
          2: { cellWidth: 44, fontStyle: 'bold' },                   // Material & Brand
          3: { cellWidth: 26 },                                      // Supplier
          4: { cellWidth: 38 },                                      // Cost breakdown
          5: { cellWidth: 24 },                                      // Remarks
          6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }   // Total (wide enough to guarantee single line)
        },
        margin: { left: 12, right: 12, top: 48, bottom: 24 },
        didParseCell: (cellData) => {
          if (cellData.section === 'body') {
            // Total Column Color
            if (cellData.column.index === 6) {
              cellData.cell.styles.textColor = [22, 163, 74] // Emerald Green
              cellData.cell.styles.fontStyle = 'bold'
            }
          }
        },
        didDrawCell: (cellData) => {
          if (cellData.section === 'body' && cellData.column.index === 0) {
            const rowIndex = cellData.row.index
            const pageNum = cellData.pageNumber
            const rowItem = parsedItems[rowIndex]
            if (rowItem) {
              pageSubtotals[pageNum] = (pageSubtotals[pageNum] || 0) + rowItem.amountNum
            }
          }
        },
        didDrawPage: (pageData) => {
          // Continuation Header
          if (pageData.pageNumber > 1) {
            drawPremiumHeader(doc, 'MATERIALS REPORT (CONT.)', periodStr)
          }

          // Draw Page Subtotal Bar right above footer on every page
          const subtotal = pageSubtotals[pageData.pageNumber] || 0
          doc.setFillColor(241, 245, 254)
          doc.setDrawColor(200, 215, 240)
          doc.roundedRect(12, H - 22, W - 24, 6.5, 1, 1, 'FD')
          
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(...PDF_COLORS.NAVY)
          doc.text(`PAGE ${pageData.pageNumber} SUB-TOTAL:`, 16, H - 17.8)
          
          doc.setTextColor(...PDF_COLORS.BLUE)
          doc.text(`Rs. ${subtotal.toLocaleString('en-IN')}`, W - 16, H - 17.8, { align: 'right' })

          // Footer
          drawPremiumFooter(doc)
        }
      })

      // Calculate final summary aggregates
      const totalTrans = parsedItems.reduce((sum, _, i) => sum + parseMaterialInfo(data[i]).transportationCost, 0)
      const totalLoading = parsedItems.reduce((sum, _, i) => sum + parseMaterialInfo(data[i]).loadingCost, 0)
      const totalBase = parsedItems.reduce((sum, _, i) => sum + parseMaterialInfo(data[i]).baseCost, 0)
      const totalDiscount = parsedItems.reduce((sum, _, i) => sum + parseMaterialInfo(data[i]).discount, 0)

      let finalY = (doc as any).lastAutoTable.finalY + 6
      const summaryBlockH = totalDiscount > 0 ? 34 : 28

      // Check if we need a new page for Summary Table
      if (finalY + summaryBlockH > H - 24) {
        doc.addPage()
        drawPremiumHeader(doc, 'MATERIALS REPORT (SUMMARY)', periodStr)
        drawPremiumFooter(doc)
        finalY = 52
      }

      // ── Tabular Summary Table (matching Labour slip format, no signatures) ──
      const summaryRows: any[][] = [
        ['Total Base Material Cost', `Rs. ${totalBase.toLocaleString('en-IN')}`, 'Total Items Logged', `${totalCount} Records`],
        ['Total Transportation Cost', `Rs. ${totalTrans.toLocaleString('en-IN')}`, 'Total Loading / Hamali', `Rs. ${totalLoading.toLocaleString('en-IN')}`]
      ]
      if (totalDiscount > 0) {
        summaryRows.push(['Total Discounts Applied', `-Rs. ${totalDiscount.toLocaleString('en-IN')}`, 'Project Filter', projName])
      }
      summaryRows.push(['GRAND TOTAL EXPENDITURE', `Rs. ${grandTotal.toLocaleString('en-IN')}`, 'Amount in Words', numberToWords(grandTotal)])

      autoTable(doc, {
        startY: finalY,
        head: [],
        body: summaryRows,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.6,
          textColor: PDF_COLORS.NAVY,
          lineColor: [210, 215, 225],
          lineWidth: 0.15
        },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [243, 246, 253], cellWidth: 46 },
          1: { cellWidth: 47, fontStyle: 'bold' },
          2: { fontStyle: 'bold', fillColor: [243, 246, 253], cellWidth: 46 },
          3: { cellWidth: 47 }
        },
        margin: { left: 12, right: 12 },
        didParseCell: (cellData) => {
          // Highlight Grand Total row
          if (cellData.row.index === summaryRows.length - 1) {
            if (cellData.column.index === 0) {
              cellData.cell.styles.fillColor = PDF_COLORS.BLUE
              cellData.cell.styles.textColor = [255, 255, 255]
              cellData.cell.styles.fontStyle = 'bold'
            } else if (cellData.column.index === 1) {
              cellData.cell.styles.fillColor = [236, 253, 245]
              cellData.cell.styles.textColor = [22, 163, 74]
              cellData.cell.styles.fontStyle = 'bold'
              cellData.cell.styles.fontSize = 9.5
            }
          }
          // Highlight discount in red
          if (totalDiscount > 0 && cellData.row.index === 2 && cellData.column.index === 1) {
            cellData.cell.styles.textColor = [220, 38, 38]
          }
        }
      })

      const fileNameSuffix = projectId ? `${projName.toLowerCase().replace(/\s+/g, '_')}` : 'all_projects'
      doc.save(`materials_report_${fileNameSuffix}_${format(new Date(), 'yyyyMMdd')}.pdf`)
      toast.success('Materials Report PDF Exported!')
      return
    }

    // ── GENERIC PDF HANDLER (FOR LABOUR, REVENUE, SUBCONTRACTS) ──
    let head = [['#', 'Date', 'Description', 'Notes', 'Amount']]
    let body = data.map((r, i) => [
      i + 1,
      format(new Date(r.date), 'dd/MM/yyyy'),
      getLabel(r),
      r.notes || '—',
      `Rs. ${Number(r.amount || r.total_amount || 0).toLocaleString('en-IN')}`
    ])
    let foot = [['', '', '', 'TOTAL', `Rs.${getTotal().toLocaleString('en-IN')}`]]

    autoTable(doc, {
      startY: 54,
      head: head,
      body: body,
      foot: foot,
      theme: 'grid',
      headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
      footStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
      styles: { cellPadding: 2.5 },
      didDrawPage: (pageData) => {
        if (pageData.pageNumber > 1) {
          drawPremiumHeader(doc, `${titles[reportType]} (CONT.)`, periodStr)
        }
        drawPremiumFooter(doc)
      },
      margin: { top: 50, left: 14, right: 14, bottom: 20 }
    })

    const fileNameSuffix = reportType === 'labour' ? `${startDate}-to-${endDate}` : 'all-time'
    doc.save(`${reportType}-report-${fileNameSuffix}.pdf`)
    toast.success('PDF exported')
  }

  const exportExcel = () => {
    const periodStr = 'All Time'
    const rows: any[][] = [[`${COMPANY_DETAILS.name} - Report`], [`Type: ${reportType} | ${periodStr}`], [], ['#', 'Date', 'Description', 'Notes', 'Amount']]
    data.forEach((r, i) => rows.push([i + 1, format(new Date(r.date), 'dd/MM/yyyy'), getLabel(r), r.notes || '—', Number(r.amount || r.total_amount || 0)]))
    rows.push(['', '', '', 'TOTAL', getTotal()])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    const fileNameSuffix = reportType === 'labour' ? startDate : 'all-time'
    XLSX.writeFile(wb, `${reportType}-report-${fileNameSuffix}.xlsx`)
    toast.success('Excel exported')
  }

  const reportTypes: { value: ReportType, label: string }[] = [
    { value: 'materials', label: 'Materials' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'subcontracts', label: 'Subcontracts' },
    { value: 'labour', label: 'Labour Payments' },
    { value: 'attendance_cost', label: 'Attendance Cost' }
  ]

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Reports & Material Logs</h1>
        <p className="text-sm mt-1" style={{ color: DIM }}>Filter by project, dates, and export executive-ready PDF registers with page subtotals.</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-5 space-y-4" style={PANEL}>
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Filter Options</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`col-span-2 md:col-span-1 space-y-1.5`}>
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)}
              className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST}>
              {reportTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className={`col-span-2 md:col-span-3 space-y-1.5`}>
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project (optional)</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm font-semibold outline-none" style={INPUT_ST}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={fetchReport} disabled={loading}
            className="h-10 px-6 rounded-xl text-sm font-black uppercase flex items-center gap-2 disabled:opacity-50 transition-all hover:brightness-110"
            style={{ backgroundColor: GOLD, color: '#0a0c12' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />} Generate Report
          </button>
          {data.length > 0 && (
            <>
              <button onClick={exportPDF} className="h-10 px-5 rounded-xl text-sm font-black uppercase flex items-center gap-2 hover:bg-white/[0.05] transition-all" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>
                <FileText size={14} className="text-blue-400" /> Export PDF
              </button>
              <button onClick={exportExcel} className="h-10 px-5 rounded-xl text-sm font-black uppercase flex items-center gap-2 hover:bg-white/[0.05] transition-all" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>
                <Download size={14} className="text-emerald-400" /> Excel
              </button>
              <span className="text-xs font-bold ml-auto" style={{ color: DIM }}>
                {data.length} records · Total: <span className="text-emerald-400 font-black">₹{getTotal().toLocaleString('en-IN')}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Results Table */}
      {data.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-[#1e2435]" style={PANEL}>
          {/* Header Bar */}
          <div className="p-4 border-b border-[#1e2435] flex flex-wrap items-center justify-between gap-3 bg-[#0d1018]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <p className="text-xs font-black uppercase tracking-wider text-white">
                {reportTypes.find(t => t.value === reportType)?.label} Register
              </p>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-gray-400 font-bold border border-white/10">
                {data.length} items
              </span>
            </div>
            <div className="text-xs font-bold text-gray-400">
              Grand Total: <span className="text-emerald-400 font-black text-sm ml-1">₹{getTotal().toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#090b10] border-b border-[#1e2435]">
                <tr>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest w-12" style={{ color: DIM }}>#</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: DIM }}>Date</th>
                  {reportType === 'materials' ? (
                    <>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Material & Details</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Supplier</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Cost Breakdown</th>
                    </>
                  ) : (
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Description</th>
                  )}
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Remarks</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: DIM }}>Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2435]">
                {data.slice(page * 15, page * 15 + 15).map((r, i) => {
                  if (reportType === 'materials') {
                    const p = parseMaterialInfo(r)

                    return (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-xs font-bold text-center" style={{ color: DIM }}>{page * 15 + i + 1}</td>
                        <td className="px-4 py-3 text-xs font-bold whitespace-nowrap text-gray-300">
                          {format(new Date(r.date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-black text-white text-xs tracking-tight uppercase">
                              {r.name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {r.quantity > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10 uppercase">
                                  {r.quantity} {r.unit || ''}
                                </span>
                              )}
                              {p.brand && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                                  Brand: {p.brand}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-300 capitalize">
                          {r.projects?.name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-gray-200">
                              {p.supplier}
                            </span>
                            {p.supplierPhone && (
                              <span className="text-[10px] text-zinc-400 font-mono">
                                Ph: {p.supplierPhone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[10px] font-semibold flex flex-col gap-0.5">
                            {p.baseCost > 0 && (p.loadingCost > 0 || p.transportationCost > 0 || p.discount > 0) && (
                              <span className="text-gray-300">Base: <b className="text-white">₹{p.baseCost.toLocaleString('en-IN')}</b></span>
                            )}
                            {p.loadingCost > 0 && (
                              <span className="text-amber-400/90 font-medium">Loading: ₹{p.loadingCost.toLocaleString('en-IN')}</span>
                            )}
                            {p.transportationCost > 0 && (
                              <span className="text-sky-400/90 font-medium">Transport: ₹{p.transportationCost.toLocaleString('en-IN')}</span>
                            )}
                            {p.discount > 0 && (
                              <span className="text-red-400 font-bold bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20 w-fit">
                                Discount: -₹{p.discount.toLocaleString('en-IN')}
                              </span>
                            )}
                            {!p.loadingCost && !p.transportationCost && !p.discount && (
                              <span className="text-gray-400">Base: ₹{p.baseCost.toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: DIM }}>
                          <div className="flex flex-col gap-1 max-w-[200px]">
                            {p.remarks ? (
                              <span className="text-gray-300 text-xs break-words">{p.remarks}</span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                            {p.receiptUrl && (
                              <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wide inline-flex items-center gap-1">
                                📎 [Receipt Attached]
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-black text-sm whitespace-nowrap text-emerald-400">
                          ₹{Number(p.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )
                  }

                  // Generic row for other reports
                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-center" style={{ color: DIM }}>{page * 15 + i + 1}</td>
                      <td className="px-4 py-3 text-xs font-bold whitespace-nowrap text-gray-300">{format(new Date(r.date), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3 text-xs font-bold text-white max-w-[220px] truncate">{getLabel(r)}</td>
                      <td className="px-4 py-3 text-xs max-w-[250px] truncate" style={{ color: DIM }}>{r.notes || '—'}</td>
                      <td className="px-5 py-3 text-right font-black text-sm whitespace-nowrap text-emerald-400">₹{Number(r.amount || r.total_amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[#090b10] border-t-2 border-[#1e2435]">
                <tr>
                  <td colSpan={reportType === 'materials' ? 7 : 4} className="px-5 py-3.5 text-xs font-black uppercase tracking-widest text-right" style={{ color: DIM }}>
                    Grand Total
                  </td>
                  <td className="px-5 py-3.5 text-right font-black text-base text-emerald-400 whitespace-nowrap">
                    ₹{getTotal().toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {data.length > 15 && (
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#1e2435] bg-[#0d1018]">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3.5 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
              <span className="text-xs font-bold" style={{ color: DIM }}>Page {page + 1} of {Math.ceil(data.length / 15)}</span>
              <button disabled={(page + 1) * 15 >= data.length} onClick={() => setPage(p => p + 1)} className="px-3.5 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
            </div>
          )}
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="text-center py-20 rounded-2xl border border-[#1e2435]" style={PANEL}>
          <FileText size={44} style={{ color: DIM, opacity: 0.3, margin: '0 auto 12px' }} />
          <p className="text-sm font-bold text-gray-300">Set filters above and click Generate Report</p>
          <p className="text-xs mt-1 text-gray-500">View materials log, labour payments, and revenue summaries in one place.</p>
        </div>
      )}
    </div>
  )
}
