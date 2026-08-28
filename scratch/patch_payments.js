const fs = require('fs')
const path = require('path')

const filePath = path.join('c:', 'Users', 'cheveli sai kumar', 'Desktop', 'labour', 'src', 'app', '(dashboard)', 'payments', 'page.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// Add state
const stateMarker = `  const [workerData, setWorkerData] = useState<any>(null)`
const stateReplacement = `  const [workerData, setWorkerData] = useState<any>(null)
  const [bandDaysSet, setBandDaysSet] = useState<Set<string>>(new Set())`

if (!content.includes(`const [bandDaysSet`)) {
  content = content.replace(stateMarker, stateReplacement)
}

// Fetch band days
const fetchMarker = `    const { data } = await supabase
      .from('attendance')
      .select('*, labour(name, type, daily_rate, phone)')
      .eq('project_id', selectedProjectId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })`

const fetchReplacement = `    const { data } = await supabase
      .from('attendance')
      .select('*, labour(name, type, daily_rate, phone)')
      .eq('project_id', selectedProjectId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })

    const { data: bandData } = await supabase
      .from('project_day_status')
      .select('*')
      .eq('project_id', selectedProjectId)
      .eq('status', 'BAND')
      .gte('date', startStr)
      .lte('date', endStr)
      
    const bandSet = new Set<string>(bandData?.map((b: any) => b.date) || [])
    setBandDaysSet(bandSet)
`

if (!content.includes(`setBandDaysSet(bandSet)`)) {
  content = content.replace(fetchMarker, fetchReplacement)
}

// Update table render
const renderMarker = `                      {weekDates.map(d => {
                        const dateStr = format(d, 'yyyy-MM-dd')
                        const day = s.days[dateStr]
                        const status = day ? day.status : (dateStr < s.maxDate ? 'A' : '-')
                        
                        return (
                          <td key={d.toISOString()} className="py-3 px-2 text-center align-top">
                            <div className="space-y-0.5">
                              <span className={cn("font-black", status === 'A' ? "text-red-500" : status === '-' ? "text-zinc-700" : "text-emerald-500")}>
                                {status}
                              </span>`

const renderReplacement = `                      {weekDates.map(d => {
                        const dateStr = format(d, 'yyyy-MM-dd')
                        const isBandDay = bandDaysSet.has(dateStr)
                        const day = s.days[dateStr]
                        const status = isBandDay ? 'B' : (day ? day.status : (dateStr < s.maxDate ? 'A' : '-'))
                        
                        return (
                          <td key={d.toISOString()} className="py-3 px-2 text-center align-top">
                            <div className="space-y-0.5">
                              <span className={cn("font-black", status === 'A' ? "text-red-500" : status === '-' ? "text-zinc-700" : status === 'B' ? "text-zinc-500" : "text-emerald-500")}>
                                {status}
                              </span>`

if (!content.includes(`const isBandDay = bandDaysSet.has(dateStr)`)) {
  content = content.replace(renderMarker, renderReplacement)
}


fs.writeFileSync(filePath, content, 'utf8')
console.log('Patched payments/page.tsx with Band Day logic')
