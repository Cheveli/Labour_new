import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { startOfWeek, endOfWeek, subDays, format, parseISO, addDays } from 'date-fns'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt'
import {
  drawPremiumHeader,
  drawPremiumFooter,
  PDF_COLORS,
  numberToWords,
  COMPANY_DETAILS
} from './report-utils'

// Instantiate Supabase client with admin/anon credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Subcontractor installment parsing helper (matches dashboard logic)
function getContractorInstallments(contractorPayments: any[]): any[] {
  const allInstallments: any[] = []
  contractorPayments.forEach((sub: any) => {
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
          date: sub.date || (sub.created_at ? format(new Date(sub.created_at), 'yyyy-MM-dd') : '2026-05-01'),
          receipt_number: 1,
          site_project: parsedNotes.project_name || 'Legacy Project',
          notes: 'Legacy Balance / Migrated Payout'
        },
        ...installments.map((inst: any, idx: number) => ({ ...inst, receipt_number: idx + 2 }))
      ]
    }

    installments.forEach((inst: any) => {
      allInstallments.push({
        contractor_name: sub.name,
        work_nature: sub.work_nature,
        amount: Number(inst.amount || 0),
        date: inst.date,
        site_project: inst.site_project || parsedNotes.project_name || '-'
      })
    })
  })
  return allInstallments
}

// Helper to draw checkmark box
function drawCheckmarkBox(doc: jsPDF, x: number, y: number, w: number, h: number, text: string) {
  // Light green filled rectangle
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(187, 247, 208) // light green border
  doc.setLineWidth(0.15)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')

  // Green circle for checkmark
  doc.setFillColor(34, 197, 94) // emerald 500
  doc.circle(x + 5, y + h / 2, 2.5, 'F')

  // White checkmark lines inside the circle
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.4)
  doc.line(x + 4, y + h / 2, x + 4.8, y + h / 2 + 1)
  doc.line(x + 4.8, y + h / 2 + 1, x + 6.2, y + h / 2 - 1)

  // Text description
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(21, 128, 61) // green 700

  // Split text to fit inside the box (width w - 12)
  const lines = doc.splitTextToSize(text, w - 12)
  const textH = lines.length * 3
  const startYText = y + (h - textH) / 2 + 2
  doc.text(lines, x + 9, startYText)
}

export interface ReportConfig {
  recipientEmail: string
  passwordProtect: string
}

