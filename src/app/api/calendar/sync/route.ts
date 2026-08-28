import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// You can swap this interface/implementation when using a real Panchang API
interface PanchangProvider {
  getAmavasyaDates(year: number, location: string): Promise<any[]>
}

class MockPanchangProvider implements PanchangProvider {
  async getAmavasyaDates(year: number, location: string) {
    // This is a placeholder. You should replace this with actual API calls
    // to a service like ProKerala, Astrotech, etc.
    // For now, returning some mock Amavasya dates for 2026 as an example.
    return [
      {
        date: '2026-08-12',
        event_type: 'AMAVASYA',
        lunar_month: 'Shravana',
        regional_name: 'శ్రావణ అమావాస్య',
        timezone: 'Asia/Kolkata',
        location: location,
        source: 'MockPanchangAPI',
        year: year
      },
      {
        date: '2026-09-10',
        event_type: 'AMAVASYA',
        lunar_month: 'Bhadrapada',
        regional_name: 'భాద్రపద అమావాస్య',
        timezone: 'Asia/Kolkata',
        location: location,
        source: 'MockPanchangAPI',
        year: year
      }
    ]
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { year = new Date().getFullYear(), location = 'Hyderabad' } = body

    // Initialize Supabase Admin client to bypass RLS for syncing
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Check if we already have events for this year and location to prevent redundant calls
    const { data: existingEvents, error: checkError } = await supabaseAdmin
      .from('calendar_events')
      .select('id')
      .eq('year', year)
      .eq('location', location)

    if (checkError) throw checkError

    if (existingEvents && existingEvents.length > 0) {
      return NextResponse.json({
        message: `Calendar events for ${year} (${location}) are already synced.`,
        synced: false
      })
    }

    // 2. Fetch from the configured provider
    const provider = new MockPanchangProvider()
    const eventsToInsert = await provider.getAmavasyaDates(year, location)

    // 3. Insert into database
    if (eventsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('calendar_events')
        .insert(eventsToInsert)

      if (insertError) throw insertError
    }

    return NextResponse.json({
      message: `Successfully synced ${eventsToInsert.length} calendar events.`,
      synced: true
    })
  } catch (error: any) {
    console.error('Error syncing calendar:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
