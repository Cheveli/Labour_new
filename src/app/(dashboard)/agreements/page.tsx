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
import { TELUGU_FONT_BASE64 } from '@/lib/telugu-font'

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

const DEFAULT_WORK_ITEMS = [
  'Cement (Slab) / సిమెంట్ (స్లాబ్)',
  'Cement (Walls) / సిమెంట్ (గోడలు)',
  'Steel / స్టీల్',
  'Bricks / ఇటుకలు',
  'Sand / ఇసుక',
  'Slab Electrical Pipe / స్లాబ్ ఎలక్ట్రికల్ పైపు',
  'Wall Electrical Pipe / గోడల ఎలక్ట్రికల్ పైపు',
  'Electrical Wire / ఎలక్ట్రికల్ వైర్',
  'Switches / స్విచ్లు',
  'Door Frames / డోర్ ఫ్రేమ్లు',
  'Doors & Windows / తలుపులు మరియు కిటికీలు',
  'Flooring Marble / ఫ్లోరింగ్ మార్బుల్',
  'Water Pipe / నీటి పైపు',
  'Staircase / మెట్లు',
  'Tiles / టైల్స్',
  'Sintex Water Tank / సిన్టెక్స్ నీటి ట్యాంక్',
  'False Ceiling / ఫాల్స్ సీలింగ్',
  'Columns / కాలమ్స్',
  'Beams / బీమ్స్',
  'Water Taps / నీటి ట్యాపులు',
  'Western Commode / వెస్ట్రన్ కమోడ్',
  'Indian Commode / ఇండియన్ కమోడ్',
  'Painting / పెయింటింగ్'
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
  const [ownerFatherName, setOwnerFatherName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [ratePerSquareFoot, setRatePerSquareFoot] = useState<number>(0)
  const [numberOfFloors, setNumberOfFloors] = useState<string>('G+1')
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [remarks, setRemarks] = useState('')
  const [hasDraft, setHasDraft] = useState(false)

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

  // Load draft from localStorage on form open
  useEffect(() => {
    if (showForm) {
      const draft = localStorage.getItem('ssc_agreement_form_draft')
      if (draft) {
        try {
          const data = JSON.parse(draft)
          const currentId = editingAgreement ? editingAgreement.id : 'new'
          if (data.editingId === currentId) {
            setHasDraft(true)
          } else {
            setHasDraft(false)
          }
        } catch (e) {
          setHasDraft(false)
        }
      } else {
        setHasDraft(false)
      }
    }
  }, [showForm, editingAgreement])

  // Auto-save form progress to localStorage on any state changes
  useEffect(() => {
    if (!showForm) return

    const draftData = {
      editingId: editingAgreement ? editingAgreement.id : 'new',
      agreementNumber,
      agreementDate,
      projectId,
      siteAddress,
      ownerName,
      ownerFatherName,
      ownerPhone,
      contractorName,
      ratePerSquareFoot,
      numberOfFloors,
      workItems,
      remarks
    }

    localStorage.setItem('ssc_agreement_form_draft', JSON.stringify(draftData))
  }, [
    showForm,
    editingAgreement,
    agreementNumber,
    agreementDate,
    projectId,
    siteAddress,
    ownerName,
    ownerFatherName,
    ownerPhone,
    contractorName,
    ratePerSquareFoot,
    numberOfFloors,
    workItems,
    remarks
  ])

  const restoreDraft = () => {
    const draft = localStorage.getItem('ssc_agreement_form_draft')
    if (draft) {
      try {
        const data = JSON.parse(draft)
        setAgreementNumber(data.agreementNumber || '')
        setAgreementDate(data.agreementDate || '')
        setProjectId(data.projectId || '')
        setSiteAddress(data.siteAddress || '')
        setOwnerName(data.ownerName || '')
        setOwnerFatherName(data.ownerFatherName || '')
        setOwnerPhone(data.ownerPhone || '')
        setContractorName(data.contractorName || '')
        setRatePerSquareFoot(Number(data.ratePerSquareFoot) || 0)
        setNumberOfFloors(data.numberOfFloors || 'G+1')
        setWorkItems(data.workItems || [])
        setRemarks(data.remarks || '')
        toast.success('Draft restored successfully!')
      } catch (e) {
        toast.error('Failed to restore draft.')
      }
    }
    setHasDraft(false)
  }

  const discardDraft = () => {
    localStorage.removeItem('ssc_agreement_form_draft')
    setHasDraft(false)
    toast.info('Draft discarded.')
  }

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
    setOwnerFatherName('')
    setOwnerPhone('')
    setContractorName(companyDetails.contractor)
    setRatePerSquareFoot(0)
    setNumberOfFloors('G+1')
    setRemarks('All materials and works mentioned above are included in this agreement. Any additional work will be charged extra as mutually agreed.')

    // Load custom checklist items if saved in Settings, else standard 23
    const savedDefaults = localStorage.getItem('ssc_agreement_default_items')
    if (savedDefaults) {
      try {
        const parsed = JSON.parse(savedDefaults)
        const hasTelugu = parsed.some((item: any) => /[\u0c00-\u0c7f]/.test(item.name))
        if (parsed.length < 20 || !hasTelugu) {
          loadDefaultChecklist()
        } else {
          setWorkItems(parsed.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: ''
          })))
        }
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
    setProjectId(agreement.project_id || '')
    setSiteAddress(agreement.site_address || '')
    const ownerParts = (agreement.owner_name || '').split(' | ')
    const ownerVal = ownerParts[0] || ''

    const soPart = ownerParts.find((p: string) => p.startsWith('S/o: '))
    const fatherVal = soPart ? soPart.replace('S/o: ', '') : ''

    const phPart = ownerParts.find((p: string) => p.startsWith('Ph: '))
    const phoneVal = phPart ? phPart.replace('Ph: ', '') : ''

    setOwnerName(ownerVal)
    setOwnerFatherName(fatherVal)
    setOwnerPhone(phoneVal)
    setContractorName(agreement.contractor_name || '')
    setRatePerSquareFoot(agreement.rate_per_square_foot || 0)
    setNumberOfFloors(agreement.number_of_floors || '')
    setWorkItems(agreement.work_items || [])
    setRemarks(agreement.remarks || '')
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
      owner_name: [
        ownerName.trim(),
        ownerFatherName.trim() ? `S/o: ${ownerFatherName.trim()}` : '',
        ownerPhone.trim() ? `Ph: ${ownerPhone.trim()}` : ''
      ].filter(Boolean).join(' | '),
      contractor_name: contractorName,
      rate_per_square_foot: Number(ratePerSquareFoot),
      number_of_floors: numberOfFloors,
      work_items: workItems,
      remarks: remarks
    }

    setSaving(true)
    try {
      let savedRecord: any = null
      if (editingAgreement) {
        const { data, error } = await supabase.from('agreements')
          .update(payload)
          .eq('id', editingAgreement.id)
          .select('*')
          .maybeSingle()

        if (error) {
          if (error.code === 'PGRST205') {
            saveLocalAgreement(editingAgreement.id, payload)
            return
          }
          throw error
        }
        savedRecord = data
        toast.success('Agreement updated successfully!')
      } else {
        const { data, error } = await supabase.from('agreements')
          .insert([payload])
          .select('*')
          .maybeSingle()

        if (error) {
          if (error.code === 'PGRST205') {
            saveLocalAgreement(null, payload)
            return
          }
          throw error
        }
        savedRecord = data
        toast.success('Agreement created successfully!')
      }

      setShowForm(false)
      fetchAgreements()
      localStorage.removeItem('ssc_agreement_form_draft')

      // Automatically generate PDF on save
      const activeProject = projects.find(p => p.id === payload.project_id)
      const fullRecord = {
        ...payload,
        id: savedRecord?.id || (editingAgreement ? editingAgreement.id : `db-${Date.now()}`),
        created_at: savedRecord?.created_at || new Date().toISOString(),
        project: activeProject ? { name: activeProject.name } : undefined
      }
      setTimeout(() => {
        generatePDF(fullRecord)
      }, 300)

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
    let recordToDownload: any = null

    const activeProject = projects.find(p => p.id === payload.project_id)

    if (id) {
      // Edit mode
      const existing = list.find((item: any) => item.id === id)
      recordToDownload = {
        ...existing,
        ...payload,
        project: activeProject ? { name: activeProject.name } : undefined
      }
      list = list.map((item: any) => item.id === id ? recordToDownload : item)
      toast.success('Agreement updated successfully!')
    } else {
      // Create mode
      const newRecord = {
        id: `local-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      recordToDownload = {
        ...newRecord,
        project: activeProject ? { name: activeProject.name } : undefined
      }
      list.unshift(newRecord)
      toast.success('Agreement created successfully!')
    }

    localStorage.setItem('ssc_agreements', JSON.stringify(list))
    localStorage.removeItem('ssc_agreement_form_draft')
    setShowForm(false)
    loadLocalAgreements()
    setSaving(false)

    if (recordToDownload) {
      setTimeout(() => {
        generatePDF(recordToDownload)
      }, 300)
    }
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
      const ownerParts = (selected.owner_name || '').split(' | ')
      const ownerVal = ownerParts[0] || ''

      const soPart = ownerParts.find((p: string) => p.startsWith('S/o: '))
      const fatherVal = soPart ? soPart.replace('S/o: ', '') : ''

      const phPart = ownerParts.find((p: string) => p.startsWith('Ph: '))
      const phoneVal = phPart ? phPart.replace('Ph: ', '') : ''

      setOwnerName(ownerVal)
      setOwnerFatherName(fatherVal)
      setOwnerPhone(phoneVal)
      // Check if address is stored in project description/address
      try {
        if (selected.description && selected.description.includes('{')) {
          const parsed = JSON.parse(selected.description)
          setSiteAddress(parsed.address || '')
        }
      } catch (e) { }
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

  const containsTelugu = (text: string): boolean => {
    return /[\u0c00-\u0c7f]/.test(text || '');
  };

  const sanitizeText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/₹/g, 'Rs. ')
      .replace(/[‘’`´\u2018\u2019\u00b9]/g, "'")
      .replace(/[“”]/g, '"');
  };

  const drawTeluguTextToCanvasSync = (text: string, widthMm: number, heightMm: number): string => {
    if (typeof window === 'undefined') return '';
    const canvas = document.createElement('canvas');

    const scale = 3.5;
    const pxPerMm = 96 / 25.4;
    canvas.width = Math.round(widthMm * pxPerMm * scale);
    canvas.height = Math.round(heightMm * pxPerMm * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(scale, scale);

    ctx.fillStyle = '#000000';
    ctx.font = 'normal 10px "Noto Sans Telugu", "Gidugu", "Inter", sans-serif';
    ctx.textBaseline = 'middle';

    const padX = 4 * pxPerMm;
    const lines = text.split('\n');
    const lineSpacing = 3.8 * pxPerMm;
    const startY = (heightMm / 2) * pxPerMm - ((lines.length - 1) * lineSpacing / 2);

    lines.forEach((line, index) => {
      ctx.fillText(line, padX, startY + (index * lineSpacing));
    });

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Generate Construction Agreement PDF matching the exact template layout
  const generatePDF = async (agr: Agreement) => {
    // Ensure Telugu webfont is loaded in document head
    if (typeof window !== 'undefined' && !document.getElementById('telugu-webfont')) {
      const link = document.createElement('link');
      link.id = 'telugu-webfont';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Gidugu&family=Noto+Sans+Telugu:wght@400;700&display=swap';
      document.head.appendChild(link);
    }

    if (typeof window !== 'undefined') {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn('Fonts ready wait failed:', e);
      }
    }

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    })

    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()

    // Register Telugu Gidugu Font (supports both English & Telugu glyphs)
    try {
      doc.addFileToVFS('Gidugu-Regular.ttf', TELUGU_FONT_BASE64)
      doc.addFont('Gidugu-Regular.ttf', 'Gidugu', 'normal')
      doc.addFont('Gidugu-Regular.ttf', 'Gidugu', 'bold')
      doc.setFont('Gidugu', 'normal')
    } catch (e) {
      console.warn('Failed to load Telugu font:', e)
    }

    // Color definitions
    const greyText = [100, 116, 139]
    const lightGreyLine = [225, 230, 240]

    // Function to draw header on Page 1 (Keep existing layout but improve spacing/alignment)
    const drawPremiumHeader = (pageNum: number) => {
      // 1. Solid Navy background
      doc.setFillColor(13, 27, 62)
      doc.rect(0, 0, W, 38, 'F')

      // 2. Orange bottom border
      doc.setFillColor(245, 158, 11)
      doc.rect(0, 38, W, 1.8, 'F')

      // Sri Sai Constructions Title (Left) - HIGHLIGHT HEADER
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18) // 18pt = 24px
      doc.text('SRI SAI CONSTRUCTIONS', 15, 12)

      doc.setTextColor(245, 158, 11)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.25) // 8.25pt = 11px
      doc.text('BUILDING YOUR VISION', 15, 16.5)

      // Spaced details below left title
      doc.setTextColor(230, 235, 245)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5) // 7.5pt = 10px
      doc.text('Boduppal, Hyderabad, Telangana - 500092', 15, 23)
      doc.text('Contractor: Cheveli Somaiah', 15, 27.5)
      doc.text('Ph: 9849678296 / 9550017985', 15, 32)

      // Title & orange badge (Right) - repositioned to prevent overlaps
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15) // 15pt = 20px Bold
      doc.text('CONSTRUCTION AGREEMENT', W - 15, 15, { align: 'right' })

      // Badge rounded rect
      doc.setFillColor(245, 158, 11)
      doc.roundedRect(W - 53, 17.5, 38, 5, 0.8, 0.8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.25) // 8.25pt = 11px
      doc.text('AGREEMENT CONTRACT', W - 34, 21, { align: 'center' })

      // Metadata - aligned on the right side
      doc.setTextColor(220, 225, 235)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.25) // 8.25pt = 11px
      doc.text(`Agreement No : ${agr.agreement_number}`, W - 15, 29, { align: 'right' })
      doc.text(`Date : ${new Date(agr.agreement_date).toLocaleDateString('en-GB')}`, W - 15, 33.5, { align: 'right' })
    }

    // Function to draw header for continuation pages (Page 2+)
    const drawContinuationHeader = (pageNum: number) => {
      // 15mm high navy bar
      doc.setFillColor(13, 27, 62)
      doc.rect(0, 0, W, 15, 'F')

      // Orange bottom border
      doc.setFillColor(245, 158, 11)
      doc.rect(0, 15, W, 1.2, 'F')

      // Left text
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.25) // 11px
      doc.text('CONSTRUCTION AGREEMENT - CONTINUATION', 15, 9.5)

      // Right text (Agreement No) - aligned next to page number badge
      doc.setTextColor(220, 225, 235)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.25) // 11px
      doc.text(`Agreement No : ${agr.agreement_number}`, W - 40, 9.5, { align: 'right' })
    }

    // Spaced Footer drawing function for all pages
    const drawSpacedFooter = (pageNum: number) => {
      // 1. Navy bottom background
      doc.setFillColor(13, 27, 62)
      doc.rect(0, H - 8, W, 8, 'F')

      // 2. Orange top border
      doc.setFillColor(245, 158, 11)
      doc.rect(0, H - 8, W, 1.2, 'F')

      // 3. Spaced footer details
      doc.setTextColor(230, 235, 245)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.75) // 6.75pt = 9px

      // Left
      doc.text('SRI SAI CONSTRUCTIONS', 15, H - 3.5)
      // Center
      doc.text('Ph: 9849678296 / 9550017985', W / 2, H - 3.5, { align: 'center' })
      // Right
      doc.text('Boduppal, Hyderabad, Telangana - 500092', W - 15, H - 3.5, { align: 'right' })
    }

    // DRAW PAGE 1
    drawPremiumHeader(1)
    drawSpacedFooter(1)

    // Details Grid Layout (Structured Tabular Columns starting at y = 44)
    doc.setFont('helvetica', 'normal')

    // Headers with navy block background and white text/vector icons
    const drawColHeader = (title: string, colX: number, iconType: 'owner' | 'contractor' | 'project') => {
      // 1. Navy background header block
      doc.setFillColor(13, 27, 62)
      doc.rect(colX, 44, 60, 6, 'F')

      // 2. Orange bottom accent border line
      doc.setFillColor(245, 158, 11)
      doc.rect(colX, 50, 60, 0.8, 'F')

      // 3. Body light-grey border box
      doc.setDrawColor(220, 225, 235)
      doc.setLineWidth(0.2)
      doc.rect(colX, 50, 60, 24)

      // Calculate centering for dynamic combined block (white text + vector icon)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.75) // 13px = 9.75pt

      const textWidth = doc.getTextWidth(title)
      const iconWidth = 5.2 // 18px-20px equivalent bounding box width in mm
      const spacing = 2.5 // space between icon and text
      const totalW = textWidth + iconWidth + spacing
      const startX = colX + 30 - (totalW / 2)
      const cx = startX + (iconWidth / 2) // center of the icon
      const textX = startX + iconWidth + spacing

      // Draw premium white/orange vector icon centered at cx
      doc.setFillColor(255, 255, 255)
      if (iconType === 'owner') {
        // Owner user avatar silhouette
        doc.circle(cx, 46.2, 1.3, 'F')
        doc.ellipse(cx, 48.6, 2.5, 0.9, 'F')
      } else if (iconType === 'contractor') {
        // Contractor Worker silhouette with Hardhat dome/brim
        doc.circle(cx, 46.5, 1.1, 'F') // head
        doc.ellipse(cx, 48.6, 2.5, 0.9, 'F') // shoulders
        doc.setDrawColor(245, 158, 11)
        doc.setLineWidth(0.4)
        doc.line(cx - 1.8, 46.2, cx + 1.8, 46.2) // orange brim
        doc.setFillColor(245, 158, 11)
        doc.ellipse(cx, 46.0, 1.3, 0.9, 'F') // orange cap dome
      } else {
        // Project house silhouette
        doc.setFillColor(245, 158, 11)
        doc.triangle(cx - 2.8, 47.4, cx, 44.6, cx + 2.8, 47.4, 'F') // roof
        doc.rect(cx - 2.4, 47.4, 4.8, 2.0, 'F') // body
        doc.setFillColor(255, 255, 255)
        doc.rect(cx - 0.7, 48.2, 1.4, 1.2, 'F') // white door
      }

      // Draw white centered title text
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.75)
      doc.text(title, textX, 48.2)
    }

    drawColHeader('OWNER DETAILS', 15, 'owner')
    drawColHeader('CONTRACTOR DETAILS', 75, 'contractor')
    drawColHeader('PROJECT DETAILS', 135, 'project')

    // Details text inside tabular cards (padded by 3mm left and aligned colons)
    const drawColRow = (key: string, val: string, cx: number, colonX: number, valX: number, rY: number) => {
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5) // Field Label: 10px = 7.5pt
      doc.text(key, cx, rY)

      doc.setTextColor(0, 0, 0)
      doc.text(':', colonX, rY)

      if (containsTelugu(val)) {
        doc.setFont('Gidugu', 'normal')
      } else {
        doc.setFont('helvetica', 'normal')
      }
      doc.setFontSize(7.5) // Field Value: 10px = 7.5pt
      doc.text(val, valX, rY)
    }

    // Column 1 (Owner) values
    let rowY = 54.5
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

    // Auto wrap long address
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

    // Column 2 (Contractor) values
    drawColRow('Contractor Name', agr.contractor_name, 78, 103, 105.5, rowY)
    // Row 2 is skipped to align horizontally with Owner column
    drawColRow('Mobile Number', companyDetails.phone1, 78, 103, 105.5, rowY + (spacingStep * 2))

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('Address', 78, rowY + (spacingStep * 3))

    doc.setTextColor(0, 0, 0)
    doc.text(':', 103, rowY + (spacingStep * 3))

    const valContrAddress = companyDetails.address
    if (containsTelugu(valContrAddress)) {
      doc.setFont('Gidugu', 'normal')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    doc.setFontSize(7.5)
    const splitContrAddr = doc.splitTextToSize(valContrAddress, 27)
    doc.text(splitContrAddr, 105.5, rowY + (spacingStep * 3))

    // Column 3 (Project) values
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

    // WORK DETAILS Header - spaced down
    // Horizontal orange line
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.5)
    doc.line(15, 80, W - 15, 80)

    // Navy pill block centered
    doc.setFillColor(13, 27, 62)
    doc.roundedRect(85, 77, 40, 6, 1.2, 1.2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.25)
    doc.text('WORK DETAILS', 105, 81.2, { align: 'center' })

    // Pad checklist to exactly 28 rows if it contains fewer items
    const displayItems = [...agr.work_items]
    const minRows = 28
    if (displayItems.length < minRows) {
      const padCount = minRows - displayItems.length
      for (let i = 0; i < padCount; i++) {
        displayItems.push({ id: `padded-${i}`, name: '', description: '' })
      }
    }

    // Page 1 Work details table
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
            // Draw a solid white rect to hide the linear text
            doc.setFillColor(255, 255, 255)
            doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F')

            // Draw the perfectly shaped canvas image
            const imgData = drawTeluguTextToCanvasSync(val, data.cell.width, data.cell.height)
            if (imgData) {
              doc.addImage(imgData, 'JPEG', data.cell.x + 0.2, data.cell.y + 0.2, data.cell.width - 0.4, data.cell.height - 0.4)
            }
          }
        }
      },
      didDrawPage: (data) => {
        // Draw header and footer on every page automatically
        if (data.pageNumber === 1) {
          // Page 1 header and footer are drawn manually before autotable
        } else {
          drawContinuationHeader(data.pageNumber)
          drawSpacedFooter(data.pageNumber)
        }
      }
    })

    // Draw red notes directly under the table
    const tableFinalY = (doc as any).lastAutoTable.finalY + 4
    doc.setTextColor(220, 38, 38)
    doc.setFont('helvetica', 'oblique')
    doc.setFontSize(7.5) // 10px

    const note1 = 'Note 1: If extra floors are added, additional charges will be applicable.'
    const note2 = 'Note 2: All work will be executed strictly in accordance with this agreement. Any work exceeding this scope shall be billed additionally and borne by the owner.'

    const splitNote1 = doc.splitTextToSize(note1, W - 30)
    const splitNote2 = doc.splitTextToSize(note2, W - 30)

    doc.text(splitNote1, 15, tableFinalY)
    doc.text(splitNote2, 15, tableFinalY + (splitNote1.length * 4))

    // Calculate final Y position after both notes
    let finalY = tableFinalY + (splitNote1.length * 4) + (splitNote2.length * 4)
    let y2 = finalY + 8

    // If remarks + signatures overflow the page (limit ~ H - 65 to fit 5 ruled lines + margins), create a new page
    if (y2 > H - 65) {
      doc.addPage()
      const lastPageNum = doc.getNumberOfPages()
      drawContinuationHeader(lastPageNum)
      drawSpacedFooter(lastPageNum)
      y2 = 22 // start below continuation header on new page
    }

    // Additional Remarks header (orange icon, dotted line)
    doc.setFillColor(245, 158, 11)
    doc.rect(15, y2 - 2.5, 3.5, 3.5, 'F')
    doc.setTextColor(13, 27, 62)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.75) // Section headers: 13px = 9.75pt
    doc.text('ADDITIONAL REMARKS / NOTES', 20, y2)

    // Dotted divider below header
    doc.setDrawColor(220, 225, 235)
    doc.setLineWidth(0.2)
    for (let x = 15; x < W - 15; x += 1.5) {
      doc.line(x, y2 + 2, x + 0.6, y2 + 2)
    }

    // Ruled lines for manual comments (exactly five blank lines, no default text)
    let lineY = y2 + 8
    doc.setDrawColor(200, 205, 215)
    doc.setLineWidth(0.15)
    for (let i = 0; i < 5; i++) {
      doc.line(15, lineY, W - 15, lineY)
      lineY += 7
    }

    // Signatures section at bottom
    const sigY = H - 20

    // Divider lines for signatures (aligned to margins)
    doc.setDrawColor(13, 27, 62)
    doc.setLineWidth(0.4)
    doc.line(15, sigY, 65, sigY)
    doc.line(W / 2 - 25, sigY, W / 2 + 25, sigY)
    doc.line(W - 65, sigY, W - 15, sigY)

    doc.setTextColor(13, 27, 62)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.75) // 6.75pt = 9px
    doc.text('HOUSE OWNER SIGNATURE', 40, sigY + 4.5, { align: 'center' })
    doc.text('CONTRACTOR SIGNATURE', W / 2, sigY + 4.5, { align: 'center' })
    doc.text('WITNESS SIGNATURE', W - 40, sigY + 4.5, { align: 'center' })

    // Add page numbers in post-processing on every page
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)

      // Page number pill inside header
      doc.setDrawColor(245, 158, 11)
      doc.setLineWidth(0.3)
      doc.setFillColor(13, 27, 62)
      doc.roundedRect(W - 36, 2.5, 22, 5.2, 0.6, 0.6, 'FD')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.75) // 6.75pt = 9px
      doc.text(`Page ${i} of ${totalPages}`, W - 25, 6.2, { align: 'center' })
    }

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e2435]">
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
              className="w-full sm:w-auto h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <X size={14} /> Back to Agreements
            </button>
          </div>

          {hasDraft && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs">
              <div className="flex items-center gap-2.5 text-blue-400 text-left">
                <Info size={16} className="shrink-0" />
                <span>We found an unsaved draft from your last session. Would you like to restore it?</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="w-1/2 sm:w-auto px-4 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all cursor-pointer text-center text-[11px] uppercase tracking-wider"
                >
                  Restore Draft
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="w-1/2 sm:w-auto px-4 py-2 font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all cursor-pointer text-center text-[11px] uppercase tracking-wider"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

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
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Owner Mobile Number</label>
                  <input
                    type="text"
                    placeholder="Owner's mobile number"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                    style={INPUT_ST}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Son of (S/o)</label>
                  <input
                    type="text"
                    placeholder="Father's name"
                    value={ownerFatherName}
                    onChange={(e) => setOwnerFatherName(e.target.value)}
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
                        list="item-suggestions"
                        placeholder="Item Name (e.g. Cement)"
                        value={item.name}
                        onChange={(e) => updateWorkItemName(item.id, e.target.value)}
                        className="flex-1 sm:w-48 h-10 px-2.5 text-xs font-semibold outline-none focus:border-purple-500/30 transition-all rounded bg-zinc-950/30 border border-[#1e2435]"
                      />
                    </div>

                    <input
                      type="text"
                      list="material-suggestions"
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
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full sm:w-auto h-11 px-5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/15"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText size={14} />}
                Generate PDF
              </button>
            </div>
          </form>

          <datalist id="item-suggestions">
            <option value="Cement" />
            <option value="Steel" />
            <option value="Sand" />
            <option value="Bricks" />
            <option value="Aggregate (20mm)" />
            <option value="Plumbing Pipes" />
            <option value="Electrical Wires" />
            <option value="Flooring Marble" />
            <option value="Flooring Tiles" />
            <option value="Staircase Granite" />
            <option value="Kitchen Granite" />
            <option value="Painting & Putty" />
            <option value="Doors & Frames" />
            <option value="Windows & Grills" />
            <option value="Water Tank" />
            <option value="Water Taps" />
            <option value="False Ceiling" />
            <option value="Sanitaryware" />
            <option value="Basement Height" />
            <option value="Slab Thickness" />
          </datalist>

          <datalist id="material-suggestions">
            <option value="Ultratech Cement" />
            <option value="Priya Cement" />
            <option value="Maha Cement" />
            <option value="Birla Gold Cement" />
            <option value="Vizag Steel (TMT)" />
            <option value="Tata Tiscon Steel" />
            <option value="Ashirvad CPVC Pipes" />
            <option value="Sudhakar PVC Pipes" />
            <option value="Supreme Water Tank" />
            <option value="Sintex Water Tank" />
            <option value="Finolex Wires" />
            <option value="Polycab Wires" />
            <option value="Asian Paints (Apex)" />
            <option value="Birla Wall Care Putty" />
            <option value="Granite '60" />
            <option value="Granite '80" />
            <option value="Vitrified Tiles 2x2" />
            <option value="Ceramic Tiles 18x12" />
            <option value="Cera Sanitaryware" />
            <option value="Parryware Fittings" />
            <option value="10 Feet" />
            <option value="12 Feet" />
            <option value="Ashirvad 1st Quality" />
            <option value="True Flow Pipes" />
            <option value="Red Bricks" />
            <option value="Fly Ash Bricks" />
            <option value="River Sand" />
            <option value="Robo Sand" />
          </datalist>
        </div>
      )}
    </div>
  )
}
