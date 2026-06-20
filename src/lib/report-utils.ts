import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { createClient } from '@supabase/supabase-js'

export const PDF_THEMES = {
  original_navy: {
    primary: [13, 27, 62] as [number, number, number],
    secondary: [245, 158, 11] as [number, number, number], // Gold/amber border strip
  },
  classic_blue: {
    primary: [37, 99, 235] as [number, number, number], // Tech blue
    secondary: [13, 27, 62] as [number, number, number], // Navy accent
  },
  emerald_green: {
    primary: [6, 78, 59] as [number, number, number], // Deep green
    secondary: [16, 185, 129] as [number, number, number], // Emerald accent
  },
  royal_blue: {
    primary: [30, 58, 138] as [number, number, number], // Deep royal blue
    secondary: [59, 130, 246] as [number, number, number], // Tech blue accent
  },
  slate_charcoal: {
    primary: [30, 41, 59] as [number, number, number], // Dark slate
    secondary: [100, 116, 139] as [number, number, number], // Muted slate accent
  },
  sunset_amber: {
    primary: [120, 53, 4] as [number, number, number], // Burnt orange/amber
    secondary: [245, 158, 11] as [number, number, number], // Orange accent
  }
}

export const PDF_COLORS = {
  get NAVY(): [number, number, number] {
    if (typeof window !== 'undefined') {
      const theme = localStorage.getItem('ssc_pdf_theme') || 'original_navy'
      return PDF_THEMES[theme as keyof typeof PDF_THEMES]?.primary || [13, 27, 62]
    }
    return [13, 27, 62]
  },
  get BLUE(): [number, number, number] {
    if (typeof window !== 'undefined') {
      const theme = localStorage.getItem('ssc_pdf_theme') || 'original_navy'
      return PDF_THEMES[theme as keyof typeof PDF_THEMES]?.secondary || [37, 99, 235]
    }
    return [37, 99, 235]
  },
  get GOLD(): [number, number, number] {
    if (typeof window !== 'undefined') {
      const theme = localStorage.getItem('ssc_pdf_theme') || 'original_navy'
      return PDF_THEMES[theme as keyof typeof PDF_THEMES]?.secondary || [245, 158, 11]
    }
    return [245, 158, 11]
  },
  GREEN: [22, 163, 74] as [number, number, number],
  RED: [239, 68, 68] as [number, number, number],
  MUTED: [100, 116, 139] as [number, number, number],
  LIGHT: [248, 250, 255] as [number, number, number]
}

export const COMPANY_DETAILS = {
  get pdfTheme() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ssc_pdf_theme') || 'original_navy'
    }
    return 'original_navy'
  },

  get name() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ssc_company_name') || 'SRI SAI CONSTRUCTIONS'
    }
    return 'SRI SAI CONSTRUCTIONS'
  },
  get tagline() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ssc_company_slogan') || 'BUILDING YOUR VISION'
    }
    return 'BUILDING YOUR VISION'
  },
  get address() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ssc_company_address') || 'Boduppal, Hyderabad'
    }
    return 'Boduppal, Hyderabad'
  },
  get contractor() {
    if (typeof window !== 'undefined') {
      const c = localStorage.getItem('ssc_contractor_name')
      return c ? `Contractor: ${c}` : 'Contractor: Cheveli Somaiah'
    }
    return 'Contractor: Cheveli Somaiah'
  },
  get contractorRaw() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ssc_contractor_name') || 'Cheveli Somaiah'
    }
    return 'Cheveli Somaiah'
  },
  get phones() {
    if (typeof window !== 'undefined') {
      const p1 = localStorage.getItem('ssc_company_phone_1')
      const p2 = localStorage.getItem('ssc_company_phone_2')
      if (p1 && p2) return `${p1} / ${p2}`
      if (p1) return p1
      if (p2) return p2
    }
    return '9849678296 / 9550017985'
  }
}

