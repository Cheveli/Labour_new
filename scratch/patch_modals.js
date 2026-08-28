const fs = require('fs')
const path = require('path')

const filePath = path.join('c:', 'Users', 'cheveli sai kumar', 'Desktop', 'labour', 'src', 'app', '(dashboard)', 'attendance', 'page.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add Band Day Modal at the bottom before final </div>
const modalMarkup = `
      {/* Band Day Modal */}
      {showBandModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111520] border border-[#1e2435] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setShowBandModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-white mb-2">🔴 Mark BAND DAY</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to mark <strong>{format(parseISO(showBandModal.date), 'dd MMM yyyy')}</strong> as a Band Day? 
              This means the site is closed and no attendance records will be saved.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Reason</label>
                <select 
                  value={bandReason}
                  onChange={e => setBandReason(e.target.value)}
                  className="w-full bg-[#0d1018] border border-[#1e2435] rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="Amavasya">Amavasya</option>
                  <option value="Festival">Festival</option>
                  <option value="Heavy Rain">Heavy Rain</option>
                  <option value="Material Delay">Material Delay</option>
                  <option value="Labour Unavailable">Labour Unavailable</option>
                  <option value="Site Closed">Site Closed</option>
                  <option value="Personal Reason">Personal Reason</option>
                  <option value="Other">Other...</option>
                </select>
              </div>

              {bandReason === 'Other' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Custom Reason</label>
                  <input 
                    type="text"
                    value={bandCustomReason}
                    onChange={e => setBandCustomReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full bg-[#0d1018] border border-[#1e2435] rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBandModal(null)} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleMarkBandDay}
                disabled={saving || (bandReason === 'Other' && !bandCustomReason.trim())}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm BAND DAY
              </button>
            </div>
          </div>
        </div>
      )}
`

if (!content.includes('{/* Band Day Modal */}')) {
  // Find the last </div>
  const lastDivIndex = content.lastIndexOf('</div>')
  if (lastDivIndex !== -1) {
    content = content.slice(0, lastDivIndex) + modalMarkup + content.slice(lastDivIndex)
  }
}

// 2. We need a way to open the Band modal. The user requested:
// "Add a Day Status control near the attendance date/week controls"
// But since the current UI uses a grid, they might want a control per column header.
// Let's add it to the column header (desktop) and mobile day header.

const colHeaderMarker = `<span className="text-[9px] font-bold text-zinc-600 tracking-normal flex flex-col items-center">
                          {format(d, 'd MMM')}
                          {calendarEvents[dateStr] && calendarEvents[dateStr].event_type === 'AMAVASYA' && (
                            <span title="Amavasya Today" className="mt-0.5 text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded cursor-help">
                              🌑 AMAVASYA
                            </span>
                          )}
                        </span>`

const colHeaderReplacement = `<span className="text-[9px] font-bold text-zinc-600 tracking-normal flex flex-col items-center">
                          {format(d, 'd MMM')}
                          {calendarEvents[dateStr] && calendarEvents[dateStr].event_type === 'AMAVASYA' && (
                            <span title="Amavasya Today" className="mt-0.5 text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded cursor-help">
                              🌑 AMAVASYA
                            </span>
                          )}
                        </span>
                        {bandDays[dateStr]?.status === 'BAND' ? (
                          <button
                            onClick={() => handleUnmarkBandDay(dateStr)}
                            className="mt-1 px-1.5 py-0.5 rounded bg-red-500/20 text-[7px] text-red-400 font-bold uppercase whitespace-nowrap hover:bg-red-500 hover:text-white transition-all"
                          >
                            🔴 UNMARK
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowBandModal({ date: dateStr, isAmavasya: !!calendarEvents[dateStr] })}
                            className="opacity-0 group-hover/col:opacity-100 mt-1 px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-red-500/20 text-[7px] text-zinc-500 hover:text-red-400 font-bold transition-all uppercase whitespace-nowrap"
                          >
                            Mark Band
                          </button>
                        )}`

if (!content.includes('Mark Band') && content.includes(colHeaderMarker)) {
  content = content.replace(colHeaderMarker, colHeaderReplacement)
}

// 3. For mobile, we have: <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{format(d, 'EEE dd MMM')}</label>
const mobileHeaderMarker = `<label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{format(d, 'EEE dd MMM')}</label>`
const mobileHeaderReplacement = `<div className="flex items-center gap-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                            {format(d, 'EEE dd MMM')}
                          </label>
                          {calendarEvents[dateStr] && calendarEvents[dateStr].event_type === 'AMAVASYA' && (
                            <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded">
                              🌑 AMAVASYA
                            </span>
                          )}
                          {bandDays[dateStr]?.status === 'BAND' ? (
                            <button onClick={() => handleUnmarkBandDay(dateStr)} className="text-[8px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                              🔴 UNMARK
                            </button>
                          ) : (
                            <button onClick={() => setShowBandModal({ date: dateStr, isAmavasya: !!calendarEvents[dateStr] })} className="text-[8px] font-bold text-zinc-500 hover:text-red-400 bg-zinc-800/50 px-1.5 py-0.5 rounded transition-colors">
                              MARK BAND
                            </button>
                          )}
                        </div>`

if (!content.includes('MARK BAND') && content.includes(mobileHeaderMarker)) {
  content = content.replace(mobileHeaderMarker, mobileHeaderReplacement)
}

// 4. Update the Cell display if it's BAND to show a dash or text
const cellTextMarker = `{cell.status || '-'}`
const cellTextReplacement = `{bandDays[dateStr]?.status === 'BAND' ? 'B' : (cell.status || '-')}`
if (content.includes(cellTextMarker)) {
  content = content.replaceAll(cellTextMarker, cellTextReplacement)
}


fs.writeFileSync(filePath, content, 'utf8')
console.log('Patched page.tsx with Modals')
