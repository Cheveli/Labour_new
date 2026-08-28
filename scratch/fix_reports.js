const fs = require('fs')
const path = require('path')

const filePath = path.join('c:', 'Users', 'cheveli sai kumar', 'Desktop', 'labour', 'src', 'app', '(dashboard)', 'attendance', 'reports', 'page.tsx')
let content = fs.readFileSync(filePath, 'utf8')

const regex = /\/\/\s*Premium Footer positioning[\s\S]*?(?=\/\/\s*Analytics)/
const correctCodeToInsert = `// Premium Footer positioning
    drawPremiumFooter(doc)

    const safeName = worker.name.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(\`Attendance_\${safeName}_\${format(new Date(startDate), 'dd-MMM')}_to_\${format(new Date(endDate), 'dd-MMM-yyyy')}.pdf\`)
    toast.success('PDF exported')
  }

  const exportProjectPDF = () => {
    if (!reportData) return
    const { project, days, workers, notesByDate, bandDaysSet } = reportData
    const doc = new jsPDF({ orientation: 'landscape' })
    
    `

if (regex.test(content)) {
  content = content.replace(regex, correctCodeToInsert)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Fixed reports/page.tsx duplication using regex')
} else {
  console.log('Regex did not match')
}