export async function generateAndEmailWeeklyReport(config: ReportConfig) {
  const today = new Date()

  // Calculate previous week Sunday to Saturday
  const prevSunday = startOfWeek(subDays(today, 7), { weekStartsOn: 0 })
  const prevSaturday = endOfWeek(subDays(today, 7), { weekStartsOn: 0 })
  const startDateStr = format(prevSunday, 'yyyy-MM-dd')
  const endDateStr = format(prevSaturday, 'yyyy-MM-dd')
  const weekRangeLabel = `${format(prevSunday, 'dd MMM yyyy')} - ${format(prevSaturday, 'dd MMM yyyy')}`

  console.log(`Generating weekly report for: ${weekRangeLabel}`)

  // 1. FETCH DATABASE DATA FOR THE PREVIOUS WEEK & ALL-TIME HISTORICAL DATA
  const [
    projectsRes,
    attendanceRes,
    materialsRes,
    contractorPaymentsRes,
    personalExpensesRes,
    // All-time data for cash position
    allIncomeRes,
    allMaterialsRes,
    allAttendanceRes,
    allPersonalExpensesRes
  ] = await Promise.all([
    supabase.from('projects').select('*').order('name'),
    supabase.from('attendance').select('*, labour(name, type, daily_rate)').gte('date', startDateStr).lte('date', endDateStr),
    supabase.from('materials').select('name, total_amount, date').gte('date', startDateStr).lte('date', endDateStr),
    supabase.from('contractor_payments').select('*'),
    supabase.from('personal_expenses').select('amount, date, person_name, purpose').gte('date', startDateStr).lte('date', endDateStr),
    // All-time data for cash position
    supabase.from('income').select('amount, project_id'),
    supabase.from('materials').select('total_amount, project_id'),
    supabase.from('attendance').select('days_worked, custom_rate, overtime_amount, project_id, labour(daily_rate)'),
    supabase.from('personal_expenses').select('amount')
  ])

  const projects = projectsRes.data || []
  const attendance = attendanceRes.data || []
  const materials = materialsRes.data || []
  const contractorPayments = contractorPaymentsRes.data || []
  const personalExpenses = personalExpensesRes.data || []

  // All-time details for cash balance calculations
  const allIncome = allIncomeRes.data || []
  const allMaterials = allMaterialsRes.data || []
  const allAttendance = allAttendanceRes.data || []
  const allPersonalExpenses = allPersonalExpensesRes.data || []

  // ── GROUPING & CALCULATING WEEKLY FIGURES ───────────────────

  // A. Group weekly attendance by worker (labourer)
  const workerMap = new Map<string, any>()
  attendance.forEach((att: any) => {
    if (!att.labour) return
    const labourId = att.labour_id
    if (!workerMap.has(labourId)) {
      workerMap.set(labourId, {
        id: labourId,
        name: att.labour.name,
        type: att.labour.type,
        rate: att.custom_rate || att.labour.daily_rate || 0,
        days: {},
        totalDays: 0,
        totalOt: 0,
        totalDed: 0,
        giveable: 0,
        grandTotal: 0
      })
    }
    const w = workerMap.get(labourId)
    const dateStr = att.date
    const daysWorked = Number(att.days_worked || 0)
    const ot = Number(att.overtime_amount || 0)
    const ded = Number(att.advance_amount || 0)

    if (!w.days[dateStr]) {
      w.days[dateStr] = { status: daysWorked === 1 ? 'P' : (daysWorked === 0.5 ? 'H' : 'A'), ot, ded }
    } else {
      const existing = w.days[dateStr]
      const nextDaysWorked = daysWorked + (existing.status === 'P' ? 1 : (existing.status === 'H' ? 0.5 : 0))
      existing.status = nextDaysWorked >= 1 ? 'P' : (nextDaysWorked > 0 ? 'H' : 'A')
      existing.ot += ot
      existing.ded += ded
    }

    w.totalDays += daysWorked
    w.totalOt += ot
    w.totalDed += ded
  })

  const workersList = Array.from(workerMap.values()).map(w => {
    w.giveable = (w.totalDays * w.rate) + w.totalOt - w.totalDed
    w.grandTotal = (w.totalDays * w.rate) + w.totalOt
    return w
  })

  // Total weekly labour expense = sum of giveable amounts of all workers
  const totalLabourExpense = workersList.reduce((acc, w) => acc + w.giveable, 0)

  // B. Weekly Material Expenses
  const materialExpensesGrouped: Record<string, number> = {}
  materials.forEach((mat: any) => {
    const name = mat.name || 'Other Materials'
    materialExpensesGrouped[name] = (materialExpensesGrouped[name] || 0) + Number(mat.total_amount || 0)
  })
  const materialExpensesList = Object.entries(materialExpensesGrouped).map(([name, amount]) => ({ name, amount }))
  const totalMaterialExpense = materialExpensesList.reduce((acc, curr) => acc + curr.amount, 0)

  // C. Weekly Contractor Expenses
  const contractorInstallments = getContractorInstallments(contractorPayments)
  const weeklyContractorInstallments = contractorInstallments.filter(inst => inst.date >= startDateStr && inst.date <= endDateStr)

  const contractorExpensesGrouped: Record<string, { name: string; workType: string; amount: number }> = {}
  weeklyContractorInstallments.forEach(inst => {
    const key = `${inst.contractor_name}-${inst.work_nature}`
    if (!contractorExpensesGrouped[key]) {
      contractorExpensesGrouped[key] = {
        name: inst.contractor_name,
        workType: inst.work_nature,
        amount: 0
      }
    }
    contractorExpensesGrouped[key].amount += inst.amount
  })
  const contractorExpensesList = Object.values(contractorExpensesGrouped)
  const totalContractorExpense = contractorExpensesList.reduce((acc, curr) => acc + curr.amount, 0)

  // D. Weekly Other Expenses (Personal Expenses)
  const totalOtherExpense = personalExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  // Weekly Total Expense
  const weeklyTotalExpense = totalLabourExpense + totalMaterialExpense + totalContractorExpense + totalOtherExpense

  // ── CASH POSITION CALCULATIONS (ALL TIME HISTORICAL AS OF TODAY) ──

  // 1. Total Income Till Today
  const totalAllTimeIncome = allIncome.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)

  // 2. Total Expense Till Today
  const totalAllTimeLabourCost = allAttendance.reduce((acc: number, att: any) => {
    const l = att.labour
    const rate = att.custom_rate || (Array.isArray(l) ? l[0]?.daily_rate : l?.daily_rate) || 0
    return acc + (Number(att.days_worked || 0) * Number(rate)) + Number(att.overtime_amount || 0)
  }, 0)

  const totalAllTimeMaterialCost = allMaterials.reduce((acc: number, curr: any) => acc + Number(curr.total_amount || 0), 0)

  const totalAllTimeContractorCost = contractorInstallments.reduce((acc, inst) => acc + inst.amount, 0)

  const totalAllTimePersonalExpense = allPersonalExpenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)

  const totalAllTimeExpense = totalAllTimeLabourCost + totalAllTimeMaterialCost + totalAllTimeContractorCost + totalAllTimePersonalExpense

  // 3. Current Net Balance (matches dashboard overview netCash exactly)
  const currentNetCashBalance = totalAllTimeIncome - totalAllTimeExpense

  // ── GENERATE PDF DOCUMENT ──────────────────────────────────

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── PAGE 1: ATTENDANCE REGISTER, MATERIALS & CONTRACTORS ────

  drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', `Week: ${weekRangeLabel}`)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...PDF_COLORS.GOLD)
  doc.text('(Page 1 of 2)', W - 14, 36, { align: 'right' })
  drawPremiumFooter(doc)

  let y = 50
  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('1. WEEKLY ATTENDANCE REGISTER', 14, y)
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15)
  doc.line(14, y + 2, 196, y + 2)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(prevSunday, i))
  const attendanceHead = [[
    '#',
    'Worker Name',
    ...weekDays.map(d => `${format(d, 'EEE')}\n(${format(d, 'dd')})`),
    'Days',
    'OT Amount\n(Rs.)',
    'Deduction\n(Rs.)',
    'Giveable Amount\n(Rs.)',
    'Grand Total\n(Rs.)'
  ]]

  const attendanceBody = workersList.map((w, index) => [
    index + 1,
    w.name,
    ...weekDays.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd')
      const day = w.days[dateStr]
      return day ? day.status : 'A'
    }),
    w.totalDays,
    w.totalOt > 0 ? w.totalOt.toLocaleString('en-IN') : '0',
    w.totalDed > 0 ? w.totalDed.toLocaleString('en-IN') : '0',
    w.giveable.toLocaleString('en-IN'),
    w.grandTotal.toLocaleString('en-IN')
  ])

  const grandOt = workersList.reduce((acc, w) => acc + w.totalOt, 0)
  const grandDed = workersList.reduce((acc, w) => acc + w.totalDed, 0)
  const grandGiveable = workersList.reduce((acc, w) => acc + w.giveable, 0)
  const grandGross = workersList.reduce((acc, w) => acc + w.grandTotal, 0)
  const grandDays = workersList.reduce((acc, w) => acc + w.totalDays, 0)

  if (attendanceBody.length === 0) {
    attendanceBody.push([
      '-',
      'No workers active this week',
      ...weekDays.map(() => '-'),
      '0', '0', '0', '0', '0'
    ])
  } else {
    // Add Grand Total row
    attendanceBody.push([
      '',
      'GRAND TOTAL',
      ...weekDays.map(() => ''),
      grandDays,
      grandOt.toLocaleString('en-IN'),
      grandDed.toLocaleString('en-IN'),
      grandGiveable.toLocaleString('en-IN'),
      grandGross.toLocaleString('en-IN')
    ])
  }

  autoTable(doc, {
    startY: y + 5,
    head: attendanceHead,
    body: attendanceBody,
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle' },
    bodyStyles: { fontSize: 7, cellPadding: 1.5, textColor: PDF_COLORS.NAVY, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 28, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 9, halign: 'center' },
      3: { cellWidth: 9, halign: 'center' },
      4: { cellWidth: 9, halign: 'center' },
      5: { cellWidth: 9, halign: 'center' },
      6: { cellWidth: 9, halign: 'center' },
      7: { cellWidth: 9, halign: 'center' },
      8: { cellWidth: 9, halign: 'center' },
      9: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
      10: { cellWidth: 16, halign: 'right' },
      11: { cellWidth: 16, halign: 'right' },
      12: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      13: { cellWidth: 21, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: [248, 250, 255] },
    didParseCell: (cellData) => {
      if (cellData.column.index >= 2 && cellData.column.index <= 8 && cellData.row.index < attendanceBody.length - 1) {
        const val = cellData.cell.text[0]
        if (val === 'P') cellData.cell.styles.textColor = [34, 197, 94]
        else if (val === 'A') cellData.cell.styles.textColor = [239, 68, 68]
        else if (val === 'H') cellData.cell.styles.textColor = [245, 158, 11]
        cellData.cell.styles.fontStyle = 'bold'
      }

      if (cellData.section === 'body' && cellData.row.index < attendanceBody.length - 1) {
        if (cellData.column.index === 11) {
          const val = cellData.cell.text[0]
          if (val && val !== '0') {
            cellData.cell.styles.textColor = PDF_COLORS.RED
            cellData.cell.styles.fontStyle = 'bold'
          }
        }
        if (cellData.column.index === 12) {
          cellData.cell.styles.textColor = PDF_COLORS.GREEN
          cellData.cell.styles.fontStyle = 'bold'
        }
        if (cellData.column.index === 13) {
          cellData.cell.styles.textColor = PDF_COLORS.BLUE
          cellData.cell.styles.fontStyle = 'bold'
        }
      }

      if (cellData.row.index === attendanceBody.length - 1 && attendanceBody.length > 1) {
        cellData.cell.styles.fillColor = PDF_COLORS.NAVY
        cellData.cell.styles.textColor = [255, 255, 255]
        cellData.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 14, right: 14 }
  })

  let finalYAttendance = (doc as any).lastAutoTable.finalY

  // Section 2 & 3 side-by-side below attendance register
  let ySec2 = finalYAttendance + 10

  if (ySec2 > H - 65) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', `Week: ${weekRangeLabel}`)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...PDF_COLORS.GOLD)
    doc.text('(Page 1 of 2 continued)', W - 14, 36, { align: 'right' })
    drawPremiumFooter(doc)
    ySec2 = 50
  }

  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('2. WEEKLY MATERIAL EXPENSES', 14, ySec2)
  doc.text('3. WEEKLY CONTRACTOR EXPENSES', 104, ySec2)

  doc.setLineWidth(0.15); doc.setDrawColor(200, 200, 200)
  doc.line(14, ySec2 + 2, 99, ySec2 + 2)
  doc.line(104, ySec2 + 2, 196, ySec2 + 2)

  // 2. Weekly Material Expenses table
  autoTable(doc, {
    startY: ySec2 + 5,
    head: [['Material Name', 'Amount (Rs.)']],
    body: materialExpensesList.length > 0
      ? materialExpensesList.map(m => [m.name, m.amount.toLocaleString('en-IN')])
      : [['No materials recorded', '0']],
    theme: 'grid',
    headStyles: { fillColor: [13, 120, 110], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 7.5, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35, halign: 'right' }
    },
    foot: [['TOTAL MATERIAL EXPENSE', `${totalMaterialExpense.toLocaleString('en-IN')}`]],
    footStyles: { fillColor: [240, 253, 244], textColor: [13, 120, 110], fontStyle: 'bold', fontSize: 7.5 },
    margin: { left: 14 },
    tableWidth: 85
  })
  const finalYMaterials = (doc as any).lastAutoTable.finalY

  // 3. Weekly Contractor Expenses table
  autoTable(doc, {
    startY: ySec2 + 5,
    head: [['Contractor Name', 'Work Type', 'Amount (Rs.)']],
    body: contractorExpensesList.length > 0
      ? contractorExpensesList.map(c => [c.name, c.workType, c.amount.toLocaleString('en-IN')])
      : [['No contractor payments', '', '0']],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 7.5, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 22, halign: 'right' }
    },
    foot: [['TOTAL CONTRACTOR EXPENSE', '', `${totalContractorExpense.toLocaleString('en-IN')}`]],
    footStyles: { fillColor: [245, 243, 255], textColor: [79, 70, 229], fontStyle: 'bold', fontSize: 7.5 },
    margin: { left: 104 },
    tableWidth: 92
  })
  const finalYContractors = (doc as any).lastAutoTable.finalY

  // Base for bottom boxes on Page 1
  let finalYPage1 = Math.max(finalYMaterials, finalYContractors) + 8

  if (finalYPage1 > H - 32) {
    finalYPage1 = H - 32
  }

  // Legend Box (bottom-left)
  doc.setLineWidth(0.1)
  doc.setDrawColor(210, 215, 225)
  doc.setFillColor(248, 250, 255)
  doc.roundedRect(14, finalYPage1, 45, 16, 1, 1, 'FD')

  doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.setTextColor(34, 197, 94); doc.text('P = Present (Full Day)', 18, finalYPage1 + 4.5)
  doc.setTextColor(239, 68, 68); doc.text('A = Absent', 18, finalYPage1 + 9)
  doc.setTextColor(245, 158, 11); doc.text('H = Half Day', 18, finalYPage1 + 13.5)

  // Total in Words Box (bottom-center) - filled with Navy, white text
  doc.setFillColor(13, 27, 62)
  doc.setDrawColor(245, 158, 11)
  doc.roundedRect(64, finalYPage1, 80, 16, 1, 1, 'FD')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Total Amount in Words:', 104, finalYPage1 + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const wordsText = numberToWords(grandGiveable)
  const wordsLines = doc.splitTextToSize(wordsText, 76)
  doc.text(wordsLines, 104, finalYPage1 + 9.5, { align: 'center' })

  // Signatory Box (bottom-right)
  doc.setFillColor(248, 250, 255)
  doc.setDrawColor(210, 215, 225)
  doc.roundedRect(149, finalYPage1, 47, 16, 1, 1, 'FD')

  doc.setTextColor(13, 27, 62)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
  doc.text('FOR SRI SAI CONSTRUCTIONS', 172.5, finalYPage1 + 3.5, { align: 'center' })
  doc.setFont('times', 'italic'); doc.setFontSize(9)
  doc.text('Cheveli Somaiah', 172.5, finalYPage1 + 9.5, { align: 'center' })
  doc.setLineWidth(0.1); doc.line(155, finalYPage1 + 11.5, 190, finalYPage1 + 11.5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6)
  doc.text('Authorized Signatory', 172.5, finalYPage1 + 14.5, { align: 'center' })

  // ── PAGE 2: WEEKLY SUMMARY & CASH POSITION & SNAPSHOT ───────

  doc.addPage()
  drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', `Week: ${weekRangeLabel}`)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...PDF_COLORS.GOLD)
  doc.text('(Page 2 of 2)', W - 14, 36, { align: 'right' })
  drawPremiumFooter(doc)

  y = 52
  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('4. WEEKLY SPENDING SUMMARY', 14, y)
  doc.text('5. CASH SUMMARY (AS OF TODAY)', 76, y)
  doc.text('6. MANAGEMENT SNAPSHOT', 138, y)

  doc.setLineWidth(0.15); doc.setDrawColor(200, 200, 200)
  doc.line(14, y + 2, 71, y + 2)
  doc.line(76, y + 2, 133, y + 2)
  doc.line(138, y + 2, 196, y + 2)

  // Table 4: Spending Summary
  autoTable(doc, {
    startY: y + 5,
    head: [['Category', 'Amount (Rs.)']],
    body: [
      ['Labour Expense', totalLabourExpense.toLocaleString('en-IN')],
      ['Material Expense', totalMaterialExpense.toLocaleString('en-IN')],
      ['Contractor Expense', totalContractorExpense.toLocaleString('en-IN')],
      ['Other Expense', totalOtherExpense.toLocaleString('en-IN')]
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 37 },
      1: { cellWidth: 20, halign: 'right' }
    },
    foot: [['TOTAL SPENT THIS WEEK', `${weeklyTotalExpense.toLocaleString('en-IN')}`]],
    footStyles: { fillColor: [254, 243, 199], textColor: PDF_COLORS.GOLD, fontStyle: 'bold', fontSize: 7.5 },
    margin: { left: 14 },
    tableWidth: 57
  })

  // Table 5: Cash Summary (As of Today)
  autoTable(doc, {
    startY: y + 5,
    head: [['Description', 'Amount (Rs.)']],
    body: [
      ['Total Income Till Today', totalAllTimeIncome.toLocaleString('en-IN')],
      ['Total Expense Till Today', totalAllTimeExpense.toLocaleString('en-IN')],
      ['CURRENT NET BALANCE', currentNetCashBalance.toLocaleString('en-IN')]
    ],
    theme: 'grid',
    headStyles: { fillColor: [13, 120, 110], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 37 },
      1: { cellWidth: 20, halign: 'right' }
    },
    margin: { left: 76 },
    tableWidth: 57,
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.row.index === 2) {
        cellData.cell.styles.fillColor = [240, 253, 244]
        cellData.cell.styles.textColor = PDF_COLORS.GREEN
        cellData.cell.styles.fontStyle = 'bold'
      }
    }
  })

  // Table 6: Management Snapshot
  autoTable(doc, {
    startY: y + 5,
    head: [['Metric', 'Amount (Rs.)']],
    body: [
      ['Weekly Labour Expense', totalLabourExpense.toLocaleString('en-IN')],
      ['Weekly Material Expense', totalMaterialExpense.toLocaleString('en-IN')],
      ['Weekly Contractor Expense', totalContractorExpense.toLocaleString('en-IN')],
      ['Weekly Total Expense', weeklyTotalExpense.toLocaleString('en-IN')],
      ['Current Net Balance', currentNetCashBalance.toLocaleString('en-IN')]
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 20, halign: 'right' }
    },
    margin: { left: 138 },
    tableWidth: 58,
    didParseCell: (cellData) => {
      if (cellData.section === 'body') {
        if (cellData.row.index === 3) {
          cellData.cell.styles.textColor = PDF_COLORS.RED
          cellData.cell.styles.fontStyle = 'bold'
        }
        if (cellData.row.index === 4) {
          cellData.cell.styles.textColor = PDF_COLORS.GREEN
          cellData.cell.styles.fontStyle = 'bold'
        }
      }
    }
  })

  const finalYPage2 = (doc as any).lastAutoTable.finalY + 8

  // Note under Column 4
  drawCheckmarkBox(
    doc,
    14,
    finalYPage2,
    57,
    18,
    `Note:\nAll figures shown in this report are for the selected week only (${weekRangeLabel}).`
  )

  // Note under Column 5
  drawCheckmarkBox(
    doc,
    76,
    finalYPage2,
    57,
    18,
    'This Net Balance matches the Dashboard Net Balance and is the source of truth.'
  )

  // Signatory under Column 6
  const sigY2 = finalYPage2 + 2
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFontSize(8)
  doc.text('FOR SRI SAI CONSTRUCTIONS', 167, sigY2, { align: 'center' })

  doc.setFont('times', 'italic')
  doc.setFontSize(11)
  doc.text('Cheveli Somaiah', 167, sigY2 + 8, { align: 'center' })
  doc.setLineWidth(0.15); doc.setDrawColor(PDF_COLORS.NAVY[0], PDF_COLORS.NAVY[1], PDF_COLORS.NAVY[2])
  doc.line(147, sigY2 + 10, 187, sigY2 + 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7); doc.text('Authorized Signatory', 167, sigY2 + 13, { align: 'center' })

  // ── PASSWORD ENCRYPT THE PDF BYTES ────────────────────────

  const rawPdfBuffer = doc.output('arraybuffer')
  const encryptedPdfBytes = await encryptPDF(new Uint8Array(rawPdfBuffer), config.passwordProtect)

  // ── SEND THE EMAIL VIA NODEMAILER SMTP ───────────────────

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass) {
    throw new Error('SMTP credentials are not configured in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS)')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587/others
    auth: { user, pass }
  })

  const mailOptions = {
    from: `"SS Constructions Reports" <${from}>`,
    to: config.recipientEmail,
    subject: `Weekly Attendance & Financial Report - [${weekRangeLabel}]`,
    text: `Hello,

Please find the attached weekly attendance and financial summary report.

The report includes:
* Weekly Attendance
* Weekly Material Expenses
* Weekly Contractor Expenses
* Weekly Spending Summary
* Current Cash Position
* Management Snapshot

This is an automatically generated report.

Regards,
System Generated Report`,
    attachments: [
      {
        filename: `Weekly_Report_${startDateStr}_to_${endDateStr}.pdf`,
        content: Buffer.from(encryptedPdfBytes)
      }
    ]
  }

  await transporter.sendMail(mailOptions)
  console.log('Weekly report email sent successfully!')
}
