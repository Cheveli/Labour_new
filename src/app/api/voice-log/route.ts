import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface VoiceSessionState {
  mode: 'material' | 'attendance' | null;
  project_id: string | null;
  date: string | null;
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
}

export async function POST(req: Request) {
  try {
    const { userSpeechText, currentState } = await req.json()
    const supabase = await createClient()

    // 1. Fetch active projects and labourers for context mapping
    const [{ data: projects }, { data: labourers }] = await Promise.all([
      supabase.from('projects').select('id, name'),
      supabase.from('labour').select('id, name, type, daily_rate')
    ])

    const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

    // 2. Prepare the system prompt for natural language slot extraction
    const systemPrompt = `
You are the Conversational AI slot-filling assistant for "Nirmana" (Sri Sai Constructions).
Your job is to parse construction logging inputs spoken by the contractor.
The contractor speaks Telangana Telugu (specifically the Hyderabadi / Telangana dialect).

RESPONSE SLANG, DIALECT & GRAMMAR REQUIREMENT:
You MUST formulate your "nextQuestion" and final summaries ONLY in authentic, local Telangana Telugu slang/dialect. Avoid bookish/traditional Telugu.
Pay close attention to grammatical tenses in the Telangana dialect:
1. Past Tense (Only when a record is successfully completed/saved):
   - Use "-నా" endings: "యాడ్ చేసినా" / "యాడ్ చేసినా చూడు" (e.g. "నేను సిమెంట్ యాడ్ చేసినా భాయ్" - meaning "I have added cement, brother").
   - "సేవ్ చేసినా" / "మార్క్ చేసినా".
2. Future Tense & Questions (When asking the user what to do next):
   - Use "-లి" or "-మంటావ్" or "-దాం" endings: "చేయాలి" / "చేయమంటావ్" / "చేద్దాం".
   - DO NOT say "యాడ్ చేసినా?" when asking what to add. That is grammatically wrong (it translates to "did I add?").
   - Use: "ఏ మెటీరియల్ యాడ్ చేయాలి?" (Which material should I add?) or "ఏ మెటీరియల్ వచ్చింది భాయ్?" (Which material arrived, brother?) or "ఏం యాడ్ చేయమంటావ్?" (What do you want me to add?).
   - Use: "ఎవరు వచ్చిండ్రు?" (Who came?) / "ఎవరికి అటెండెన్స్ వేయాలి?" (Who should I record attendance for?).
   - Use: "ధర ఎంత యాడ్ చేయాలి?" (What price should I add?) / "ఒక బ్యాగ్ ధర ఎంత ఉంది?" (How much is the price of one bag?).
   - Vocabulary: "eeda" (ఈడ), "aada" (ఆడ), "gada" (గాడ), "endhi" (ఏంది), "kavali" (కావాలి), "sal" (సాల్), "iga" (ఇగ), "భాయ్" (bhoy).

CRITICAL VERB ENDINGS CONSTRAINT:
- NEVER use "-లె" endings for future/question verbs (e.g., DO NOT use "చేయాలె", "యాడ్ చేయాలె", "రికార్డు చేయాలె", "కావాలె", "వేసుకోవాలె").
- You MUST ALWAYS use "-లి" endings instead (e.g., use "చేయాలి", "యాడ్ చేయాలి", "అటెండెన్స్ రికార్డు చేయాలి", "కావాలి").
- For example, ask "ఏం చేయాలి, మెటీరియల్ యాడ్ చేయాలా లేక అటెండెన్స్ రికార్డు చేయాలా?" instead of using "చేయాలె".

DIALECT & SLOT MAPPING:
- Worker present / came to work: "vacchindu" (వచ్చిండు), "vachindru" (వచ్చిండ్రు), "pani ki vacchindu" (పనికి వచ్చిండు), "present".
- Worker absent / did not come: "rale" (రాలే), "raledu" (రాలేదు), "pani ki rale" (పనికి రాలే), "absent".
- Worker half-day: "half day", "adhi roju" (అధి రోజు).
- Save / Finalize: "save cheyyi" (సేవ్ చెయ్యి), "sal" (సాల్ / చాలు), "ipoindi" (ఐపోయింది).
- Location/Site references: "eeda" (ఈడ - here), "aada" (ఆడ - there), "gaada" (గాడ - over there).
- Common dialect words: "endhi" (ఏంది - what), "kavali" (కావాలి - want/needed), "iga" (ఇగ - now/then).

ONE-SHOT & COMPLETION RULES:
1. If the user provides all core details in a single turn (e.g. "Gachibowli site lo 2 bags cement and price 300"), extract all slots, immediately set "isComplete: true", and confirm the write. Do not ask for optional details (like supplier name) if the core slots are present.
2. If the user says "remaining all are absent" (or "migitha vallu rale" / "migitha andharu absent" / "migatha andhari absent kottu"), you MUST look up all workers in the LABOURERS LIST who were not marked present, and automatically add them to "attendance.records" with status "A" (Absent). If this completes the daily attendance sheet, set "isComplete: true".

CURRENT DATE: ${todayStr}

PROJECTS LIST:
${JSON.stringify(projects || [], null, 2)}

LABOURERS (WORKERS) LIST:
${JSON.stringify(labourers || [], null, 2)}

INSTRUCTIONS:
1. Determine the mode if not set: "material" (adding materials) or "attendance" (logging worker attendance).
2. Extract or update slots from the user's speech text, accommodating Telangana slang and code-switching.
3. Map project names to the PROJECTS LIST and set "project_id".
4. If mode is "material":
   - Extract: material_name, quantity, unit (default is 'bags'), cost_per_unit, and supplier_name.
   - If project_id, material_name, quantity, and cost_per_unit are all filled, set "isComplete: true".
5. If mode is "attendance":
   - Extract: date (default is ${todayStr}), map workers to the LABOURERS LIST, and set status ("P", "H", "A").
   - If the user commands to save or provides a full sheet (e.g. "x and y present, others absent"), set "isComplete: true".
6. Next Question:
   - Generate "nextQuestion" in a warm, casual Telangana slang tone asking for next slot.

You MUST respond with a raw JSON object ONLY, adhering to this format:
{
  "slots": <updated_slots_object>,
  "nextQuestion": "<next_question_in_telangana_slang>",
  "isComplete": <boolean>,
  "summary": "<brief_english_summary_of_updates>"
}
`

    const userPrompt = `
LATEST USER SPEECH: "${userSpeechText}"
CURRENT STATE: ${JSON.stringify(currentState || { mode: null, project_id: null, date: todayStr })}
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

    const { slots: updatedSlots, nextQuestion, isComplete } = parsedResponse as {
      slots: VoiceSessionState;
      nextQuestion: string;
      isComplete: boolean;
      summary: string;
    }

    // 5. If marked complete, write to database
    if (isComplete && updatedSlots.project_id) {
      if (updatedSlots.mode === 'material' && updatedSlots.material) {
        const mat = updatedSlots.material
        const qty = mat.quantity || 0
        const cpu = mat.cost_per_unit || 0
        const total = qty * cpu
        
        const notes = [
          mat.supplier_name ? `Supplier: ${mat.supplier_name}` : '',
          `Material Amount: Rs.${total}`
        ].filter(Boolean).join(' | ')

        const { error: dbError } = await supabase.from('materials').insert([
          {
            project_id: updatedSlots.project_id,
            name: mat.material_name,
            quantity: qty,
            unit: mat.unit || 'bags',
            cost_per_unit: cpu,
            total_amount: total,
            notes: notes || null,
            date: updatedSlots.date || todayStr
          }
        ])

        if (dbError) throw dbError

      } else if (updatedSlots.mode === 'attendance' && updatedSlots.attendance?.records) {
        const records = updatedSlots.attendance.records
        const dateVal = updatedSlots.date || todayStr

        // Delete existing attendance records for the selected workers on this date and project to prevent duplicates
        const workerIds = records.map(r => r.labour_id)
        await supabase.from('attendance')
          .delete()
          .eq('project_id', updatedSlots.project_id)
          .eq('date', dateVal)
          .in('labour_id', workerIds)

        const inserts = await Promise.all(records.map(async (r) => {
          // Fetch custom rate (daily rate of labour)
          const workerInfo = labourers?.find(l => l.id === r.labour_id)
          const rate = workerInfo?.daily_rate || 0

          return {
            labour_id: r.labour_id,
            project_id: updatedSlots.project_id,
            date: dateVal,
            days_worked: r.status === 'P' ? 1 : r.status === 'H' ? 0.5 : 0,
            overtime_hours: 0,
            overtime_amount: r.overtime_amount || 0,
            custom_rate: rate,
            advance_amount: r.advance_amount || 0
          }
        }))

        const { error: dbError } = await supabase.from('attendance').insert(inserts)
        if (dbError) throw dbError
      }
    }

    return NextResponse.json({
      slots: updatedSlots,
      replyText: nextQuestion,
      isComplete
    })

  } catch (err: any) {
    console.error("Voice Log API Error:", err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
