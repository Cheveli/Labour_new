import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

interface VoiceSessionState {
  mode: 'material' | 'attendance' | 'expense' | 'payment' | 'worker' | 'navigation' | null;
  project_id: string | null;
  date: string | null;
  status: 'collecting' | 'confirming' | 'completed' | 'failed' | null;
  material?: {
    material_name: string | null;
    quantity: number | null;
    unit: string | null;
    cost_per_unit: number | null;
    supplier_name: string | null;
  } | null;
  attendance?: {
    records: Array<{
      labour_id: string;
      labour_name: string;
      status: 'P' | 'H' | 'A';
      overtime_amount?: number;
      advance_amount?: number;
    }>;
  } | null;
  expense?: {
    person_name: string | null;
    purpose: string | null;
    amount: number | null;
  } | null;
  payment?: {
    labour_id: string | null;
    labour_name: string | null;
    amount: number | null;
    payment_type: 'REGULAR' | 'ADVANCE' | null;
  } | null;
  worker?: {
    name: string | null;
    type: string | null;
    daily_rate: number | null;
    phone: string | null;
  } | null;
}

// Helper to write logs to logs/voice_assistant.log
function writeVoiceLog(data: {
  userSpeechText: string;
  currentState: any;
  updatedSlots: any;
  parsedResponse: any;
  dbRequest: any;
  dbResponse: any;
  error: string | null;
}) {
  try {
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    const logFile = path.join(logDir, 'voice_assistant.log')
    const logEntry = {
      timestamp: new Date().toISOString(),
      rawSpeech: data.userSpeechText,
      stateBefore: data.currentState,
      stateAfter: data.updatedSlots,
      aiInterpretation: data.parsedResponse || null,
      databaseRequest: data.dbRequest || null,
      databaseResponse: data.dbResponse || null,
      error: data.error || null
    }
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8')
  } catch (err) {
    console.error('Failed to write log file:', err)
  }
}

// Database helper
async function performDatabaseInsert(supabase: any, slots: VoiceSessionState, todayStr: string, labourers: any) {
  if (slots.mode === 'material' && slots.material) {
    const mat = slots.material
    const qty = Number(mat.quantity || 0)
    const cpu = Number(mat.cost_per_unit || 0)
    const total = qty * cpu
    
    const notes = [
      mat.supplier_name ? `Supplier: ${mat.supplier_name}` : '',
      `Material Amount: Rs.${total}`
    ].filter(Boolean).join(' | ')

    const { data, error } = await supabase.from('materials').insert([
      {
        project_id: slots.project_id,
        name: mat.material_name,
        quantity: qty,
        unit: mat.unit || 'bags',
        cost_per_unit: cpu,
        total_amount: total,
        notes: notes || null,
        date: slots.date || todayStr
      }
    ]).select()

    if (error) throw error
    return data
  } 
  
  if (slots.mode === 'attendance' && slots.attendance?.records) {
    const records = slots.attendance.records
    const dateVal = slots.date || todayStr

    const workerIds = records.map(r => r.labour_id)
    const { error: deleteError } = await supabase.from('attendance')
      .delete()
      .eq('project_id', slots.project_id)
      .eq('date', dateVal)
      .in('labour_id', workerIds)
    if (deleteError) throw deleteError

    const inserts = records.map(r => {
      const workerInfo = labourers?.find((l: any) => l.id === r.labour_id)
      const rate = workerInfo?.daily_rate || 0

      return {
        labour_id: r.labour_id,
        project_id: slots.project_id,
        date: dateVal,
        days_worked: r.status === 'P' ? 1 : r.status === 'H' ? 0.5 : 0,
        overtime_hours: 0,
        overtime_amount: r.overtime_amount || 0,
        custom_rate: rate,
        advance_amount: r.advance_amount || 0
      }
    })

    const { data, error } = await supabase.from('attendance').insert(inserts).select()
    if (error) throw error
    return data
  }

  if (slots.mode === 'expense' && slots.expense) {
    const exp = slots.expense
    const { data, error } = await supabase.from('personal_expenses').insert([
      {
        person_name: exp.person_name,
        purpose: exp.purpose,
        amount: Number(exp.amount),
        date: slots.date || todayStr
      }
    ]).select()
    if (error) throw error
    return data
  }

  if (slots.mode === 'payment' && slots.payment) {
    const pay = slots.payment
    const { data, error } = await supabase.from('payments').insert([
      {
        labour_id: pay.labour_id,
        amount: Number(pay.amount),
        payment_type: pay.payment_type || 'REGULAR',
        date: slots.date || todayStr,
        notes: 'Voice assistant entry'
      }
    ]).select()
    if (error) throw error
    return data
  }

  if (slots.mode === 'worker' && slots.worker) {
    const wrk = slots.worker
    const { data, error } = await supabase.from('labour').insert([
      {
        name: wrk.name,
        type: wrk.type || 'Labour (Unskilled)',
        daily_rate: Number(wrk.daily_rate),
        phone: wrk.phone,
        gender: 'Male'
      }
    ]).select()
    if (error) throw error
    return data
  }

  throw new Error(`Unsupported mode for database insert: ${slots.mode}`)
}

