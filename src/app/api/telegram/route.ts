import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startOfWeek, endOfWeek, format, eachDayOfInterval, parseISO, subWeeks, subDays } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDF_COLORS, drawPremiumHeader, drawPremiumFooter, numberToWords } from '@/lib/report-utils'

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const TELEGRAM_PIN = process.env.TELEGRAM_PIN || '1919'
const ALLOWED_CHAT_IDS = (process.env.ALLOWED_CHAT_IDS || '').split(',').map(s => Number(s.trim()))

// Helper to generate a week selection inline keyboard
function getWeekSelectorKeyboard(prefix: 'sumweek' | 'pdfweek') {
  const keyboard = []
  const today = new Date()
  
  for (let i = 0; i < 4; i++) {
    // startOfWeek subtraction for index i weeks
    const start = startOfWeek(subWeeks(today, i), { weekStartsOn: 0 })
    const end = endOfWeek(subWeeks(today, i), { weekStartsOn: 0 })
    
    let label = ''
    if (i === 0) label = `📅 This Week (${format(start, 'dd MMM')} - ${format(end, 'dd MMM')})`
    else if (i === 1) label = `📅 Last Week (${format(start, 'dd MMM')} - ${format(end, 'dd MMM')})`
    else label = `📅 ${i} Weeks Ago (${format(start, 'dd MMM')} - ${format(end, 'dd MMM')})`
    
    keyboard.push([{
      text: label,
      callback_data: `${prefix}_${i}`
    }])
  }
  return { inline_keyboard: keyboard }
}

// In-memory caches for PIN typing states and serverless fallback sessions
const pinCache = new Map<number, string>() // chatId -> accumulated PIN string (e.g. "12")
const fallbackSessionCache = new Map<number, { isUnlocked: boolean; lastActive: number }>() // chatId -> session info

// Helper to send Telegram message
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    })
  })
}

// Helper to edit Telegram message text (great for live PIN feedback)
async function editTelegramMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${token}/editMessageText`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    })
  })
}

// Helper to answer Telegram callback query (hides the loading wheel in Telegram UI)
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text
    })
  })
}

// Helper to send PDF file to Telegram chat
async function sendTelegramDocument(chatId: number, filename: string, pdfBuffer: Uint8Array) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${token}/sendDocument`
  
  const formData = new FormData()
  formData.append('chat_id', String(chatId))
  const blob = new Blob([pdfBuffer as any], { type: 'application/pdf' })
  formData.append('document', blob, filename)

  await fetch(url, {
    method: 'POST',
    body: formData
  })
}

// Check session state (DB with in-memory fallback)
async function checkIsUnlocked(chatId: number): Promise<boolean> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  
  try {
    const { data, error } = await supabase
      .from('telegram_sessions')
      .select('*')
      .eq('chat_id', chatId)
      .gte('last_active_at', tenMinutesAgo)
      .single()

    if (error || !data) {
      // Check in-memory fallback cache
      const cached = fallbackSessionCache.get(chatId)
      if (cached && cached.isUnlocked && cached.lastActive > Date.now() - 10 * 60 * 1000) {
        // Touch active timestamp
        cached.lastActive = Date.now()
        fallbackSessionCache.set(chatId, cached)
        return true
      }
      return false
    }

    if (data.is_unlocked) {
      // Touch session last active time
      await supabase
        .from('telegram_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('chat_id', chatId)
      return true
    }
  } catch (dbErr) {
    // DB error / table missing fallback
    const cached = fallbackSessionCache.get(chatId)
    if (cached && cached.isUnlocked && cached.lastActive > Date.now() - 10 * 60 * 1000) {
      cached.lastActive = Date.now()
      fallbackSessionCache.set(chatId, cached)
      return true
    }
  }
  return false
}

// Lock session
async function lockSession(chatId: number) {
  fallbackSessionCache.set(chatId, { isUnlocked: false, lastActive: 0 })
  try {
    await supabase
      .from('telegram_sessions')
      .upsert({ chat_id: chatId, is_unlocked: false, last_active_at: new Date().toISOString() })
  } catch {}
}

// Unlock session
async function unlockSession(chatId: number) {
  fallbackSessionCache.set(chatId, { isUnlocked: true, lastActive: Date.now() })
  try {
    await supabase
      .from('telegram_sessions')
      .upsert({ chat_id: chatId, is_unlocked: true, last_active_at: new Date().toISOString() })
  } catch {}
}

