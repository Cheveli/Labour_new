'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { 
  Plus, Loader2, FileText, Trash2, Edit3, Download, 
  ArrowUp, ArrowDown, Check, CheckCircle2, ChevronRight, X, Info
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS } from '@/lib/report-utils'

const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const DIM = '#6b7280'
const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

interface WorkItem {
  id: string
  name: string
  description: string
}

interface Agreement {
  id: string
  agreement_number: string
  agreement_date: string
  project_id: string
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

const DEFAULT_WORK_ITEMS = [
  'Cement', 'Steel', 'Bricks / Blocks', 'Sand', 'Coarse Aggregate (Metal)',
  'Fine Aggregate', 'Concrete Mix', 'Roof Height', 'Roof Design', 'Steel Quantity',
  'Water Supply', 'Walls', 'Doors', 'Windows', 'Painting', 'Flooring',
  'Staircase', 'Columns', 'Beams'
]

export default function AgreementsPage() {
  const supabase = createClient()

  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null)

  // Form states
  const [agreementNumber, setAgreementNumber] = useState('')
  const [agreementDate, setAgreementDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [ratePerSquareFoot, setRatePerSquareFoot] = useState<number>(0)
  const [numberOfFloors, setNumberOfFloors] = useState<string>('G+1')
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [remarks, setRemarks] = useState('')

  // Company profile details for PDF
  const [companyDetails, setCompanyDetails] = useState({
    name: 'SRI SAI CONSTRUCTIONS',
    contractor: 'Cheveli Somaiah',
    phone1: '9849678296',
    phone2: '9550017985',
    slogan: 'BUILDING YOUR VISION',
    address: 'Boduppal, Hyderabad',
    theme: 'original_navy'
  })

  // Load database content
  useEffect(() => {
    fetchProjects()
    fetchCompanyDetails()
  }, [])

  useEffect(() => {
    if (projects.length > 0) {
      fetchAgreements()
    }
  }, [projects])

  const fetchCompanyDetails = () => {
    const localName = localStorage.getItem('ssc_company_name')
    if (localName) {
      setCompanyDetails({
        name: localStorage.getItem('ssc_company_name') || 'SRI SAI CONSTRUCTIONS',
        contractor: localStorage.getItem('ssc_contractor_name') || 'Cheveli Somaiah',
        phone1: localStorage.getItem('ssc_company_phone_1') || '9849678296',
        phone2: localStorage.getItem('ssc_company_phone_2') || '9550017985',
        slogan: localStorage.getItem('ssc_company_slogan') || 'BUILDING YOUR VISION',
        address: localStorage.getItem('ssc_company_address') || 'Boduppal, Hyderabad',
        theme: localStorage.getItem('ssc_pdf_theme') || 'original_navy'
      })
    }
  }

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name, owner_name').neq('status', 'SYSTEM').order('name')
    setProjects(data || [])
  }

  const fetchAgreements = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('agreements').select('*').order('created_at', { ascending: false })
      if (error) {
        if (error.code === 'PGRST205') {
          // Table doesn't exist yet, fall back to local storage
          loadLocalAgreements()
          return
        }
        throw error
      }

