'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FolderClosed,
  FolderOpen,
  ArrowLeft,
  Plus,
  Download,
  Trash2,
  Edit2,
  X,
  Loader2,
  Briefcase,
  Wallet,
  Phone,
  Calendar,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import { drawPremiumHeader, drawPremiumFooter, PDF_COLORS, COMPANY_DETAILS } from '@/lib/report-utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const DEFAULT_WORK_NATURES = [
  'Centering Work',
  'Labour Contractor',
  'JCB / Excavation',
  'Masonry',
  'Plumbing',
  'Electrician',
  'Tiles Work',
  'Painter',
  'Carpenter',
  'Aluminium Work',
  'Granite Installation',
  'Welding',
  'Other'
]

export default function SubcontractsPage() {
  const supabase = createClient()

  // State Management
  const [contractors, setContractors] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Folder navigation
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  // Modal states
  const [showAddSubModal, setShowAddSubModal] = useState(false)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<any | null>(null)
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null)

  // Forms
  const [newSubForm, setNewSubForm] = useState({
    name: '',
    mobile: '',
    work_nature: '',
    custom_work: '',
    project_id: '',
    site_project: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  })

  const [newPaymentForm, setNewPaymentForm] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    site_project: '',
    notes: ''
  })

  // Load Initial Data
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [subsRes, projRes] = await Promise.all([
        supabase.from('contractor_payments').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('name')
      ])

      if (subsRes.error) throw subsRes.error
      if (projRes.error) throw projRes.error

      setContractors(subsRes.data || [])
      setProjects(projRes.data || [])

      if (projRes.data && projRes.data.length > 0) {
        const firstProjId = projRes.data[0].id
        const firstProjName = projRes.data[0].name
        setNewSubForm(prev => ({ ...prev, project_id: prev.project_id || firstProjId }))
        setNewPaymentForm(prev => ({ ...prev, site_project: prev.site_project || firstProjName }))
      }

      // Update currently opened subcontractor details if visible
      if (selectedSubcontractor) {
        const updated = subsRes.data?.find(c => c.id === selectedSubcontractor.id)
        if (updated) setSelectedSubcontractor(updated)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to load data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Parse custom notes structure for subcontractor ledger entries
  const getSubcontractorData = (sub: any) => {
    let parsedNotes = { description: '', project_id: '', project_name: '' }
    try {
      if (sub.notes && (sub.notes.startsWith('{') || sub.notes.startsWith('['))) {
        parsedNotes = JSON.parse(sub.notes)
      } else {
        parsedNotes = {
          description: sub.notes || '',
          project_id: '',
          project_name: ''
        }
      }
    } catch (e) {
      parsedNotes = {
        description: sub.notes || '',
        project_id: '',
        project_name: ''
      }
    }

    let installments = sub.installments || []
    const sumInstallments = installments.reduce((sum: number, inst: any) => sum + Number(inst.amount || 0), 0)
    
    // Inject legacy balance payment if total_amount is greater than recorded installments
    if (sub.total_amount > sumInstallments) {
      const diff = sub.total_amount - sumInstallments
      installments = [
        {
          amount: diff,
          date: sub.date || format(new Date(sub.created_at), 'yyyy-MM-dd'),
          receipt_number: 1,
          site_project: parsedNotes.project_name || 'Legacy Project',
          notes: 'Legacy Balance / Migrated Payout'
        },
        ...installments.map((inst: any, idx: number) => ({ ...inst, receipt_number: idx + 2 }))
      ]
    }

    const totalPaid = installments.reduce((sum: number, inst: any) => sum + Number(inst.amount || 0), 0)

    return {
      description: parsedNotes.description || '',
      projectId: parsedNotes.project_id || '',
      projectName: parsedNotes.project_name || '',
      installments,
      totalPaid
    }
  }

  // Subcontractor Creation
  const handleCreateSubcontractor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubForm.name) {
      toast.error('Name is required')
      return
    }

    const finalWorkNature = newSubForm.work_nature === 'Other' ? newSubForm.custom_work : newSubForm.work_nature
    if (!finalWorkNature) {
      toast.error('Please specify a department or work type')
      return
    }

    setSaving(true)
    try {
      const selectedProject = projects.find(p => p.id === newSubForm.project_id)
      const selectedProjectName = selectedProject ? selectedProject.name : ''

      const parsedNotes = {
        description: newSubForm.notes,
        project_id: newSubForm.project_id,
        project_name: selectedProjectName
      }

      const { error } = await supabase.from('contractor_payments').insert([{
        name: newSubForm.name,
        mobile: newSubForm.mobile,
        work_nature: finalWorkNature,
        total_amount: 0,
        date: newSubForm.date,
        notes: JSON.stringify(parsedNotes),
        installments: [],
        total_paid: 0,
        current_receipt: 0
      }])

      if (error) throw error

      toast.success(`Subcontractor "${newSubForm.name}" registered successfully!`)
      setNewSubForm({
        name: '',
        mobile: '',
        work_nature: activeFolder || '',
        custom_work: '',
        project_id: projects[0]?.id || '',
        site_project: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      })
      setShowAddSubModal(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Add Installment Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubcontractor || !newPaymentForm.amount) {
      toast.error('Payment amount is required')
      return
    }

    try {
      const subData = getSubcontractorData(selectedSubcontractor)
      const nextReceiptNumber = (selectedSubcontractor.current_receipt || 0) + 1

      const newInst = {
        amount: parseFloat(newPaymentForm.amount),
        date: newPaymentForm.date,
        receipt_number: nextReceiptNumber,
        site_project: newPaymentForm.site_project,
        notes: newPaymentForm.notes // Optional notes
      }

      const updatedInstallments = [...subData.installments, newInst]
      const totalPaid = updatedInstallments.reduce((sum: number, inst: any) => sum + inst.amount, 0)

      const { error } = await supabase
        .from('contractor_payments')
        .update({
          installments: updatedInstallments,
          total_paid: totalPaid,
          current_receipt: nextReceiptNumber
        })
        .eq('id', selectedSubcontractor.id)

      if (error) throw error

      toast.success('Installment payment added successfully!')
      setNewPaymentForm(prev => ({
        ...prev,
        amount: '',
        notes: ''
      }))
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Delete Payment Installment
  const handleDeletePayment = async (receiptNum: number) => {
    if (!selectedSubcontractor) return
    if (!confirm('Are you sure you want to delete this payment record?')) return

    try {
      const subData = getSubcontractorData(selectedSubcontractor)
      const updatedInstallments = subData.installments.filter((inst: any) => inst.receipt_number !== receiptNum)
      const totalPaid = updatedInstallments.reduce((sum: number, inst: any) => sum + inst.amount, 0)

      const { error } = await supabase
        .from('contractor_payments')
        .update({
          installments: updatedInstallments,
          total_paid: totalPaid
        })
        .eq('id', selectedSubcontractor.id)

      if (error) throw error

      toast.success('Payment installment deleted')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Subcontractor Deletion
  const handleDeleteSubcontractor = async () => {
    if (!deleteSubId) return
    try {
      const { error } = await supabase
        .from('contractor_payments')
        .delete()
        .eq('id', deleteSubId)

      if (error) throw error

      toast.success('Subcontractor removed successfully')
      setDeleteSubId(null)
      setSelectedSubcontractor(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Receipt PDF Generation
  const exportPDF = (sub: any, installment: any) => {
    const subData = getSubcontractorData(sub)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 160]
    })

    const W = 80
    const H = 160

    // Header (Navy background)
    doc.setFillColor(13, 27, 62)
    doc.rect(0, 0, W, 27, 'F')

    // Gold Strip beneath header
    doc.setFillColor(245, 158, 11)
    doc.rect(0, 27, W, 1.5, 'F')

    // White background for contents
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 28.5, W, H - 28.5, 'F')

    // Company Details text
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(COMPANY_DETAILS.name, 40, 7, { align: 'center' })

    doc.setFontSize(4.5)
    doc.setFont('helvetica', 'normal')
    doc.text(COMPANY_DETAILS.tagline, 40, 12, { align: 'center' })
    doc.text(COMPANY_DETAILS.address, 40, 17, { align: 'center' })
    doc.text(`Authorized Signatory: Cheveli Somaiah | Ph: ${COMPANY_DETAILS.phones.split(' / ')[0]}`, 40, 22, { align: 'center' })

    // Title (with gold border accent)
    const titleY = 34
    doc.setFillColor(13, 27, 62)
    doc.roundedRect(15, titleY, 50, 8, 1.5, 1.5, 'F')
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.3)
    doc.roundedRect(15, titleY, 50, 8, 1.5, 1.5, 'S')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYMENT VOUCHER', 40, titleY + 5, { align: 'center' })

    // Voucher info
    const infoY = titleY + 14
    doc.setTextColor(100, 116, 139) // Muted color
    doc.setFontSize(5)
    doc.setFont('helvetica', 'normal')
    doc.text(`Voucher No. : VOUCH-${sub.id.slice(0, 6).toUpperCase()}-${installment.receipt_number}`, 10, infoY)
    doc.text(`Date : ${format(new Date(installment.date), 'dd MMM yyyy')}`, 70, infoY, { align: 'right' })

    doc.setDrawColor(220, 225, 235)
    doc.setLineWidth(0.2)
    doc.line(5, infoY + 3, 75, infoY + 3)

    // Details Block Header
    const detailsY = infoY + 6
    doc.setFillColor(13, 27, 62)
    doc.rect(5, detailsY, 70, 5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.text('SUBCONTRACTOR & TRANSACTION DETAILS', 40, detailsY + 3.5, { align: 'center' })

    const tableY = detailsY + 5
    const payLabel = 'Amount Paid'
    const termLabel = 'Payment No.'

    const details = [
      ['Name', sub.name],
      ['Department', sub.work_nature],
      ['Contact No.', sub.mobile || '—'],
      ['Site / Project', installment.site_project || '—'],
      [termLabel, `#${installment.receipt_number}`],
      [payLabel, `Rs. ${Number(installment.amount).toLocaleString('en-IN')}`],
      ['Remarks', installment.notes || '—']
    ]

    // Alternate backgrounds and draw outer box with thin horizontal separators
    let currentY = tableY
    details.forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 255)
        doc.rect(5, currentY, 70, 5, 'F')
      }
      
      doc.setTextColor(13, 27, 62)
      doc.setFontSize(4.5)
      doc.setFont('helvetica', 'bold')
      doc.text(`${row[0]}               :`, 8, currentY + 3.2)

      if (row[0] === payLabel) {
        doc.setTextColor(22, 163, 74) // Premium Green color
        doc.setFont('helvetica', 'bold')
      } else {
        doc.setTextColor(70, 80, 95)
        doc.setFont('helvetica', 'normal')
      }
      doc.text(row[1] || '—', 32, currentY + 3.2)

      if (idx < details.length - 1) {
        doc.setDrawColor(230, 235, 245)
        doc.setLineWidth(0.1)
        doc.line(5, currentY + 5, 75, currentY + 5)
      }

      currentY += 5
    })

    // Draw single outer border around detail block
    doc.setDrawColor(200, 205, 215)
    doc.setLineWidth(0.2)
    doc.rect(5, tableY, 70, details.length * 5, 'S')

    // Summary Highlight Box (Golden accent premium box)
    const summaryY = currentY + 6
    doc.setFillColor(245, 158, 11, 0.08) // 8% gold tint opacity
    doc.roundedRect(5, summaryY - 3, 70, 8, 1, 1, 'F')
    doc.setDrawColor(245, 158, 11)
    doc.setLineWidth(0.2)
    doc.roundedRect(5, summaryY - 3, 70, 8, 1, 1, 'S')

    doc.setTextColor(13, 27, 62)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL PAID TILL DATE', 8, summaryY + 2)
    doc.setFontSize(5.5)
    doc.text(`Rs. ${subData.totalPaid.toLocaleString('en-IN')}`, 72, summaryY + 2, { align: 'right' })

    // Footer divider line
    const footerY = summaryY + 10
    doc.setDrawColor(210, 215, 225)
    doc.setLineWidth(0.25)
    doc.line(5, footerY, 75, footerY)

    doc.setTextColor(140, 150, 165)
    doc.setFontSize(4)
    doc.setFont('helvetica', 'normal')
    doc.text('-- COMPUTER GENERATED RECEIPT --', 40, footerY + 4, { align: 'center' })

    // Gold Strip above footer
    doc.setFillColor(245, 158, 11)
    doc.rect(0, H - 11.5, W, 1.5, 'F')

    // Footer dark bar
    doc.setFillColor(13, 27, 62)
    doc.rect(0, H - 10, W, 10, 'F')

    doc.setTextColor(180, 200, 240)
    doc.setFontSize(3.5)
    doc.text(`${COMPANY_DETAILS.name}  |  HYDERABAD`, 40, H - 5, { align: 'center' })

    doc.save(`Receipt_${sub.name.replace(/\s+/g, '_')}_Term_${installment.receipt_number}.pdf`)
    toast.success('Payment receipt generated successfully!')
  }

  // Group subcontractors by folder/work_nature
  const folders = Array.from(
    new Set([...DEFAULT_WORK_NATURES, ...contractors.map(c => c.work_nature)])
  )

  const getSubcontractorCountInFolder = (folderName: string) => {
    return contractors.filter(c => c.work_nature === folderName).length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            {activeFolder ? `Subcontracts / ${activeFolder}` : 'Subcontractor Ledgers'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {activeFolder
              ? `Manage payment history for ${activeFolder}.`
              : 'Workspace folders for contract payments and installment ledgers.'}
          </p>
        </div>

        {activeFolder ? (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveFolder(null)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase text-zinc-300 border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Folders
            </button>
            <button
              onClick={() => {
                setNewSubForm({ ...newSubForm, work_nature: activeFolder })
                setShowAddSubModal(true)
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase text-[#0a0c12] transition-all cursor-pointer bg-blue-500 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)]"
            >
              <Plus size={14} /> Add Subcontractor
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setNewSubForm({
                name: '',
                mobile: '',
                work_nature: DEFAULT_WORK_NATURES[0],
                custom_work: '',
                project_id: projects[0]?.id || '',
                site_project: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                notes: ''
              })
              setShowAddSubModal(true)
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase text-[#0a0c12] transition-all cursor-pointer bg-blue-500 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)]"
          >
            <Plus size={14} /> Add Subcontractor
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={36} />
        </div>
      ) : activeFolder === null ? (
        // Grid View of Folders (Workspaces)
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {folders.map(folderName => {
            const count = getSubcontractorCountInFolder(folderName)
            return (
              <div
                key={folderName}
                onClick={() => {
                  setActiveFolder(folderName)
                  setNewPaymentForm({ ...newPaymentForm, site_project: projects[0]?.name || '' })
                }}
                className="cursor-pointer bg-[#111520] border border-[#1e2435] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all p-6 rounded-2xl flex flex-col items-center justify-center space-y-4 group shadow-lg"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <FolderClosed size={36} className="fill-amber-500/10" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-sm uppercase tracking-wide group-hover:text-blue-400 transition-colors">{folderName}</p>
                  <p className="text-[10px] text-zinc-500 font-black mt-1 uppercase tracking-widest">{count} Subcontractors</p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Subcontractors List within selected Folder
        <div>
          {contractors.filter(c => c.work_nature === activeFolder).length === 0 ? (
            <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-16 text-center space-y-4">
              <FolderOpen size={48} className="mx-auto text-zinc-700" />
              <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">No subcontractors registered in this folder yet.</p>
              <button
                onClick={() => setShowAddSubModal(true)}
                className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-[#0a0c12] text-xs font-black uppercase rounded-xl transition-all cursor-pointer"
              >
                Add Subcontractor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contractors.filter(c => c.work_nature === activeFolder).map(sub => {
                const subData = getSubcontractorData(sub)
                const latestProject = sub.installments?.[sub.installments.length - 1]?.site_project || 'No Project Assigned'

                return (
                  <div
                    key={sub.id}
                    className="bg-[#111520] border border-[#1e2435] hover:border-blue-500/30 transition-all rounded-2xl p-6 flex flex-col justify-between shadow-xl space-y-5"
                  >
                    <div>
                      {/* Sub Header */}
                      <div className="flex justify-between items-start border-b border-[#1e2435] pb-3">
                        <div>
                          <h4 className="font-black text-white text-lg">{sub.name}</h4>
                          <p className="text-zinc-500 text-[10px] font-bold mt-0.5 uppercase tracking-widest flex items-center gap-1.5">
                            <Phone size={10} /> {sub.mobile || 'No Contact'}
                          </p>
                        </div>
                        
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Payments Ledger
                        </span>
                      </div>

                      {/* Info Detail */}
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500 font-bold uppercase tracking-wider">Active Site:</span>
                          <span className="text-zinc-300 font-bold max-w-[150px] truncate">{latestProject}</span>
                        </div>
                        {sub.installments && sub.installments.length > 0 && (
                          <div className="flex justify-between text-xs border-t border-dashed border-[#1e2435] pt-2">
                            <span className="text-zinc-500 font-bold uppercase tracking-wider">Last Payment:</span>
                            <span className="text-emerald-400 font-bold">
                              ₹{Number(sub.installments[sub.installments.length - 1].amount).toLocaleString('en-IN')} ({format(new Date(sub.installments[sub.installments.length - 1].date), 'dd MMM')})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Cart Metrics */}
                    <div className="pt-4 border-t border-[#1e2435] flex items-center justify-between">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Payment Completed</p>
                        <p className="text-base font-black text-emerald-400">
                          ₹{subData.totalPaid.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedSubcontractor(sub)
                          setNewPaymentForm({ ...newPaymentForm, site_project: projects[0]?.name || '' })
                        }}
                        className="px-4 py-2 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer"
                      >
                        Open Ledger
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Subcontractor Modal */}
      {showAddSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowAddSubModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">{COMPANY_DETAILS.name}</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">Register Subcontractor</p>
              </div>
              <button onClick={() => setShowAddSubModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSubcontractor} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Name</label>
                <Input
                  placeholder="Subcontractor / Contractor name"
                  value={newSubForm.name}
                  onChange={e => setNewSubForm({ ...newSubForm, name: e.target.value })}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mobile Number</label>
                <Input
                  placeholder="9876543210"
                  value={newSubForm.mobile}
                  onChange={e => setNewSubForm({ ...newSubForm, mobile: e.target.value })}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Department / Work Nature</label>
                <select
                  value={newSubForm.work_nature}
                  onChange={e => setNewSubForm({ ...newSubForm, work_nature: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl font-bold bg-zinc-900 border-zinc-800 text-white outline-none"
                >
                  {folders.map(work => <option key={work} value={work}>{work}</option>)}
                </select>
              </div>

              {newSubForm.work_nature === 'Other' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Custom Work Nature</label>
                  <Input
                    placeholder="Enter work nature"
                    value={newSubForm.custom_work}
                    onChange={e => setNewSubForm({ ...newSubForm, custom_work: e.target.value })}
                    className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Associated Project</label>
                <select
                  value={newSubForm.project_id}
                  onChange={e => setNewSubForm({ ...newSubForm, project_id: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl font-bold bg-zinc-900 border-zinc-800 text-white outline-none"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Registration Date</label>
                <Input
                  type="date"
                  value={newSubForm.date}
                  onChange={(e: any) => setNewSubForm({ ...newSubForm, date: e.target.value })}
                  className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Agreement Notes (Optional)</label>
                <Textarea
                  placeholder="Lump sum stages, installment notes etc."
                  value={newSubForm.notes}
                  onChange={(e: any) => setNewSubForm({ ...newSubForm, notes: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-3 h-20"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddSubModal(false)} className="flex-1 h-12 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-[#6b7280] border border-[#1e2435]">Cancel</button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Register
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcontractor Ledger details Dialog */}
      <Dialog open={!!selectedSubcontractor} onOpenChange={(open) => !open && setSelectedSubcontractor(null)}>
        {selectedSubcontractor && (() => {
          const subData = getSubcontractorData(selectedSubcontractor)
          return (
            <DialogContent 
              style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0', maxWidth: '1024px' }} 
              className="sm:max-w-5xl w-full rounded-2xl max-h-[85vh] overflow-y-auto"
            >
              <DialogHeader className="border-b border-[#1e2435] pb-4 flex flex-row justify-between items-start pr-8">
                <div>
                  <DialogTitle className="text-white font-black text-xl uppercase">{selectedSubcontractor.name} Ledgers</DialogTitle>
                  <DialogDescription style={{ color: '#6b7280' }} className="text-xs mt-0.5">
                    {selectedSubcontractor.work_nature} &bull; Ph: {selectedSubcontractor.mobile || 'N/A'}
                  </DialogDescription>
                </div>
                
                {/* Delete subcontractor button */}
                <button 
                  onClick={() => setDeleteSubId(selectedSubcontractor.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={10} /> Delete Contractor
                </button>
              </DialogHeader>

              {/* Subcontractor Stats */}
              <div className="py-4 text-center">
                <div className="inline-block px-8 py-4 rounded-2xl bg-[#1a1f2e] border border-[#2d3748] min-w-[320px] shadow-md">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Payment Completed</p>
                  <p className="text-3xl font-black text-emerald-400 mt-1">₹{subData.totalPaid.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {subData.description && (
                <div className="p-4 rounded-xl bg-black/20 border border-[#1e2435] text-xs text-zinc-400">
                  <span className="font-bold text-zinc-300 block mb-1">Contractor Notes / Details:</span>
                  {subData.description}
                </div>
              )}

              {/* Grid Layout: Add Payout on Left, Payout History on Right */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                
                {/* COLUMN 1: Add Payout Form */}
                <div className="space-y-4">
                  <div className="border-b border-[#1e2435] pb-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Record New Payment Given</h3>
                  </div>

                  <form onSubmit={handleAddPayment} className="p-6 rounded-xl border border-[#1e2435] bg-black/20 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Enter Payment Details</p>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Amount (₹)</label>
                      <Input 
                        type="number"
                        placeholder="Amount paid" 
                        value={newPaymentForm.amount}
                        onChange={e => setNewPaymentForm({ ...newPaymentForm, amount: e.target.value })}
                        className="h-11 bg-zinc-900 border-zinc-800 text-sm text-white px-4 rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Date</label>
                        <Input 
                          type="date"
                          value={newPaymentForm.date}
                          onChange={(e: any) => setNewPaymentForm({ ...newPaymentForm, date: e.target.value })}
                          className="h-11 bg-zinc-900 border-zinc-800 text-sm text-white px-4 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Site / Project</label>
                        <select 
                          value={newPaymentForm.site_project}
                          onChange={e => setNewPaymentForm({ ...newPaymentForm, site_project: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl text-sm font-semibold bg-zinc-900 border-zinc-800 text-white outline-none"
                        >
                          {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Notes / Remarks (Optional)</label>
                      <Input 
                        placeholder="Notes" 
                        value={newPaymentForm.notes}
                        onChange={e => setNewPaymentForm({ ...newPaymentForm, notes: e.target.value })}
                        className="h-11 bg-zinc-900 border-zinc-800 text-sm text-white px-4 rounded-xl"
                      />
                    </div>

                    <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider">
                      Save Payment
                    </Button>
                  </form>
                </div>

                {/* COLUMN 2: Payouts History */}
                <div className="space-y-4">
                  <div className="border-b border-[#1e2435] pb-2 flex justify-between items-center">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Payments History</h3>
                    <span className="text-[10px] font-bold text-zinc-500">{subData.installments.length} payouts</span>
                  </div>

                  <div className="max-h-[350px] overflow-y-auto border border-[#1e2435] rounded-xl bg-black/10 divide-y divide-[#1e2435] custom-scrollbar">
                    {subData.installments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-600 font-bold uppercase">No payments recorded yet</div>
                    ) : (
                      subData.installments.map((inst: any) => (
                        <div key={inst.receipt_number} className="p-3.5 flex justify-between items-center hover:bg-white/[0.01]">
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-white">Payment #{inst.receipt_number}</p>
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                                Payment Done
                              </span>
                              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wide shrink-0">
                                {inst.date ? format(new Date(inst.date), 'dd MMM yyyy') : 'N/A'}
                              </span>
                            </div>
                            <p className="text-[9px] text-zinc-400 mt-0.5 truncate font-semibold uppercase tracking-wider">
                              Site: {inst.site_project || '—'} {inst.notes ? `| ${inst.notes}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black text-emerald-400 pr-1">₹{Number(inst.amount).toLocaleString('en-IN')}</span>
                            <button 
                              type="button"
                              onClick={() => exportPDF(selectedSubcontractor, inst)} 
                              className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/10 transition-all cursor-pointer"
                              title="Download PDF Receipt"
                            >
                              <Download size={11} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeletePayment(inst.receipt_number)} 
                              className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-[#1e2435] transition-all cursor-pointer"
                              title="Delete Payment"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              <DialogFooter className="pt-4 border-t border-[#1e2435] mt-6">
                <Button onClick={() => setSelectedSubcontractor(null)} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs h-11">
                  Close Profile
                </Button>
              </DialogFooter>
            </DialogContent>
          )
        })()}
      </Dialog>

      {/* Delete Subcontractor Confirmation */}
      <Dialog open={!!deleteSubId} onOpenChange={(open) => !open && setDeleteSubId(null)}>
        <DialogContent style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#f0f0f0' }} className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-black text-lg">REMOVE SUBCONTRACTOR</DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }} className="text-xs">
              Are you absolutely sure you want to remove this subcontractor? This will permanently delete their profile, work history, and payment vouchers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setDeleteSubId(null)}
              className="h-10 px-5 rounded-xl font-bold text-xs bg-[#1a1f2e] border border-[#1e2435] text-zinc-300 transition-all cursor-pointer flex items-center justify-center min-w-[80px]"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSubcontractor}
              className="h-10 px-5 rounded-xl font-black uppercase tracking-widest text-[10px] bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer flex items-center justify-center min-w-[120px]"
            >
              Yes, Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
