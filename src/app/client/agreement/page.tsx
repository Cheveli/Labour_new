'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Loader2, FileText, Download, X, Eye, Info } from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { TELUGU_FONT_BASE64 } from '@/lib/telugu-font'
import { drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'

interface WorkItem {
  id: string
  name: string
  description: string
}

interface Agreement {
  id: string
  agreement_number: string
  agreement_date: string
  project_id?: string | null
  site_address: string
  owner_name: string
  contractor_name: string
  total_square_feet?: number
  rate_per_square_foot: number
  total_contract_amount?: number
  number_of_floors?: string
  work_items: WorkItem[]
  remarks: string
  owner_signature?: string
  contractor_signature?: string
  witness_signature?: string
  project?: { name: string }
  created_at?: string
}

export default function ClientAgreementPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAgr, setSelectedAgr] = useState<Agreement | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/client/project-data')
        if (!res.ok) throw new Error('Failed to load project details.')
        const resData = await res.json()
        setData(resData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  if (!data?.project) return (
    <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl mt-12 space-y-4 max-w-md mx-auto text-white">
      <Info className="mx-auto text-zinc-500" size={32} />
      <h2 className="text-lg font-bold">No Project Associated</h2>
      <p className="text-xs text-zinc-400">Please contact the administrator or your contractor to link this client profile to your active site project.</p>
    </div>
  )

  const { agreements, companyDetails } = data

  const drawNirmanaLogo = (doc: jsPDF, x: number, y: number) => {
    doc.setFillColor(37, 99, 235)
    doc.circle(x + 8, y + 8, 8, 'F')
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.8)
    doc.line(x + 4, y + 9, x + 8, y + 4)
    doc.line(x + 8, y + 4, x + 12, y + 9)
    doc.line(x + 6, y + 9, x + 6, y + 12)
    doc.line(x + 10, y + 9, x + 10, y + 12)
    doc.line(x + 6, y + 12, x + 10, y + 12)
  }

  const drawCursiveSignature = (doc: jsPDF, x: number, y: number) => {
    doc.setDrawColor(37, 99, 235)
    doc.setLineWidth(0.5)
    doc.line(x, y - 2, x + 4, y - 6)
    doc.line(x + 4, y - 6, x + 8, y - 1)
    doc.line(x + 8, y - 1, x + 12, y - 9)
    doc.line(x + 12, y - 9, x + 16, y - 2)
    doc.line(x + 16, y - 2, x + 20, y - 7)
    doc.line(x + 20, y - 7, x + 24, y - 3)
    doc.line(x + 24, y - 3, x + 28, y - 8)
    doc.line(x + 28, y - 8, x + 32, y - 1)
    doc.line(x + 32, y - 1, x + 40, y - 4)
  }

  const containsTelugu = (text: string): boolean => {
    return /[\u0c00-\u0c7f]/.test(text || '')
  }

  const sanitizeText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/₹/g, 'Rs. ')
      .replace(/[‘’`´\u2018\u2019\u00b9]/g, "'")
      .replace(/[“”]/g, '"')
  }

  const drawTeluguTextToCanvasSync = (text: string, widthMm: number, heightMm: number): string => {
    if (typeof window === 'undefined') return ''
    const canvas = document.createElement('canvas')
    const scale = 3.5
    const pxPerMm = 96 / 25.4
    canvas.width = Math.round(widthMm * pxPerMm * scale)
    canvas.height = Math.round(heightMm * pxPerMm * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)

    ctx.fillStyle = '#000000'
    ctx.font = 'normal 10px "Noto Sans Telugu", "Gidugu", "Inter", sans-serif'
    ctx.textBaseline = 'middle'

    const padX = 4 * pxPerMm
    const lines = text.split('\n')
    const lineSpacing = 3.8 * pxPerMm
    const startY = (heightMm / 2) * pxPerMm - ((lines.length - 1) * lineSpacing / 2)

    lines.forEach((line, index) => {
      ctx.fillText(line, padX, startY + (index * lineSpacing))
    })

    return canvas.toDataURL('image/jpeg', 0.9)
  }

  const generatePDF = async (agr: Agreement, shouldSave: boolean = true) => {
    if (typeof window !== 'undefined' && !document.getElementById('telugu-webfont')) {
      const link = document.createElement('link')
      link.id = 'telugu-webfont'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Gidugu&family=Noto+Sans+Telugu:wght@400;700&display=swap'
      document.head.appendChild(link)
    }

    if (typeof window !== 'undefined') {
      try {
        await document.fonts.ready
      } catch (e) {}
    }

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    })

    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()

    try {
      doc.addFileToVFS('Gidugu-Regular.ttf', TELUGU_FONT_BASE64)
      doc.addFont('Gidugu-Regular.ttf', 'Gidugu', 'normal')
      doc.addFont('Gidugu-Regular.ttf', 'Gidugu', 'bold')
      doc.setFont('Gidugu', 'normal')
    } catch (e) {}

    const drawPremiumHeader = (pageNum: number) => {
      doc.setFillColor(13, 27, 62)
      doc.rect(0, 0, W, 38, 'F')
      doc.setFillColor(245, 158, 11)
      doc.rect(0, 38, W, 1.8, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('SRI SAI CONSTRUCTIONS', 15, 12)

      doc.setTextColor(245, 158, 11)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.25)
      doc.text('BUILDING YOUR VISION', 15, 16.5)

      doc.setTextColor(230, 235, 245)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text('Boduppal, Hyderabad, Telangana - 500092', 15, 23)
      doc.text('Contractor: Cheveli Somaiah', 15, 27.5)
      doc.text(`Ph: ${companyDetails.phone1 || '9550017985'}`, 15, 32)

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('CONSTRUCTION AGREEMENT', W - 15, 15, { align: 'right' })

      doc.setFillColor(245, 158, 11)
      doc.roundedRect(W - 53, 17.5, 38, 5, 0.8, 0.8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.25)
      doc.text('AGREEMENT CONTRACT', W - 34, 21, { align: 'center' })

      doc.setTextColor(220, 225, 235)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.25)
      doc.text(`Agreement No : ${agr.agreement_number}`, W - 15, 29, { align: 'right' })
      doc.text(`Date : ${new Date(agr.agreement_date).toLocaleDateString('en-GB')}`, W - 15, 33.5, { align: 'right' })
    }

    const drawContinuationHeader = (pageNum: number) => {
      doc.setFillColor(13, 27, 62)
      doc.rect(0, 0, W, 15, 'F')
      doc.setFillColor(245, 158, 11)
      doc.rect(0, 15, W, 1.2, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.25)
      doc.text('CONSTRUCTION AGREEMENT - CONTINUATION', 15, 9.5)

      doc.setTextColor(220, 225, 235)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.25)
      doc.text(`Agreement No : ${agr.agreement_number}`, W - 40, 9.5, { align: 'right' })
    }

    const drawSpacedFooter = (pageNum: number) => {
      doc.setFillColor(13, 27, 62)
      doc.rect(0, H - 8, W, 8, 'F')
      doc.setFillColor(245, 158, 11)
      doc.rect(0, H - 8, W, 1.2, 'F')

      doc.setTextColor(230, 235, 245)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.75)

      doc.text('SRI SAI CONSTRUCTIONS', 15, H - 3.5)
      doc.text(`Ph: ${companyDetails.phone1 || '9550017985'}`, W / 2, H - 3.5, { align: 'center' })
      doc.text('Boduppal, Hyderabad, Telangana - 500092', W - 15, H - 3.5, { align: 'right' })
    }

    drawPremiumHeader(1)
    drawSpacedFooter(1)

    const drawColHeader = (title: string, colX: number, iconType: 'owner' | 'contractor' | 'project') => {
      doc.setFillColor(13, 27, 62)
      doc.rect(colX, 44, 60, 6, 'F')
      doc.setFillColor(245, 158, 11)
      doc.rect(colX, 50, 60, 0.8, 'F')
      doc.setDrawColor(220, 225, 235)
      doc.setLineWidth(0.2)
      doc.rect(colX, 50, 60, 24)

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.75)

      const textWidth = doc.getTextWidth(title)
      const iconWidth = 5.2
      const spacing = 2.5
      const totalW = textWidth + iconWidth + spacing
      const startX = colX + 30 - (totalW / 2)
      const cx = startX + (iconWidth / 2)
      const textX = startX + iconWidth + spacing

      doc.setFillColor(255, 255, 255)
      if (iconType === 'owner') {
        doc.circle(cx, 46.2, 1.3, 'F')
        doc.ellipse(cx, 48.6, 2.5, 0.9, 'F')
      } else if (iconType === 'contractor') {
        doc.circle(cx, 46.5, 1.1, 'F')
        doc.ellipse(cx, 48.6, 2.5, 0.9, 'F')
        doc.setDrawColor(245, 158, 11)
        doc.setLineWidth(0.4)
        doc.line(cx - 1.8, 46.2, cx + 1.8, 46.2)
        doc.setFillColor(245, 158, 11)
        doc.ellipse(cx, 46.0, 1.3, 0.9, 'F')
      } else {
        doc.setFillColor(245, 158, 11)
        doc.triangle(cx - 2.8, 47.4, cx, 44.6, cx + 2.8, 47.4, 'F')
        doc.rect(cx - 2.4, 47.4, 4.8, 2.0, 'F')
        doc.setFillColor(255, 255, 255)
        doc.rect(cx - 0.7, 48.2, 1.4, 1.2, 'F')
      }

      doc.setTextColor(255, 255, 255)
      doc.text(title, textX, 48.2)
    }

    drawColHeader('OWNER DETAILS', 15, 'owner')
    drawColHeader('CONTRACTOR DETAILS', 75, 'contractor')
    drawColHeader('PROJECT DETAILS', 135, 'project')

    const drawColRow = (key: string, val: string, cx: number, colonX: number, valX: number, rY: number) => {
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.text(key, cx, rY)
      doc.setTextColor(0, 0, 0)
      doc.text(':', colonX, rY)

      if (containsTelugu(val)) {
        doc.setFont('Gidugu', 'normal')
      } else {
        doc.setFont('helvetica', 'normal')
      }
      doc.setFontSize(7.5)
      doc.text(val, valX, rY)
    }

    const rowY = 54.5
    const spacingStep = 5.2

    const ownerParts = (agr.owner_name || '').split(' | ')
    const ownerVal = ownerParts[0] || ''
    const soPart = ownerParts.find((p: string) => p.startsWith('S/o: '))
    const fatherVal = soPart ? soPart.replace('S/o: ', '') : ''
    const phPart = ownerParts.find((p: string) => p.startsWith('Ph: '))
    const phoneVal = phPart ? phPart.replace('Ph: ', '') : (companyDetails.phone1 || '')

    drawColRow('Owner Name', ownerVal, 18, 43, 45.5, rowY)
    drawColRow('Son of (S/o)', fatherVal, 18, 43, 45.5, rowY + spacingStep)
    drawColRow('Mobile Number', phoneVal, 18, 43, 45.5, rowY + (spacingStep * 2))

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('Address', 18, rowY + (spacingStep * 3))
    doc.setTextColor(0, 0, 0)
    doc.text(':', 43, rowY + (spacingStep * 3))

    const valOwnerAddress = agr.site_address || '—'
    if (containsTelugu(valOwnerAddress)) {
      doc.setFont('Gidugu', 'normal')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    doc.setFontSize(7.5)
    const splitOwnerAddr = doc.splitTextToSize(valOwnerAddress, 27)
    doc.text(splitOwnerAddr, 45.5, rowY + (spacingStep * 3))

    drawColRow('Contractor Name', agr.contractor_name, 78, 103, 105.5, rowY)
    drawColRow('Mobile Number', companyDetails.phone1, 78, 103, 105.5, rowY + (spacingStep * 2))

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('Address', 78, rowY + (spacingStep * 3))
    doc.setTextColor(0, 0, 0)
    doc.text(':', 103, rowY + (spacingStep * 3))

    const valContrAddress = companyDetails.address || 'Boduppal, Hyderabad'
    if (containsTelugu(valContrAddress)) {
      doc.setFont('Gidugu', 'normal')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    doc.setFontSize(7.5)
    const splitContrAddr = doc.splitTextToSize(valContrAddress, 27)
    doc.text(splitContrAddr, 105.5, rowY + (spacingStep * 3))

    drawColRow('Number of Floors', agr.number_of_floors || '—', 138, 163, 165.5, rowY)
    drawColRow('Rate Per Sq.Ft.', `Rs. ${Number(agr.rate_per_square_foot).toLocaleString('en-IN')}/-`, 138, 163, 165.5, rowY + spacingStep)

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('Site Address', 138, rowY + (spacingStep * 3))
    doc.setTextColor(0, 0, 0)
    doc.text(':', 163, rowY + (spacingStep * 3))

    const valProjAddress = agr.site_address || '—'
    if (containsTelugu(valProjAddress)) {
      doc.setFont('Gidugu', 'normal')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    doc.setFontSize(7.5)
    const splitProjAddr = doc.splitTextToSize(valProjAddress, 27)
    doc.text(splitProjAddr, 165.5, rowY + (spacingStep * 3))

    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.5)
    doc.line(15, 80, W - 15, 80)

    doc.setFillColor(13, 27, 62)
    doc.roundedRect(85, 77, 40, 6, 1.2, 1.2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.25)
    doc.text('WORK DETAILS', 105, 81.2, { align: 'center' })

    const displayItems = [...agr.work_items]
    const minRows = 28
    if (displayItems.length < minRows) {
      const padCount = minRows - displayItems.length
      for (let i = 0; i < padCount; i++) {
        displayItems.push({ id: `padded-${i}`, name: '', description: '' })
      }
    }

    autoTable(doc, {
      startY: 86,
      head: [['No.', 'Item Name', 'Value / Description']],
      body: displayItems.map((item, idx) => [
        idx + 1,
        sanitizeText(item.name || ''),
        sanitizeText(item.description || '')
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', lineColor: [220, 225, 235], lineWidth: 0.1 },
      headStyles: { fillColor: [13, 27, 62], textColor: 255, fontStyle: 'bold', fontSize: 7.5, minCellHeight: 7.4, halign: 'center', valign: 'middle' },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 7.5, minCellHeight: 6.35, valign: 'middle', cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 14.4, halign: 'center' },
        1: { cellWidth: 81.0, halign: 'left' },
        2: { cellWidth: 84.6, halign: 'left' }
      },
      margin: { left: 15, right: 15, top: 22, bottom: 20 },
      didDrawCell: (data) => {
        if (data.cell.section === 'body') {
          const val = data.cell.text.join('\n')
          if (containsTelugu(val)) {
            doc.setFillColor(255, 255, 255)
            doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F')
            const imgData = drawTeluguTextToCanvasSync(val, data.cell.width, data.cell.height)
            if (imgData) {
              doc.addImage(imgData, 'JPEG', data.cell.x + 0.2, data.cell.y + 0.2, data.cell.width - 0.4, data.cell.height - 0.4)
            }
          }
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawContinuationHeader(data.pageNumber)
          drawSpacedFooter(data.pageNumber)
        }
      }
    })

    const tableFinalY = (doc as any).lastAutoTable.finalY + 4
    doc.setTextColor(220, 38, 38)
    doc.setFont('helvetica', 'oblique')
    doc.setFontSize(7.5)

    const note1 = 'Note 1: If extra floors are added, additional charges will be applicable.'
    const note2 = 'Note 2: All work will be executed strictly in accordance with this agreement. Any work exceeding this scope shall be billed additionally and borne by the owner.'

    const splitNote1 = doc.splitTextToSize(note1, W - 30)
    const splitNote2 = doc.splitTextToSize(note2, W - 30)

    doc.text(splitNote1, 15, tableFinalY)
    doc.text(splitNote2, 15, tableFinalY + (splitNote1.length * 4))

    let finalY = tableFinalY + (splitNote1.length * 4) + (splitNote2.length * 4)
    let y2 = finalY + 8

    if (y2 > H - 65) {
      doc.addPage()
      const lastPageNum = doc.getNumberOfPages()
      drawContinuationHeader(lastPageNum)
      drawSpacedFooter(lastPageNum)
      y2 = 22
    }

    doc.setFillColor(245, 158, 11)
    doc.rect(15, y2 - 2.5, 3.5, 3.5, 'F')
    doc.setTextColor(13, 27, 62)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.75)
    doc.text('ADDITIONAL REMARKS / NOTES', 20, y2)

    doc.setDrawColor(220, 225, 235)
    doc.setLineWidth(0.2)
    for (let x = 15; x < W - 15; x += 1.5) {
      doc.line(x, y2 + 2, x + 0.6, y2 + 2)
    }

    let lineY = y2 + 8
    doc.setDrawColor(200, 205, 215)
    doc.setLineWidth(0.15)
    for (let i = 0; i < 5; i++) {
      doc.line(15, lineY, W - 15, lineY)
      lineY += 7
    }

    const sigY = H - 20
    doc.setDrawColor(13, 27, 62)
    doc.setLineWidth(0.4)
    doc.line(15, sigY, 65, sigY)
    doc.line(W / 2 - 25, sigY, W / 2 + 25, sigY)
    doc.line(W - 65, sigY, W - 15, sigY)

    doc.setTextColor(13, 27, 62)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.75)
    doc.text('HOUSE OWNER SIGNATURE', 40, sigY + 4.5, { align: 'center' })
    doc.text('CONTRACTOR SIGNATURE', W / 2, sigY + 4.5, { align: 'center' })
    doc.text('WITNESS SIGNATURE', W - 40, sigY + 4.5, { align: 'center' })

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(245, 158, 11)
      doc.setLineWidth(0.3)
      doc.setFillColor(13, 27, 62)
      doc.roundedRect(W - 36, 2.5, 22, 5.2, 0.6, 0.6, 'FD')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.75)
      doc.text(`Page ${i} of ${totalPages}`, W - 25, 6.2, { align: 'center' })
    }

    if (shouldSave) {
      doc.save(`Agreement_${agr.agreement_number}.pdf`)
    }
    return doc
  }

  const handleOpenView = async (agr: Agreement) => {
    setSelectedAgr(agr)
    setShowViewModal(true)
    setPdfPreviewUrl(null)
    const doc = await generatePDF(agr, false)
    const blobUrl = doc.output('bloburl')
    setPdfPreviewUrl(blobUrl.toString())
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Legal Documents,</p>
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-1">Construction Agreement</h1>
        <p className="text-xs text-zinc-400 mt-1">Review work checklist details and download signed contract agreement.</p>
      </div>

      {/* List Card */}
      <div style={PANEL} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e2435] flex items-center gap-3">
          <FileText className="text-blue-500 shrink-0" size={18} />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Available Contracts Scoped</p>
        </div>

        {/* Table View */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader style={{ backgroundColor: '#0d1018' }}>
              <TableRow style={{ borderColor: '#1e2435' }}>
                {['Agreement No', 'Contract Date', 'Classification Rate', 'Floors Logged', 'Actions'].map(h => (
                  <TableHead key={h} className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-sm font-bold text-zinc-500">No agreements generated for this project yet.</TableCell>
                </TableRow>
              ) : (
                agreements.map((agr: Agreement) => (
                  <TableRow key={agr.id} style={{ borderColor: '#1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-4 py-4 text-xs font-bold text-white uppercase">{agr.agreement_number}</TableCell>
                    <TableCell className="px-4 py-4 text-xs text-zinc-300 font-semibold">{format(new Date(agr.agreement_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="px-4 py-4 text-xs font-semibold text-zinc-400">Rs. {Number(agr.rate_per_square_foot).toLocaleString('en-IN')}/- per sqft</TableCell>
                    <TableCell className="px-4 py-4 text-xs text-zinc-400 font-semibold">{agr.number_of_floors || '—'}</TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenView(agr)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>
                          <Eye size={12} /> View
                        </button>
                        <button onClick={() => generatePDF(agr)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-blue-600/10 text-blue-400 border border-blue-500/20">
                          <Download size={12} /> PDF
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="flex flex-col gap-3 p-4 sm:hidden">
          {agreements.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-zinc-500">No agreements generated for this project yet.</div>
          ) : (
            agreements.map((agr: Agreement) => (
              <div key={agr.id} className="rounded-xl p-4 flex flex-col gap-3 border border-[#1e2435]" style={{ backgroundColor: '#0d1018' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-black">CONTRACT NO</p>
                    <p className="text-xs text-white font-bold mt-1 uppercase">{agr.agreement_number}</p>
                  </div>
                  <p className="text-xs text-zinc-400 font-bold">{format(new Date(agr.agreement_date), 'dd MMM yyyy')}</p>
                </div>
                <div className="text-xs text-zinc-400 font-semibold border-t border-[#1e2435]/50 pt-2 flex flex-col gap-1">
                  <p><span className="text-zinc-600 font-black">Rate:</span> Rs. {Number(agr.rate_per_square_foot).toLocaleString('en-IN')}/- sqft</p>
                  <p><span className="text-zinc-600 font-black">Floors:</span> {agr.number_of_floors || '—'}</p>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-[#1e2435]/50">
                  <button onClick={() => handleOpenView(agr)} className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-lg text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>
                    <Eye size={12} /> View Details
                  </button>
                  <button onClick={() => generatePDF(agr)} className="flex-1 flex justify-center items-center gap-1.5 py-2 rounded-lg text-xs font-black uppercase bg-blue-600/10 text-blue-400 border border-blue-500/20">
                    <Download size={12} /> Download PDF
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* View Agreement Detail Modal */}
      {showViewModal && selectedAgr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowViewModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col space-y-4 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center pb-3 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Contract Agreement Document Preview</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">Agreement #{selectedAgr.agreement_number}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Native PDF Viewer Iframe */}
            <div className="flex-1 min-h-[550px] relative rounded-xl overflow-hidden border border-[#1e2435] bg-[#0d1018]">
              {pdfPreviewUrl ? (
                <iframe src={pdfPreviewUrl} className="w-full h-[580px] border-none" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-2.5 text-zinc-400">
                  <Loader2 className="animate-spin text-blue-500" size={24} />
                  <p className="text-xs font-bold uppercase tracking-wider">Generating PDF View...</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowViewModal(false)} className="px-5 h-11 rounded-xl text-xs font-bold bg-[#1a1f2e] text-[#f0f0f0] border border-[#1e2435]">
                Close
              </button>
              <button
                onClick={() => generatePDF(selectedAgr, true)}
                className="px-6 h-11 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/15"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
