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

    // Fetch all-time context for all relevant tables
    const [
      { data: projects },
      { data: labour },
      { data: payments },
      { data: materials },
      { data: attendance },
      { data: income },
      { data: contractor_payments },
      { data: personal_expenses }
    ] = await Promise.all([
      supabase.from('projects').select('id, name, status, owner_name'),
      supabase.from('labour').select('id, name, type, daily_rate'),
      supabase.from('payments').select('date, amount, payment_type, labour:labour_id(name)'),
      supabase.from('materials').select('date, name, total_amount, quantity, unit, notes, project:project_id(name)'),
      supabase.from('attendance').select('date, days_worked, custom_rate, overtime_amount, advance_amount, labour:labour_id(name), project:project_id(name)'),
      supabase.from('income').select('date, amount, notes, project:project_id(name)'),
      supabase.from('contractor_payments').select('id, date, name, work_nature, total_amount, total_paid, notes, installments'),
      supabase.from('personal_expenses').select('date, person_name, purpose, amount')
    ])

    const userQueryLower = message.toLowerCase()

    // 1. Worker Name Filtering & Aggregation
    const mentionedWorkers = labour?.filter(l => {
      const nameLower = l.name.toLowerCase()
      return userQueryLower.includes(nameLower) || 
             nameLower.split(' ').some((part: string) => part.length > 2 && userQueryLower.includes(part))
    }).map(l => l.name) || []
    
    const hasWorkerMention = mentionedWorkers.length > 0

    // Pre-aggregate attendance by worker name
    const workerSummary: Record<string, {
      name: string;
      role: string;
      daily_rate: number;
      total_days_worked: number;
      total_overtime: number;
      total_advance: number;
      total_earned: number;
      work_history: { date: string; project: string; days_worked: number; overtime: number; advance: number }[];
    }> = {}

    labour?.forEach(l => {
      workerSummary[l.name] = {
        name: l.name,
        role: l.type,
        daily_rate: l.daily_rate || 0,
        total_days_worked: 0,
        total_overtime: 0,
        total_advance: 0,
        total_earned: 0,
        work_history: []
      }
    })

    attendance?.forEach(a => {
      const workerName = (a.labour as any)?.name
      if (workerName) {
        if (!workerSummary[workerName]) {
          workerSummary[workerName] = {
            name: workerName,
            role: 'Unknown',
            daily_rate: a.custom_rate || 0,
            total_days_worked: 0,
            total_overtime: 0,
            total_advance: 0,
            total_earned: 0,
            work_history: []
          }
        }
        
        const summary = workerSummary[workerName]
        const days = Number(a.days_worked || 0)
        const rate = Number(a.custom_rate || summary.daily_rate || 0)
        const ot = Number(a.overtime_amount || 0)
        const adv = Number(a.advance_amount || 0)
        
        summary.total_days_worked += days
        summary.total_overtime += ot
        summary.total_advance += adv
        summary.total_earned += (days * rate) + ot
        
        summary.work_history.push({
          date: a.date,
          project: (a.project as any)?.name || 'Unknown',
          days_worked: days,
          overtime: ot,
          advance: adv
        })
      }
    })

    // Map summaries with conditional detail rendering to keep context small
    const formattedWorkers = Object.values(workerSummary).map(w => {
      const nameLower = w.name.toLowerCase()
      const isMentioned = userQueryLower.includes(nameLower) || 
                          nameLower.split(' ').some((part: string) => part.length > 2 && userQueryLower.includes(part))
      
      return {
        name: w.name,
        role: w.role,
        daily_rate: w.daily_rate,
        total_days_worked: w.total_days_worked,
        total_overtime: w.total_overtime,
        total_advance: w.total_advance,
        total_earned: w.total_earned,
        detailed_attendance_days: isMentioned ? w.work_history : `[Omitted for brevity - ${w.total_days_worked} days present]`
      }
    })

    // 2. Payments Filtering (Only keep relevant payments if worker mentioned)
    const filteredPayments = payments?.filter(p => {
      const wName = (p.labour as any)?.name
      if (!wName) return false
      if (hasWorkerMention) {
        return mentionedWorkers.some(m => wName.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(wName.toLowerCase()))
      }
      return true
    })

    // 3. Materials Keyword Filtering
    const materialKeywords = ['sand', 'cement', 'steel', 'gravel', 'brick', 'metal', 'dust', 'aggregate', 'water', 'paint']
    const mentionedMaterials = materialKeywords.filter(k => userQueryLower.includes(k))
    const hasMaterialMention = mentionedMaterials.length > 0

    const filteredMaterials = materials?.filter(m => {
      if (hasMaterialMention) {
        return mentionedMaterials.some(k => m.name.toLowerCase().includes(k))
      }
      return true
    })

    // 4. Personal Expenses Person Filtering
    const expensePersons = personal_expenses?.map(pe => pe.person_name).filter(Boolean) || []
    const mentionedExpensePersons = expensePersons.filter(p => userQueryLower.includes(p.toLowerCase()))
    const hasExpensePersonMention = mentionedExpensePersons.length > 0

    const filteredExpenses = personal_expenses?.filter(pe => {
      if (hasExpensePersonMention) {
        return mentionedExpensePersons.some(p => pe.person_name.toLowerCase().includes(p.toLowerCase()))
      }
      return true
    })

    // Parse contractor payments to extract subcontracts work entries & installments
    const subcontracts = contractor_payments?.map(cp => {
      let parsedNotes = { description: '' };
      try {
        if (cp.notes && (cp.notes.startsWith('{') || cp.notes.startsWith('['))) {
          parsedNotes = JSON.parse(cp.notes);
        } else {
          parsedNotes = { description: cp.notes || '' };
        }
      } catch (e) {}
      
      let installments = cp.installments || [];
      const sumInstallments = installments.reduce((sum: number, inst: any) => sum + Number(inst.amount || 0), 0);
      if (cp.total_amount > sumInstallments) {
        const diff = cp.total_amount - sumInstallments;
        installments = [
          {
            amount: diff,
            date: cp.date || '',
            receipt_number: 1,
            notes: 'Legacy Balance / Migrated Payout'
          },
          ...installments.map((inst: any, idx: number) => ({ ...inst, receipt_number: idx + 2 }))
        ];
      }

      const workEntries = installments.map((inst: any) => ({
        id: `${cp.id}-${inst.receipt_number}`,
        work_name: `Payment #${inst.receipt_number}`,
        amount: inst.amount,
        date: inst.date,
        notes: inst.notes || ''
      }));

      return {
        contractor: cp.name,
        department: cp.work_nature,
        grand_total_earned: cp.total_amount,
        total_paid: cp.total_paid,
        balance_due: Number(cp.total_amount || 0) - Number(cp.total_paid || 0),
        notes: parsedNotes.description,
        work_entries: workEntries,
        installments: cp.installments || []
      };
    }) || [];

    // Format the optimized context for the LLM
    const context = {
      projects: projects?.map(p => ({ name: p.name, status: p.status, owner: p.owner_name })) || [],
      workers: formattedWorkers,
      worker_payments: filteredPayments?.map(p => ({ date: p.date, worker: (p.labour as any)?.name, amount: p.amount, type: p.payment_type })) || [],
      materials: filteredMaterials?.map(m => ({ date: m.date, item: m.name, amount: m.total_amount, quantity: `${m.quantity} ${m.unit || ''}`.trim(), notes: m.notes, project: (m.project as any)?.name })) || [],
      income: income?.map(i => ({ date: i.date, amount: i.amount, notes: i.notes, project: (i.project as any)?.name })) || [],
      subcontracts,
      personal_expenses: filteredExpenses?.map(pe => ({ date: pe.date, person: pe.person_name, purpose: pe.purpose, amount: pe.amount })) || []
    }

    const systemPrompt = `You are an advanced AI database assistant for 'Sri Sai Constructions', a premium contractor management platform.
You answer questions based ONLY on the following JSON database context.
Keep your answers professional, direct, and factual. Always format numbers as Indian Rupees (e.g. ₹1,50,000).
Use clean Markdown formatting to make your answers structured and elegant:
- Use bold text for key figures, metrics, totals, names, and projects.
- Use lists or clean tables to summarize items, worker lists, or transactions.
- Separate sections with line breaks where helpful.

Answer concisely and directly. Do NOT write a long internal monologue or step-by-step counting in your reasoning if you are a reasoning model. Directly compute the totals and output the final response.

If the user asks a question about data not found in the context (or if no records are found), politely inform them that you only have access to live database records and cannot find information matching their request. Do not make up or hallucinate figures.

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
        temperature: 0.1,
        max_tokens: 2048,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NVIDIA API Error: ${errorText}`)
    }

    const data = await response.json()
    const messageObj = data.choices?.[0]?.message
    let reply = messageObj?.content || messageObj?.reasoning || messageObj?.reasoning_content || ''
    
    if (!reply && messageObj) {
      reply = "Sorry, I fetched the database records but was unable to formulate a text response. Please try rephrasing your question."
    }

    return NextResponse.json({ reply })

  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

