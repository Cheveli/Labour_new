'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Boxes, Loader2, Trash2, Edit2, FileText, Upload, Folder, FolderOpen, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'all' | 'folders'>('all')
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  // Smart grouping of materials by categories
  const groupedCategories = React.useMemo(() => {
    const categories: Record<string, {
      name: string;
      items: any[];
      totalCost: number;
      totalQty: Record<string, number>;
    }> = {
      Cement: { name: 'Cement', items: [], totalCost: 0, totalQty: {} },
      Steel: { name: 'Steel / Iron', items: [], totalCost: 0, totalQty: {} },
      Concrete: { name: 'Concrete / RCC', items: [], totalCost: 0, totalQty: {} },
      Sand: { name: 'Sand & Dust', items: [], totalCost: 0, totalQty: {} },
      Bricks: { name: 'Bricks & Blocks', items: [], totalCost: 0, totalQty: {} },
      Others: { name: 'Other Materials', items: [], totalCost: 0, totalQty: {} }
    }

    materials.forEach(item => {
      const name = (item.name || '').toLowerCase().trim()
      let category = 'Others'

      if (name.includes('cement')) {
        category = 'Cement'
      } else if (name.includes('steel') || name.includes('iron') || name.includes('rod') || name.includes('rebar') || name.includes('wire mesh')) {
        category = 'Steel'
      } else if (name.includes('concrete') || name.includes('rcc') || name.includes('aggregate') || name.includes('gravel') || name.includes('stones') || name.includes('chips')) {
        category = 'Concrete'
      } else if (name.includes('sand') || name.includes('dust') || name.includes('powder')) {
        category = 'Sand'
      } else if (name.includes('brick') || name.includes('block')) {
        category = 'Bricks'
      }

      const cost = parseFloat(item.total_amount || item.total_cost || 0) || 0
      const qty = parseFloat(item.quantity) || 0
      const unit = (item.unit || 'units').toLowerCase().trim()

      categories[category].items.push(item)
      categories[category].totalCost += cost
      
      if (qty > 0) {
        categories[category].totalQty[unit] = (categories[category].totalQty[unit] || 0) + qty
      }
    })

    return categories
  }, [materials])

  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    quantity: '',
    unit: 'bags',
    cost_per_unit: '',
    base_amount: '',
    total_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  })
  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [transportEnabled, setTransportEnabled] = useState(false)
  const [transportFee, setTransportFee] = useState('')
  const [hamaliEnabled, setHamaliEnabled] = useState(false)
  const [hamaliFee, setHamaliFee] = useState('')
  const [matPage, setMatPage] = useState(0)
  const [editingMat, setEditingMat] = useState<any>(null)
  const [editMatData, setEditMatData] = useState({ name: '', quantity: '', unit: 'bags', cost_per_unit: '', total_amount: '', notes: '', date: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const cpu = parseFloat(formData.cost_per_unit) || 0;
    if (qty > 0 && cpu > 0) {
      setFormData(prev => ({ ...prev, base_amount: (qty * cpu).toString() }));
    }
  }, [formData.quantity, formData.cost_per_unit])

  useEffect(() => {
    const base = parseFloat(formData.base_amount) || 0;
    const tFee = transportEnabled ? (parseFloat(transportFee) || 0) : 0;
    const hFee = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0;
    const calculated = parseFloat((base + tFee + hFee).toFixed(2));
    if (base > 0 || tFee > 0 || hFee > 0) {
      setFormData(prev => ({ ...prev, total_amount: calculated.toString() }));
    }
  }, [formData.base_amount, transportFee, transportEnabled, hamaliFee, hamaliEnabled])

  useEffect(() => {
    fetchData()
  }, [selectedProjectId])

  useEffect(() => {
    const handleProjectChanged = () => {
      const activeProjId = localStorage.getItem('ssc_active_project_id')
      if (activeProjId && activeProjId !== selectedProjectId) {
        setSelectedProjectId(activeProjId || '')
      } else {
        fetchData()
      }
    }
    window.addEventListener('ssc_project_changed', handleProjectChanged)
    return () => {
      window.removeEventListener('ssc_project_changed', handleProjectChanged)
    }
  }, [selectedProjectId])

  const handleDeleteMat = async (id: string) => {
    if (!confirm('Delete this material entry?')) return
    const { error } = await supabase.from('materials').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Entry deleted'); fetchData() }
  }

  const handleOpenEditMat = (item: any) => {
    setEditingMat(item)
    setEditMatData({ name: item.name, quantity: String(item.quantity || ''), unit: item.unit || 'bags', cost_per_unit: String(item.cost_per_unit || ''), total_amount: String(item.total_amount || ''), notes: item.notes || '', date: item.date })
  }

  const handleSaveMat = async () => {
    if (!editingMat) return
    setEditSaving(true)
    const { error } = await supabase.from('materials').update({
      name: editMatData.name,
      quantity: parseFloat(editMatData.quantity) || 0,
      unit: editMatData.unit,
      cost_per_unit: parseFloat(editMatData.cost_per_unit) || 0,
      total_amount: parseFloat(editMatData.total_amount) || 0,
      notes: editMatData.notes,
      date: editMatData.date
    }).eq('id', editingMat.id).select()
    if (error) toast.error(error.message)
    else { toast.success('Entry updated'); setEditingMat(null); fetchData() }
    setEditSaving(false)
  }
  async function fetchData() {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setProjects(projData || [])

    const savedActive = localStorage.getItem('ssc_active_project_id')
    let currentId = selectedProjectId

    if (!currentId) {
      if (savedActive && projData?.some(p => p.id === savedActive)) {
        currentId = savedActive
      } else if (projData && projData.length > 0) {
        currentId = projData[0].id
      }
      setSelectedProjectId(currentId)
    }

    setLoading(true)
    let q = supabase.from('materials').select('*, projects(name)').order('date', { ascending: true })
    if (currentId) {
      q = q.eq('project_id', currentId)
      localStorage.setItem('ssc_active_project_id', currentId)
    }
    window.dispatchEvent(new Event('ssc_project_changed'))
    const { data: matData } = await q
    setMaterials(matData || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id || !formData.name || !formData.total_amount) {
      toast.error('Required fields missing')
      return
    }

    setSaving(true)

    let uploadedUrl = null
    if (receiptFile) {
      try {
        const fileName = `material_${Date.now()}_${receiptFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile)

        if (uploadError) {
          toast.error('Failed to upload receipt: ' + uploadError.message)
          setSaving(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
        uploadedUrl = publicUrl
      } catch (err) {
        toast.error('Receipt upload failed. Continuing without receipt.')
        uploadedUrl = null
      }
    }

    const transport = transportEnabled ? (parseFloat(transportFee) || 0) : 0
    const hamali = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0
    const finalAmt = parseFloat(formData.total_amount) || 0
    const baseAmt = parseFloat(formData.base_amount) || 0
    const notesWithFees = [
      supplierName ? `Supplier: ${supplierName}${supplierPhone ? ' (' + supplierPhone + ')' : ''}` : '',
      formData.notes,
      baseAmt > 0 ? `Material Amount: Rs.${baseAmt}` : '',
      transport > 0 ? `Transportation: Rs.${transport}` : '',
      hamali > 0 ? `Hamali: Rs.${hamali}` : '',
      uploadedUrl ? `Receipt: ${uploadedUrl}` : ''
    ].filter(Boolean).join(' | ')

    const { base_amount, ...dbPayload } = formData;

    const payload: any = {
      ...dbPayload,
      quantity: parseFloat(formData.quantity) || 0,
      cost_per_unit: parseFloat(formData.cost_per_unit) || 0,
      total_amount: finalAmt,
      notes: notesWithFees || null,
      receipt_url: uploadedUrl
    }

    const { data: newEntry, error } = await supabase.from('materials').insert([payload]).select()

    let finalError = error
    if (error && error.message.includes('column "receipt_url" of relation "materials" does not exist')) {
      const { data: retryData, error: retryError } = await supabase.from('materials').insert([{ ...payload, receipt_url: undefined }]).select()
      finalError = retryError
    }

    if (finalError) {
      toast.error(finalError.message)
    } else {
      toast.success('Inventory recorded')
      setFormData({ project_id: '', name: '', quantity: '', unit: 'bags', cost_per_unit: '', base_amount: '', total_amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      setSupplierName(''); setSupplierPhone('')
      setTransportEnabled(false); setTransportFee('')
      setHamaliEnabled(false); setHamaliFee('')
      setReceiptFile(null)
      setMatPage(0)
      fetchData()
      setShowAddModal(false)
    }
    setSaving(false)
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Material Inventory</h1>
          <p className="mt-1 text-sm text-zinc-500">Record site deliveries, stock levels, and resource costs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-10 px-4 rounded-xl text-xs font-bold bg-[#111520] border border-[#1e2435] text-white outline-none focus:border-blue-500 transition-all flex-1 min-w-[140px]"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{materials.length} entries</span>
          <button
            type="button"
            onClick={() => {
              setFormData({ project_id: selectedProjectId, name: '', quantity: '', unit: 'bags', cost_per_unit: '', base_amount: '', total_amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
              setSupplierName(''); setSupplierPhone('');
              setTransportEnabled(false); setTransportFee('');
              setHamaliEnabled(false); setHamaliFee('');
              setReceiptFile(null);
              setShowAddModal(true);
            }}
            className="whitespace-nowrap h-10 px-5 rounded-xl text-xs font-black uppercase bg-blue-500 text-white flex items-center gap-2 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] transition-all cursor-pointer"
          >
            + New Entry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Material List - Full Width */}
        <div className="lg:col-span-12">
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-zinc-800 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Inventory History</CardTitle>
              <div className="flex bg-[#0d1018] p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    viewMode === 'all'
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/10 font-bold"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  All Deliveries
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('folders')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    viewMode === 'folders'
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/10 font-bold"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  Grouped Folders
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {viewMode === 'folders' ? (
                <div className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {Object.entries(groupedCategories).map(([key, category]) => {
                      const qtyDisplay = Object.entries(category.totalQty)
                        .map(([unit, val]) => `${val.toLocaleString()} ${unit}`)
                        .join(', ') || '—'

                      return (
                        <div
                          key={key}
                          onClick={() => category.items.length > 0 && setActiveFolder(key)}
                          className={cn(
                            "group rounded-2xl border p-6 flex flex-col justify-between transition-all bg-gradient-to-br from-[#111520] to-[#0c0f17] relative overflow-hidden",
                            category.items.length > 0
                              ? "border-zinc-800 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer active:scale-[0.98]"
                              : "border-zinc-900/50 opacity-40 select-none"
                          )}
                        >
                          {/* Folder decoration */}
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Folder className="w-6 h-6 fill-current" />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-full">
                                {category.items.length} {category.items.length === 1 ? 'Delivery' : 'Deliveries'}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-blue-400 transition-colors">
                                {category.name}
                              </h4>
                              <p className="text-[10px] font-bold text-zinc-400 mt-1 line-clamp-1">
                                Qty: <span className="text-zinc-200">{qtyDisplay}</span>
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-zinc-900 pt-4 mt-5 flex justify-between items-end">
                            <div>
                              <p className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">Total Spent</p>
                              <p className="text-lg font-black text-white group-hover:text-blue-400 transition-colors mt-0.5">
                                ₹ {category.totalCost.toLocaleString()}
                              </p>
                            </div>
                            {category.items.length > 0 && (
                              <div className="text-xs font-black text-blue-500 flex items-center gap-1 group-hover:translate-x-1 transition-all">
                                Open <ChevronRight size={14} />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-zinc-900/80">
                    <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
                      <TableHead className="px-4 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400 w-12 text-center">S.No</TableHead>
                      <TableHead className="px-4 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Project / Material</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Supplier</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Breakdown</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Remarks</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400 text-center">Receipt</TableHead>
                      <TableHead className="text-right px-4 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Total</TableHead>
                      <TableHead className="py-6 w-14"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-zinc-800">
                          <TableCell colSpan={9} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                        </TableRow>
                      ))
                    ) : materials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                            <Boxes size={48} className="opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest">No material history found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      materials.slice(matPage * 10, matPage * 10 + 10).map((item, idx) => {
                        const notes = item.notes || '';
                        const supplierMatch = notes.match(/Supplier:\s(.*?)(?:\s\(|$)/);
                        const supplierPhoneMatch = notes.match(/\((\d+)\)/);
                        const matAmtMatch = notes.match(/Material Amount:\sRs\.([\d,.]+)/);
                        const transportMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/);
                        const hamaliMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/);
                        const receiptMatch = notes.match(/Receipt:\s(.*?)(?:\s\||$)/);
 
                        const supplier = supplierMatch ? supplierMatch[1] : '—';
                        const supplierPhone = supplierPhoneMatch ? supplierPhoneMatch[1] : '';
                        const supplierDisplay = supplier !== '—' ? (supplierPhone ? `${supplier} (${supplierPhone})` : supplier) : '—';
                        const matAmt = matAmtMatch ? `₹${matAmtMatch[1]}` : (item.quantity > 0 && item.cost_per_unit > 0 ? `₹${(item.quantity * item.cost_per_unit).toLocaleString()}` : '');
                        const transport = transportMatch ? `₹${transportMatch[1]}` : '—';
                        const hamali = hamaliMatch ? `₹${hamaliMatch[1]}` : '—';
                        const receiptUrl = item.receipt_url || (receiptMatch ? receiptMatch[1] : null);
 
                        let cleanNotes = notes
                          .replace(/Supplier:\s(.*?)(?:\s\(|$)/, '')
                          .replace(/\(\d+\)/, '')
                          .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                          .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                          .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                          .replace(/Receipt:\s(.*?)(?:\s\||$)/, '')
                          .replace(/^[\s\|]+|[\s\|]+$/g, '')
                          .trim();
 
                        return (
                          <TableRow key={item.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                            <TableCell className="px-4 py-5 font-bold text-gray-400 text-xs text-center">{matPage * 10 + idx + 1}</TableCell>
                            <TableCell className="px-4 py-5 font-bold text-gray-400 text-xs whitespace-nowrap">
                              {format(new Date(item.date), 'dd-MM-yyyy')}
                            </TableCell>
                            <TableCell className="py-5">
                              <p className="font-bold text-white text-sm lowercase">{item.projects?.name}</p>
                              <p className="font-black text-gray-200 text-[10px] tracking-tight uppercase mt-1">{item.name}</p>
                              <p className="font-bold text-zinc-500 text-[10px] uppercase mt-0.5">{item.quantity} {item.unit} {item.cost_per_unit > 0 ? ` @ ₹${item.cost_per_unit}` : ''}</p>
                            </TableCell>
                            <TableCell className="py-5">
                              <p className="font-bold text-white text-sm">{supplierDisplay}</p>
                            </TableCell>
                            <TableCell className="py-5">
                              {matAmt && <p className="text-[10px] font-bold text-zinc-400">Material: <span className="text-emerald-400">{matAmt}</span></p>}
                              {transport !== '—' && <p className="text-[10px] font-bold text-zinc-400">Transport: <span className="text-white">{transport}</span></p>}
                              {hamali !== '—' && <p className="text-[10px] font-bold text-zinc-400">Hamali: <span className="text-white">{hamali}</span></p>}
                            </TableCell>
                            <TableCell className="py-5 text-xs text-zinc-400 max-w-[150px] truncate" title={cleanNotes}>{cleanNotes || '—'}</TableCell>
                            <TableCell className="py-5 text-center">
                              {receiptUrl ? (
                                <a 
                                  href={receiptUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20 transition-all whitespace-nowrap font-sans"
                                >
                                  <FileText size={12} /> View Receipt
                                </a>
                              ) : (
                                <span className="text-zinc-600 font-bold text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-5 text-right px-4 font-black text-white text-sm whitespace-nowrap">₹ {item.total_amount?.toLocaleString() || item.total_cost?.toLocaleString()}</TableCell>
                            <TableCell className="py-3 pr-4">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button onClick={() => handleOpenEditMat(item)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 transition-colors"><Edit2 size={13} /></button>
                                <button onClick={() => handleDeleteMat(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Desktop Pagination */}
              {materials.length > 10 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800">
                  <button disabled={matPage === 0} onClick={() => setMatPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>Page {matPage + 1} / {Math.ceil(materials.length / 10)}</span>
                  <button disabled={(matPage + 1) * 10 >= materials.length} onClick={() => setMatPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
                </div>
              )}

              {/* Mobile Cards */}
              <div className="flex flex-col gap-3 p-4 md:hidden bg-[#05070B]">
                {loading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="h-24 animate-pulse bg-zinc-900 rounded-xl" />)
                ) : materials.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 text-zinc-600 py-10">
                    <Boxes size={48} className="opacity-10" />
                    <p className="text-sm font-bold uppercase tracking-widest">No material history found</p>
                  </div>
                ) : (
                  materials.slice(matPage * 10, matPage * 10 + 10).map((item) => {
                    const notes = item.notes || '';
                    const cleanNotes = notes.replace(/Supplier:\s(.*?)(?:\s\||$)/, '').replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/^[\s\|]+|[\s\|]+$/g, '').trim();
                    return (
                      <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-white text-sm">{item.projects?.name}</p>
                            <p className="font-black text-gray-200 text-[10px] tracking-tight uppercase mt-0.5">{item.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-1">{format(new Date(item.date), 'MMM dd, yyyy')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-white text-sm">₹ {item.total_amount?.toLocaleString() || item.total_cost?.toLocaleString()}</p>
                            <p className="font-bold text-zinc-500 text-[10px] uppercase mt-0.5">{item.quantity} {item.unit}</p>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-400 break-words">
                          {notes.split(' | ').map((n: string, i: number) => <div key={i}>{n}</div>)}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {/* Mobile Pagination */}
              {materials.length > 10 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 md:hidden">
                  <button disabled={matPage === 0} onClick={() => setMatPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                  <span className="text-xs" style={{ color: '#6b7280' }}>{matPage + 1} / {Math.ceil(materials.length / 10)}</span>
                  <button disabled={(matPage + 1) * 10 >= materials.length} onClick={() => setMatPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  </div>

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowAddModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">New Stock Entry</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                <select value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })} className="styled-select w-full h-11">
                  <option value="">Delivery Location</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Material Name</label>
                <Input
                  placeholder="e.g. Cement, Sand, Steel"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Qty</label>
                  <Input
                    placeholder="0.00"
                    type="number"
                    value={formData.quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, quantity: e.target.value })}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Unit</label>
                  <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="styled-select w-full h-12">
                    <option value="bags">Bags</option>
                    <option value="kgs">Kg</option>
                    <option value="tons">Tons</option>
                    <option value="sq-ft">Square feet (sq ft)</option>
                    <option value="boxes">Boxes</option>
                    <option value="pieces">Pieces</option>
                    <option value="liters">Liters</option>
                    <option value="bricks">Number (Nos) of bricks</option>
                    <option value="meters">Meters</option>
                    <option value="no-unit">No Unit</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Per Unit (₹)</label>
                  <Input
                    placeholder="0.00"
                    type="number"
                    value={formData.cost_per_unit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Material Amount (₹) *</label>
                <Input
                  placeholder="Base amount of material"
                  type="number"
                  value={formData.base_amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, base_amount: e.target.value })}
                  required
                  className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Delivery Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, date: e.target.value })}
                  className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white px-4"
                />
              </div>

              {/* Supplier Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Supplier Name</label>
                  <Input placeholder="e.g. Ramu Traders" value={supplierName} onChange={e => setSupplierName(e.target.value)} className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Supplier Phone</label>
                  <Input placeholder="9876543210" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
                </div>
              </div>

              {/* Transportation Fee */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={transportEnabled} onChange={e => setTransportEnabled(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Transportation Fees</span>
                </label>
                {transportEnabled && (
                  <Input
                    type="number" placeholder="Enter transport amount"
                    value={transportFee} onChange={e => setTransportFee(e.target.value)}
                    className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white animate-in slide-in-from-top-1 duration-150"
                  />
                )}
              </div>

              {/* Hamali Fee */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={hamaliEnabled} onChange={e => setHamaliEnabled(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Hamali Fees (Loading/Unloading)</span>
                </label>
                {hamaliEnabled && (
                  <Input
                    type="number" placeholder="Enter hamali amount"
                    value={hamaliFee} onChange={e => setHamaliFee(e.target.value)}
                    className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white animate-in slide-in-from-top-1 duration-150"
                  />
                )}
              </div>

              <div className="space-y-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mt-4">
                <label className="text-xs font-black text-blue-400 uppercase tracking-widest">Grand Total (₹) *</label>
                <Input
                  placeholder="Total including fees"
                  type="number"
                  value={formData.total_amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, total_amount: e.target.value })}
                  required
                  className="h-12 bg-zinc-950 border-blue-500/30 rounded-xl font-black text-blue-400 text-lg"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Remarks (optional)</label>
                <Textarea
                  placeholder="Supplier, transport, quality, bill details..."
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4"
                />
              </div>

              {/* Receipt Upload */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <label className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Upload size={14} className="text-blue-400" />
                  Upload Receipt / Bill <span className="text-[10px] text-zinc-500 font-normal lowercase">(optional)</span>
                </label>

                <div className="relative group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/svg+xml,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all",
                    receiptFile ? "bg-emerald-500/5 border-emerald-500/30" : "bg-zinc-900/50 border-zinc-800 group-hover:border-zinc-700"
                  )}>
                    {receiptFile ? (
                      <>
                        <p className="text-xs font-bold text-emerald-400 truncate max-w-[200px]">{receiptFile.name}</p>
                        <p className="text-[10px] text-emerald-500/60 mt-1">Ready to upload</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-zinc-400 transition-colors">Tap to select receipt</p>
                        <p className="text-[8px] text-zinc-600 mt-1 italic">Images or PDF allowed</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 h-12 rounded-xl text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#6b7280', border: '1px solid #1e2435' }}>Cancel</button>
                <Button type="submit" disabled={saving} className="flex-1 h-12 btn-construction rounded-xl font-black uppercase tracking-tight text-sm">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Record Delivery
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {editingMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingMat(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-white uppercase tracking-wide">Edit Material Entry</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Material Name</label>
                <Input value={editMatData.name} onChange={e => setEditMatData({ ...editMatData, name: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Qty</label>
                <Input type="number" value={editMatData.quantity} onChange={e => setEditMatData({ ...editMatData, quantity: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Unit</label>
                <select value={editMatData.unit} onChange={e => setEditMatData({ ...editMatData, unit: e.target.value })} className="styled-select">
                  <option value="bags">Bags</option>
                  <option value="kgs">Kg</option>
                  <option value="tons">Tons</option>
                  <option value="sq-ft">Square feet (sq ft)</option>
                  <option value="boxes">Boxes</option>
                  <option value="pieces">Pieces</option>
                  <option value="liters">Liters</option>
                  <option value="bricks">Number (Nos) of bricks</option>
                  <option value="meters">Meters</option>
                  <option value="no-unit">No Unit</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Amount (₹)</label>
                <Input type="number" value={editMatData.total_amount} onChange={e => setEditMatData({ ...editMatData, total_amount: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</label>
                <Input type="date" value={editMatData.date} onChange={e => setEditMatData({ ...editMatData, date: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Remarks</label>
                <Input value={editMatData.notes} onChange={e => setEditMatData({ ...editMatData, notes: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingMat(null)} className="flex-1 h-10 rounded-xl text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#6b7280', border: '1px solid #1e2435' }}>Cancel</button>
              <button onClick={handleSaveMat} disabled={editSaving} className="flex-1 h-10 rounded-xl text-xs font-black uppercase text-[#0a0c12] disabled:opacity-50" style={{ backgroundColor: '#3b82f6' }}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Folder Drill-down Modal */}
      {activeFolder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4 transition-all"
          onClick={() => setActiveFolder(null)}
        >
          <div 
            className="rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-[#0d1018] border border-[#1e2435] shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#111520] p-6 border-b border-[#1e2435] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <FolderOpen className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    {groupedCategories[activeFolder]?.name} Folder
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                    {groupedCategories[activeFolder]?.items.length} itemized deliveries
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setActiveFolder(null)}
                className="p-2 rounded-lg bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer animate-none"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Folder Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Total Deliveries</p>
                  <p className="text-xl font-black text-white mt-1">
                    {groupedCategories[activeFolder]?.items.length} Times
                  </p>
                </div>
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Total Quantities</p>
                  <p className="text-xs font-black text-white mt-1 text-ellipsis overflow-hidden">
                    {Object.entries(groupedCategories[activeFolder]?.totalQty)
                      .map(([unit, val]) => `${val.toLocaleString()} ${unit}`)
                      .join(', ') || '—'}
                  </p>
                </div>
                <div className="bg-blue-600 p-4 rounded-xl border border-blue-500 shadow-lg shadow-blue-600/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-blue-100">Total Money Spent</p>
                  <p className="text-xl font-black text-white mt-1">
                    ₹ {groupedCategories[activeFolder]?.totalCost.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Desktop Items Table */}
              <div className="hidden md:block border border-[#1e2435] rounded-xl overflow-hidden bg-black/10">
                <Table>
                  <TableHeader className="bg-black/30">
                    <TableRow className="border-[#1e2435] hover:bg-transparent">
                      <TableHead className="px-5 py-4 text-[9px] font-black uppercase tracking-wider text-zinc-500 w-10">S.No</TableHead>
                      <TableHead className="py-4 text-[9px] font-black uppercase tracking-wider text-zinc-500">Date</TableHead>
                      <TableHead className="py-4 text-[9px] font-black uppercase tracking-wider text-zinc-500">Item Detail</TableHead>
                      <TableHead className="py-4 text-[9px] font-black uppercase tracking-wider text-zinc-500">Supplier</TableHead>
                      <TableHead className="py-4 text-[9px] font-black uppercase tracking-wider text-zinc-500">Fees (Trsp/Hml)</TableHead>
                      <TableHead className="py-4 text-[9px] font-black uppercase tracking-wider text-zinc-500">Remarks</TableHead>
                      <TableHead className="text-right pr-6 py-4 text-[9px] font-black uppercase tracking-wider text-zinc-500">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedCategories[activeFolder]?.items.map((item, idx) => {
                      const notes = item.notes || '';
                      const supplierMatch = notes.match(/Supplier:\s(.*?)(?:\s\(|$)/);
                      const supplierPhoneMatch = notes.match(/\((\d+)\)/);
                      const transportMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/);
                      const hamaliMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/);
                      const receiptMatch = notes.match(/Receipt:\s(.*?)(?:\s\||$)/);

                      const supplier = supplierMatch ? supplierMatch[1] : '—';
                      const supplierPhone = supplierPhoneMatch ? supplierPhoneMatch[1] : '';
                      const supplierDisplay = supplier !== '—' ? (supplierPhone ? `${supplier} (${supplierPhone})` : supplier) : '—';
                      const transport = transportMatch ? `₹${transportMatch[1]}` : '';
                      const hamali = hamaliMatch ? `₹${hamaliMatch[1]}` : '';
                      const receiptUrl = item.receipt_url || (receiptMatch ? receiptMatch[1] : null);

                      let cleanNotes = notes
                        .replace(/Supplier:\s(.*?)(?:\s\(|$)/, '')
                        .replace(/\(\d+\)/, '')
                        .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                        .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                        .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                        .replace(/Receipt:\s(.*?)(?:\s\||$)/, '')
                        .replace(/^[\s\|]+|[\s\|]+$/g, '')
                        .trim();

                      return (
                        <TableRow key={item.id} className="border-[#1e2435] transition-colors hover:bg-white/[0.02]">
                          <TableCell className="px-5 py-4 font-bold text-gray-500 text-xs text-center">{idx + 1}</TableCell>
                          <TableCell className="py-4 font-bold text-gray-400 text-xs whitespace-nowrap">
                            {format(new Date(item.date), 'dd-MM-yyyy')}
                          </TableCell>
                          <TableCell className="py-4">
                            <p className="font-black text-gray-200 text-xs uppercase tracking-tight leading-none">{item.name}</p>
                            <p className="font-bold text-zinc-500 text-[9px] uppercase mt-1">
                              {item.quantity} {item.unit} {item.cost_per_unit > 0 ? ` @ ₹${item.cost_per_unit}` : ''}
                            </p>
                          </TableCell>
                          <TableCell className="py-4">
                            <p className="font-bold text-white text-xs whitespace-nowrap">{supplierDisplay}</p>
                          </TableCell>
                          <TableCell className="py-4 text-[10px]">
                            {transport && <p className="text-zinc-400">Trsp: <span className="text-white">{transport}</span></p>}
                            {hamali && <p className="text-zinc-400">Hml: <span className="text-white">{hamali}</span></p>}
                            {!transport && !hamali && '—'}
                          </TableCell>
                          <TableCell className="py-4 text-[10px] text-zinc-400 max-w-[150px] break-words">
                            {cleanNotes || '—'}
                          </TableCell>
                          <TableCell className="py-4 text-right pr-6 font-black text-blue-400 text-sm whitespace-nowrap">
                            ₹ {item.total_amount?.toLocaleString() || item.total_cost?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Items Cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {groupedCategories[activeFolder]?.items.map((item, idx) => {
                  const notes = item.notes || '';
                  const supplierMatch = notes.match(/Supplier:\s(.*?)(?:\s\(|$)/);
                  const supplierPhoneMatch = notes.match(/\((\d+)\)/);
                  const transportMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/);
                  const hamaliMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/);
                  const receiptMatch = notes.match(/Receipt:\s(.*?)(?:\s\||$)/);

                  const supplier = supplierMatch ? supplierMatch[1] : '—';
                  const supplierPhone = supplierPhoneMatch ? supplierPhoneMatch[1] : '';
                  const supplierDisplay = supplier !== '—' ? (supplierPhone ? `${supplier} (${supplierPhone})` : supplier) : '—';
                  const transport = transportMatch ? `₹${transportMatch[1]}` : '';
                  const hamali = hamaliMatch ? `₹${hamaliMatch[1]}` : '';
                  const receiptUrl = item.receipt_url || (receiptMatch ? receiptMatch[1] : null);

                  let cleanNotes = notes
                    .replace(/Supplier:\s(.*?)(?:\s\(|$)/, '')
                    .replace(/\(\d+\)/, '')
                    .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                    .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                    .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                    .replace(/Receipt:\s(.*?)(?:\s\||$)/, '')
                    .replace(/^[\s\|]+|[\s\|]+$/g, '')
                    .trim();

                  return (
                    <div key={item.id} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase">#{idx + 1} · {format(new Date(item.date), 'dd-MM-yyyy')}</p>
                          <h5 className="font-black text-white text-sm uppercase mt-1">{item.name}</h5>
                          <p className="font-bold text-zinc-400 text-xs mt-0.5">
                            {item.quantity} {item.unit} {item.cost_per_unit > 0 ? ` @ ₹${item.cost_per_unit}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-blue-400 text-sm">₹ {item.total_amount?.toLocaleString() || item.total_cost?.toLocaleString()}</p>
                          {receiptUrl && (
                            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-black text-emerald-400 hover:underline">
                              <FileText size={10} /> View Bill
                            </a>
                          )}
                        </div>
                      </div>
                      
                      {(supplierDisplay !== '—' || transport || hamali || cleanNotes) && (
                        <div className="border-t border-zinc-800/60 pt-2.5 mt-1 space-y-1.5 text-[11px] text-zinc-400">
                          {supplierDisplay !== '—' && (
                            <p><strong>Supplier:</strong> <span className="text-zinc-200">{supplierDisplay}</span></p>
                          )}
                          {(transport || hamali) && (
                            <p>
                              <strong>Fees:</strong>{' '}
                              <span className="text-zinc-200">
                                {[transport && `Transport: ${transport}`, hamali && `Hamali: ${hamali}`].filter(Boolean).join(', ')}
                              </span>
                            </p>
                          )}
                          {cleanNotes && (
                            <p><strong>Remarks:</strong> <span className="text-zinc-300 italic">{cleanNotes}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-[#111520] p-4 border-t border-[#1e2435] flex justify-end">
              <button 
                type="button" 
                onClick={() => setActiveFolder(null)}
                className="h-10 px-6 rounded-xl text-xs font-black uppercase text-zinc-300 bg-[#1a1f2e] border border-[#1e2435] hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Close Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
