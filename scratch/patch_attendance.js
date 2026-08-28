const fs = require('fs')
const path = require('path')

const filePath = path.join('c:', 'Users', 'cheveli sai kumar', 'Desktop', 'labour', 'src', 'app', '(dashboard)', 'attendance', 'page.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add handleMarkBandDay and handleUnmarkBandDay right before handleSave
const saveLogicMarker = '// Save Logic'
const bandDayActions = `
  // Band Day Actions
  const handleMarkBandDay = async () => {
    if (!showBandModal || !selectedProject) return
    const { date, isAmavasya } = showBandModal
    const finalReason = bandReason === 'Other' ? bandCustomReason : bandReason
    
    try {
      setSaving(true)
      
      // Upsert into project_day_status
      const { error: upsertErr } = await supabase
        .from('project_day_status')
        .upsert({
          project_id: selectedProject,
          date,
          status: 'BAND',
          reason: finalReason,
          source: isAmavasya ? 'CALENDAR' : 'MANUAL'
        }, { onConflict: 'project_id,date' })
        
      if (upsertErr) throw upsertErr

      // Delete any existing attendance records for this date to clear 'A' or accidental marks
      await supabase
        .from('attendance')
        .delete()
        .eq('project_id', selectedProject)
        .eq('date', date)

      // Clear local state for this date
      setGridData(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(wId => {
          if (next[wId].days[date]) {
            next[wId].days[date] = { status: '', paid_amount: 0 }
          }
        })
        return next
      })

      setBandDays(prev => ({
        ...prev,
        [date]: { status: 'BAND', reason: finalReason }
      }))

      setShowBandModal(null)
      setBandReason('Amavasya')
      setBandCustomReason('')
      toast.success(\`\${format(parseISO(date), 'dd MMM')} marked as BAND DAY.\`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark Band Day')
    } finally {
      setSaving(false)
    }
  }

  const handleUnmarkBandDay = async (date: string) => {
    if (!selectedProject) return
    if (!confirm('Are you sure you want to unmark this Band Day?')) return
    
    try {
      setSaving(true)
      const { error } = await supabase
        .from('project_day_status')
        .delete()
        .eq('project_id', selectedProject)
        .eq('date', date)
        
      if (error) throw error
      
      setBandDays(prev => {
        const next = { ...prev }
        delete next[date]
        return next
      })
      toast.success('Band Day removed. You can now mark attendance.')
    } catch (e: any) {
      toast.error(e.message || 'Failed to unmark Band Day')
    } finally {
      setSaving(false)
    }
  }

`
if (!content.includes('handleMarkBandDay')) {
  content = content.replace(saveLogicMarker, bandDayActions + saveLogicMarker)
}

// 2. Prevent handleCellClick if it's a Band Day
const cellClickMarker = `const handleCellClick = (workerId: string, dateStr: string) => {`
const cellClickReplacement = `const handleCellClick = (workerId: string, dateStr: string) => {
    if (bandDays[dateStr]?.status === 'BAND') {
      toast.error('Cannot mark attendance on a BAND DAY. Unmark it first.')
      return
    }`
if (!content.includes(`if (bandDays[dateStr]?.status === 'BAND')`)) {
  content = content.replace(cellClickMarker, cellClickReplacement)
}

// 3. Prevent save for Band Days in handleSave
const handleSavePushMarker = `// Save every day. If not P or H, it defaults to 0 (Absent)
          inserts.push({`
const handleSavePushReplacement = `// Do not save attendance if it's a BAND day
          if (bandDays[dateStr]?.status === 'BAND') return;
          
          // Save every day. If not P or H, it defaults to 0 (Absent)
          inserts.push({`
if (!content.includes(`if (bandDays[dateStr]?.status === 'BAND') return;`)) {
  content = content.replace(handleSavePushMarker, handleSavePushReplacement)
}

// 4. Desktop header UI: Show Amavasya hint and Band day button
const thMarker = `<th key={d.toISOString()} className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center min-w-[65px] group/col hover:bg-white/[0.01] transition-colors relative">
                      <div className="flex flex-col items-center justify-between h-14">
                        <span>{format(d, 'EEE')}</span>
                        <span className="text-[9px] font-bold text-zinc-600 tracking-normal">{format(d, 'd MMM')}</span>`

const thReplacement = `<th key={d.toISOString()} className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center min-w-[65px] group/col hover:bg-white/[0.01] transition-colors relative">
                      <div className="flex flex-col items-center justify-between min-h-[56px]">
                        <span>{format(d, 'EEE')}</span>
                        <span className="text-[9px] font-bold text-zinc-600 tracking-normal flex flex-col items-center">
                          {format(d, 'd MMM')}
                          {calendarEvents[dateStr] && calendarEvents[dateStr].event_type === 'AMAVASYA' && (
                            <span title="Amavasya Today" className="mt-0.5 text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded cursor-help">
                              🌑 AMAVASYA
                            </span>
                          )}
                        </span>`
if (!content.includes(`🌑 AMAVASYA`)) {
  content = content.replace(thMarker, thReplacement)
}

// 5. Desktop Cell UI: If Band day, show Band instead of the normal box, but only if we are merging? 
// Wait, if it's a Band Day, the whole column should probably just be disabled.
// The easiest way is to modify the cell background to look red and disabled if Band Day.
const cellMarkupMarker = `className={cn(
                            "mx-auto w-11 h-11 rounded-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all border-2 relative",
                            cell.status === 'P' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
                            cell.status === 'H' ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" :
                            cell.status === 'A' ? "bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                            "bg-[#0d1018] border-[#1e2435] text-zinc-600 hover:border-zinc-500 hover:bg-[#1a1f2e]"
                          )}`
const cellMarkupReplacement = `className={cn(
                            "mx-auto w-11 h-11 rounded-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all border-2 relative",
                            bandDays[dateStr]?.status === 'BAND' ? "bg-red-500/5 border-red-500/10 text-red-500/40 cursor-not-allowed" :
                            cell.status === 'P' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
                            cell.status === 'H' ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" :
                            cell.status === 'A' ? "bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                            "bg-[#0d1018] border-[#1e2435] text-zinc-600 hover:border-zinc-500 hover:bg-[#1a1f2e]"
                          )}`
if (!content.includes(`bandDays[dateStr]?.status === 'BAND'`)) {
  // It appears twice (Desktop and Mobile might share or have separate loops). Let's do a global replace for this specific string.
  content = content.replaceAll(cellMarkupMarker, cellMarkupReplacement)
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Patched page.tsx')