export async function POST(req: Request) {
  const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  let inputSpeech = ''
  let stateBeforeLog: any = null

  try {
    const { userSpeechText, currentState } = await req.json()
    inputSpeech = userSpeechText
    stateBeforeLog = currentState

    const supabase = await createClient()

    // 1. Fetch active projects and labourers for context mapping
    const [{ data: projects }, { data: labourers }] = await Promise.all([
      supabase.from('projects').select('id, name'),
      supabase.from('labour').select('id, name, type, daily_rate')
    ])

    // 1.1 Handle user direct buttons (confirm_save_action / retry_save)
    if ((userSpeechText === 'confirm_save_action' || userSpeechText === 'retry_save') && currentState) {
      try {
        const slotsToSave = { ...currentState }
        const dbResult = await performDatabaseInsert(supabase, slotsToSave, todayStr, labourers)
        
        writeVoiceLog({
          userSpeechText,
          currentState,
          updatedSlots: { ...slotsToSave, status: 'completed' },
          parsedResponse: { summary: `Action: ${userSpeechText}` },
          dbRequest: slotsToSave,
          dbResponse: dbResult,
          error: null
        })

        let successText = 'విజయవంతంగా సేవ్ చేసినా భాయ్!'
        if (slotsToSave.mode === 'material') successText = 'మెటీరియల్ విజయవంతంగా సేవ్ చేసినా భాయ్.'
        else if (slotsToSave.mode === 'attendance') successText = 'అటెండెన్స్ విజయవంతంగా మార్క్ చేసినా భాయ్.'
        else if (slotsToSave.mode === 'expense') successText = 'ఖర్చు వివరాలు విజయవంతంగా రికార్డు చేసినా భాయ్.'
        else if (slotsToSave.mode === 'payment') successText = 'పేమెంట్ విజయవంతంగా సేవ్ చేసినా భాయ్.'
        else if (slotsToSave.mode === 'worker') successText = 'కొత్త వర్కర్ రికార్డును విజయవంతంగా క్రియేట్ చేసినా భాయ్.'

        return NextResponse.json({
          slots: {
            mode: null,
            project_id: null,
            date: todayStr,
            status: 'completed'
          },
          replyText: successText,
          isComplete: true
        })
      } catch (dbErr: any) {
        console.error("Manual action DB error:", dbErr)
        writeVoiceLog({
          userSpeechText,
          currentState,
          updatedSlots: { ...currentState, status: 'failed' },
          parsedResponse: null,
          dbRequest: currentState,
          dbResponse: null,
          error: dbErr.message || 'Database insert failed'
        })
        return NextResponse.json({
          slots: { ...currentState, status: 'failed' },
          replyText: 'క్షమించండి, సేవ్ చేయడం ఫెయిల్ అయింది. దయచేసి మళ్ళీ ట్రై చేయండి.',
          isComplete: false,
          dbError: true
        })
      }
    }

    // 2. Prepare the system prompt for natural language slot extraction
    const systemPrompt = `
You are the Conversational AI slot-filling assistant for "Nirmana" (Sri Sai Constructions), a contractor logging system.
Your job is to parse Telangana Telugu voice speech and extract fields to log to the database.

CRITICAL SAFETY RULE:
- NEVER perform a write directly without confirmation.
- If all slots for a mode are completed, you MUST transition "status" to "confirming", keep "isComplete" as false, and present a structured "Preview" of the extracted values in English/Telugu inside your response message, followed by asking: "Confirm/Save చేయమంటావా, భాయ్?" or "సేవ్ చేయాలా?".
- Only transition "status" to "completed" and "isComplete" to true when the user says confirmation words (e.g. "Avunu", "Sare", "Yes", "Confirm", "Save", "avundhi", "sarele", "okay") while in the "confirming" state.

CONVERSATION STATE MACHINE:
- "status" can be "collecting", "confirming", "completed" or "failed".
- If "status" is "confirming" and the user says a confirmation word: set "status" to "completed" and "isComplete" to true.
- If "status" is "confirming" and the user corrects a detail (e.g., "quantity 50 kadu 40 bags" or "Ramesh rale"): update the slot, set "status" to "collecting" (or back to "confirming" if fully parsed), and set "isComplete" to false.
- If "status" is "confirming" and the user says no / cancels: clear all slots, set "mode" to null, "status" to "collecting", and "isComplete" to false.

MODES & REQUIRED SLOTS:
1. "navigation": Used when the user requests to navigate pages (e.g., "materials open cheyyi", "attendance list vellu").
   - Navigation links available:
     - Overview / Dashboard: "/"
     - Workforce / Workers: "/labour"
     - Attendance: "/attendance"
     - Materials: "/materials"
     - Payments: "/payments"
     - Reports: "/reports"
     - Export Calculation: "/export-calculation"
     - Revenue / Income: "/income"
     - Extra Work: "/extra-work"
     - Contractor Payments: "/contractor-payments"
     - Projects: "/projects"
     - Contacts: "/contacts"
     - Personal Expenses: "/personal-expenses"
   - Action: set "mode" to "navigation", extract "redirectUrl" matching one of these paths. Set "isComplete" to true and "status" to "completed". Reply with: "Opening [Page name] page...".
2. "material":
   - Required slots: project_id (from PROJECTS LIST), material_name, quantity, cost_per_unit.
   - Optional slots: unit (default 'bags'), supplier_name.
3. "attendance":
   - Required slots: project_id (from PROJECTS LIST), date (default: ${todayStr}), records (array of worker details with labour_id from LABOURERS LIST, labour_name, status: "P" (Present) / "H" (Half day) / "A" (Absent)).
   - Special Rule: If user says "migatha andharu absent" or "others absent", map all workers in the LABOURERS LIST not explicitly mentioned to status "A".
4. "expense":
   - Required slots: person_name, purpose, amount.
5. "payment":
   - Required slots: labour_id (from LABOURERS LIST), amount, payment_type ("REGULAR" or "ADVANCE").
6. "worker":
   - Required slots: name, type ("Mistry (Skilled)" or "Labour (Unskilled)" or "Helper"), daily_rate, phone.

CONSTRUCTION MATERIAL & UNIT DICTIONARY (Convert spoken Telangana terms to standard English name/unit):
- Sand -> ఇసుక (isuka), ఎసుక (esuka), యసుక (yesuka), eska, iska, sand, ఎసక
- Coarse Aggregate -> కంకర (kankara), కమ్కర (kamkara), కంకర్ (kankar), gravel, aggregate, మెటల్, 20mm jalli, 40mm jalli
- Aggregate -> జల్లి (jalli), chips, చిప్స్
- Cement -> సిమెంట్ (cement), సిమెంటు (cementu), sement, cement bags
- Steel -> స్టీల్ (steel), ఇనుము (inumu), రాడ్లు (rodlu), రడ్లు, కడ్డీలు (kaddeelu), rod, iron, binding wire, బైండింగ్ వైర్
- Bricks -> ఇటుకలు (itukalu), బ్రిక్స్, బిరిక్స్, ఎర్ర ఇటుకలు, fly ash bricks, hollow blocks
- Water -> నీళ్ళు (neellu), నీళ్లు, వాటర్, tanker
- Concrete -> కాంక్రీట్, concrete, concrit, konkret
- Stone Dust -> డస్ట్ (dust), స్టోన్ డస్ట్, dust, ఇసుక డస్ట్
- Wood/Timber -> కలప (kalapa), కర్ర (karra), wood, plywood
- Tiles/Granite -> టైల్స్ (tiles), బండలు (bandalu), మార్బుల్స్, గ్రానైట్, శహాబాద్ బండలు
- Paint -> పెయింట్ (paint), rangulu, sunnam
- Pipes/Plumbing -> పైపులు, pipe, PVC pipes
- Electricals -> వైర్లు, wire, cables

UNITS MAPPING:
- bags -> బ్యాగులు (bagulu), బస్తాలు (bastalu), సంచులు (sanchulu), bags, basta, bastha
- loads -> లోడ్స్ (loads), లోడు (loadu), బండి (bandi), loads, tractor load, truck load
- units -> యూనిట్లు, unit
- brass -> బ్రాస్
- cft -> cubic feet, సీఎఫ్టీ
- kgs -> కేజీలు (kg-lu), కిలోలు (kilolu), kgs, kg, ton, టన్నులు
- liters -> లీటర్లు, liters, tanker
- pieces -> numbers, pieces, nos, peesulu

TELANGANA TELUGU GRAMMAR & DIALECT CONSTRAINTS:
- formulate "nextQuestion" in authentic Telangana Telugu.
- Use "-నా" endings for successful actions: "మార్క్ చేసినా", "సేవ్ చేసినా", "యాడ్ చేసినా".
- Use "-లి" or "-మంటావ్" or "-దాం" for future / questions: "చేయాలి" / "చేయమంటావ్" / "చేద్దాం".
- NEVER use "-లె" endings (e.g. DO NOT say "చేయాలె", "యాడ్ చేయాలె", "రికార్డు చేయాలె", "కావాలె"). Use "చేయాలి", "యాడ్ చేయాలి", "కావాలి" instead.

CURRENT DATE: ${todayStr}

PROJECTS LIST:
${JSON.stringify(projects || [], null, 2)}

LABOURERS (WORKERS) LIST:
${JSON.stringify(labourers || [], null, 2)}

RESPONSE JSON FORMAT ONLY:
Return a RAW JSON object ONLY. Do not wrap in markdown code blocks.
{
  "slots": <updated_slots_object>,
  "nextQuestion": "<next_question_in_telangana_slang>",
  "isComplete": <boolean>,
  "summary": "<english_summary_of_updates>",
  "redirectUrl": "<url_if_navigation_else_null>"
}
`

    const userPrompt = `
LATEST USER SPEECH: "${userSpeechText}"
CURRENT STATE: ${JSON.stringify(currentState || { mode: null, project_id: null, date: todayStr, status: 'collecting' })}
`

    // 3. Invoke the NVIDIA LLM API
    const llmRes = await fetch(`${process.env.NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1024
      })
    })

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      throw new Error(`LLM request failed: ${errText}`)
    }

    const llmJson = await llmRes.json()
    const rawContent = llmJson.choices?.[0]?.message?.content || ''

    // 4. Parse the LLM's JSON response safely (strip markdown backticks if any)
    const jsonString = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim()
    let parsedResponse
    try {
      parsedResponse = JSON.parse(jsonString)
    } catch (parseErr) {
      console.error("Failed to parse LLM JSON output:", rawContent)
      throw new Error("Invalid response format from AI model")
    }

    const { slots: updatedSlots, nextQuestion, isComplete, redirectUrl } = parsedResponse as {
      slots: VoiceSessionState;
      nextQuestion: string;
      isComplete: boolean;
      summary: string;
      redirectUrl: string | null;
    }

    let dbResult: any = null
    let errorMsg: string | null = null

    // 5. If marked complete by LLM, execute database write
    if (isComplete && updatedSlots.status === 'completed') {
      try {
        dbResult = await performDatabaseInsert(supabase, updatedSlots, todayStr, labourers)
        
        // Reset slots after successful log (keep basic properties)
        const completedSlots = {
          mode: null,
          project_id: null,
          date: todayStr,
          status: 'completed'
        }
        
        writeVoiceLog({
          userSpeechText,
          currentState,
          updatedSlots: completedSlots,
          parsedResponse,
          dbRequest: updatedSlots,
          dbResponse: dbResult,
          error: null
        })

        return NextResponse.json({
          slots: completedSlots,
          replyText: nextQuestion,
          isComplete: true,
          redirectUrl
        })
      } catch (dbErr: any) {
        console.error("Voice Log Database Insertion Failed:", dbErr)
        errorMsg = dbErr.message || 'Database write error'
        const failedSlots = { ...updatedSlots, status: 'failed' as const }
        
        writeVoiceLog({
          userSpeechText,
          currentState,
          updatedSlots: failedSlots,
          parsedResponse,
          dbRequest: updatedSlots,
          dbResponse: null,
          error: errorMsg
        })

        return NextResponse.json({
          slots: failedSlots,
          replyText: 'క్షమించండి, డేటాబేస్ సేవ్ చేయడం ఫెయిల్ అయింది. దయచేసి మళ్ళీ ట్రై చేయండి.',
          isComplete: false,
          dbError: true
        })
      }
    }

    // If it's a redirect / navigation command that is complete
    if (isComplete && updatedSlots.mode === 'navigation' && redirectUrl) {
      writeVoiceLog({
        userSpeechText,
        currentState,
        updatedSlots: { mode: null, project_id: null, date: todayStr, status: 'completed' },
        parsedResponse,
        dbRequest: null,
        dbResponse: null,
        error: null
      })

      return NextResponse.json({
        slots: {
          mode: null,
          project_id: null,
          date: todayStr,
          status: 'completed'
        },
        replyText: nextQuestion,
        isComplete: true,
        redirectUrl
      })
    }

    // Default flow: slots collection or confirming state
    writeVoiceLog({
      userSpeechText,
      currentState,
      updatedSlots,
      parsedResponse,
      dbRequest: null,
      dbResponse: null,
      error: null
    })

    return NextResponse.json({
      slots: updatedSlots,
      replyText: nextQuestion,
      isComplete: false
    })

  } catch (err: any) {
    console.error("Voice Log API Error:", err)
    writeVoiceLog({
      userSpeechText: inputSpeech,
      currentState: stateBeforeLog,
      updatedSlots: stateBeforeLog ? { ...stateBeforeLog, status: 'failed' } : null,
      parsedResponse: null,
      dbRequest: null,
      dbResponse: null,
      error: err.message || 'Internal Server Error'
    })
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