      const formatted = (data || []).map((item: any) => {
        const proj = projects.find(p => p.id === item.project_id)
        return {
          ...item,
          project: proj ? { name: proj.name } : undefined
        }
      })
      setAgreements(formatted)
    } catch (err) {
      console.warn('Supabase agreements fetch failed, falling back to local storage:', err)
      loadLocalAgreements()
    } finally {
      setLoading(false)
    }
  }

  const loadLocalAgreements = () => {
    const local = localStorage.getItem('ssc_agreements')
    if (local) {
      try {
        const parsed = JSON.parse(local)
        const formatted = parsed.map((item: any) => {
          const proj = projects.find(p => p.id === item.project_id)
          return {
            ...item,
            project: proj ? { name: proj.name } : undefined
          }
        })
        setAgreements(formatted)
      } catch (e) {
        setAgreements([])
      }
    } else {
      setAgreements([])
    }
  }

  // Auto pre-fill default values on creation
  const handleOpenCreate = () => {
    setEditingAgreement(null)
    
    // Auto generate agreement number
    const year = new Date().getFullYear()
    const nextNum = agreements.length + 1
    setAgreementNumber(`AGR-${year}-${String(nextNum).padStart(5, '0')}`)
    setAgreementDate(new Date().toISOString().split('T')[0])
    
    setProjectId('')
    setSiteAddress('')
    setOwnerName('')
    setContractorName(companyDetails.contractor)
    setRatePerSquareFoot(0)
    setNumberOfFloors('G+1')
    setRemarks('All materials and works mentioned above are included in this agreement. Any additional work will be charged extra as mutually agreed.')

    // Load custom checklist items if saved in Settings, else standard 19
    const savedDefaults = localStorage.getItem('ssc_agreement_default_items')
    if (savedDefaults) {
      try {
        const parsed = JSON.parse(savedDefaults)
        setWorkItems(parsed.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: ''
        })))
      } catch (e) {
        loadDefaultChecklist()
      }
    } else {
      loadDefaultChecklist()
    }

    setShowForm(true)
  }

  const loadDefaultChecklist = () => {
    setWorkItems(DEFAULT_WORK_ITEMS.map((name, index) => ({
      id: `${index}-${Date.now()}`,
      name,
      description: ''
    })))
  }

  const handleOpenEdit = (agreement: Agreement) => {
    setEditingAgreement(agreement)
    setAgreementNumber(agreement.agreement_number)
    setAgreementDate(agreement.agreement_date)
    setProjectId(agreement.project_id)
    setSiteAddress(agreement.site_address)
    setOwnerName(agreement.owner_name)
    setContractorName(agreement.contractor_name)
    setRatePerSquareFoot(agreement.rate_per_square_foot)
    setNumberOfFloors(agreement.number_of_floors || '')
    setWorkItems(agreement.work_items)
    setRemarks(agreement.remarks)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agreement?')) return

    try {
      const { error } = await supabase.from('agreements').delete().eq('id', id)
      if (error) {
        if (error.code === 'PGRST205') {
          deleteLocalAgreement(id)
          return
        }
        throw error
      }
      toast.success('Agreement deleted successfully!')
      fetchAgreements()
    } catch (err: any) {
      console.warn('DB delete failed, falling back to local storage:', err)
      deleteLocalAgreement(id)
    }
  }

  const deleteLocalAgreement = (id: string) => {
    const local = localStorage.getItem('ssc_agreements')
    if (local) {
      const parsed = JSON.parse(local)
      const filtered = parsed.filter((item: any) => item.id !== id)
      localStorage.setItem('ssc_agreements', JSON.stringify(filtered))
      toast.success('Agreement deleted successfully!')
      loadLocalAgreements()
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreementNumber.trim()) return toast.error('Agreement number is required')
    if (!agreementDate) return toast.error('Agreement date is required')
    if (!ownerName.trim()) return toast.error('Owner Name is required')

    const payload = {
      agreement_number: agreementNumber,
      agreement_date: agreementDate,
      project_id: projectId || null,
      site_address: siteAddress,
      owner_name: ownerName,
      contractor_name: contractorName,
      rate_per_square_foot: Number(ratePerSquareFoot),
      number_of_floors: numberOfFloors,
      work_items: workItems,
      remarks: remarks
    }

    setSaving(true)
    try {
      if (editingAgreement) {
        const { error } = await supabase.from('agreements').update(payload).eq('id', editingAgreement.id)
        if (error) {
          if (error.code === 'PGRST205') {
            saveLocalAgreement(editingAgreement.id, payload)
            return
          }
          throw error
        }
        toast.success('Agreement updated successfully!')
      } else {
        const { error } = await supabase.from('agreements').insert([payload])
        if (error) {
          if (error.code === 'PGRST205') {
            saveLocalAgreement(null, payload)
            return
          }
          throw error
        }
        toast.success('Agreement created successfully!')
      }
      setShowForm(false)
      fetchAgreements()
    } catch (err: any) {
      console.warn('DB save failed, falling back to local storage:', err)
      saveLocalAgreement(editingAgreement ? editingAgreement.id : null, payload)
    } finally {
      setSaving(false)
    }
  }

  const saveLocalAgreement = (id: string | null, payload: any) => {
    const local = localStorage.getItem('ssc_agreements')
    let list = local ? JSON.parse(local) : []

    if (id) {
      // Edit mode
      list = list.map((item: any) => item.id === id ? { ...item, ...payload, updated_at: new Date().toISOString() } : item)
      toast.success('Agreement updated successfully!')
    } else {
      // Create mode
      const newRecord = {
        id: `local-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      list.unshift(newRecord)
      toast.success('Agreement created successfully!')
    }

    localStorage.setItem('ssc_agreements', JSON.stringify(list))
    setShowForm(false)
    loadLocalAgreements()
    setSaving(false)
  }

  // Dynamic checklist actions
  const addWorkItem = () => {
    setWorkItems([...workItems, {
      id: `${Date.now()}-${Math.random()}`,
      name: 'New Work Specification',
      description: ''
    }])
  }

  const deleteWorkItem = (id: string) => {
    setWorkItems(workItems.filter(item => item.id !== id))
  }

  const updateWorkItemName = (id: string, name: string) => {
    setWorkItems(workItems.map(item => item.id === id ? { ...item, name } : item))
  }

  const updateWorkItemValue = (id: string, description: string) => {
    setWorkItems(workItems.map(item => item.id === id ? { ...item, description } : item))
  }

  const moveItemUp = (index: number) => {
    if (index === 0) return
    const updated = [...workItems]
    const temp = updated[index]
    updated[index] = updated[index - 1]
    updated[index - 1] = temp
    setWorkItems(updated)
  }

  const moveItemDown = (index: number) => {
    if (index === workItems.length - 1) return
    const updated = [...workItems]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    setWorkItems(updated)
  }

  // Auto fill owner name and site address when project is chosen
  const handleProjectChange = (pId: string) => {
    setProjectId(pId)
    const selected = projects.find(p => p.id === pId)
    if (selected) {
      setOwnerName(selected.owner_name || '')
      // Check if address is stored in project description/address
      try {
        if (selected.description && selected.description.includes('{')) {
          const parsed = JSON.parse(selected.description)
          setSiteAddress(parsed.address || '')
        }
      } catch (e) {}
    }
  }

  // helper to convert number to currency words (Telugu/Rupees format)
  const numberToWordsRupees = (n: number): string => {
    if (n <= 0) return 'Zero Rupees Only'
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    function conv(num: number): string {
      if (num < 20) return ones[num] ? ones[num] + ' ' : ''
      if (num < 100) return tens[Math.floor(num / 10)] + ' ' + conv(num % 10)
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred ' + conv(num % 100)
      if (num < 100000) return conv(Math.floor(num / 1000)) + 'Thousand ' + conv(num % 1000)
      if (num < 10000000) return conv(Math.floor(num / 100000)) + 'Lakh ' + conv(num % 100000)
      return conv(Math.floor(num / 10000000)) + 'Crore ' + conv(num % 10000000)
    }
    return 'Rupees ' + conv(Math.floor(n)).trim() + ' Only'
  }

  // Draw the custom branding header logo (circle + home icon)
  const drawNirmanaLogo = (doc: jsPDF, x: number, y: number) => {
    doc.setFillColor(37, 99, 235) // Primary Blue
    doc.circle(x + 8, y + 8, 8, 'F')

    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.8)
    
    // Roof triangle
    doc.line(x + 4, y + 9, x + 8, y + 4)
    doc.line(x + 8, y + 4, x + 12, y + 9)
    // House walls
    doc.line(x + 6, y + 9, x + 6, y + 12)
    doc.line(x + 10, y + 9, x + 10, y + 12)
    doc.line(x + 6, y + 12, x + 10, y + 12)
  }

  // Draw handwritten-style blue signatures above labels
  const drawCursiveSignature = (doc: jsPDF, x: number, y: number) => {
    doc.setDrawColor(37, 99, 235) // Blue pen color
    doc.setLineWidth(0.5)
    
    // Cursive path segments
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

  // Generate Construction Agreement PDF matching the exact template layout
  const generatePDF = (agr: Agreement) => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    })

    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()

    // Color definitions
    const greyText = [100, 116, 139]
    const lightGreyLine = [225, 230, 240]

    // Function to draw header only on Page 1 (No circle logo, bigger brand name)
    const drawPremiumHeaderPage1 = () => {
      // 1. Solid Navy background
      doc.setFillColor(13, 27, 62)
      doc.rect(0, 0, W, 38, 'F')

      // 2. Orange bottom border
      doc.setFillColor(245, 158, 11)
      doc.rect(0, 38, W, 1.8, 'F')

      //  Sri Sai Constructions Title (Left) - HIGHLIGHT HEADER
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18) // Highlight size
      doc.text('SRI SAI CONSTRUCTIONS', 14, 12)

      doc.setTextColor(245, 158, 11)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.text('BUILDING YOUR VISION', 14, 16.5)

      // Spaced details below left title
      doc.setTextColor(230, 235, 245)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text(`Boduppal, Hyderabad, Telangana - 500092`, 14, 23)
      doc.text(`Contractor: Cheveli Somaiah`, 14, 27.5)
      doc.text(`Ph: 9849678296 / 9550017985`, 14, 32)

      // Title & orange badge (Right)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('CONSTRUCTION AGREEMENT', W - 14, 12, { align: 'right' })

      // Badge rounded rect
      doc.setFillColor(245, 158, 11)
      doc.roundedRect(W - 48, 14.5, 34, 4.5, 0.8, 0.8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text('AGREEMENT CONTRACT', W - 31, 17.8, { align: 'center' })

      // Metadata
      doc.setTextColor(220, 225, 235)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(`Agreement No : ${agr.agreement_number}`, W - 14, 27.5, { align: 'right' })
      doc.text(`Date : ${new Date(agr.agreement_date).toLocaleDateString('en-GB')}`, W - 14, 32, { align: 'right' })

      // Page number pill inside header (prevents overlapping details)
      doc.setDrawColor(245, 158, 11)
      doc.setLineWidth(0.4)
      doc.setFillColor(13, 27, 62)
      doc.roundedRect(W - 32, 4, 18, 4, 0.6, 0.6, 'FD')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.text('Page 1 of 2', W - 23, 7, { align: 'center' })
    }

    // Spaced Footer drawing function for all pages
    const drawSpacedFooter = () => {
      // 1. Navy bottom background
      doc.setFillColor(13, 27, 62)
      doc.rect(0, H - 12, W, 12, 'F')

      // 2. Orange top border
      doc.setFillColor(245, 158, 11)
      doc.rect(0, H - 12, W, 1.5, 'F')

      // 3. Spaced footer details
      doc.setTextColor(230, 235, 245)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)

      // Left
      doc.text('Ph: 9849678296 / 9550017985', 14, H - 5)
      // Center
      doc.text('Boduppal, Hyderabad, Telangana - 500092', W / 2, H - 5, { align: 'center' })
      // Right
      doc.text('SRI SAI CONSTRUCTIONS', W - 14, H - 5, { align: 'right' })
    }

    // DRAW PAGE 1
    drawPremiumHeaderPage1()
    drawSpacedFooter()

    // Details Grid Layout (3 Column Grid starting at y = 48)
    let detailY = 48

    // Headers with orange icon and dotted underline
    const drawColHeader = (title: string, cx: number, iconType: 'owner' | 'contractor' | 'project') => {
      doc.setTextColor(13, 27, 62)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5) // Increased header size
      
      // Draw small orange icon
      doc.setFillColor(245, 158, 11)
      if (iconType === 'owner') {
        doc.circle(cx - 3, detailY - 1, 1.2, 'F')
        doc.ellipse(cx - 3, detailY + 1.5, 2, 0.8, 'F')
      } else if (iconType === 'contractor') {
        doc.rect(cx - 4.5, detailY - 2, 3, 3, 'F')
        doc.circle(cx - 3, detailY + 1, 0.8, 'F')
      } else {
        doc.rect(cx - 4.5, detailY - 2.5, 3.5, 4.5, 'F')
      }

      doc.text(title, cx + 1, detailY)

      // Dotted underline
      doc.setDrawColor(245, 158, 11)
      doc.setLineWidth(0.25)
      let startX = cx - 5
      for (let x = startX; x < startX + 50; x += 1.5) {
        doc.line(x, detailY + 2.5, x + 0.6, detailY + 2.5)
      }
    }

    drawColHeader('OWNER DETAILS', 19, 'owner')
    drawColHeader('CONTRACTOR DETAILS', 81, 'contractor')
    drawColHeader('PROJECT DETAILS', 145, 'project')

    // Vertical Divider Lines (extended to y = 82)
    doc.setDrawColor(220, 225, 235)
    doc.setLineWidth(0.25)
    doc.line(72, detailY + 5, 72, detailY + 34)
    doc.line(136, detailY + 5, 136, detailY + 34)

    // Details text
    const drawColRow = (key: string, val: string, cx: number, valOffset: number, rY: number) => {
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5) // Increased key size
      doc.text(key, cx, rY)
      
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5) // Increased value size
      doc.text(`:  ${val}`, cx + valOffset, rY)
    }

    // Column 1 (Owner) values
    let rowY = detailY + 9 // starts somewhat below
    const spacingStep = 7.5 // row spacing increased

    drawColRow('Owner Name', agr.owner_name, 14, 24, rowY)
    drawColRow('Mobile Number', companyDetails.phone1, 14, 24, rowY + spacingStep)
    
    // Auto wrap long address
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text('Address', 14, rowY + (spacingStep * 2))
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const splitOwnerAddr = doc.splitTextToSize(agr.site_address || '—', 35)
    doc.text(':', 38, rowY + (spacingStep * 2))
    doc.text(splitOwnerAddr, 39.5, rowY + (spacingStep * 2))

    // Column 2 (Contractor) values
    drawColRow('Contractor Name', agr.contractor_name, 76, 26, rowY)
    drawColRow('Mobile Number', companyDetails.phone2, 76, 26, rowY + spacingStep)
    
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text('Address', 76, rowY + (spacingStep * 2))
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const splitContrAddr = doc.splitTextToSize(companyDetails.address, 34)
    doc.text(':', 102, rowY + (spacingStep * 2))
    doc.text(splitContrAddr, 103.5, rowY + (spacingStep * 2))

    // Column 3 (Project) values
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text('Site Address', 140, rowY)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const splitProjAddr = doc.splitTextToSize(agr.site_address || '—', 32)
    doc.text(':', 168, rowY)
    doc.text(splitProjAddr, 169.5, rowY)

    drawColRow('Number of Floors', agr.number_of_floors || '—', 140, 28, rowY + spacingStep)
    drawColRow('Rate Per Sq.Ft.', `Rs. ${Number(agr.rate_per_square_foot).toLocaleString('en-IN')}/-`, 140, 28, rowY + (spacingStep * 2))

    // Note about extra floors in column 3 (red, size 6.5, italic)
    doc.setTextColor(220, 38, 38)
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(6.5)
    const splitNoteText = doc.splitTextToSize('Note: If extra floors are added, additional charges will be applicable.', 54)
    doc.text(splitNoteText, 140, rowY + (spacingStep * 3))

    // WORK DETAILS Header
    // Horizontal orange line
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.5)
    doc.line(14, 85, W - 14, 85)

    // Navy pill block
    doc.setFillColor(13, 27, 62)
    doc.roundedRect(85, 82, 40, 6, 1.2, 1.2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('WORK DETAILS', 105, 86.2, { align: 'center' })

    // Page 1 Work details table (occupies space dynamically, pagebreaks handled automatically)
    autoTable(doc, {
      startY: 90,
      head: [['No.', 'Item Name', 'Value / Description']],
      body: agr.work_items.map((item, idx) => [idx + 1, item.name, item.description || '—']),
      theme: 'grid',
      headStyles: { fillColor: [13, 27, 62], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 8, cellPadding: 3.5 }, // Increased spacing (Height of cell)
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 60, fontStyle: 'bold', fontSize: 8.5 }, // Item name is bold and slightly bigger!
        2: { cellWidth: 107 }
      },
      margin: { left: 14, right: 14, top: 14, bottom: 20 },
      didDrawPage: (data) => {
        // Draw footer on every page
        drawSpacedFooter()

        // Page number pill (Only for subsequent pages, Page 1 drawn manually)
        if (data.pageNumber > 1) {
          doc.setDrawColor(210, 215, 225)
          doc.setLineWidth(0.3)
          doc.setFillColor(255, 255, 255)
          doc.roundedRect(W - 36, 6, 22, 5, 0.8, 0.8, 'FD')
          doc.setTextColor(110, 115, 125)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.text(`(Page ${data.pageNumber})`, W - 25, 9.5, { align: 'center' })
        }
      }
    })

    // Dotted caption under table
    const tableFinalY = (doc as any).lastAutoTable.finalY + 4
    doc.setTextColor(110, 115, 125)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.text('+ Additional items can be added in continuation if required.', 14, tableFinalY)

    // Calculate final Y position after autoTable
    let finalY = (doc as any).lastAutoTable.finalY
    let y2 = finalY + 8

    // If remarks + signatures overflow the page (limit ~ 197 Y), create a new page
    if (y2 > 197) {
      doc.addPage()
      drawSpacedFooter()
      
      // Page number pill
      doc.setDrawColor(210, 215, 225)
      doc.setLineWidth(0.3)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(W - 36, 6, 22, 5, 0.8, 0.8, 'FD')
      doc.setTextColor(110, 115, 125)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('(Page 2)', W - 25, 9.5, { align: 'center' })

      y2 = 14
    }

    // Additional Remarks header (orange icon, dotted line)
    doc.setFillColor(245, 158, 11)
    doc.rect(14, y2 - 2.5, 3.5, 3.5, 'F')
    doc.setTextColor(13, 27, 62)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('ADDITIONAL REMARKS / NOTES', 19, y2)
    
    // Dotted divider below header
    doc.setDrawColor(220, 225, 235)
    doc.setLineWidth(0.2)
    for (let x = 14; x < W - 14; x += 1.5) {
      doc.line(x, y2 + 2, x + 0.6, y2 + 2)
    }

    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const splitRemarks = doc.splitTextToSize(agr.remarks || 'No additional remarks.', W - 28)
    doc.text(splitRemarks, 14, y2 + 6)

    // Ruled lines for manual comments
    let lineY = y2 + 6 + (splitRemarks.length * 4) + 6
    doc.setDrawColor(230, 235, 245)
    doc.setLineWidth(0.15)
    for (let i = 0; i < 4; i++) {
      if (lineY < H - 38) {
        doc.line(14, lineY, W - 14, lineY)
        lineY += 6
      }
    }

    // Signatures section at bottom (left blank, no arrow marks!)
    const sigY = H - 24

    // Divider lines for signatures
    doc.setDrawColor(13, 27, 62)
    doc.setLineWidth(0.4)
    doc.line(14, sigY, 64, sigY)
    doc.line(W / 2 - 25, sigY, W / 2 + 25, sigY)
    doc.line(W - 64, sigY, W - 14, sigY)

    doc.setTextColor(13, 27, 62)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('HOUSE OWNER SIGNATURE', 39, sigY + 4.5, { align: 'center' })
    doc.text('CONTRACTOR SIGNATURE', W / 2, sigY + 4.5, { align: 'center' })
    doc.text('WITNESS SIGNATURE', W - 39, sigY + 4.5, { align: 'center' })

    // Save PDF
    doc.save(`Agreement_${agr.agreement_number}.pdf`)
    toast.success('Agreement PDF downloaded successfully!')
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header Banner */}
      {!showForm && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <FileText size={22} className="text-blue-400" />
              Agreements
            </h1>
            <p className="text-sm mt-1" style={{ color: DIM }}>
              Draft, customize, and generate professional construction agreements.
            </p>
          </div>
          <div>
            <button
              onClick={handleOpenCreate}
              className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/15"
            >
              <Plus size={14} /> Create Agreement
            </button>
          </div>
        </div>
      )}

      {/* Main dashboard List */}
      {!showForm && (
        <div style={PANEL} className="overflow-hidden">
          {loading ? (
            <div className="flex h-60 items-center justify-center text-zinc-400 font-bold gap-2">
              <Loader2 className="animate-spin text-blue-500" size={18} /> Loading agreements...
            </div>
          ) : agreements.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <FileText size={22} className="text-blue-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">No Agreements Yet</h3>
                <p className="text-xs max-w-xs text-zinc-500 font-medium leading-relaxed">
                  Draft your first construction agreement by clicking the Create Agreement button.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <Table>
                <TableHeader className="bg-zinc-950/40 border-b border-[#1e2435]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Agreement No.</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Project</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Owner</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Floors</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Rate / Sq.Ft.</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements.map((agr) => (
                    <TableRow key={agr.id} className="border-b border-[#1e2435]/50 hover:bg-zinc-950/20">
                      <TableCell className="text-xs font-black text-blue-400">{agr.agreement_number}</TableCell>
                      <TableCell className="text-xs font-bold text-zinc-300">
                        {new Date(agr.agreement_date).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-white max-w-[150px] truncate">
                        {agr.project?.name || '—'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-300 truncate">{agr.owner_name}</TableCell>
                      <TableCell className="text-xs font-bold text-zinc-400">{agr.number_of_floors || '—'}</TableCell>
                      <TableCell className="text-xs font-black text-white text-right">
                        ₹ {Number(agr.rate_per_square_foot).toLocaleString('en-IN')}/-
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => generatePDF(agr)}
                            className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors cursor-pointer"
                            title="Download PDF"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(agr)}
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(agr.id)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT OVERLAY FORM */}
      {showForm && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#1e2435]">
            <div>
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                <Link href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); setShowForm(false); }} className="hover:text-white transition-colors">Agreements</Link>
                <ChevronRight size={12} />
                <span className="text-zinc-300">{editingAgreement ? 'Edit Agreement' : 'Create Agreement'}</span>
              </div>
              <h1 className="text-xl font-black text-white tracking-tight mt-1">
                {editingAgreement ? 'Edit Agreement Details' : 'Create Agreement'}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">Fill in the details to generate construction contract</p>
            </div>

            <button
              onClick={() => setShowForm(false)}
              className="h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <X size={14} /> Back to Agreements
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Card 1: Basic Details */}
            <div style={PANEL} className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#1e2435]">
                <FileText size={16} className="text-blue-400" />
                <p className="text-xs font-black text-white uppercase tracking-wider">Basic Details</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Agreement Number *</label>
                  <input
                    type="text"
                    required
                    value={agreementNumber}
                    onChange={(e) => setAgreementNumber(e.target.value)}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Agreement Date *</label>
                  <input
                    type="date"
                    required
                    value={agreementDate}
                    onChange={(e) => setAgreementDate(e.target.value)}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Project (Optional)</label>
                  <select
                    value={projectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  >
                    <option value="">— Select Associated Project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Site Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Devender Nagar, Boduppal, Hyderabad, Telangana - 500092"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                  style={INPUT_ST}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Owner Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Owner's full name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Contractor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contractor's name"
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  />
                </div>
              </div>

              {/* Construction Details row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Number of Floors *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. G+1 / 2 Floors"
                    value={numberOfFloors}
                    onChange={(e) => setNumberOfFloors(e.target.value)}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Rate Per Square Foot (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 1780"
                    value={ratePerSquareFoot || ''}
                    onChange={(e) => setRatePerSquareFoot(Number(e.target.value))}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Work Details List */}
            <div style={PANEL} className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e2435]">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-purple-400" />
                  <p className="text-xs font-black text-white uppercase tracking-wider">Work Details</p>
                </div>
                <button
                  type="button"
                  onClick={addWorkItem}
                  className="h-9 px-3 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 text-[10px] font-black uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer border border-purple-500/20"
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {/* Dynamic list rendering */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 no-scrollbar">
                {workItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-[#0d1018] border border-[#1e2435]"
                  >
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <span className="text-xs font-black text-purple-400 w-6 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Item Name (e.g. Cement)"
                        value={item.name}
                        onChange={(e) => updateWorkItemName(item.id, e.target.value)}
                        className="flex-1 sm:w-48 h-10 px-2.5 text-xs font-semibold outline-none focus:border-purple-500/30 transition-all rounded bg-zinc-950/30 border border-[#1e2435]"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Value / Material description (e.g. Ultratech PPC / 10 Feet)"
                      value={item.description}
                      onChange={(e) => updateWorkItemValue(item.id, e.target.value)}
                      className="flex-1 w-full h-10 px-2.5 text-xs font-semibold outline-none focus:border-purple-500/30 transition-all rounded bg-zinc-950/30 border border-[#1e2435]"
                    />

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveItemUp(idx)}
                        disabled={idx === 0}
                        className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItemDown(idx)}
                        disabled={idx === workItems.length - 1}
                        className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWorkItem(item.id)}
                        className="p-2 text-red-400/80 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Remarks */}
            <div style={PANEL} className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#1e2435]">
                <FileText size={16} className="text-zinc-400" />
                <p className="text-xs font-black text-white uppercase tracking-wider">Remarks / Notes</p>
              </div>
              <textarea
                placeholder="Enter additional terms or remarks here. Textarea expands dynamically..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full min-h-[100px] p-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all resize-y no-scrollbar"
                style={INPUT_ST}
              />
            </div>

            {/* Card 4: Signature Mockups */}
            <div style={PANEL} className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#1e2435]">
                <FileText size={16} className="text-zinc-400" />
                <p className="text-xs font-black text-white uppercase tracking-wider">Signature Approvals</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-xl border border-dashed border-[#1e2435] bg-zinc-950/20 space-y-3">
                  <div className="h-10 flex items-center justify-center font-cursive text-blue-400 text-sm border-b border-[#1e2435]/50 border-dashed pb-2">
                    {ownerName ? <span className="opacity-75 italic">Owner Sign</span> : <span className="text-zinc-700 text-xs">— Pending —</span>}
                  </div>
                  <p className="text-[10px] font-black uppercase text-zinc-500">House Owner</p>
                </div>
                <div className="p-4 rounded-xl border border-dashed border-[#1e2435] bg-zinc-950/20 space-y-3">
                  <div className="h-10 flex items-center justify-center font-cursive text-blue-400 text-sm border-b border-[#1e2435]/50 border-dashed pb-2">
                    {contractorName ? <span className="opacity-75 italic">Contractor Sign</span> : <span className="text-zinc-700 text-xs">— Pending —</span>}
                  </div>
                  <p className="text-[10px] font-black uppercase text-zinc-500">Contractor</p>
                </div>
                <div className="p-4 rounded-xl border border-dashed border-[#1e2435] bg-zinc-950/20 space-y-3">
                  <div className="h-10 flex items-center justify-center font-cursive text-blue-400 text-sm border-b border-[#1e2435]/50 border-dashed pb-2">
                    <span className="opacity-75 italic">Witness Sign</span>
                  </div>
                  <p className="text-[10px] font-black uppercase text-zinc-500">Witness</p>
                </div>
              </div>
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-11 px-5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/15"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText size={14} />}
                Generate PDF
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