export async function getCompanyDetailsServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const defaults = {
    name: 'SRI SAI CONSTRUCTIONS',
    contractorRaw: 'Cheveli Somaiah',
    phones: '9849678296 / 9550017985',
    tagline: 'BUILDING YOUR VISION',
    address: 'Boduppal, Hyderabad'
  }

  try {
    const { data, error } = await supabase.from('company_settings').select('*')
    if (error || !data || data.length === 0) {
      // Fallback: check projects for special ID
      const { data: proj } = await supabase.from('projects').select('description').eq('id', '00000000-0000-0000-0000-000000000000').single()
      if (proj && proj.description) {
        const parsed = JSON.parse(proj.description)
        return {
          name: parsed.company_name || defaults.name,
          contractorRaw: parsed.contractor_name || defaults.contractorRaw,
          phones: (parsed.phone_1 && parsed.phone_2) ? `${parsed.phone_1} / ${parsed.phone_2}` : (parsed.phone_1 || parsed.phone_2 || defaults.phones),
          tagline: parsed.slogan || defaults.tagline,
          address: parsed.address || defaults.address
        }
      }
      return defaults
    }

    const map = new Map(data.map(item => [item.key, item.value]))
    const name = map.get('company_name') || defaults.name
    const contractorRaw = map.get('contractor_name') || defaults.contractorRaw
    const phone1 = map.get('company_phone_1')
    const phone2 = map.get('company_phone_2')
    const tagline = map.get('company_slogan') || defaults.tagline
    const address = map.get('company_address') || defaults.address

    let phones = defaults.phones
    if (phone1 && phone2) phones = `${phone1} / ${phone2}`
    else if (phone1) phones = phone1
    else if (phone2) phones = phone2

    return { name, contractorRaw, phones, tagline, address }
  } catch (err) {
    return defaults
  }
}

export function drawPremiumHeader(doc: jsPDF, title: string, subtitle: string, companyDetails?: any) {
  const W = doc.internal.pageSize.getWidth()
  const details = companyDetails || COMPANY_DETAILS

  // Navy Header Box
  doc.setFillColor(...PDF_COLORS.NAVY)
  doc.rect(0, 0, W, 44, 'F')

  // Company Logo/Name
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(details.name, 14, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(details.tagline, 14, 21)
  doc.text(details.address, 14, 27)
  
  const contractorLabel = details.contractor || (details.contractorRaw ? `Contractor: ${details.contractorRaw}` : 'Contractor: Cheveli Somaiah')
  doc.text(`${contractorLabel}  |  Ph: ${details.phones}`, 14, 33)

  // Report Title
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  const titleLines = title.split(' ')
  if (titleLines.length > 2) {
    doc.text(titleLines.slice(0, 2).join(' '), W - 14, 15, { align: 'right' })
    doc.text(titleLines.slice(2).join(' '), W - 14, 21, { align: 'right' })
  } else {
    doc.text(title, W - 14, 18, { align: 'right' })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(subtitle, W - 14, 30, { align: 'right' })

  // Gold Strip
  doc.setFillColor(...PDF_COLORS.GOLD)
  doc.rect(0, 44, W, 3, 'F')
}

export function drawPremiumFooter(doc: jsPDF, companyDetails?: any) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const details = companyDetails || COMPANY_DETAILS

  doc.setFillColor(...PDF_COLORS.NAVY)
  doc.rect(0, H - 14, W, 14, 'F')

  doc.setTextColor(180, 200, 240)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Tel: ${details.phones}  |  ${details.address}  |  ${details.name}`, W / 2, H - 6, { align: 'center' })
}

export function numberToWords(n: number): string {
  if (n <= 0) return 'Zero Only'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function conv(n: number): string {
    if (n < 20) return ones[n] ? ones[n] + ' ' : ''
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + conv(n % 10)
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + conv(n % 100)
    if (n < 100000) return conv(Math.floor(n / 1000)) + 'Thousand ' + conv(n % 1000)
    if (n < 10000000) return conv(Math.floor(n / 100000)) + 'Lakh ' + conv(n % 100000)
    return conv(Math.floor(n / 10000000)) + 'Crore ' + conv(n % 10000000)
  }
  return 'Rupees ' + conv(Math.floor(n)).trim() + ' Only'
}

export function exportToExcel(data: any[][], fileName: string, sheetName: string = 'Sheet1') {
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}
