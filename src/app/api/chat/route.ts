import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// We use the admin/standard client for server-side read-only fetches
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const { message } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Fetch 90-days context
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0]

    const [
      { data: projects },
      { data: labour },
      { data: payments },
      { data: materials },
      { data: attendance }
    ] = await Promise.all([
      supabase.from('projects').select('id, name'),
      supabase.from('labour').select('id, name, type, daily_rate'),
      supabase.from('payments').select('date, amount, payment_type, labour:labour_id(name)').gte('date', dateStr),
      supabase.from('materials').select('date, name, total_amount, project:project_id(name)').gte('date', dateStr),
      supabase.from('attendance').select('date, days_worked, advance_amount, labour:labour_id(name), project:project_id(name)').gte('date', dateStr)
    ])

    // Format the context for the LLM
    const context = {
      projects: projects?.map(p => p.name) || [],
      workers: labour?.map(l => ({ name: l.name, role: l.type, rate: l.daily_rate })) || [],
      recent_payments: payments?.map(p => ({ date: p.date, worker: (p.labour as any)?.name, amount: p.amount, type: p.payment_type })) || [],
      recent_materials: materials?.map(m => ({ date: m.date, item: m.name, amount: m.total_amount, project: (m.project as any)?.name })) || [],
      recent_attendance: attendance?.map(a => ({ date: a.date, worker: (a.labour as any)?.name, days_worked: a.days_worked, advance: a.advance_amount })) || []
    }

    const systemPrompt = `You are an AI database assistant for 'Sri Sai Constructions', an internal contractor management dashboard. 
You answer questions based ONLY on the following JSON database context (which covers the last 90 days). 
Keep your answers brief, professional, and clear. Format numbers as Indian Rupees (₹).
Do NOT use markdown formatting like bold text (**) or italics. Provide clean, plain text.
If the user asks something not found in the context, politely inform them that you only have access to recent data and cannot find it.

Context:
${JSON.stringify(context)}
`

    // Call NVIDIA API
    const response = await fetch(`${process.env.NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.2,
        max_tokens: 1024,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NVIDIA API Error: ${errorText}`)
    }

    const data = await response.json()
    return NextResponse.json({ reply: data.choices[0].message.content })

  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
