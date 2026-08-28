const fs = require('fs')
const path = require('path')

const filePath = path.join('c:', 'Users', 'cheveli sai kumar', 'Desktop', 'labour', 'src', 'app', '(dashboard)', 'attendance', 'reports', 'page.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Fetch band days in fetchProjectWeeklyReport
const fetchProjWeeklyMarker = `const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_type', 'ADVANCE')
      .gte('date', startDate)
      .lte('date', endDate)`

const fetchProjWeeklyReplacement = `const { data: payData } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_type', 'ADVANCE')
      .gte('date', startDate)
      .lte('date', endDate)

    // Fetch Band Days
    const { data: bandData } = await supabase
      .from('project_day_status')
      .select('*')
      .eq('project_id', selectedProjectId)
      .eq('status', 'BAND')
      .gte('date', startDate)
      .lte('date', endDate)
      
    const bandDaysSet = new Set(bandData?.map(b => b.date) || [])`

if (!content.includes(`const bandDaysSet`)) {
  content = content.replace(fetchProjWeeklyMarker, fetchProjWeeklyReplacement)
}

// 2. Add bandDaysSet to setReportData
const setReportProjMarker = `setReportData({
      type: 'PROJECT',
      project,
      days: eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }),
      notesByDate,
      workers: Array.from(workerMap.values())
    })`

const setReportProjReplacement = `setReportData({
      type: 'PROJECT',
      project,
      days: eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }),
      notesByDate,
      bandDaysSet,
      workers: Array.from(workerMap.values())
    })`

if (!content.includes(`bandDaysSet,`) && content.includes(setReportProjMarker)) {
  content = content.replace(setReportProjMarker, setReportProjReplacement)
}

// 3. Update exportProjectPDF to show BAND days
const exportProjPdfMarker = `const exportProjectPDF = () => {
    if (!reportData) return
    const { project, days, workers, notesByDate } = reportData`

const exportProjPdfReplacement = `const exportProjectPDF = () => {
    if (!reportData) return
    const { project, days, workers, notesByDate, bandDaysSet } = reportData`

if (!content.includes(`bandDaysSet } = reportData`) && content.includes(exportProjPdfMarker)) {
  content = content.replace(exportProjPdfMarker, exportProjPdfReplacement)
}

// 4. In the body mapping, check bandDaysSet
const bodyMappingMarker = `...days.map((d: any) => {
        const att = w.attendance[format(d, 'yyyy-MM-dd')]
        if (!att) return 'A'
        return att.days_worked === 1 ? 'P' : att.days_worked === 0.5 ? 'H' : 'A'
      }),`

const bodyMappingReplacement = `...days.map((d: any) => {
        const dateStr = format(d, 'yyyy-MM-dd')
        if (bandDaysSet && bandDaysSet.has(dateStr)) return 'B' // BAND DAY
        const att = w.attendance[dateStr]
        if (!att) return 'A'
        return att.days_worked === 1 ? 'P' : att.days_worked === 0.5 ? 'H' : 'A'
      }),`

if (!content.includes(`return 'B' // BAND DAY`) && content.includes(bodyMappingMarker)) {
  content = content.replace(bodyMappingMarker, bodyMappingReplacement)
}

// 5. PDF formatting for 'B'
const pdfFormattingMarker = `if (data.cell.text[0] === 'P') data.cell.styles.textColor = PDF_COLORS.GREEN
        }`

const pdfFormattingReplacement = `if (data.cell.text[0] === 'P') data.cell.styles.textColor = PDF_COLORS.GREEN
          if (data.cell.text[0] === 'B') {
            data.cell.styles.textColor = PDF_COLORS.MUTED
            data.cell.styles.fontStyle = 'bold'
          }
        }`

if (!content.includes(`data.cell.text[0] === 'B'`) && content.includes(pdfFormattingMarker)) {
  content = content.replace(pdfFormattingMarker, pdfFormattingReplacement)
}

// 6. Project summary calculation of Attendance Percentage
// We need to calculate the attendance percentage and display it.
// The user asked to integrate Band Days into existing attendance analytics.
// Let's modify the weekly tasks summary or add a note about Band Days.
const summaryMarker = `const workDoneRow = [
      '', 'WORK DONE (ALL WORKERS)', '',
      ...days.map((d: any) => notesByDate[format(d, 'yyyy-MM-dd')] || '-'),
      '', '', '', ''
    ]`

const summaryReplacement = `const workDoneRow = [
      '', 'WORK DONE (ALL WORKERS)', '',
      ...days.map((d: any) => {
        const dStr = format(d, 'yyyy-MM-dd');
        return bandDaysSet && bandDaysSet.has(dStr) ? '🔴 BAND DAY' : (notesByDate[dStr] || '-');
      }),
      '', '', '', ''
    ]
    
    // Analytics
    const totalPossibleDays = days.length - (bandDaysSet ? bandDaysSet.size : 0)
    let totalPresentDays = 0
    let totalAbsentDays = 0
    workers.forEach((w: any) => {
       days.forEach((d: any) => {
         const dateStr = format(d, 'yyyy-MM-dd')
         if (bandDaysSet && bandDaysSet.has(dateStr)) return // Skip band days
         const att = w.attendance[dateStr]
         if (att && att.days_worked > 0) totalPresentDays += att.days_worked
         else totalAbsentDays += 1
       })
    })
    const attPercentage = totalPossibleDays > 0 && workers.length > 0 
      ? ((totalPresentDays / (totalPossibleDays * workers.length)) * 100).toFixed(1)
      : '0.0'
`
if (!content.includes(`const totalPossibleDays`) && content.includes(summaryMarker)) {
  content = content.replace(summaryMarker, summaryReplacement)
}

// Add it to the subheader or foot
const subheadMarker = `doc.setFont('helvetica', 'bold'); doc.text('Week Range', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(\`: \${startDate} to \${endDate}\`, 40, y + 6)`
const subheadReplacement = `doc.setFont('helvetica', 'bold'); doc.text('Week Range', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(\`: \${startDate} to \${endDate}\`, 40, y + 6)
    
    doc.setFont('helvetica', 'bold'); doc.text('Band Days', 110, y); doc.setFont('helvetica', 'normal'); doc.text(\`: \${bandDaysSet ? bandDaysSet.size : 0}\`, 135, y)
    doc.setFont('helvetica', 'bold'); doc.text('Avg Attendance', 110, y + 6); doc.setFont('helvetica', 'normal'); doc.text(\`: \${attPercentage}%\`, 135, y + 6)
`
if (!content.includes(`'Band Days'`) && content.includes(subheadMarker)) {
  content = content.replace(subheadMarker, subheadReplacement)
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Patched reports/page.tsx with Band Day logic')
