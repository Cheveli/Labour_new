import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export const PDF_COLORS = {
  NAVY: [13, 27, 62] as [number, number, number],
  BLUE: [37, 99, 235] as [number, number, number],
  GOLD: [245, 158, 11] as [number, number, number],
  GREEN: [22, 163, 74] as [number, number, number],
  RED: [239, 68, 68] as [number, number, number],
  MUTED: [100, 116, 139] as [number, number, number],
  LIGHT: [248, 250, 255] as [number, number, number]
}

export const COMPANY_DETAILS = {
  name: 'SRI SAI CONSTRUCTIONS',
  tagline: 'BUILDING YOUR VISION',
  address: 'Boduppal, Hyderabad',
  contractor: 'Contractor: Cheveli Somaiah',
  phones: '9849678296 / 9550017985'
}


export function drawPremiumHeader(doc: jsPDF, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth()

  // Navy Header Box
  doc.setFillColor(...PDF_COLORS.NAVY)
  doc.rect(0, 0, W, 44, 'F')

  // Company Logo/Name
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(COMPANY_DETAILS.name, 14, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(COMPANY_DETAILS.tagline, 14, 21)
  doc.text(COMPANY_DETAILS.address, 14, 27)
  doc.text(`${COMPANY_DETAILS.contractor}  |  Ph: ${COMPANY_DETAILS.phones}`, 14, 33)

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

export function drawPremiumFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  doc.setFillColor(...PDF_COLORS.NAVY)
  doc.rect(0, H - 14, W, 14, 'F')

  doc.setTextColor(180, 200, 240)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Tel: ${COMPANY_DETAILS.phones}  |  ${COMPANY_DETAILS.address}  |  ${COMPANY_DETAILS.name}`, W / 2, H - 6, { align: 'center' })
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
