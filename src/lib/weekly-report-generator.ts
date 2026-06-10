import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { startOfWeek, endOfWeek, subDays, format, parseISO } from 'date-fns'
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

  // 1. FETCH DATABASE DATA FOR THE PREVIOUS WEEK
  const [
    projectsRes,
    attendanceRes,
    paymentsRes,
    materialsRes,
    subcontractorsRes,
    personalExpensesRes,
    allIncomeRes,
    allMaterialsRes,
    allAttendanceRes,
    allPersonalExpensesRes
  ] = await Promise.all([
    supabase.from('projects').select('*').order('name'),
    supabase.from('attendance').select('*, labour(name, type, daily_rate)').gte('date', startDateStr).lte('date', endDateStr),
    supabase.from('payments').select('*, labour(name, type)').gte('date', startDateStr).lte('date', endDateStr),
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
  const payments = paymentsRes.data || []
  const materials = materialsRes.data || []
  const contractorPayments = subcontractorsRes.data || []
  const personalExpenses = personalExpensesRes.data || []

  // All-time details for cash balance calculations
  const allIncome = allIncomeRes.data || []
  const allMaterials = allMaterialsRes.data || []
  const allAttendance = allAttendanceRes.data || []
  const allPersonalExpenses = allPersonalExpensesRes.data || []

  // ── CALCULATE IN-MEMORY SUMMARIES ─────────────────────────

  // A. Weekly Attendance Grouping
  const workerWeeklyDaysWorked: Record<string, number> = {}
  attendance.forEach((att: any) => {
    const key = `${att.labour_id}-${att.project_id}`
    workerWeeklyDaysWorked[key] = (workerWeeklyDaysWorked[key] || 0) + Number(att.days_worked || 0)
  })

  // B. Weekly Labour Expenses (From actual payments made in the week)
  const labourExpensesGrouped: Record<string, { category: string; name: string; amount: number }> = {}
  payments.forEach((pay: any) => {
    const lName = pay.labour?.name || 'Unknown Labour'
    const lCategory = pay.labour?.type || 'Other'
    const key = `${lName}-${lCategory}`
    if (!labourExpensesGrouped[key]) {
      labourExpensesGrouped[key] = { category: lCategory, name: lName, amount: 0 }
    }
    labourExpensesGrouped[key].amount += Number(pay.amount || 0)
  })
  const labourExpensesList = Object.values(labourExpensesGrouped)
  const totalLabourExpense = labourExpensesList.reduce((acc, curr) => acc + curr.amount, 0)

  // C. Weekly Material Expenses (Grouped & Summed)
  const materialExpensesGrouped: Record<string, number> = {}
  materials.forEach((mat: any) => {
    const name = mat.name || 'Other Materials'
    materialExpensesGrouped[name] = (materialExpensesGrouped[name] || 0) + Number(mat.total_amount || 0)
  })
  const materialExpensesList = Object.entries(materialExpensesGrouped).map(([name, amount]) => ({ name, amount }))
  const totalMaterialExpense = materialExpensesList.reduce((acc, curr) => acc + curr.amount, 0)

  // D. Weekly Subcontractor Expenses (Extract installments paid in week range)
  const subcontractorExpensesList: { name: string; workType: string; amount: number }[] = []
  contractorPayments.forEach((sub: any) => {
    const installments = sub.installments || []
    installments.forEach((inst: any) => {
      if (inst.date >= startDateStr && inst.date <= endDateStr) {
        subcontractorExpensesList.push({
          name: sub.name,
          workType: sub.work_nature,
          amount: Number(inst.amount || 0)
        })
      }
    })
  })
  const totalSubcontractorExpense = subcontractorExpensesList.reduce((acc, curr) => acc + curr.amount, 0)

  // E. Other Expenses (Personal Expenses in the week)
  const totalOtherExpense = personalExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  // F. Weekly Total Financials
  const weeklyTotalExpense = totalLabourExpense + totalMaterialExpense + totalSubcontractorExpense + totalOtherExpense

  // ── CASH POSITION CALCULATIONS (ALL TIME AS OF TODAY) ─────

  // All-time income per project
  const projectIncomeMap: Record<string, number> = {}
  allIncome.forEach((inc: any) => {
    if (inc.project_id) {
      projectIncomeMap[inc.project_id] = (projectIncomeMap[inc.project_id] || 0) + Number(inc.amount || 0)
    }
  })

  // All-time materials expense per project
  const projectMaterialMap: Record<string, number> = {}
  allMaterials.forEach((mat: any) => {
    if (mat.project_id) {
      projectMaterialMap[mat.project_id] = (projectMaterialMap[mat.project_id] || 0) + Number(mat.total_amount || 0)
    }
  })

  // All-time labour costs per project (derived from attendance wages accrued)
  const projectLabourMap: Record<string, number> = {}
  allAttendance.forEach((att: any) => {
    if (att.project_id) {
      const dailyRate = att.labour?.daily_rate || 0
      const rate = att.custom_rate || dailyRate
      const wage = Number(att.days_worked || 0) * Number(rate) + Number(att.overtime_amount || 0)
      projectLabourMap[att.project_id] = (projectLabourMap[att.project_id] || 0) + wage
    }
  })

  // All-time subcontractor payouts per project
  const projectSubcontractorMap: Record<string, number> = {}
  contractorPayments.forEach((sub: any) => {
    const installments = sub.installments || []
    installments.forEach((inst: any) => {
      // Find matching project id by project name in installments
      const matchedProj = projects.find((p: any) => p.name === inst.site_project)
      const pId = matchedProj ? matchedProj.id : 'unknown'
      projectSubcontractorMap[pId] = (projectSubcontractorMap[pId] || 0) + Number(inst.amount || 0)
    })
  })

  // Group cash positions per project
  const activeProjectsCash: { name: string; income: number; expenses: number; balance: number }[] = []
  projects.forEach((proj: any) => {
    const pId = proj.id
    const pIncome = projectIncomeMap[pId] || 0
    const pExpense = (projectLabourMap[pId] || 0) + (projectMaterialMap[pId] || 0) + (projectSubcontractorMap[pId] || 0)
    activeProjectsCash.push({
      name: proj.name,
      income: pIncome,
      expenses: pExpense,
      balance: pIncome - pExpense
    })
  })

  // Overall Company Net Cash Position (All-Time)
  const totalAllTimeIncome = allIncome.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)
  const totalAllTimeLabourCost = allAttendance.reduce((acc: number, att: any) => {
    const rate = att.custom_rate || att.labour?.daily_rate || 0
    return acc + (Number(att.days_worked || 0) * Number(rate)) + Number(att.overtime_amount || 0)
  }, 0)
  const totalAllTimeMaterialCost = allMaterials.reduce((acc: number, curr: any) => acc + Number(curr.total_amount || 0), 0)
  
  // All subcontractor payouts all-time
  let totalAllTimeSubcontractorCost = 0
  contractorPayments.forEach((sub: any) => {
    const installments = sub.installments || []
    installments.forEach((inst: any) => {
      totalAllTimeSubcontractorCost += Number(inst.amount || 0)
    })
  })

  const totalAllTimePersonalExpense = allPersonalExpenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0)

  // Net Cash Balance = Total All-Time Income - All-Time Expenses
  const currentNetCashBalance = totalAllTimeIncome - (totalAllTimeLabourCost + totalAllTimeMaterialCost + totalAllTimeSubcontractorCost + totalAllTimePersonalExpense)
  const remainingBalanceAfterWeekly = currentNetCashBalance - weeklyTotalExpense

  // ── GENERATE PDF DOCUMENT ──────────────────────────────────

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  })

  drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)

  let y = 52
  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('REPORT OVERVIEW', 14, y)
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15)
  doc.line(14, y + 2, 196, y + 2)

  y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  doc.text(`Generated On  : ${format(today, 'dd MMM yyyy HH:mm')}`, 14, y)
  doc.text(`Report Period : ${weekRangeLabel}`, 14, y + 5)
  doc.text(`Email Recipient: ${config.recipientEmail}`, 14, y + 10)

  // Section 1: Weekly Attendance records
  y += 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('1. WEEKLY ATTENDANCE SUMMARY', 14, y)
  doc.line(14, y + 2, 196, y + 2)

  let attendanceBody: any[] = []
  if (attendance.length === 0) {
    attendanceBody = [['Attendance Data Not Available', '', '', '', '', '']]
  } else {
    attendanceBody = attendance.map((att: any) => {
      const projName = projects.find((p: any) => p.id === att.project_id)?.name || '—'
      const key = `${att.labour_id}-${att.project_id}`
      const weeklyDays = workerWeeklyDaysWorked[key] || 0
      const statusText = att.days_worked === 1 ? 'Present' : att.days_worked === 0.5 ? 'Half-day' : 'Absent'
      return [
        att.labour?.name || '—',
        att.labour_id ? att.labour_id.slice(0, 8).toUpperCase() : 'N/A',
        projName,
        format(parseISO(att.date), 'dd MMM yyyy'),
        statusText,
        `${weeklyDays} days`
      ]
    })
  }

  autoTable(doc, {
    startY: y + 5,
    head: [['Labour Name', 'Labour ID', 'Project Name', 'Date', 'Status', 'Total Days Present (Weekly)']],
    body: attendanceBody,
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: PDF_COLORS.NAVY, fontSize: 8 },
    alternateRowStyles: { fillColor: PDF_COLORS.LIGHT },
    margin: { left: 14, right: 14 }
  })

  // Section 2: Weekly Expense Summary
  let nextY = (doc as any).lastAutoTable.finalY + 12

  // Page break if necessary
  if (nextY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 50
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('2. WEEKLY EXPENSE BREAKDOWN', 14, nextY)
  doc.line(14, nextY + 2, 196, nextY + 2)

  // 2.1 Labour Payouts
  nextY += 7
  doc.setFontSize(8.5); doc.setTextColor(...PDF_COLORS.BLUE)
  doc.text('Labour Expenses (Weekly Payouts)', 14, nextY)
  
  const labourTableBody = labourExpensesList.map(item => [
    item.category,
    item.name,
    `Rs. ${item.amount.toLocaleString('en-IN')}`
  ])
  if (labourTableBody.length === 0) labourTableBody.push(['—', 'No payments made', 'Rs. 0'])

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Category / Role', 'Labour Name', 'Amount Paid']],
    body: labourTableBody,
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 2: { halign: 'right' as const } },
    foot: [['TOTAL LABOUR EXPENSE', '', `Rs. ${totalLabourExpense.toLocaleString('en-IN')}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: PDF_COLORS.NAVY, fontStyle: 'bold', fontSize: 8 },
    margin: { left: 14, right: 14 }
  })

  // 2.2 Material Costs
  nextY = (doc as any).lastAutoTable.finalY + 10
  if (nextY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 50
  }

  doc.setFontSize(8.5); doc.setTextColor(...PDF_COLORS.BLUE)
  doc.text('Material Expenses (Summary)', 14, nextY)

  const materialTableBody = materialExpensesList.map(item => [
    item.name,
    `Rs. ${item.amount.toLocaleString('en-IN')}`
  ])
  if (materialTableBody.length === 0) materialTableBody.push(['No materials recorded', 'Rs. 0'])

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Material Name', 'Amount']],
    body: materialTableBody,
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'right' as const } },
    foot: [['TOTAL MATERIAL EXPENSE', `Rs. ${totalMaterialExpense.toLocaleString('en-IN')}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: PDF_COLORS.NAVY, fontStyle: 'bold', fontSize: 8 },
    margin: { left: 14, right: 14 }
  })

  // 2.3 Subcontractor Payouts
  nextY = (doc as any).lastAutoTable.finalY + 10
  if (nextY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 50
  }

  doc.setFontSize(8.5); doc.setTextColor(...PDF_COLORS.BLUE)
  doc.text('Subcontractor Expenses', 14, nextY)

  const subcontractorTableBody = subcontractorExpensesList.map(item => [
    item.name,
    item.workType,
    `Rs. ${item.amount.toLocaleString('en-IN')}`
  ])
  if (subcontractorTableBody.length === 0) subcontractorTableBody.push(['No contractor payments', '', 'Rs. 0'])

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Subcontractor Name', 'Work Type / Nature', 'Amount Paid']],
    body: subcontractorTableBody,
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 2: { halign: 'right' as const } },
    foot: [['TOTAL SUBCONTRACTOR EXPENSE', '', `Rs. ${totalSubcontractorExpense.toLocaleString('en-IN')}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: PDF_COLORS.NAVY, fontStyle: 'bold', fontSize: 8 },
    margin: { left: 14, right: 14 }
  })

  // Section 3: Financial Summary & Cash Position
  nextY = (doc as any).lastAutoTable.finalY + 12
  if (nextY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 50
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PDF_COLORS.NAVY)
  doc.text('3. FINANCIAL SUMMARY & CASH POSITION', 14, nextY)
  doc.line(14, nextY + 2, 196, nextY + 2)

  // 3.1 Financials Grid
  nextY += 7
  autoTable(doc, {
    startY: nextY,
    head: [[{ content: 'FINANCIAL ANALYSIS', colSpan: 2, styles: { fillColor: PDF_COLORS.BLUE, textColor: 255 } }]],
    body: [
      ['Total Weekly Labour Expense', `Rs. ${totalLabourExpense.toLocaleString('en-IN')}`],
      ['Total Weekly Material Expense', `Rs. ${totalMaterialExpense.toLocaleString('en-IN')}`],
      ['Total Weekly Subcontractor Expense', `Rs. ${totalSubcontractorExpense.toLocaleString('en-IN')}`],
      ['Other Expenses (Personal Expenses)', `Rs. ${totalOtherExpense.toLocaleString('en-IN')}`],
      ['TOTAL AMOUNT SPENT THIS WEEK', `Rs. ${weeklyTotalExpense.toLocaleString('en-IN')}`]
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 1: { halign: 'right' as const, fontStyle: 'bold' } },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.row.index === 4) {
        cellData.cell.styles.fillColor = [254, 243, 199] // Soft gold highlights
        cellData.cell.styles.textColor = PDF_COLORS.GOLD
        cellData.cell.styles.fontStyle = 'bold'
      }
    },
    margin: { left: 14, right: 14 }
  })

  // 3.2 Cash Positions
  nextY = (doc as any).lastAutoTable.finalY + 10
  if (nextY > doc.internal.pageSize.getHeight() - 65) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 50
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PDF_COLORS.BLUE)
  doc.text('Project Cash Balances (All-Time)', 14, nextY)

  const cashPositionsBody = activeProjectsCash.map(item => [
    item.name,
    `Rs. ${item.income.toLocaleString('en-IN')}`,
    `Rs. ${item.expenses.toLocaleString('en-IN')}`,
    `Rs. ${item.balance.toLocaleString('en-IN')}`
  ])

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Project Name', 'All-Time Income', 'All-Time Expenses', 'Current Project Balance']],
    body: cashPositionsBody,
    theme: 'grid',
    headStyles: { fillColor: PDF_COLORS.NAVY, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 
      1: { halign: 'right' as const }, 
      2: { halign: 'right' as const }, 
      3: { halign: 'right' as const, fontStyle: 'bold' } 
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body') {
        const valText = cellData.row.cells[3]?.text[0] || 'Rs. 0'
        const isNeg = valText.includes('-')
        if (cellData.column.index === 3) {
          cellData.cell.styles.textColor = isNeg ? PDF_COLORS.RED : PDF_COLORS.GREEN
        }
      }
    },
    margin: { left: 14, right: 14 }
  })

  // 3.3 Cash Position Summary Box
  nextY = (doc as any).lastAutoTable.finalY + 8
  if (nextY > doc.internal.pageSize.getHeight() - 55) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 50
  }

  autoTable(doc, {
    startY: nextY,
    head: [[{ content: 'CASH BALANCE SUMMARY (AS OF TODAY)', colSpan: 2, styles: { fillColor: PDF_COLORS.BLUE } }]],
    body: [
      ['Current Net Cash Balance', `Rs. ${currentNetCashBalance.toLocaleString('en-IN')}`],
      ['Remaining Balance After Weekly Expenses', `Rs. ${remainingBalanceAfterWeekly.toLocaleString('en-IN')}`]
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 1: { halign: 'right' as const, fontStyle: 'bold' } },
    didParseCell: (cellData) => {
      if (cellData.section === 'body') {
        cellData.cell.styles.fillColor = [240, 253, 244]
        cellData.cell.styles.textColor = PDF_COLORS.GREEN
      }
    },
    margin: { left: 14, right: 14 }
  })

  // Section 4: Management Summary Snapshot
  nextY = (doc as any).lastAutoTable.finalY + 12
  if (nextY > doc.internal.pageSize.getHeight() - 55) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 50
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PDF_COLORS.NAVY)
  doc.text('4. WEEKLY SNAPSHOT (MANAGEMENT PREVIEW)', 14, nextY)
  doc.line(14, nextY + 2, 196, nextY + 2)

  nextY += 7
  autoTable(doc, {
    startY: nextY,
    head: [['Metric', 'Amount']],
    body: [
      ['Weekly Labour Expense', `Rs. ${totalLabourExpense.toLocaleString('en-IN')}`],
      ['Weekly Material Expense', `Rs. ${totalMaterialExpense.toLocaleString('en-IN')}`],
      ['Weekly Subcontractor Expense', `Rs. ${totalSubcontractorExpense.toLocaleString('en-IN')}`],
      ['Total Weekly Spent', `Rs. ${weeklyTotalExpense.toLocaleString('en-IN')}`],
      ['Net Cash Available (As of Today)', `Rs. ${currentNetCashBalance.toLocaleString('en-IN')}`]
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 1: { halign: 'right' as const, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 }
  })

  // Signatory Area
  nextY = (doc as any).lastAutoTable.finalY + 15
  const H = doc.internal.pageSize.getHeight()
  if (nextY > H - 35) {
    doc.addPage()
    drawPremiumHeader(doc, 'WEEKLY MANAGEMENT REPORT', weekRangeLabel)
    nextY = 60
  }

  const sigY = H - 48
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFontSize(8)
  doc.text('FOR ' + COMPANY_DETAILS.name, 160, sigY + 5, { align: 'center' })

  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  doc.text('Cheveli Somaiah', 160, sigY + 16, { align: 'center' })
  doc.line(140, sigY + 18, 180, sigY + 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7); doc.text('Authorized Signatory', 160, sigY + 22, { align: 'center' })

  drawPremiumFooter(doc)

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
* Labour Expenses
* Material Expenses
* Subcontractor Expenses
* Weekly Expense Summary
* Current Cash Position

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