// Generate keyboard markup for the PIN lock screen
function getPinKeyboardMarkup(currentInputLength: number) {
  const mask = '•'.repeat(currentInputLength) + ' '.repeat(4 - currentInputLength)
  return {
    inline_keyboard: [
      [
        { text: '1', callback_data: 'pin_1' },
        { text: '2', callback_data: 'pin_2' },
        { text: '3', callback_data: 'pin_3' }
      ],
      [
        { text: '4', callback_data: 'pin_4' },
        { text: '5', callback_data: 'pin_5' },
        { text: '6', callback_data: 'pin_6' }
      ],
      [
        { text: '7', callback_data: 'pin_7' },
        { text: '8', callback_data: 'pin_8' },
        { text: '9', callback_data: 'pin_9' }
      ],
      [
        { text: '❌ Clear', callback_data: 'pin_clear' },
        { text: '0', callback_data: 'pin_0' },
        { text: '🔓 Unlock', callback_data: 'pin_submit' }
      ]
    ]
  }
}

// Request PIN lock message
async function sendLockMessage(chatId: number, messageId?: number) {
  const currentPin = pinCache.get(chatId) || ''
  const displayPin = currentPin.split('').map(() => '•').join(' ') + ' _ '.repeat(4 - currentPin.length)
  const text = `🔒 *Nirmana Bot is Locked*\n\nPlease enter the 4-digit security PIN to unlock the bot:\n\n*Entered:* [ ${displayPin.trim()} ]`
  const markup = getPinKeyboardMarkup(currentPin.length)
  
  if (messageId) {
    await editTelegramMessage(chatId, messageId, text, markup)
  } else {
    await sendTelegramMessage(chatId, text, markup)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('Telegram webhook payload:', JSON.stringify(body))

    const message = body.message
    const callbackQuery = body.callback_query

    const chatId = message ? message.chat.id : (callbackQuery ? callbackQuery.message.chat.id : null)
    if (!chatId) {
      return NextResponse.json({ ok: true })
    }

    // 1. Authorize Chat ID
    if (!ALLOWED_CHAT_IDS.includes(chatId)) {
      await sendTelegramMessage(chatId, '🚫 *Access Denied:* You are not authorized to use this bot.')
      return NextResponse.json({ ok: true })
    }

    // 2. Handle PIN Keyboard Callback Queries (Unlocked screen checks)
    if (callbackQuery) {
      const data: string = callbackQuery.data
      const callbackQueryId = callbackQuery.id
      const messageId = callbackQuery.message.message_id
      
      // Check if session is already unlocked
      const isUnlocked = await checkIsUnlocked(chatId)

      if (data.startsWith('pin_')) {
        let currentPin = pinCache.get(chatId) || ''
        const action = data.replace('pin_', '')

        if (action === 'clear') {
          pinCache.set(chatId, '')
          await sendLockMessage(chatId, messageId)
          await answerCallbackQuery(callbackQueryId, 'PIN Cleared')
        } else if (action === 'submit') {
          if (currentPin === TELEGRAM_PIN) {
            pinCache.set(chatId, '')
            await unlockSession(chatId)
            await editTelegramMessage(chatId, messageId, '🔓 *Bot Unlocked Successfully!* Session active for 10 minutes.\n\nUse /summary or /workerpdf to proceed.')
            await answerCallbackQuery(callbackQueryId, 'Unlocked!')
          } else {
            pinCache.set(chatId, '')
            await sendTelegramMessage(chatId, '❌ *Incorrect PIN.* Please try again.')
            await sendLockMessage(chatId)
            await answerCallbackQuery(callbackQueryId, 'Incorrect PIN')
          }
        } else {
          // It's a digit 0-9
          if (currentPin.length < 4) {
            currentPin += action
            pinCache.set(chatId, currentPin)
          }
          await sendLockMessage(chatId, messageId)
          await answerCallbackQuery(callbackQueryId)
        }
        return NextResponse.json({ ok: true })
      }

      // If locked and trying to click report buttons, redirect to PIN lock
      if (!isUnlocked) {
        await answerCallbackQuery(callbackQueryId, 'Session expired. Please unlock.')
        await sendLockMessage(chatId)
        return NextResponse.json({ ok: true })
      }

      // Handle weekly summary selection callback
      if (data.startsWith('sumweek_')) {
        const offset = Number(data.replace('sumweek_', ''))
        await answerCallbackQuery(callbackQueryId, 'Calculating...')
        await editTelegramMessage(chatId, messageId, '⏳ *Calculating Weekly Summary...* Please wait.')
        
        const start = startOfWeek(subWeeks(new Date(), offset), { weekStartsOn: 0 })
        const end = endOfWeek(subWeeks(new Date(), offset), { weekStartsOn: 0 })
        const summaryMsg = await getWeeklySummaryMessage(start, end)
        await editTelegramMessage(chatId, messageId, summaryMsg)
        return NextResponse.json({ ok: true })
      }

      // Handle worker PDF week selection callback
      if (data.startsWith('pdfweek_')) {
        const offset = Number(data.replace('pdfweek_', ''))
        await answerCallbackQuery(callbackQueryId, 'Loading workers...')
        
        const start = startOfWeek(subWeeks(new Date(), offset), { weekStartsOn: 0 })
        const end = endOfWeek(subWeeks(new Date(), offset), { weekStartsOn: 0 })
        const startStr = format(start, 'yyyy-MM-dd')
        const endStr = format(end, 'yyyy-MM-dd')

        const { data: att } = await supabase
          .from('attendance')
          .select('labour_id, labour(name)')
          .gte('date', startStr)
          .lte('date', endStr)

        if (!att || att.length === 0) {
          await editTelegramMessage(chatId, messageId, `🤷‍♂️ *No workers registered attendance for the week:* ${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`)
          return NextResponse.json({ ok: true })
        }

        const uniqueWorkers = new Map<string, string>()
        att.forEach((r: any) => {
          if (r.labour) uniqueWorkers.set(r.labour_id, r.labour.name)
        })

        const buttons = Array.from(uniqueWorkers.entries()).map(([id, name]) => {
          return [{ text: name, callback_data: `workerpdf_${id}_${startStr}_${endStr}` }]
        })

        await editTelegramMessage(chatId, messageId, `👷 *Workers Active (${format(start, 'dd MMM')} - ${format(end, 'dd MMM')}):*\nSelect a worker to generate and download their Salary Slip PDF:`, {
          inline_keyboard: buttons
        })
        return NextResponse.json({ ok: true })
      }

      // Handle worker PDF generation trigger
      if (data.startsWith('workerpdf_')) {
        const parts = data.split('_') // [workerpdf, id, startDate, endDate]
        const workerId = parts[1]
        const startDate = parts[2]
        const endDate = parts[3]

        await answerCallbackQuery(callbackQueryId, 'Generating PDF...')
        await sendTelegramMessage(chatId, '⏳ *Generating Salary Slip PDF...* Please wait.')
        
        try {
          const { pdfBuffer, filename } = await generateWorkerPDFBuffer(workerId, startDate, endDate)
          await sendTelegramDocument(chatId, filename, pdfBuffer)
        } catch (err: any) {
          await sendTelegramMessage(chatId, `❌ *Error generating PDF:* ${err.message}`)
        }
        return NextResponse.json({ ok: true })
      }
    }

    // 3. Handle Text Commands
    if (message && message.text) {
      const text: string = message.text.trim()
      
      if (text === '/start') {
        pinCache.set(chatId, '')
        await sendLockMessage(chatId)
        return NextResponse.json({ ok: true })
      }

      // Check unlock status for regular commands
      const isUnlocked = await checkIsUnlocked(chatId)
      if (!isUnlocked) {
        pinCache.set(chatId, '')
        await sendLockMessage(chatId)
        return NextResponse.json({ ok: true })
      }

      if (text === '/summary') {
        const markup = getWeekSelectorKeyboard('sumweek')
        await sendTelegramMessage(chatId, '📊 *Select the week for the Site Summary:*', markup)
      } else if (text === '/workerpdf') {
        const markup = getWeekSelectorKeyboard('pdfweek')
        await sendTelegramMessage(chatId, '👷 *Select the week for the Worker PDFs:*', markup)
      } else if (text === '/lock') {
        await lockSession(chatId)
        await sendTelegramMessage(chatId, '🔒 *Session Locked.*')
      } else {
        await sendTelegramMessage(chatId, '❓ *Unknown Command.* Available commands:\n\n📊 /summary - Weekly site totals\n👷 /workerpdf - Download salary slips\n🔒 /lock - Log out')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Weekly Summary Builder ───────────────────────────
async function getWeeklySummaryMessage(start: Date, end: Date): Promise<string> {
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  const [{ data: att }, { data: mat }, { data: inc }, { data: contractPayments }] = await Promise.all([
    supabase.from('attendance').select('*, labour(name, type, daily_rate)').gte('date', startStr).lte('date', endStr),
    supabase.from('materials').select('total_amount').gte('date', startStr).lte('date', endStr),
    supabase.from('income').select('amount').gte('date', startStr).lte('date', endStr),
    supabase.from('contractor_payments').select('*')
  ])

  // 1. Group workers and calculate totals
  const workerCounts: Record<string, Set<string>> = { 'Skilled Labour': new Set(), 'Labour': new Set(), 'Helper': new Set() }
  let labourWages = 0
  let totalAdvances = 0
  const notesList: string[] = []

  att?.forEach((r: any) => {
    if (!r.labour) return
    
    // Group categories
    const rawType = r.labour.type || 'Labour'
    let category = 'Labour'
    if (rawType.toLowerCase().includes('skilled') || rawType.toLowerCase().includes('mason') || rawType.toLowerCase().includes('carpenter')) {
      category = 'Skilled Labour'
    } else if (rawType.toLowerCase().includes('helper')) {
      category = 'Helper'
    }
    workerCounts[category].add(r.labour.name)

    // Calculate wages
    const rate = r.custom_rate || r.labour.daily_rate || 0
    labourWages += (Number(r.days_worked || 0) * rate) + Number(r.overtime_amount || 0)
    totalAdvances += Number(r.advance_amount || 0)

    if (r.notes && r.notes.trim()) {
      notesList.push(r.notes.trim())
    }
  })

  // 2. Materials total
  const materialsCost = mat?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0

  // 3. Income total
  const incomeReceived = inc?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0

  // 4. Contractor payouts this week
  let contractorWages = 0
  contractPayments?.forEach((sub: any) => {
    const installments = sub.installments || []
    installments.forEach((inst: any) => {
      if (inst.date >= startStr && inst.date <= endStr) {
        contractorWages += Number(inst.amount || 0)
      }
    })
  })

  const uniqueNotes = Array.from(new Set(notesList)).slice(0, 5)
  const workCompletedNotes = uniqueNotes.length > 0 
    ? uniqueNotes.map(n => `• ${n}`).join('\n') 
    : '• No progress notes recorded.'

  return `📊 *Nirmana Site Summary (This Week)*\n_Period: ${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}_\n\n` +
         `*👷 Crew Attendance (Active):*\n` +
         `• *Skilled Labours:* ${workerCounts['Skilled Labour'].size} workers\n` +
         `• *Labours:* ${workerCounts['Labour'].size} workers\n` +
         `• *Helpers:* ${workerCounts['Helper'].size} workers\n\n` +
         `*💰 Financials (This Week):*\n` +
         `• *Labour Wages Earned:* ₹${labourWages.toLocaleString('en-IN')}\n` +
         `• *Labour Advances Paid:* ₹${totalAdvances.toLocaleString('en-IN')}\n` +
         `• *Contractor Payouts:* ₹${contractorWages.toLocaleString('en-IN')}\n` +
         `• *Materials Expenses:* ₹${materialsCost.toLocaleString('en-IN')}\n` +
         `• *Collections / Income:* ₹${incomeReceived.toLocaleString('en-IN')}\n\n` +
         `*📝 Work Logs / Notes:*\n${workCompletedNotes}`
}

// ── Send Worker PDF List ────────────────────────────
async function sendWorkerPDFOptions(chatId: number) {
  const start = startOfWeek(new Date(), { weekStartsOn: 0 })
  const end = endOfWeek(new Date(), { weekStartsOn: 0 })
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  // Fetch workers who attended this week
  const { data: att } = await supabase
    .from('attendance')
    .select('labour_id, labour(name)')
    .gte('date', startStr)
    .lte('date', endStr)

  if (!att || att.length === 0) {
    await sendTelegramMessage(chatId, '🤷‍♂️ *No workers registered attendance this week.*')
    return
  }

  // Deduplicate workers
  const uniqueWorkers = new Map<string, string>()
  att.forEach((r: any) => {
    if (r.labour) uniqueWorkers.set(r.labour_id, r.labour.name)
  })

  const buttons = Array.from(uniqueWorkers.entries()).map(([id, name]) => {
    return [{ text: name, callback_data: `pdf_${id}` }]
  })

  await sendTelegramMessage(chatId, '👷 *Select a worker below to generate and download their Salary Slip PDF:*', {
    inline_keyboard: buttons
  })
}

// ── Generate Individual Worker PDF Buffer on Server ────
async function generateWorkerPDFBuffer(workerId: string, startDate: string, endDate: string): Promise<{ pdfBuffer: Uint8Array; filename: string }> {
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  const [{ data: worker }, { data: attData }, { data: payData }] = await Promise.all([
    supabase.from('labour').select('*').eq('id', workerId).single(),
    supabase.from('attendance').select('*, projects(name)').eq('labour_id', workerId).gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
    supabase.from('payments').select('*').eq('labour_id', workerId).gte('date', startDate).lte('date', endDate).eq('payment_type', 'ADVANCE')
  ])

  if (!worker || !attData || attData.length === 0) {
    throw new Error('Worker profile or weekly attendance not found.')
  }

  const project = attData[0].projects
  const breakdown = attData.map((att: any) => {
    const rate = att.custom_rate || worker.daily_rate || 0
    const baseWage = Number(att.days_worked || 0) * Number(rate)
    const otAmount = Number(att.overtime_amount || 0)
    const advance = Number(att.advance_amount || 0)
    return {
      date: att.date,
      project: att.projects?.name || '—',
      status: att.days_worked === 1 ? 'PRESENT' : att.days_worked === 0.5 ? 'HALF_DAY' : 'ABSENT',
      baseWage,
      overtimeAmount: otAmount,
      advance,
      total: baseWage + otAmount,
      giveable: baseWage + otAmount - advance,
      notes: att.notes
    }
  })

  const totalDays = attData.reduce((acc, curr) => acc + Number(curr.days_worked), 0)
  const totalOTAmount = attData.reduce((acc, curr) => acc + Number(curr.overtime_amount || 0), 0)
  const totalWages = attData.reduce((acc, att) => {
    const rate = att.custom_rate || worker.daily_rate
    return acc + (Number(att.days_worked) * Number(rate))
  }, 0)
  const attAdvances = attData.reduce((acc, att) => acc + Number(att.advance_amount || 0), 0)
  const payAdvances = payData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  const totalAdvances = attAdvances + payAdvances
  const netPayable = totalWages + totalOTAmount - totalAdvances

  const hasOT = totalOTAmount > 0
  const tableHeight = (breakdown.length + 1) * 8.5
  const summaryBoxH = 20
  const requiredHeight = 44 + 16 + tableHeight + 10 + summaryBoxH + 18 + 24 + 10 + 14
  const pageHeight = Math.max(160, requiredHeight)

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: [210, pageHeight]
  })

  drawPremiumHeader(doc, 'LABOUR WEEKLY REPORT', '(INDIVIDUAL)')

  let y = 54
  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('Worker Name', 14, y); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.name}`, 40, y)
  doc.setFont('helvetica', 'bold'); doc.text('Role', 14, y + 6); doc.setFont('helvetica', 'normal'); doc.text(`: ${worker.type || 'N/A'}`, 40, y + 6)
  
  doc.setFont('helvetica', 'bold'); doc.text('Date Range', 110, y)
  doc.setFont('helvetica', 'normal'); doc.text(`: ${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`, 140, y)
  doc.setFont('helvetica', 'bold'); doc.text('Report Date', 110, y + 6)
  doc.setFont('helvetica', 'normal'); doc.text(`: ${format(new Date(), 'dd MMM yyyy')}`, 140, y + 6)

  const head = hasOT 
    ? [['Date', 'Status', 'Wages on the day', 'OT Amount', 'Deduction', 'Giveable Amount', 'Grand Total']]
    : [['Date', 'Status', 'Wages on the day', 'Deduction', 'Giveable Amount', 'Grand Total']]

  const body = breakdown.map((r: any) => {
    const row = [
      format(new Date(r.date), 'EEEE (dd MMM)'),
      r.status,
      `Rs. ${(r.baseWage || 0).toLocaleString('en-IN')}`,
    ]
    if (hasOT) {
      row.push(r.overtimeAmount > 0 ? `Rs. ${(r.overtimeAmount || 0).toLocaleString('en-IN')}` : '-')
    }
    row.push(
      r.advance > 0 ? `Rs. ${(r.advance || 0).toLocaleString('en-IN')}` : '-',
      `Rs. ${(r.giveable || 0).toLocaleString('en-IN')}`,
      `Rs. ${(r.total || 0).toLocaleString('en-IN')}`
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
        drawPremiumHeader(doc, 'LABOUR WEEKLY REPORT (CONT.)', '(INDIVIDUAL)')
      }
      drawPremiumFooter(doc)
    },
    margin: { top: 50, left: 14, right: 14, bottom: 20 },
    didParseCell: (cellData) => {
      const deductionColIdx = hasOT ? 4 : 3
      const giveableColIdx = hasOT ? 5 : 4
      const grandTotalColIdx = hasOT ? 6 : 5
      if (cellData.section === 'body') {
        if (cellData.column.index === 1) {
          const val = cellData.cell.text[0]
          if (val === 'PRESENT') cellData.cell.styles.textColor = [34, 197, 94]
          else if (val === 'ABSENT') cellData.cell.styles.textColor = [239, 68, 68]
          else if (val === 'HALF_DAY') cellData.cell.styles.textColor = [245, 158, 11]
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

  if (finalY + summaryBoxH > H - 25) {
    doc.addPage()
    drawPremiumHeader(doc, 'LABOUR WEEKLY REPORT (CONT.)', '(INDIVIDUAL)')
    drawPremiumFooter(doc)
    finalY = 50
  }

  const boxW = hasOT ? 45 : 60
  const boxH = 20
  const isNeg = netPayable < 0
  const boxes = [
    { l: 'Total Payment', v: `Rs. ${(totalWages + totalOTAmount).toLocaleString('en-IN')}` },
    { l: 'Deduction', v: `Rs. ${(totalAdvances).toLocaleString('en-IN')}` },
    { l: isNeg ? 'WORKER OWES' : 'GIVEABLE AMOUNT', v: `Rs. ${Math.abs(netPayable).toLocaleString('en-IN')}`, hi: true }
  ]

  boxes.forEach((b, i) => {
    const bx = 14 + (i * (boxW + 3))
    if (b.hi && isNeg) { doc.setFillColor(...PDF_COLORS.RED); doc.setTextColor(255, 255, 255) }
    else if (b.hi) { doc.setFillColor(...PDF_COLORS.BLUE); doc.setTextColor(255, 255, 255) }
    else { doc.setFillColor(240, 245, 255); doc.setTextColor(...PDF_COLORS.NAVY) }
    doc.roundedRect(bx, finalY, boxW, boxH, 1, 1, 'F')
    doc.setFontSize(7); doc.text(b.l, bx + boxW / 2, finalY + 6, { align: 'center' })
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(b.v, bx + boxW / 2, finalY + 14, { align: 'center' })
  })

  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFontSize(8); doc.text('Amount in Words:', 14, finalY + boxH + 8)
  doc.setFont('helvetica', 'italic'); doc.text(numberToWords(Math.abs(netPayable)), 42, finalY + boxH + 8)

  const sigY = H - 48
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PDF_COLORS.NAVY)
  doc.setFontSize(8)
  
  // Dynamic signature company name
  doc.text('FOR ' + (typeof window !== 'undefined' ? localStorage.getItem('ssc_company_name') || 'SRI SAI CONSTRUCTIONS' : 'SRI SAI CONSTRUCTIONS'), 160, sigY + 5, { align: 'center' })

  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  
  // Dynamic signature contractor name
  const contractorName = typeof window !== 'undefined' ? localStorage.getItem('ssc_contractor_name') || 'Cheveli Somaiah' : 'Cheveli Somaiah'
  doc.text(contractorName, 160, sigY + 16, { align: 'center' })
  doc.line(140, sigY + 18, 180, sigY + 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7); doc.text('Authorized Signatory', 160, sigY + 22, { align: 'center' })

  drawPremiumFooter(doc)

  const pdfArrayBuffer = doc.output('arraybuffer')
  const pdfBuffer = new Uint8Array(pdfArrayBuffer)
  const safeName = worker.name.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `${safeName}_Receipt_${startDate}_to_${endDate}.pdf`

  return { pdfBuffer, filename }
}
