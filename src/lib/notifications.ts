import { createClient } from '@supabase/supabase-js'

export async function sendSMSNotification(phone: string, text: string) {
  console.log(`[SMS Notification System] Sending to phone: ${phone} | Content: ${text}`)

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.log('[SMS Notification System] No TELEGRAM_BOT_TOKEN env variable set. Logging only.')
    return
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Alert any active Telegram session
    const { data: sessions } = await supabase.from('telegram_sessions').select('chat_id')
    if (sessions && sessions.length > 0) {
      for (const s of sessions) {
        if (s.chat_id) {
          const url = `https://api.telegram.org/bot${token}/sendMessage`
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: s.chat_id,
              text: `🔔 *Nirmana Notification Alert (${phone}):*\n\n${text}`,
              parse_mode: 'Markdown'
            })
          })
        }
      }
    }
  } catch (e) {
    console.error('Failed to forward SMS notification to Telegram Bot:', e)
  }
}
