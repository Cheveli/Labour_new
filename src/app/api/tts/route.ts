import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const text = searchParams.get('text')

    if (!text) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 })
    }

    const hfToken = process.env.HF_API_TOKEN
    if (!hfToken) {
      throw new Error('HF_API_TOKEN environment variable is not set')
    }
    const hfModel = 'SYSPIN/Telugu_Male_TTS'
    const hfUrl = `https://api-inference.huggingface.co/models/${hfModel}`

    console.log('[TTS API] Calling Hugging Face TTS model:', hfModel)
    
    let res;
    let attempts = 0;
    const maxAttempts = 6;
    
    while (attempts < maxAttempts) {
      res = await fetch(hfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: text })
      })

      if (res.status === 503) {
        try {
          const errorJson = await res.clone().json()
          if (errorJson.error && errorJson.error.includes('loading')) {
            const waitTime = Math.min((errorJson.estimated_time || 3) * 1000, 5000)
            console.log(`[TTS API] Model is loading. Waiting ${waitTime}ms... (Attempt ${attempts + 1}/${maxAttempts})`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            attempts++
            continue
          }
        } catch (e) {
          console.warn('[TTS API] Failed to parse 503 error JSON:', e)
        }
      }
      break;
    }

    if (!res || !res.ok) {
      const errText = res ? await res.text() : 'No response from API'
      console.error('[TTS API] Hugging Face error response:', errText)
      throw new Error(`Failed to fetch from Hugging Face TTS service: ${res ? res.statusText : ''} - ${errText}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    const contentType = res.headers.get('Content-Type') || 'audio/wav'

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (err: any) {
    console.error('TTS proxy error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
