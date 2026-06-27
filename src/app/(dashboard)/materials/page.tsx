'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { Boxes, Loader2, Trash2, Edit2, FileText, Upload, Folder, FolderOpen, ChevronRight, X, Calendar, ChevronDown, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
}

interface Material {
  id: string
  name: string
  quantity: number
  unit: string
  cost_per_unit: number
  total_amount: number
  total_cost?: number
  date: string
  notes?: string | null
  receipt_url?: string | null
  payment_system_v2?: boolean
  payment_status?: 'paid' | 'unpaid'
  payment_mode?: string | null
  account_name?: string | null
  payment_date?: string | null
  created_at?: string
  projects?: {
    name: string
  }
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'all' | 'folders'>('all')
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  // ── Details panel & extra filter states ───────────────────
  const [selectedDetailItem, setSelectedDetailItem] = useState<Material | null>(null)
  const [showExtraFilters, setShowExtraFilters] = useState(false)

  const dateFilterRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setShowDateFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dateFilterRef])

  // ── Date filter state (hidden by default) ─────────────────
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [allMaterialsForFolders, setAllMaterialsForFolders] = useState<Material[]>([])
  const [matPage, setMatPage] = useState(0)

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setMatPage(0)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Smart grouping of materials by categories (uses the full unpaginated list)
  const groupedCategories = React.useMemo(() => {
    const categories: Record<string, {
      name: string;
      items: Material[];
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

    allMaterialsForFolders.forEach(item => {
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

      const cost = parseFloat(String(item.total_amount || item.total_cost || 0)) || 0
      const qty = parseFloat(String(item.quantity)) || 0
      const unit = (item.unit || 'units').toLowerCase().trim()

      categories[category].items.push(item)
      categories[category].totalCost += cost

      if (qty > 0) {
        categories[category].totalQty[unit] = (categories[category].totalQty[unit] || 0) + qty
      }
    })

    return categories
  }, [allMaterialsForFolders])

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

  // ── Autocomplete Suggestions (using active page items) ──
  const allMaterialNames = React.useMemo(() => {
    const names = materials.map((m: Material) => m.name).filter(Boolean)
    return [...new Set<string>(names)]
  }, [materials])

  const nameSuggestions = React.useMemo(() => {
    const q = formData.name.trim().toLowerCase()
    if (!q || q.length < 1) return []
    return allMaterialNames
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 8)
  }, [formData.name, allMaterialNames])

  const [showNameSuggestions, setShowNameSuggestions] = React.useState(false)

  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [transportEnabled, setTransportEnabled] = useState(false)
  const [transportFee, setTransportFee] = useState('')
  const [hamaliEnabled, setHamaliEnabled] = useState(false)
  const [hamaliFee, setHamaliFee] = useState('')

  const [editingMat, setEditingMat] = useState<Material | null>(null)
  const [editMatData, setEditMatData] = useState({ name: '', quantity: '', unit: '', cost_per_unit: '', total_amount: '', notes: '', date: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Payment system V2 modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentItem, setPaymentItem] = useState<Material | null>(null)
  const [paymentData, setPaymentData] = useState({
    payment_mode: 'cash',
    account_name: '',
    payment_date: format(new Date(), 'yyyy-MM-dd')
  })
  const [paymentSaving, setPaymentSaving] = useState(false)

  const supabase = createClient()

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          const maxDim = 800
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height / width) * maxDim
              width = maxDim
            } else {
              width = (width / height) * maxDim
              height = maxDim
            }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(file)
          ctx.drawImage(img, 0, 0, width, height)
          
          let quality = 0.9
          const attemptCompress = () => {
            canvas.toBlob((blob) => {
              if (!blob) return resolve(file)
              if (blob.size > 100 * 1024 && quality > 0.1) {
                quality -= 0.1
                attemptCompress()
              } else {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }))
              }
            }, 'image/jpeg', quality)
          }
          attemptCompress()
        }
        img.onerror = (err) => reject(err)
      }
      reader.onerror = (err) => reject(err)
    })
  }

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type.startsWith('image/')) {
        try {
          let finalFile = file
          if (file.size > 100 * 1024) {
            finalFile = await compressImage(file)
          }
          setReceiptFile(finalFile)
        } catch {
          toast.error('Failed to compress image')
          setReceiptFile(file)
        }
      } else {
        setReceiptFile(file)
      }
    } else {
      setReceiptFile(null)
    }
  }

  const handleDeleteMat = async (id: string) => {
    if (!confirm('Delete this material entry?')) return
    const { error } = await supabase.from('materials').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { 
      toast.success('Entry deleted')
      setSelectedDetailItem(null)
      fetchData()
    }
  }

  const handleOpenEditMat = (item: Material) => {
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
    else { 
      toast.success('Entry updated')
      setEditingMat(null)
      setSelectedDetailItem(null)
      fetchData()
    }
    setEditSaving(false)
  }

  const handleSavePayment = async (status: 'paid' | 'unpaid') => {
    if (!paymentItem) return
    setPaymentSaving(true)

    const payload = status === 'paid' ? {
      payment_status: 'paid',
      payment_mode: paymentData.payment_mode,
      account_name: paymentData.payment_mode === 'online' ? paymentData.account_name : null,
      payment_date: paymentData.payment_date
    } : {
      payment_status: 'unpaid',
      payment_mode: null,
      account_name: null,
      payment_date: null
    }

    const { error } = await supabase
      .from('materials')
      .update(payload)
      .eq('id', paymentItem.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(status === 'paid' ? 'Payment details saved' : 'Marked as unpaid')
      setShowPaymentModal(false)
      setPaymentItem(null)
      setSelectedDetailItem(null)
      fetchData()
    }
    setPaymentSaving(false)
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
    try {
      if (viewMode === 'folders') {
        let q = supabase
          .from('materials')
          .select('*, projects(name)')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (currentId) {
          q = q.eq('project_id', currentId)
          localStorage.setItem('ssc_active_project_id', currentId)
        }

        const { data } = await q
        setAllMaterialsForFolders(data || [])
      } else {
        let q = supabase
          .from('materials')
          .select('*, projects(name)', { count: 'exact' })
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (currentId) {
          q = q.eq('project_id', currentId)
          localStorage.setItem('ssc_active_project_id', currentId)
        }
        if (filterFrom) {
          q = q.gte('date', filterFrom)
        }
        if (filterTo) {
          q = q.lte('date', filterTo)
        }
        if (debouncedSearchQuery.trim()) {
          const term = `%${debouncedSearchQuery.trim()}%`
          q = q.or(`name.ilike.${term},notes.ilike.${term}`)
        }

        const fromIndex = matPage * 10
        const toIndex = fromIndex + 9
        q = q.range(fromIndex, toIndex)

        const { data, count, error } = await q
        if (error) {
          toast.error(error.message)
        } else {
          setMaterials(data || [])
          setTotalCount(count || 0)
        }
      }
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch hook triggering on changes
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matPage, debouncedSearchQuery, filterFrom, filterTo, selectedProjectId, viewMode])

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
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile)

        if (uploadError) {
          toast.error('Failed to upload receipt: ' + uploadError.message)
          setSaving(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
        uploadedUrl = publicUrl
      } catch {
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

    const dbPayload = {
      project_id: formData.project_id,
      name: formData.name,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      cost_per_unit: parseFloat(formData.cost_per_unit) || 0,
      total_amount: finalAmt,
      notes: notesWithFees || null,
      date: formData.date
    }

    const payload: Omit<Material, 'id'> = {
      ...dbPayload,
      receipt_url: uploadedUrl,
      payment_system_v2: true,
      payment_status: 'unpaid'
    }

    const { error } = await supabase.from('materials').insert([payload]).select()

    let finalError = error
    if (error && error.message.includes('column "receipt_url" of relation "materials" does not exist')) {
      const { error: retryError } = await supabase.from('materials').insert([{ ...payload, receipt_url: undefined }]).select()
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
    <div className="space-y-2">
      {/* Main Container */}
      <div className="w-full">
        {/* Material List */}
        <div className="w-full">
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden h-[calc(100vh-90px)] flex flex-col">
            {/* Extremely Compact Header: Moved Title and Add Button inside here */}
            <CardHeader className="p-4 border-b border-zinc-800 flex flex-row items-center justify-between gap-4 shrink-0 bg-[#0c0f17]">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Material Inventory</h2>
                <div className="flex bg-[#0d1018] p-0.5 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className={cn(
                      "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      viewMode === 'all'
                        ? "bg-blue-600 text-white shadow-md font-bold"
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    All Deliveries
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('folders')}
                    className={cn(
                      "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      viewMode === 'folders'
                        ? "bg-blue-600 text-white shadow-md font-bold"
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Grouped Folders
                  </button>
                </div>
              </div>

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
                className="whitespace-nowrap h-8 px-4 rounded-xl text-[10px] font-black uppercase bg-blue-500 text-white flex items-center gap-1.5 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] transition-all cursor-pointer"
              >
                + New Entry
              </button>
            </CardHeader>

            {/* ── Sub Navigation & Filtering Bar ── */}
            {viewMode === 'all' && (
              <div className="px-4 py-2 border-b border-zinc-800 bg-[#08090f] flex flex-wrap items-center gap-2 shrink-0">
                {/* Date Range Picker Dropdown Toggle */}
                <div className="relative" ref={dateFilterRef}>
                  <button
                    type="button"
                    onClick={() => setShowDateFilter(!showDateFilter)}
                    className="h-8 px-3 rounded-lg text-xs font-bold bg-[#111520] border border-[#1e2435] text-white flex items-center gap-1.5 hover:bg-zinc-800 transition-all select-none cursor-pointer"
                  >
                    <Calendar size={13} className="text-zinc-400" />
                    <span>
                      {filterFrom || filterTo
                        ? `${filterFrom ? format(new Date(filterFrom), 'dd-MM-yyyy') : 'Start'} - ${filterTo ? format(new Date(filterTo), 'dd-MM-yyyy') : 'End'}`
                        : 'Date Range'}
                    </span>
                    <ChevronDown size={11} className="text-zinc-400" />
                  </button>

                  {showDateFilter && (
                    <div className="absolute top-10 left-0 z-30 p-4 rounded-xl bg-[#111520] border border-[#1e2435] flex flex-col gap-2.5 shadow-2xl min-w-[200px] animate-in fade-in-50 zoom-in-95">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Filter by Date</span>
                      <input
                        type="date"
                        value={filterFrom}
                        onChange={e => { setFilterFrom(e.target.value); setMatPage(0); }}
                        className="h-9 px-3 rounded-lg text-xs font-bold outline-none focus:border-blue-500 transition-all"
                        style={{ backgroundColor: '#1d2333', border: '1px solid #1e2435', color: '#ffffff', colorScheme: 'dark' }}
                        title="From date"
                      />
                      <span className="text-zinc-600 text-xs font-bold text-center">→</span>
                      <input
                        type="date"
                        value={filterTo}
                        min={filterFrom}
                        onChange={e => { setFilterTo(e.target.value); setMatPage(0); }}
                        className="h-9 px-3 rounded-lg text-xs font-bold outline-none focus:border-blue-500 transition-all"
                        style={{ backgroundColor: '#1d2333', border: '1px solid #1e2435', color: '#ffffff', colorScheme: 'dark' }}
                        title="To date"
                      />
                      {(filterFrom || filterTo) && (
                        <button
                          onClick={() => { setFilterFrom(''); setFilterTo(''); setMatPage(0); setShowDateFilter(false); }}
                          className="h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-wide flex items-center justify-center gap-1 transition-all bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25"
                        >
                          Clear Dates
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Search Bar */}
                <div className="flex-1 min-w-[180px]">
                  <Input
                    placeholder="Search by project / material..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                    }}
                    className="h-8 bg-[#111520] border-[#1e2435] rounded-lg text-xs font-bold text-white placeholder:text-zinc-500"
                  />
                </div>

                {/* Filters Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowExtraFilters(!showExtraFilters)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 select-none cursor-pointer",
                    showExtraFilters
                      ? "bg-blue-600/10 border-blue-500 text-blue-400"
                      : "bg-[#111520] border-[#1e2435] text-zinc-400 hover:text-white"
                  )}
                >
                  <span>Project Filters</span>
                  <ChevronDown size={11} className={cn("transition-transform", showExtraFilters && "rotate-180")} />
                </button>

                <button
                  onClick={() => {
                    setFilterFrom('')
                    setFilterTo('')
                    setSearchQuery('')
                    setSelectedProjectId('')
                    setMatPage(0)
                  }}
                  className="h-8 px-3 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-1 select-none cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Extra Project filters tray */}
            {viewMode === 'all' && showExtraFilters && (
              <div className="px-4 py-2 border-b border-zinc-800 bg-[#0c0e14] flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-200 shrink-0">
                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Filter by Project</span>
                  <select
                    value={selectedProjectId}
                    onChange={e => { setSelectedProjectId(e.target.value); setMatPage(0); }}
                    className="h-8 px-3 rounded-lg text-xs font-bold bg-[#111520] border border-[#1e2435] text-white outline-none focus:border-blue-500"
                  >
                    <option value="">All Projects / Sites</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between">
              {viewMode === 'folders' ? (
                <div className="p-8 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {Object.entries(groupedCategories).map(([key, category]) => {
                      const qtyDisplay = Object.entries(category.totalQty)
                        .map(([unit, val]) => `${val.toLocaleString('en-IN')} ${unit}`)
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
                                ₹ {category.totalCost.toLocaleString('en-IN')}
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
                  <div className="flex-1 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-zinc-900/80">
                        <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
                          <TableHead className="px-4 py-2 uppercase text-[10px] font-black tracking-widest text-zinc-400 w-12 text-center">S.No</TableHead>
                          <TableHead className="px-4 py-2 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                          <TableHead className="py-2 uppercase text-[10px] font-black tracking-widest text-zinc-400">Material</TableHead>
                          <TableHead className="py-2 uppercase text-[10px] font-black tracking-widest text-zinc-400">Quantity</TableHead>
                          <TableHead className="text-right px-4 py-2 uppercase text-[10px] font-black tracking-widest text-zinc-400">Total Amount</TableHead>
                          <TableHead className="px-4 py-2 uppercase text-[10px] font-black tracking-widest text-zinc-400 text-center">Payment Status</TableHead>
                          <TableHead className="py-2 w-14 text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          Array(5).fill(0).map((_, i) => (
                            <TableRow key={i} className="animate-pulse border-zinc-800">
                              <TableCell colSpan={7} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                            </TableRow>
                          ))
                        ) : materials.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-24 text-center">
                              <div className="flex flex-col items-center gap-4 text-zinc-600">
                                <Boxes size={48} className="opacity-10" />
                                <p className="text-sm font-bold uppercase tracking-widest">
                                  {(filterFrom || filterTo) ? 'No materials found for selected date' : 'No material history found'}
                                </p>
                                {(filterFrom || filterTo) && (
                                  <button onClick={() => { setFilterFrom(''); setFilterTo(''); setMatPage(0); }}
                                    className="text-xs font-bold text-blue-400 underline">Clear filter</button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          materials.map((item, idx) => {
                            return (
                              <TableRow key={item.id} className={cn("border-zinc-800 transition-colors hover:bg-white/5", selectedDetailItem?.id === item.id && "bg-white/5 border-l-2 border-l-blue-500")}>
                                <TableCell className="px-4 py-1.5 font-bold text-gray-400 text-xs text-center">{matPage * 10 + idx + 1}</TableCell>
                                <TableCell className="px-4 py-1.5 font-bold text-gray-400 text-xs whitespace-nowrap">
                                  <p className="text-white font-bold">{format(new Date(item.date), 'dd-MM-yyyy')}</p>
                                  <p className="text-zinc-500 text-[10px] font-bold mt-0.5">{format(new Date(item.date), 'EEE')}</p>
                                </TableCell>
                                <TableCell className="py-1.5 font-bold text-white text-sm whitespace-nowrap">
                                  <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-[#1e2435] text-zinc-300">
                                    {item.name}
                                  </span>
                                </TableCell>
                                <TableCell className="py-1.5 text-zinc-400 text-xs whitespace-nowrap font-bold">
                                  <span>{item.quantity} {item.unit}</span>
                                  {item.cost_per_unit > 0 && (
                                    <span className="text-zinc-500 font-semibold ml-1.5">@ ₹{item.cost_per_unit}</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5 text-right px-4">
                                  <p className="font-black text-white text-sm whitespace-nowrap">₹ {(item.total_amount || 0).toLocaleString('en-IN')}</p>
                                </TableCell>
                                <TableCell className="py-1.5 text-center px-4">
                                  {item.payment_system_v2 ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setPaymentItem(item)
                                        setPaymentData({
                                          payment_mode: item.payment_mode || 'cash',
                                          account_name: item.account_name || '',
                                          payment_date: item.payment_date || item.date || format(new Date(), 'yyyy-MM-dd')
                                        })
                                        setShowPaymentModal(true)
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase inline-block cursor-pointer transition-all hover:scale-105 active:scale-95",
                                        item.payment_status === 'paid'
                                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                          : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                                      )}
                                    >
                                      {item.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                                    </button>
                                  ) : (
                                    <span className="text-zinc-600 text-xs font-semibold">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedDetailItem(item)
                                    }}
                                    className={cn(
                                      "p-1 rounded-lg transition-all",
                                      selectedDetailItem?.id === item.id
                                        ? "bg-blue-600 text-white"
                                        : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                    )}
                                    title="View Details"
                                  >
                                    <Eye size={11} />
                                  </button>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Desktop Pagination */}
                  {totalCount > 0 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 flex-wrap gap-3 bg-[#0d1018] shrink-0 mt-auto">
                      <span className="text-xs text-zinc-500 font-medium">
                        Showing {totalCount > 0 ? matPage * 10 + 1 : 0} to {Math.min(totalCount, (matPage + 1) * 10)} of {totalCount} entries
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={matPage === 0}
                          onClick={() => setMatPage(0)}
                          className="w-8 h-8 rounded-lg text-xs font-black uppercase bg-[#111520] border border-[#1e2435] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer"
                        >
                          «
                        </button>
                        <button
                          disabled={matPage === 0}
                          onClick={() => setMatPage(p => p - 1)}
                          className="w-8 h-8 rounded-lg text-xs font-black uppercase bg-[#111520] border border-[#1e2435] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer"
                        >
                          ‹
                        </button>

                        {(() => {
                          const totalPages = Math.ceil(totalCount / 10)
                          const pages = []
                          const maxVisiblePages = 5
                          let start = Math.max(0, matPage - 2)
                          const endVal = Math.min(totalPages, start + maxVisiblePages)
                          if (endVal - start < maxVisiblePages) {
                            start = Math.max(0, endVal - maxVisiblePages)
                          }
                          for (let i = start; i < endVal; i++) {
                            pages.push(i)
                          }
                          return pages.map(p => (
                            <button
                              key={p}
                              onClick={() => setMatPage(p)}
                              className={cn(
                                "w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center border cursor-pointer",
                                matPage === p
                                  ? "bg-blue-600 border-blue-500 text-white font-black"
                                  : "bg-[#111520] border-[#1e2435] text-zinc-400 hover:text-white"
                              )}
                            >
                              {p + 1}
                            </button>
                          ))
                        })()}

                        <button
                          disabled={(matPage + 1) * 10 >= totalCount}
                          onClick={() => setMatPage(p => p + 1)}
                          className="w-8 h-8 rounded-lg text-xs font-black uppercase bg-[#111520] border border-[#1e2435] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer"
                        >
                          ›
                        </button>
                        <button
                          disabled={(matPage + 1) * 10 >= totalCount}
                          onClick={() => setMatPage(Math.ceil(totalCount / 10) - 1)}
                          className="w-8 h-8 rounded-lg text-xs font-black uppercase bg-[#111520] border border-[#1e2435] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer"
                        >
                          »
                        </button>

                        <div className="h-8 px-3 rounded-lg text-xs font-bold bg-[#111520] border border-[#1e2435] text-zinc-400 flex items-center justify-center ml-2">
                          10 / page
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mobile Cards */}
                  <div className="flex flex-col gap-2.5 p-4 md:hidden bg-[#05070B] overflow-y-auto">
                    {loading ? (
                      Array(3).fill(0).map((_, i) => <div key={i} className="h-24 animate-pulse bg-zinc-900 rounded-xl" />)
                    ) : materials.length === 0 ? (
                      <div className="flex flex-col items-center gap-4 text-zinc-600 py-10">
                        <Boxes size={48} className="opacity-10" />
                        <p className="text-sm font-bold uppercase tracking-widest">
                          {(filterFrom || filterTo) ? 'No materials for selected date' : 'No material history found'}
                        </p>
                      </div>
                    ) : (
                      materials.map((item) => {
                        const notes = item.notes || '';
                        const cleanNotesVal = notes.replace(/Supplier:\s(.*?)(?:\s\||$)/, '').replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '').replace(/^[\s\|]+|[\s\|]+$/g, '').trim();
                        return (
                          <div key={item.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm truncate">{item.projects?.name}</p>
                                <p className="font-black text-blue-400 text-[11px] tracking-tight uppercase mt-0.5 truncate">{item.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] font-bold text-zinc-500">
                                    {format(new Date(item.date), 'dd MMM yyyy')} · {item.quantity} {item.unit}
                                  </span>
                                  {item.payment_system_v2 && (
                                    item.payment_status === 'paid' ? (
                                      <span
                                        onClick={() => {
                                          setPaymentItem(item)
                                          setPaymentData({
                                            payment_mode: item.payment_mode || 'cash',
                                            account_name: item.account_name || '',
                                            payment_date: item.payment_date || item.date || format(new Date(), 'yyyy-MM-dd')
                                          })
                                          setShowPaymentModal(true)
                                        }}
                                        className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-pointer"
                                      >
                                        Paid
                                      </span>
                                    ) : (
                                      <span
                                        onClick={() => {
                                          setPaymentItem(item)
                                          setPaymentData({
                                            payment_mode: 'cash',
                                            account_name: '',
                                            payment_date: item.date || format(new Date(), 'yyyy-MM-dd')
                                          })
                                          setShowPaymentModal(true)
                                        }}
                                        className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-red-500/10 border border-red-500/20 text-red-400 cursor-pointer"
                                      >
                                        Unpaid
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black text-white text-sm">₹ {item.total_amount?.toLocaleString('en-IN') || item.total_cost?.toLocaleString('en-IN')}</p>
                                {item.cost_per_unit > 0 && (
                                  <p className="text-[9px] font-bold text-zinc-500 mt-0.5">@ ₹{item.cost_per_unit}</p>
                                )}
                              </div>
                            </div>

                            {cleanNotesVal ? (
                              <p className="text-[10px] text-zinc-500 leading-relaxed">{cleanNotesVal}</p>
                            ) : null}

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/60">
                              <button
                                onClick={() => {
                                  setSelectedDetailItem(item)
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 bg-blue-500/10 border border-blue-500/20 text-blue-400"
                              >
                                <Eye size={11} /> View
                              </button>
                              <button
                                onClick={() => handleOpenEditMat(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all active:scale-95"
                                style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
                              >
                                <Edit2 size={11} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteMat(item.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all active:scale-95"
                                style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  {/* Mobile Pagination */}
                  {totalCount > 10 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 md:hidden shrink-0">
                      <button disabled={matPage === 0} onClick={() => setMatPage(p => p - 1)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                        style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                      <span className="text-xs" style={{ color: '#6b7280' }}>{matPage + 1} / {Math.ceil(totalCount / 10)}</span>
                      <button disabled={(matPage + 1) * 10 >= totalCount} onClick={() => setMatPage(p => p + 1)}
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

      {/* DETAIL MODAL POPUP */}
      {selectedDetailItem && (() => {
        const detailNotes = selectedDetailItem.notes || ''
        const detailSupplierMatch = detailNotes.match(/Supplier:\s(.*?)(?:\s\(|$)/)
        const detailSupplierPhoneMatch = detailNotes.match(/\((\d+)\)/)
        const detailMatAmtMatch = detailNotes.match(/Material Amount:\sRs\.([\d,.]+)/)
        const detailTransportMatch = detailNotes.match(/Transportation:\sRs\.([\d,.]+)/)
        const detailHamaliMatch = detailNotes.match(/Hamali:\sRs\.([\d,.]+)/)
        const detailReceiptMatch = detailNotes.match(/Receipt:\s(.*?)(?:\s\||$)/)

        const detailSupplier = detailSupplierMatch ? detailSupplierMatch[1] : '—'
        const detailSupplierPhone = detailSupplierPhoneMatch ? detailSupplierPhoneMatch[1] : ''
        const detailSupplierDisplay = detailSupplier !== '—' ? (detailSupplierPhone ? `${detailSupplier} (${detailSupplierPhone})` : detailSupplier) : '—'

        const rawMatAmt = detailMatAmtMatch ? detailMatAmtMatch[1].replace(/,/g, '') : (selectedDetailItem.quantity * selectedDetailItem.cost_per_unit)
        const detailMatAmtVal = parseFloat(String(rawMatAmt)) || 0

        const detailTransportVal = detailTransportMatch ? parseFloat(detailTransportMatch[1].replace(/,/g, '')) || 0 : 0
        const detailHamaliVal = detailHamaliMatch ? parseFloat(detailHamaliMatch[1].replace(/,/g, '')) || 0 : 0
        const detailReceiptUrl = selectedDetailItem.receipt_url || (detailReceiptMatch ? detailReceiptMatch[1] : null)

        const detailCleanNotes = detailNotes
          .replace(/Supplier:\s(.*?)(?:\s\(|$)/, '')
          .replace(/\(\d+\)/, '')
          .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
          .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
          .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
          .replace(/Receipt:\s(.*?)(?:\s\||$)/, '')
          .replace(/^[\s\|]+|[\s\|]+$/g, '')
          .trim()

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setSelectedDetailItem(null)}>
            <div className="rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col space-y-5 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-4 border-b border-[#1e2435] shrink-0">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Delivery Details</h3>
                </div>
                <button onClick={() => setSelectedDetailItem(null)} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all">
                  <X size={16} />
                </button>
              </div>

              {/* Subheader Card */}
              <div className="flex items-center justify-between bg-[#0b0e14] p-4 rounded-xl border border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm lowercase">{selectedDetailItem.projects?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-[#1e2435] text-zinc-400">
                        {selectedDetailItem.name}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500">
                        {format(new Date(selectedDetailItem.date), 'dd-MM-yyyy')} ({format(new Date(selectedDetailItem.date), 'EEE')})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-white text-base">₹ {(selectedDetailItem.total_amount || 0).toLocaleString('en-IN')}</p>
                  {selectedDetailItem.payment_system_v2 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black uppercase inline-block mt-1",
                      selectedDetailItem.payment_status === 'paid'
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border border-red-500/20 text-red-400"
                    )}>
                      {selectedDetailItem.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  )}
                </div>
              </div>

              {/* Info List */}
              <div className="bg-[#0b0e14]/50 p-4 rounded-xl space-y-2.5 text-xs border border-zinc-900">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold">Supplier</span>
                  <span className="text-white font-bold">{detailSupplierDisplay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold">Quantity</span>
                  <span className="text-white font-bold">{selectedDetailItem.quantity} {selectedDetailItem.unit}</span>
                </div>
                {selectedDetailItem.cost_per_unit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Rate</span>
                    <span className="text-white font-bold">₹ {selectedDetailItem.cost_per_unit}</span>
                  </div>
                )}
                {detailMatAmtVal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Material Amount</span>
                    <span className="text-white font-bold">₹ {detailMatAmtVal.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {detailTransportVal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Transportation</span>
                    <span className="text-white font-bold">₹ {detailTransportVal.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {detailHamaliVal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Hamali</span>
                    <span className="text-white font-bold">₹ {detailHamaliVal.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {detailReceiptUrl && (
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-zinc-500 font-bold">Receipt Attachment</span>
                    <a
                      href={detailReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-wider text-blue-400 hover:bg-blue-500/20 transition-all font-sans"
                    >
                      <FileText size={10} /> View Receipt
                    </a>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              {selectedDetailItem.payment_system_v2 && (
                <div className="bg-[#0b0e14]/50 p-4 rounded-xl space-y-2.5 text-xs border border-zinc-900">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 font-bold">Payment Status</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                      selectedDetailItem.payment_status === 'paid' ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
                    )}>
                      {selectedDetailItem.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  {selectedDetailItem.payment_status === 'paid' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-bold">Payment Mode</span>
                        <span className="text-white font-bold capitalize">{selectedDetailItem.payment_mode || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-bold">Payment Date</span>
                        <span className="text-white font-bold">
                          {selectedDetailItem.payment_date ? format(new Date(selectedDetailItem.payment_date), 'dd-MM-yyyy') : '—'}
                        </span>
                      </div>
                      {selectedDetailItem.payment_mode === 'online' && selectedDetailItem.account_name && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-bold">Paid From Account</span>
                          <span className="text-white font-bold">{selectedDetailItem.account_name}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Remarks / Notes */}
              {detailCleanNotes && (
                <div className="bg-[#0b0e14]/50 p-4 rounded-xl text-xs text-zinc-300 leading-relaxed border border-zinc-900">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Remarks</p>
                  <p className="font-semibold text-zinc-300 leading-relaxed">{detailCleanNotes}</p>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex gap-3 pt-4 border-t border-[#1e2435] shrink-0 mt-auto">
                <button
                  onClick={() => handleOpenEditMat(selectedDetailItem)}
                  className="flex-1 h-11 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  onClick={() => handleDeleteMat(selectedDetailItem.id)}
                  className="flex-1 h-11 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Payment V2 Status Dialog */}
      {showPaymentModal && paymentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowPaymentModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Update Payment Details</h3>
            </div>

            <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-zinc-800/80 space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Material Delivery</p>
              <p className="text-xs font-black text-white uppercase">{paymentItem.name} · {paymentItem.quantity} {paymentItem.unit}</p>
              <p className="text-sm font-black text-emerald-400 mt-1">₹ {paymentItem.total_amount?.toLocaleString('en-IN')}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Mode</label>
                <select
                  value={paymentData.payment_mode}
                  onChange={e => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
                  className="styled-select w-full h-10 text-xs"
                >
                  <option value="cash">💵 Cash Payment</option>
                  <option value="online">💳 Online Bank Transfer</option>
                </select>
              </div>

              {paymentData.payment_mode === 'online' && (
                <div className="space-y-1 animate-in slide-in-from-top-1 duration-150">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Paid from Account Name</label>
                  <Input
                    placeholder="e.g. SBI Main, HDFC Construction"
                    value={paymentData.account_name}
                    onChange={e => setPaymentData({ ...paymentData, account_name: e.target.value })}
                    className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Date</label>
                <Input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={e => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs px-3"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                disabled={paymentSaving}
                onClick={() => handleSavePayment('unpaid')}
                className="flex-1 h-10 rounded-xl text-xs font-black uppercase border border-red-500/30 text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
              >
                Mark Unpaid
              </button>
              <button
                disabled={paymentSaving}
                onClick={() => handleSavePayment('paid')}
                className="flex-1 h-10 rounded-xl text-xs font-black uppercase bg-emerald-500 text-zinc-950 hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {paymentSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Mark Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowAddModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <p className="text-sm font-bold text-white uppercase tracking-wide">New Stock Entry</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                <select value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })} className="styled-select w-full h-11">
                  <option value="">Delivery Location</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* ── Material Name with Autocomplete ── */}
              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Material Name</label>
                <Input
                  placeholder="e.g. Cement, Sand, Steel"
                  value={formData.name}
                  autoComplete="off"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                  className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                />

                {/* Suggestions dropdown */}
                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <div
                    className="absolute left-0 right-0 z-[60] rounded-xl overflow-hidden shadow-2xl"
                    style={{
                      top: '100%',
                      marginTop: 4,
                      backgroundColor: '#0d1018',
                      border: '1px solid #1e2435',
                    }}
                  >
                    {nameSuggestions.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setFormData({ ...formData, name })
                          setShowNameSuggestions(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500/10 border-b border-[#1e2435] last:border-0"
                      >
                        {(() => {
                          const q = formData.name.trim().toLowerCase()
                          const idx = name.toLowerCase().indexOf(q)
                          if (idx === -1) return name
                          return (
                            <>
                              {name.slice(0, idx)}
                              <span className="text-blue-400">{name.slice(idx, idx + q.length)}</span>
                              {name.slice(idx + q.length)}
                            </>
                          )
                        })()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Qty</label>
                  <Input
                    placeholder="0.00"
                    type="number"
                    value={formData.quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value
                      const qty = parseFloat(val) || 0
                      const cpu = parseFloat(formData.cost_per_unit) || 0
                      const baseAmt = qty > 0 && cpu > 0 ? (qty * cpu).toString() : formData.base_amount
                      const base = parseFloat(baseAmt) || 0
                      const tFee = transportEnabled ? (parseFloat(transportFee) || 0) : 0
                      const hFee = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0
                      const calculated = (base + tFee + hFee).toFixed(2)
                      setFormData(prev => ({
                        ...prev,
                        quantity: val,
                        base_amount: baseAmt,
                        total_amount: calculated
                      }))
                    }}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value
                      const qty = parseFloat(formData.quantity) || 0
                      const cpu = parseFloat(val) || 0
                      const baseAmt = qty > 0 && cpu > 0 ? (qty * cpu).toString() : formData.base_amount
                      const base = parseFloat(baseAmt) || 0
                      const tFee = transportEnabled ? (parseFloat(transportFee) || 0) : 0
                      const hFee = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0
                      const calculated = (base + tFee + hFee).toFixed(2)
                      setFormData(prev => ({
                        ...prev,
                        cost_per_unit: val,
                        base_amount: baseAmt,
                        total_amount: calculated
                      }))
                    }}
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = e.target.value
                    const base = parseFloat(val) || 0
                    const tFee = transportEnabled ? (parseFloat(transportFee) || 0) : 0
                    const hFee = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0
                    const calculated = (base + tFee + hFee).toFixed(2)
                    setFormData(prev => ({
                      ...prev,
                      base_amount: val,
                      total_amount: calculated
                    }))
                  }}
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
                  <input
                    type="checkbox"
                    checked={transportEnabled}
                    onChange={e => {
                      const enabled = e.target.checked
                      setTransportEnabled(enabled)
                      const base = parseFloat(formData.base_amount) || 0
                      const tFee = enabled ? (parseFloat(transportFee) || 0) : 0
                      const hFee = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0
                      const calculated = (base + tFee + hFee).toFixed(2)
                      setFormData(prev => ({ ...prev, total_amount: calculated }))
                    }}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Transportation Fees</span>
                </label>
                {transportEnabled && (
                  <Input
                    type="number" placeholder="Enter transport amount"
                    value={transportFee}
                    onChange={e => {
                      const val = e.target.value
                      setTransportFee(val)
                      const base = parseFloat(formData.base_amount) || 0
                      const tFee = parseFloat(val) || 0
                      const hFee = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0
                      const calculated = (base + tFee + hFee).toFixed(2)
                      setFormData(prev => ({ ...prev, total_amount: calculated }))
                    }}
                    className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white animate-in slide-in-from-top-1 duration-150"
                  />
                )}
              </div>

              {/* Hamali Fee */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hamaliEnabled}
                    onChange={e => {
                      const enabled = e.target.checked
                      setHamaliEnabled(enabled)
                      const base = parseFloat(formData.base_amount) || 0
                      const tFee = transportEnabled ? (parseFloat(transportFee) || 0) : 0
                      const hFee = enabled ? (parseFloat(hamaliFee) || 0) : 0
                      const calculated = (base + tFee + hFee).toFixed(2)
                      setFormData(prev => ({ ...prev, total_amount: calculated }))
                    }}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Hamali Fees (Loading/Unloading)</span>
                </label>
                {hamaliEnabled && (
                  <Input
                    type="number" placeholder="Enter hamali amount"
                    value={hamaliFee}
                    onChange={e => {
                      const val = e.target.value
                      setHamaliFee(val)
                      const base = parseFloat(formData.base_amount) || 0
                      const tFee = transportEnabled ? (parseFloat(transportFee) || 0) : 0
                      const hFee = parseFloat(val) || 0
                      const calculated = (base + tFee + hFee).toFixed(2)
                      setFormData(prev => ({ ...prev, total_amount: calculated }))
                    }}
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
                    onChange={handleReceiptFileChange}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in-50" onClick={() => setEditingMat(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-white uppercase tracking-wide">Edit Material Entry</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Material Name</label>
                <Input value={editMatData.name} onChange={e => setEditMatData({ ...editMatData, name: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Qty</label>
                <Input type="number" value={editMatData.quantity} onChange={e => setEditMatData({ ...editMatData, quantity: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Unit</label>
                <select value={editMatData.unit} onChange={e => setEditMatData({ ...editMatData, unit: e.target.value })} className="styled-select text-xs h-10">
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
                <Input type="number" value={editMatData.total_amount} onChange={e => setEditMatData({ ...editMatData, total_amount: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</label>
                <Input type="date" value={editMatData.date} onChange={e => setEditMatData({ ...editMatData, date: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs px-3" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Remarks</label>
                <Input value={editMatData.notes} onChange={e => setEditMatData({ ...editMatData, notes: e.target.value })} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingMat(null)} className="flex-1 h-10 rounded-xl text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#6b7280', border: '1px solid #1e2435' }}>Cancel</button>
              <button onClick={handleSaveMat} disabled={editSaving} className="flex-1 h-10 rounded-xl text-xs font-black uppercase text-[#0a0c12] disabled:opacity-50" style={{ backgroundColor: '#3b82f6' }}>{editSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Drill-down Modal */}
      {activeFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4 transition-all animate-in fade-in-50"
          onClick={() => setActiveFolder(null)}
        >
          <div
            className="rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-[#0d1018] border border-[#1e2435] shadow-2xl relative animate-in zoom-in-95"
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
                className="p-2 rounded-lg bg-zinc-950/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
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
                      .map(([unit, val]) => `${val.toLocaleString('en-IN')} ${unit}`)
                      .join(', ') || '—'}
                  </p>
                </div>
                <div className="bg-blue-600 p-4 rounded-xl border border-blue-500 shadow-lg shadow-blue-600/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-blue-100">Total Money Spent</p>
                  <p className="text-xl font-black text-white mt-1">
                    ₹ {groupedCategories[activeFolder]?.totalCost.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Desktop Items Table */}
              <div className="hidden md:block border border-[#1e2435] rounded-xl overflow-hidden bg-black/10">
                <Table>
                  <TableHeader className="bg-black/30">
                    <TableRow className="border-[#1e2435] hover:bg-transparent">
                      <TableHead className="px-5 py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500 w-10">S.No</TableHead>
                      <TableHead className="py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500">Date</TableHead>
                      <TableHead className="py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500">Item Detail</TableHead>
                      <TableHead className="py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500">Supplier</TableHead>
                      <TableHead className="py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500">Fees (Trsp/Hml)</TableHead>
                      <TableHead className="py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500">Remarks</TableHead>
                      <TableHead className="text-right pr-6 py-3 text-[9px] font-black uppercase tracking-wider text-zinc-500">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedCategories[activeFolder]?.items.map((item, idx) => {
                      const notes = item.notes || '';
                      const supplierMatch = notes.match(/Supplier:\s(.*?)(?:\s\(|$)/);
                      const supplierPhoneMatch = notes.match(/\((\d+)\)/);
                      const transportMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/);
                      const hamaliMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/);

                      const supplier = supplierMatch ? supplierMatch[1] : '—';
                      const supplierPhone = supplierPhoneMatch ? supplierPhoneMatch[1] : '';
                      const supplierDisplay = supplier !== '—' ? (supplierPhone ? `${supplier} (${supplierPhone})` : supplier) : '—';
                      const transport = transportMatch ? `₹${transportMatch[1]}` : '';
                      const hamali = hamaliMatch ? `₹${hamaliMatch[1]}` : '';

                      const cleanNotes = notes
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
                          <TableCell className="px-5 py-2 font-bold text-gray-500 text-xs text-center">{idx + 1}</TableCell>
                          <TableCell className="py-2 font-bold text-gray-400 text-xs whitespace-nowrap">
                            {format(new Date(item.date), 'dd-MM-yyyy')}
                          </TableCell>
                          <TableCell className="py-2">
                            <p className="font-black text-gray-200 text-xs uppercase tracking-tight leading-none">{item.name}</p>
                            <p className="font-bold text-zinc-500 text-[9px] uppercase mt-1">
                              {item.quantity} {item.unit} {item.cost_per_unit > 0 ? ` @ ₹${item.cost_per_unit}` : ''}
                            </p>
                          </TableCell>
                          <TableCell className="py-2">
                            <p className="font-bold text-white text-xs whitespace-nowrap">{supplierDisplay}</p>
                          </TableCell>
                          <TableCell className="py-2 text-[10px]">
                            {transport && <p className="text-zinc-400">Trsp: <span className="text-white">{transport}</span></p>}
                            {hamali && <p className="text-zinc-400">Hml: <span className="text-white">{hamali}</span></p>}
                            {!transport && !hamali && '—'}
                          </TableCell>
                          <TableCell className="py-2 text-[10px] text-zinc-400 max-w-[150px] break-words">
                            {cleanNotes || '—'}
                          </TableCell>
                          <TableCell className="py-2 text-right pr-6 font-black text-blue-400 text-sm whitespace-nowrap">
                            ₹ {item.total_amount?.toLocaleString('en-IN') || item.total_cost?.toLocaleString('en-IN')}
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

                  const cleanNotes = notes
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
                          <p className="font-black text-blue-400 text-sm">₹ {item.total_amount?.toLocaleString('en-IN') || item.total_cost?.toLocaleString('en-IN')}</p>
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
