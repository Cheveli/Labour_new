import { NextResponse } from 'next/server'
import { generateAndEmailWeeklyReport } from '@/lib/weekly-report-generator'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleWeeklyReportTrigger(request)
}

export async function POST(request: Request) {
  return handleWeeklyReportTrigger(request)
}

async function handleWeeklyReportTrigger(request: Request) {
  try {
    // 1. Authorization check using CRON_SECRET (if defined in env)
    const { searchParams } = new URL(request.url)
    const urlSecret = searchParams.get('secret')
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret) {
      const isAuthorizedHeader = authHeader === `Bearer ${cronSecret}`
      const isAuthorizedQuery = urlSecret === cronSecret

      if (!isAuthorizedHeader && !isAuthorizedQuery) {
        return NextResponse.json(
          { error: 'Unauthorized request. Invalid Cron Secret token.' },
          { status: 401 }
        )
      }
    } else {
      console.warn('Warning: CRON_SECRET env variable is not set. API route is public.')
    }

    // 2. Trigger weekly management report generation
    await generateAndEmailWeeklyReport({
      recipientEmail: 'saichevelly@gmail.com',
      passwordProtect: '191918'
    })

    return NextResponse.json({
      success: true,
      message: 'Weekly report generated and emailed successfully!'
    })
  } catch (error: any) {
    console.error('Error during weekly report generation:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred during report generation'
      },
      { status: 500 }
    )
  }
}
