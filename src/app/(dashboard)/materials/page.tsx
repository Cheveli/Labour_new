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
import { 
  Boxes, Loader2, Trash2, Edit2, FileText, Upload, Folder, FolderOpen, 
  ChevronRight, X, Calendar, ChevronDown, Eye, Plus, Check, Settings, 
  AlertTriangle, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, Filter 
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const MATERIAL_MASTER = [
  { name: 'Other / Miscellaneous', unit: 'No Unit' },
  { name: 'Cement', unit: 'Bags' },
  { name: 'White Cement', unit: 'Bags' },
  { name: 'Steel', unit: 'Kg' },
  { name: 'Binding Wire', unit: 'Kg' },
  { name: 'Sand', unit: 'Tons' },
  { name: 'Coarse Aggregate', unit: 'Tons' },
  { name: 'Dust Powder', unit: 'Tons' },
  { name: 'Bricks', unit: 'Nos' },
  { name: 'Fly Ash Bricks', unit: 'Nos' },
  { name: 'Tiles', unit: 'Boxes' },
  { name: 'Marble', unit: 'Sq.ft' },
  { name: 'Granite', unit: 'Sq.ft' },
  { name: 'Grout', unit: 'Bags' },
  { name: 'Plumbing Materials', unit: 'No Unit' },
  { name: 'Electrical Materials', unit: 'No Unit' },
  { name: 'Door', unit: 'Nos' },
  { name: 'Door Frame', unit: 'Nos' },
  { name: 'Window', unit: 'Nos' },
  { name: 'Plywood', unit: 'Sheets' },
  { name: 'False Ceiling', unit: 'Sq.ft' },
  { name: 'Painting', unit: 'Liters' },
  { name: 'Water Tank', unit: 'Nos' },
] as const;

const QUICK_ADD_MATERIALS = ['Cement', 'Steel', 'Sand', 'Coarse Aggregate', 'Bricks', 'Binding Wire'] as const;

interface ParsedMaterialNotes {
  purchase_id: string
  supplier: string
  brand: string | null
  invoice_number: string | null
  transportation_cost: number
  loading_cost: number
  discount: number
  calculated_total: number
  final_paid_amount: number
  remarks: string | null
  is_erp_v3: boolean
}

const parseMaterialNotes = (notesStr: string | null | undefined): ParsedMaterialNotes => {
  if (notesStr && notesStr.startsWith('{')) {
    try {
      const parsed = JSON.parse(notesStr)
      if (parsed.is_erp_v3) {
        return {
          purchase_id: parsed.purchase_id || '—',
          supplier: parsed.supplier || '—',
          brand: parsed.brand || null,
          invoice_number: parsed.invoice_number || null,
          transportation_cost: parsed.transportation_cost || 0,
          loading_cost: parsed.loading_cost || 0,
          discount: parsed.discount || 0,
          calculated_total: parsed.calculated_total || 0,
          final_paid_amount: parsed.final_paid_amount || 0,
          remarks: parsed.remarks || null,
          is_erp_v3: true
        }
      }
    } catch (e) {}
  }

  // Fallback for legacy format
  const notes = notesStr || ''
  const supMatch = notes.match(/Supplier:\s(.*?)(?:\s\(|$)/)
  const transMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/)
  const hamaliMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/)
  
  const detailCleanNotes = notes
    .replace(/Supplier:\s(.*?)(?:\s\(|$)/, '')
    .replace(/\(\d+\)/, '')
    .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
    .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
    .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
    .replace(/^[\s\|]+|[\s\|]+$/g, '')
    .trim()

  return {
    purchase_id: '—',
    supplier: supMatch ? supMatch[1] : '—',
    brand: null,
    invoice_number: null,
    transportation_cost: transMatch ? parseFloat(transMatch[1].replace(/,/g, '')) || 0 : 0,
    loading_cost: hamaliMatch ? parseFloat(hamaliMatch[1].replace(/,/g, '')) || 0 : 0,
    discount: 0,
    calculated_total: 0,
    final_paid_amount: 0,
    remarks: detailCleanNotes || null,
    is_erp_v3: false
  }
}

interface Project {
  id: string
  name: string
  description?: string | null
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

import { haptic } from '@/lib/haptic'

interface MaterialCardProps {
  item: Material
  cleanNotesVal: string
  onDelete: (id: string) => void
  onEdit: (item: Material) => void
  onView: (item: Material) => void
  onTogglePayment: (item: Material) => void
}

function MaterialCard({ item, cleanNotesVal, onDelete, onEdit, onView, onTogglePayment }: MaterialCardProps) {
  const parsed = parseMaterialNotes(item.notes)
  const supplierDisplay = parsed.supplier !== '—' ? parsed.supplier : ''

  return (
    <div
      style={{
        backgroundColor: '#111520',
        border: '1px solid #1e2435',
      }}
      className="relative rounded-xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.01]"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{item.projects?.name}</p>
          <p className="font-black text-blue-400 text-[11px] tracking-tight uppercase mt-0.5 truncate">
            {item.name}{parsed.brand ? ` (${parsed.brand})` : ''}
          </p>
          {supplierDisplay && (
            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
              Supplier: <span className="text-zinc-300 font-bold">{supplierDisplay}</span>
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-zinc-500">
              {format(new Date(item.date), 'dd MMM yyyy')} · {item.quantity} {item.unit}
            </span>
            {item.payment_system_v2 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase cursor-pointer border select-none transition-all",
                  item.payment_status === 'paid'
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                )}
                onClick={() => onTogglePayment(item)}
              >
                {item.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-white text-sm">₹ {(item.total_amount || item.total_cost || 0).toLocaleString('en-IN')}</p>
          {item.cost_per_unit > 0 && (
            <p className="text-[9px] font-bold text-zinc-500 mt-0.5">@ ₹{item.cost_per_unit}</p>
          )}
        </div>
      </div>

      {cleanNotesVal ? (
        <p className="text-[10px] text-zinc-500 leading-relaxed truncate">{cleanNotesVal}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/60">
        <button
          onClick={() => onView(item)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 bg-blue-500/10 border border-blue-500/20 text-blue-400 cursor-pointer"
        >
          <Eye size={10} /> View
        </button>
        <button
          onClick={() => onEdit(item)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
          style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
        >
          <Edit2 size={10} /> Edit
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
          style={{ backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  )
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'all' | 'folders'>('all')
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  // ERP Tab Control
  const [activeTab, setActiveTab] = useState<'purchases' | 'dashboard' | 'analytics' | 'estimations'>('purchases')

  // Multi-item purchase form state
  const [purchaseItems, setPurchaseItems] = useState<Array<{
    name: string
    brand: string
    quantity: string
    unit: string
    cost_per_unit: string
    unitLocked: boolean
    customName?: string
  }>>([
    { name: 'Cement', brand: '', quantity: '', unit: 'Bags', cost_per_unit: '', unitLocked: true, customName: '' }
  ])

  // Common purchase details
  const [commonSupplier, setCommonSupplier] = useState('')
  const [commonDate, setCommonDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [commonInvoice, setCommonInvoice] = useState('')
  const [commonTransport, setCommonTransport] = useState('')
  const [commonLoading, setCommonLoading] = useState('')
  const [commonRemarks, setCommonRemarks] = useState('')
  const [commonPaidAmount, setCommonPaidAmount] = useState('')
  const [isPaidAmountManuallyEdited, setIsPaidAmountManuallyEdited] = useState(false)
  const [creationPaymentStatus, setCreationPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid')
  const [creationPaymentMode, setCreationPaymentMode] = useState<'cash' | 'online'>('cash')
  const [creationAccountName, setCreationAccountName] = useState('')

  // Active material for price history modal
  const [activeHistoryMaterial, setActiveHistoryMaterial] = useState<string | null>(null)

  // Estimations editing states
  const [editingEstimations, setEditingEstimations] = useState<Record<string, string>>({})
  const [showEstimationModal, setShowEstimationModal] = useState(false)

  // Grid/List filters
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterInvoice, setFilterInvoice] = useState('')

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

  // Transfer Modal states
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferSourceProj, setTransferSourceProj] = useState('')
  const [transferDestProj, setTransferDestProj] = useState('')
  const [transferMaterialId, setTransferMaterialId] = useState('')
  const [transferQty, setTransferQty] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [sourceMaterials, setSourceMaterials] = useState<Material[]>([])

  useEffect(() => {
    if (transferSourceProj) {
      loadSourceMaterials(transferSourceProj)
    } else {
      setSourceMaterials([])
    }
  }, [transferSourceProj])

  async function loadSourceMaterials(projectId: string) {
    const { data } = await supabase
      .from('materials')
      .select('*')
      .eq('project_id', projectId)
      .gt('quantity', 0)
    setSourceMaterials(data || [])
  }

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

  // Dynamic filter sets computed in-memory
  const dynamicSuppliers = React.useMemo(() => {
    const list = allMaterials.map(m => parseMaterialNotes(m.notes).supplier).filter((s): s is string => !!s)
    return [...new Set(list)].sort()
  }, [allMaterials])

  const dynamicBrands = React.useMemo(() => {
    const list = allMaterials.map(m => parseMaterialNotes(m.notes).brand).filter((b): b is string => !!b)
    return [...new Set(list)].sort()
  }, [allMaterials])

  const dynamicInvoices = React.useMemo(() => {
    const list = allMaterials.map(m => parseMaterialNotes(m.notes).invoice_number).filter((i): i is string => !!i)
    return [...new Set(list)].sort()
  }, [allMaterials])

  // Estimations computed helper mapping
  const projectEstimations = React.useMemo(() => {
    const activeProject = projects.find(p => p.id === selectedProjectId)
    if (!activeProject) return {}
    try {
      const parsed = JSON.parse(activeProject.description || '{}')
      return parsed.estimations || {}
    } catch (e) {
      return {}
    }
  }, [projects, selectedProjectId])

  const materialPurchasedTotals = React.useMemo(() => {
    const totals: Record<string, number> = {}
    allMaterials.forEach(m => {
      totals[m.name] = (totals[m.name] || 0) + (m.quantity || 0)
    })
    return totals
  }, [allMaterials])

  const materialPurchasedCosts = React.useMemo(() => {
    const costs: Record<string, number> = {}
    allMaterials.forEach(m => {
      costs[m.name] = (costs[m.name] || 0) + (m.total_amount || 0)
    })
    return costs
  }, [allMaterials])

  // In-memory searching & filtering
  const filteredMaterials = React.useMemo(() => {
    return allMaterials.filter(item => {
      const parsed = parseMaterialNotes(item.notes)
      
      // Date filter
      if (filterFrom && item.date < filterFrom) return false
      if (filterTo && item.date > filterTo) return false

      // Search Query (Material, Supplier, Brand, Invoice Number, Date)
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase().trim()
        const matchMat = item.name.toLowerCase().includes(q)
        const matchSup = parsed.supplier.toLowerCase().includes(q)
        const matchBrand = (parsed.brand || '').toLowerCase().includes(q)
        const matchInvoice = (parsed.invoice_number || '').toLowerCase().includes(q)
        const matchDate = item.date.includes(q)
        if (!matchMat && !matchSup && !matchBrand && !matchInvoice && !matchDate) return false
      }

      // Dropdown Filters
      if (filterCategory) {
        const matName = item.name.toLowerCase()
        if (filterCategory === 'Cement' && !matName.includes('cement')) return false
        if (filterCategory === 'Steel' && !matName.includes('steel') && !matName.includes('wire') && !matName.includes('rebar')) return false
        if (filterCategory === 'Sand' && !matName.includes('sand') && !matName.includes('dust') && !matName.includes('powder')) return false
        if (filterCategory === 'Aggregate' && !matName.includes('aggregate') && !matName.includes('concrete')) return false
        if (filterCategory === 'Bricks' && !matName.includes('brick') && !matName.includes('block')) return false
        if (filterCategory === 'Others') {
          const isCement = matName.includes('cement')
          const isSteel = matName.includes('steel') || matName.includes('wire') || matName.includes('rebar')
          const isSand = matName.includes('sand') || matName.includes('dust') || matName.includes('powder')
          const isAgg = matName.includes('aggregate') || matName.includes('concrete')
          const isBrick = matName.includes('brick') || matName.includes('block')
          if (isCement || isSteel || isSand || isAgg || isBrick) return false
        }
      }
      if (filterSupplier && parsed.supplier !== filterSupplier) return false
      if (filterBrand && parsed.brand !== filterBrand) return false
      if (filterInvoice && parsed.invoice_number !== filterInvoice) return false

      return true
    })
  }, [allMaterials, debouncedSearchQuery, filterFrom, filterTo, filterCategory, filterSupplier, filterBrand, filterInvoice])

  // Count calculations
  const totalFilteredCount = filteredMaterials.length

  const paginatedMaterials = React.useMemo(() => {
    return filteredMaterials.slice(matPage * 10, (matPage + 1) * 10)
  }, [filteredMaterials, matPage])

  // Material Master unit locking mapper helper
  const getUnitForMaterial = (name: string): string => {
    const match = MATERIAL_MASTER.find(m => m.name === name)
    return match ? match.unit : 'No Unit'
  }

  // Add Item to purchase builder list
  const handleUpdateItem = (index: number, field: string, value: any) => {
    setPurchaseItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item
      const updated = { ...item, [field]: value }
      if (field === 'name') {
        const defaultUnit = getUnitForMaterial(value)
        if (value === 'Other / Miscellaneous') {
          updated.unit = 'No Unit'
          updated.unitLocked = false
        } else {
          updated.unit = defaultUnit
          updated.unitLocked = true
          updated.customName = ''
        }
      }
      return updated
    }))
  }

  const handleQuickAdd = (materialName: string) => {
    const defaultUnit = getUnitForMaterial(materialName)
    setPurchaseItems(prev => [
      ...prev,
      { name: materialName, brand: '', quantity: '', unit: defaultUnit, cost_per_unit: '', unitLocked: true }
    ])
    toast.success(`Added ${materialName} item row`)
  }

  // Math purchase calculations builder
  const purchaseStats = React.useMemo(() => {
    let materialTotal = 0
    purchaseItems.forEach(item => {
      const q = parseFloat(item.quantity) || 0
      const r = parseFloat(item.cost_per_unit) || 0
      materialTotal += q * r
    })
    const t = parseFloat(commonTransport) || 0
    const l = parseFloat(commonLoading) || 0
    const calculatedTotal = materialTotal + t + l
    const paid = isPaidAmountManuallyEdited ? (parseFloat(commonPaidAmount) || 0) : calculatedTotal
    const discount = calculatedTotal - paid
    return {
      materialTotal,
      calculatedTotal,
      paid,
      discount
    }
  }, [purchaseItems, commonTransport, commonLoading, commonPaidAmount, isPaidAmountManuallyEdited])

  // Dashboard Aggregates
  const dashboardStats = React.useMemo(() => {
    let totalCost = 0
    const purchasedCounts: Record<string, number> = {}
    
    allMaterials.forEach(item => {
      if (item.payment_system_v2 && item.payment_status !== 'paid') return
      totalCost += item.total_amount || 0
      purchasedCounts[item.name] = (purchasedCounts[item.name] || 0) + (item.total_amount || 0)
    })

    const sortedPurchased = Object.entries(purchasedCounts).sort((a, b) => b[1] - a[1])
    const highestPurchased = sortedPurchased[0]?.[0] || '—'
    const lowestPurchased = sortedPurchased.length > 1 ? sortedPurchased[sortedPurchased.length - 1]?.[0] : '—'

    // Low stock warnings
    const lowStockAlerts: string[] = []
    Object.entries(projectEstimations).forEach(([matName, estQty]) => {
      const estNum = parseFloat(String(estQty)) || 0
      const purchased = materialPurchasedTotals[matName] || 0
      if (estNum > 0 && purchased >= estNum * 0.85) {
        const pct = Math.round((purchased / estNum) * 100)
        lowStockAlerts.push(`${matName} consumption has reached ${pct}% of estimate (${purchased} of ${estNum} ${getUnitForMaterial(matName)})`)
      }
    })

    // Price change alerts
    const priceAlerts: string[] = []
    const pricesByMaterial: Record<string, number[]> = {}
    allMaterials.forEach(m => {
      const rate = m.cost_per_unit || 0
      if (rate > 0) {
        if (!pricesByMaterial[m.name]) pricesByMaterial[m.name] = []
        pricesByMaterial[m.name].push(rate)
      }
    })

    Object.entries(pricesByMaterial).forEach(([name, list]) => {
      if (list.length > 1) {
        const latest = list[0]
        const avg = list.reduce((a, b) => a + b, 0) / list.length
        if (latest > avg * 1.05) {
          const pct = Math.round(((latest - avg) / avg) * 100)
          priceAlerts.push(`${name} unit price increased by ${pct}% over historic average (₹${latest} vs Avg: ₹${Math.round(avg)})`)
        }
      }
    })

    return {
      totalCost,
      highestPurchased,
      lowestPurchased,
      lowStockAlerts,
      priceAlerts
    }
  }, [allMaterials, projectEstimations, materialPurchasedTotals])

  // Material Analytics list
  const materialAnalytics = React.useMemo(() => {
    const groups: Record<string, {
      name: string
      unit: string
      totalQty: number
      totalCost: number
      minPrice: number
      maxPrice: number
      lastDate: string
      lastSupplier: string
      lastPrice: number
      prevPrice: number
    }> = {}

    allMaterials.forEach(item => {
      const parsed = parseMaterialNotes(item.notes)
      const name = item.name
      const unit = item.unit
      const qty = item.quantity
      const cost = item.total_amount
      const rate = item.cost_per_unit || (qty > 0 ? cost / qty : 0)

      if (!groups[name]) {
        groups[name] = {
          name,
          unit,
          totalQty: 0,
          totalCost: 0,
          minPrice: rate,
          maxPrice: rate,
          lastDate: item.date,
          lastSupplier: parsed.supplier,
          lastPrice: rate,
          prevPrice: 0
        }
      }

      groups[name].totalQty += qty
      groups[name].totalCost += cost
      if (rate > 0) {
        if (groups[name].minPrice === 0 || rate < groups[name].minPrice) groups[name].minPrice = rate
        if (rate > groups[name].maxPrice) groups[name].maxPrice = rate
      }

      if (item.date > groups[name].lastDate) {
        groups[name].prevPrice = groups[name].lastPrice
        groups[name].lastDate = item.date
        groups[name].lastSupplier = parsed.supplier
        groups[name].lastPrice = rate
      } else if (item.date < groups[name].lastDate && groups[name].prevPrice === 0) {
        groups[name].prevPrice = rate
      }
    })

    return Object.values(groups)
  }, [allMaterials])

  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [transportEnabled, setTransportEnabled] = useState(false)
  const [transportFee, setTransportFee] = useState('')
  const [hamaliEnabled, setHamaliEnabled] = useState(false)
  const [hamaliFee, setHamaliFee] = useState('')

  const [editingMat, setEditingMat] = useState<Material | null>(null)
  const [editNotesParsed, setEditNotesParsed] = useState<any>(null)
  const [editMatData, setEditMatData] = useState({ name: '', quantity: '', unit: '', cost_per_unit: '', total_amount: '', notes: '', date: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Payment system V2 modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentItem, setPaymentItem] = useState<Material | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid')
  const [paymentData, setPaymentData] = useState({
    payment_mode: 'cash',
    account_name: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    remarks: ''
  })
  const [paymentSaving, setPaymentSaving] = useState(false)

  // Consolidated filter modal states
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState<'category' | 'supplier' | 'brand' | 'project' | 'date'>('category')

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
    
    let isV3 = false
    let parsed: any = null
    if (item.notes && item.notes.startsWith('{')) {
      try {
        parsed = JSON.parse(item.notes)
        isV3 = true
      } catch (e) {}
    }

    if (isV3 && parsed) {
      setEditNotesParsed(parsed)
      setEditMatData({
        name: item.name,
        quantity: String(item.quantity || ''),
        unit: item.unit || 'Bags',
        cost_per_unit: String(item.cost_per_unit || ''),
        total_amount: String(item.total_amount || ''),
        notes: parsed.remarks || '',
        date: item.date
      })
      setSupplierName(parsed.supplier || '')
      setCommonInvoice(parsed.invoice_number || '')
      setCommonTransport(String(parsed.transportation_cost || ''))
      setCommonLoading(String(parsed.loading_cost || ''))
      setCommonPaidAmount(String(parsed.final_paid_amount || ''))
    } else {
      setEditNotesParsed(null)
      const notes = item.notes || ''
      const supMatch = notes.match(/Supplier:\s(.*?)(?:\s\(|$)/)
      const transMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/)
      const hamaliMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/)

      setEditMatData({
        name: item.name,
        quantity: String(item.quantity || ''),
        unit: item.unit || 'Bags',
        cost_per_unit: String(item.cost_per_unit || ''),
        total_amount: String(item.total_amount || ''),
        notes: notes
          .replace(/Supplier:\s(.*?)(?:\s\(|$)/, '')
          .replace(/\(\d+\)/, '')
          .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
          .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
          .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
          .replace(/^[\s\|]+|[\s\|]+$/g, '')
          .trim(),
        date: item.date
      })
      setSupplierName(supMatch ? supMatch[1] : '')
      setCommonInvoice('')
      setCommonTransport(transMatch ? transMatch[1] : '')
      setCommonLoading(hamaliMatch ? hamaliMatch[1] : '')
      setCommonPaidAmount(String(item.total_amount || ''))
    }
  }

  const handleSaveMat = async () => {
    if (!editingMat) return
    setEditSaving(true)
    try {
      const q = parseFloat(editMatData.quantity) || 0
      const r = parseFloat(editMatData.cost_per_unit) || 0
      const cost = q * r

      let updatedNotes = ''
      if (editNotesParsed) {
        const trans = parseFloat(commonTransport) || 0
        const load = parseFloat(commonLoading) || 0
        const calcTotal = cost + trans + load
        const finalPaid = parseFloat(commonPaidAmount) || calcTotal
        const disc = calcTotal - finalPaid

        updatedNotes = JSON.stringify({
          ...editNotesParsed,
          supplier: supplierName.trim(),
          invoice_number: commonInvoice.trim() || null,
          transportation_cost: trans,
          loading_cost: load,
          discount: disc,
          calculated_total: calcTotal,
          final_paid_amount: finalPaid,
          remarks: editMatData.notes.trim() || null
        })
      } else {
        updatedNotes = [
          supplierName ? `Supplier: ${supplierName}` : '',
          editMatData.notes,
          cost > 0 ? `Material Amount: Rs.${cost}` : '',
          commonTransport ? `Transportation: Rs.${commonTransport}` : '',
          commonLoading ? `Hamali: Rs.${commonLoading}` : ''
        ].filter(Boolean).join(' | ')
      }

      const { error } = await supabase.from('materials').update({
        name: editMatData.name,
        quantity: q,
        unit: editMatData.unit,
        cost_per_unit: r,
        total_amount: cost,
        notes: updatedNotes,
        date: editMatData.date
      }).eq('id', editingMat.id)

      if (error) throw error

      toast.success('Material entry updated!')
      setEditingMat(null)
      setSelectedDetailItem(null)
      fetchData()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update')
    } finally {
      setEditSaving(false)
    }
  }

  const handleSavePayment = async (status: 'paid' | 'unpaid') => {
    if (!paymentItem) return
    setPaymentSaving(true)

    let updatedNotes = paymentItem.notes
    const parsedNotes = parseMaterialNotes(paymentItem.notes)
    parsedNotes.remarks = paymentData.remarks

    if (paymentItem.notes && paymentItem.notes.startsWith('{')) {
      try {
        const jsonNotes = JSON.parse(paymentItem.notes)
        jsonNotes.remarks = paymentData.remarks
        updatedNotes = JSON.stringify(jsonNotes)
      } catch (e) {
        updatedNotes = JSON.stringify({
          ...parsedNotes,
          is_erp_v3: true
        })
      }
    } else {
      updatedNotes = JSON.stringify({
        ...parsedNotes,
        remarks: paymentData.remarks,
        is_erp_v3: true
      })
    }

    const payload = status === 'paid' ? {
      payment_status: 'paid',
      payment_mode: paymentData.payment_mode,
      account_name: paymentData.payment_mode === 'online' ? paymentData.account_name : null,
      payment_date: paymentData.payment_date,
      notes: updatedNotes
    } : {
      payment_status: 'unpaid',
      payment_mode: null,
      account_name: null,
      payment_date: null,
      notes: updatedNotes
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
      let q = supabase
        .from('materials')
        .select('*, projects(name)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (currentId) {
        q = q.eq('project_id', currentId)
        localStorage.setItem('ssc_active_project_id', currentId)
      }

      const { data, error } = await q
      if (error) {
        toast.error(error.message)
      } else {
        const list = data || []
        setMaterials(list)
        setAllMaterials(list)
        setAllMaterialsForFolders(list)
        setTotalCount(list.length)

        // Load project estimations mapping
        const activeProj = projData?.find(p => p.id === currentId)
        if (activeProj) {
          try {
            const parsed = JSON.parse(activeProj.description || '{}')
            const ests = parsed.estimations || {}
            setEditingEstimations(ests)
          } catch(e) {}
        }
      }
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleShareWhatsApp = (item: Material) => {
    const text = `Sri Sai Constructions: Shipment Logged\n` +
      `---------------------------------\n` +
      `Item: ${item.name}\n` +
      `Qty: ${item.quantity} ${item.unit}\n` +
      `Amount: Rs.${(item.total_amount || item.total_cost || 0).toLocaleString('en-IN')}\n` +
      `Site: ${item.projects?.name || 'Site'}\n` +
      `Status: ${item.payment_status === 'paid' ? 'Paid' : 'Unpaid'}\n` +
      `Date: ${format(new Date(item.date), 'dd MMM yyyy')}\n\n` +
      `Please check the entry details. Thank you!`
      
    const encodedText = encodeURIComponent(text)
    
    // Check if phone number exists in notes in standard (number) pattern
    const phoneMatch = item.notes?.match(/\((\d+)\)/)
    const phone = phoneMatch ? phoneMatch[1] : ''
    
    const url = phone 
      ? `https://wa.me/91${phone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`
      
    haptic(20)
    window.open(url, '_blank')
  }

  const handleTogglePayment = async (item: Material) => {
    const newStatus = item.payment_status === 'paid' ? 'unpaid' : 'paid'
    try {
      haptic(25)
      const { error } = await supabase
        .from('materials')
        .update({ payment_status: newStatus })
        .eq('id', item.id)

      if (error) throw error
      
      // Update local state
      setMaterials(prev => prev.map(m => m.id === item.id ? { ...m, payment_status: newStatus } : m))
      toast.success(`Payment updated to ${newStatus}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to update payment')
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matPage, debouncedSearchQuery, filterFrom, filterTo, selectedProjectId, viewMode])

  const handleTransferConfirm = async () => {
    if (!transferSourceProj || !transferDestProj || !transferMaterialId || !transferQty) {
      toast.error('All fields are required')
      return
    }

    const qtyToTransfer = parseFloat(transferQty)
    if (isNaN(qtyToTransfer) || qtyToTransfer <= 0) {
      toast.error('Please enter a valid transfer quantity')
      return
    }

    const sourceMat = sourceMaterials.find(m => m.id === transferMaterialId)
    if (!sourceMat) {
      toast.error('Selected material not found')
      return
    }

    if (qtyToTransfer > sourceMat.quantity) {
      toast.error(`Transfer quantity exceeds available amount (${sourceMat.quantity} ${sourceMat.unit})`)
      return
    }

    try {
      setTransferLoading(true)
      const costPerUnit = sourceMat.cost_per_unit || (sourceMat.total_amount / sourceMat.quantity) || 0
      
      const newSourceQty = sourceMat.quantity - qtyToTransfer
      const newSourceAmount = newSourceQty * costPerUnit

      const sourceProjName = projects.find(p => p.id === transferSourceProj)?.name || 'Source Site'
      const destProjName = projects.find(p => p.id === transferDestProj)?.name || 'Destination Site'

      // 1. Update source material quantity and total_amount
      const updateSource = supabase
        .from('materials')
        .update({
          quantity: newSourceQty,
          total_amount: newSourceAmount,
          notes: (sourceMat.notes ? sourceMat.notes + ' | ' : '') + `Transferred ${qtyToTransfer} ${sourceMat.unit} to ${destProjName}`
        })
        .eq('id', sourceMat.id)

      // 2. Insert new material record in destination project
      const insertDest = supabase
        .from('materials')
        .insert([{
          project_id: transferDestProj,
          name: sourceMat.name,
          quantity: qtyToTransfer,
          unit: sourceMat.unit,
          cost_per_unit: costPerUnit,
          total_amount: qtyToTransfer * costPerUnit,
          date: format(new Date(), 'yyyy-MM-dd'),
          notes: `Transferred from ${sourceProjName}`,
          payment_system_v2: true,
          payment_status: 'paid',
          payment_mode: 'transfer'
        }])

      const [upRes, inRes] = await Promise.all([updateSource, insertDest])

      if (upRes.error) throw upRes.error
      if (inRes.error) throw inRes.error

      toast.success(`Successfully transferred ${qtyToTransfer} ${sourceMat.unit} of ${sourceMat.name}!`)
      setShowTransferModal(false)
      
      // Reset transfer form
      setTransferSourceProj('')
      setTransferDestProj('')
      setTransferMaterialId('')
      setTransferQty('')
      
      // Reload page data
      fetchData()
    } catch (e: any) {
      toast.error(e.message || 'Transfer failed')
    } finally {
      setTransferLoading(false)
    }
  }

  const handleSaveEstimations = async () => {
    if (!selectedProjectId) {
      toast.error('Select a site first')
      return
    }
    const activeProject = projects.find(p => p.id === selectedProjectId)
    if (!activeProject) return

    let currentMeta = {}
    try {
      if (activeProject.description && activeProject.description.startsWith('{')) {
        currentMeta = JSON.parse(activeProject.description)
      }
    } catch (e) {}

    // Build the updated estimations
    const estimationsToSave: Record<string, number> = {}
    Object.entries(editingEstimations).forEach(([k, v]) => {
      const val = parseFloat(v)
      if (!isNaN(val) && val > 0) {
        estimationsToSave[k] = val
      }
    })

    const updatedMeta = {
      ...currentMeta,
      estimations: estimationsToSave
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({ description: JSON.stringify(updatedMeta) })
        .eq('id', selectedProjectId)

      if (error) throw error

      toast.success('Project estimations updated successfully')
      setShowEstimationModal(false)
      
      // Update local state for projects list to reflect estimation change immediately
      setProjects(prev => prev.map(p => {
        if (p.id === selectedProjectId) {
          return {
            ...p,
            description: JSON.stringify(updatedMeta)
          }
        }
        return p
      }))
    } catch (e: any) {
      toast.error(e.message || 'Failed to save estimations')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id) {
      toast.error('Please select a project/site location')
      return
    }
    if (!commonSupplier.trim()) {
      toast.error('Supplier name is required')
      return
    }
    if (purchaseItems.length === 0) {
      toast.error('Please add at least one material item')
      return
    }

    // Verify all items have names, quantities, and rates
    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i]
      if (!item.name) {
        toast.error(`Item #${i + 1} has no material selected`)
        return
      }
      const qty = parseFloat(item.quantity)
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Please enter a valid quantity for Item #${i + 1} (${item.name})`)
        return
      }
      const rate = parseFloat(item.cost_per_unit)
      if (isNaN(rate) || rate < 0) {
        toast.error(`Please enter a valid unit rate for Item #${i + 1} (${item.name})`)
        return
      }
    }

    setSaving(true)
    try {
      // 1. Upload receipt if exists
      let uploadedUrl = null
      if (receiptFile) {
        try {
          const fileName = `material_${Date.now()}_${receiptFile.name}`
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(fileName, receiptFile)
          if (uploadError) throw new Error('Receipt upload failed: ' + uploadError.message)
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
          uploadedUrl = publicUrl
        } catch (uploadErr: any) {
          toast.error('Receipt upload failed. Saving without receipt.')
        }
      }

      // Generate unique purchase ID
      const purchaseId = 'PUR-' + Date.now()

      // Map rows
      const dbPayloads = purchaseItems.map(item => {
        const qty = parseFloat(item.quantity) || 0
        const rate = parseFloat(item.cost_per_unit) || 0
        const cost = qty * rate

        const notesJson = JSON.stringify({
          purchase_id: purchaseId,
          supplier: commonSupplier.trim(),
          brand: item.brand.trim() || null,
          invoice_number: commonInvoice.trim() || null,
          transportation_cost: parseFloat(commonTransport) || 0,
          loading_cost: parseFloat(commonLoading) || 0,
          discount: purchaseStats.discount,
          calculated_total: purchaseStats.calculatedTotal,
          final_paid_amount: purchaseStats.paid,
          remarks: commonRemarks.trim() || null,
          is_erp_v3: true
        })

        return {
          project_id: formData.project_id,
          name: item.name === 'Other / Miscellaneous' ? (item.customName?.trim() || 'Other') : item.name,
          quantity: qty,
          unit: item.unit,
          cost_per_unit: rate,
          total_amount: cost,
          date: commonDate,
          notes: notesJson,
          receipt_url: uploadedUrl,
          payment_system_v2: true,
          payment_status: creationPaymentStatus,
          payment_mode: creationPaymentStatus === 'paid' ? creationPaymentMode : null,
          account_name: creationPaymentStatus === 'paid' && creationPaymentMode === 'online' ? (creationAccountName.trim() || null) : null,
          payment_date: creationPaymentStatus === 'paid' ? commonDate : null
        }
      })

      // Insert all in Supabase
      const { error } = await supabase.from('materials').insert(dbPayloads)
      if (error) throw error

      toast.success(`Successfully logged purchase with ${purchaseItems.length} items!`)
      
      // Reset form
      setPurchaseItems([{ name: 'Cement', brand: '', quantity: '', unit: 'Bags', cost_per_unit: '', unitLocked: true }])
      setCommonSupplier('')
      setCommonInvoice('')
      setCommonTransport('')
      setCommonLoading('')
      setCommonRemarks('')
      setCommonPaidAmount('')
      setIsPaidAmountManuallyEdited(false)
      setReceiptFile(null)
      setCreationPaymentStatus('unpaid')
      setCreationPaymentMode('cash')
      setCreationAccountName('')
      setShowAddModal(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save purchase details')
    } finally {
      setSaving(false)
    }
  }

  const activeFiltersCount = [
    !!filterFrom || !!filterTo,
    !!filterCategory,
    !!filterSupplier,
    !!filterBrand,
    !!selectedProjectId
  ].filter(Boolean).length

  return (
    <div className="space-y-2">
      {/* Main Container */}
      <div className="w-full">
        {/* Material List */}
        <div className="w-full">
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden h-[calc(100vh-90px)] flex flex-col">
            <CardHeader className="p-4 border-b border-zinc-800 flex flex-col gap-4 shrink-0 bg-[#0c0f17]">
              {/* Row 1: ERP Title & Tabs */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
                <h2 className="text-sm font-black text-white uppercase tracking-wider hidden lg:block">Nirmana ERP</h2>
                <div className="flex bg-[#0d1018] p-0.5 rounded-lg border border-zinc-800 w-full md:w-auto overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('purchases'); }}
                    className={cn(
                      "flex-1 md:flex-none px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                      activeTab === 'purchases'
                        ? "bg-blue-600 text-white shadow-md font-bold"
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('dashboard'); }}
                    className={cn(
                      "flex-1 md:flex-none px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                      activeTab === 'dashboard'
                        ? "bg-blue-600 text-white shadow-md font-bold"
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('analytics'); }}
                    className={cn(
                      "flex-1 md:flex-none px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                      activeTab === 'analytics'
                        ? "bg-blue-600 text-white shadow-md font-bold"
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Analytics
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('estimations'); }}
                    className={cn(
                      "flex-1 md:flex-none px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                      activeTab === 'estimations'
                        ? "bg-blue-600 text-white shadow-md font-bold"
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Estimations
                  </button>
                </div>
              </div>

              {/* Row 2: Sub-tabs & Action Buttons aligned nicely */}
              <div className="flex items-center justify-between w-full gap-3 border-t border-zinc-800/45 pt-3 md:pt-0 md:border-none">
                {/* Left side: sub tabs (List / Folders) */}
                <div className="flex items-center">
                  {activeTab === 'purchases' && (
                    <div className="flex bg-[#0d1018] p-0.5 rounded-lg border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setViewMode('all')}
                        className={cn(
                          "px-2.5 py-0.5 rounded text-[8px] font-black uppercase transition-all",
                          viewMode === 'all' ? "bg-zinc-800 text-white font-bold" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('folders')}
                        className={cn(
                          "px-2.5 py-0.5 rounded text-[8px] font-black uppercase transition-all",
                          viewMode === 'folders' ? "bg-zinc-800 text-white font-bold" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        Folders
                      </button>
                    </div>
                  )}
                </div>

                {/* Right side: Action Buttons */}
                <div className="flex items-center gap-2">
                  {activeTab === 'purchases' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferSourceProj(selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id || ''));
                          setTransferDestProj('');
                          setTransferMaterialId('');
                          setTransferQty('');
                          setShowTransferModal(true);
                        }}
                        className="whitespace-nowrap h-8 px-3 rounded-xl text-[10px] font-black uppercase bg-[#1a1f2e] text-zinc-300 border border-[#1e2435] flex items-center gap-1 hover:bg-[#23293b] hover:text-white transition-all cursor-pointer"
                      >
                        Transfer
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPurchaseItems([{ name: 'Cement', brand: '', quantity: '', unit: 'Bags', cost_per_unit: '', unitLocked: true }]);
                          setCommonSupplier('');
                          setCommonInvoice('');
                          setCommonTransport('');
                          setCommonLoading('');
                          setCommonRemarks('');
                          setCommonPaidAmount('');
                          setIsPaidAmountManuallyEdited(false);
                          setReceiptFile(null);
                          setShowAddModal(true);
                        }}
                        className="whitespace-nowrap h-8 px-4 rounded-xl text-[10px] font-black uppercase bg-blue-500 text-white flex items-center gap-1.5 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] transition-all cursor-pointer"
                      >
                        + Log Purchase
                      </button>
                    </>
                  )}

                  {activeTab === 'estimations' && selectedProjectId !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEstimations(projectEstimations);
                        setShowEstimationModal(true);
                      }}
                      className="whitespace-nowrap h-8 px-4 rounded-xl text-[10px] font-black uppercase bg-blue-500 text-white flex items-center gap-1.5 hover:bg-blue-600 shadow-[0_4px_14px_rgba(59,130,246,0.3)] transition-all cursor-pointer"
                    >
                      <Settings size={12} /> Configure Estimations
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* ── Sub Navigation & Filtering Bar ── */}
            {activeTab === 'purchases' && viewMode === 'all' && (
              <div className="px-4 py-2 border-b border-zinc-800 bg-[#08090f] flex items-center gap-2 shrink-0">
                {/* Search Bar */}
                <div className="flex-1">
                  <Input
                    placeholder="Search by supplier, brand, invoice, material..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                    }}
                    className="h-8 bg-[#111520] border-[#1e2435] rounded-lg text-xs font-bold text-white placeholder:text-zinc-500"
                  />
                </div>

                {/* Consolidated Filters Button */}
                <button
                  type="button"
                  onClick={() => setShowFilterModal(true)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 select-none cursor-pointer",
                    activeFiltersCount > 0
                      ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                      : "bg-[#111520] border-[#1e2435] text-zinc-400 hover:text-white"
                  )}
                >
                  <Filter size={12} className={activeFiltersCount > 0 ? "text-blue-400" : "text-zinc-450"} />
                  <span>Filter {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
                </button>

                {/* Reset Button */}
                {(activeFiltersCount > 0 || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilterFrom('')
                      setFilterTo('')
                      setSearchQuery('')
                      setFilterCategory('')
                      setFilterSupplier('')
                      setFilterBrand('')
                      setFilterInvoice('')
                      setSelectedProjectId('')
                      setMatPage(0)
                    }}
                    className="h-8 px-3 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-1 select-none cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between">
              {activeTab === 'purchases' && (
                viewMode === 'folders' ? (
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
                          ) : paginatedMaterials.length === 0 ? (
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
                            paginatedMaterials.map((item, idx) => {
                              const parsed = parseMaterialNotes(item.notes)
                              return (
                                <TableRow key={item.id} className={cn("border-zinc-800 transition-colors hover:bg-white/5", selectedDetailItem?.id === item.id && "bg-white/5 border-l-2 border-l-blue-500")}>
                                  <TableCell className="px-4 py-1.5 font-bold text-gray-400 text-xs text-center">{matPage * 10 + idx + 1}</TableCell>
                                  <TableCell className="px-4 py-1.5 font-bold text-gray-400 text-xs whitespace-nowrap">
                                    <p className="text-white font-bold">{format(new Date(item.date), 'dd-MM-yyyy')}</p>
                                    <p className="text-zinc-500 text-[10px] font-bold mt-0.5">{format(new Date(item.date), 'EEE')}</p>
                                  </TableCell>
                                  <TableCell className="py-1.5 font-bold text-white text-sm whitespace-nowrap">
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-[#1e2435] text-zinc-300">
                                      {item.name}{parsed.brand ? ` (${parsed.brand})` : ''}
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
                                          setPaymentStatus(item.payment_status || 'unpaid')
                                          const parsedNotes = parseMaterialNotes(item.notes)
                                          setPaymentData({
                                            payment_mode: item.payment_mode || 'cash',
                                            account_name: item.account_name || '',
                                            payment_date: item.payment_date || item.date || format(new Date(), 'yyyy-MM-dd'),
                                            remarks: parsedNotes.remarks || ''
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
                    {totalFilteredCount > 0 && (
                      <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 flex-wrap gap-3 bg-[#0d1018] shrink-0 mt-auto">
                        <span className="text-xs text-zinc-500 font-medium">
                          Showing {totalFilteredCount > 0 ? matPage * 10 + 1 : 0} to {Math.min(totalFilteredCount, (matPage + 1) * 10)} of {totalFilteredCount} entries
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
                            const totalPages = Math.ceil(totalFilteredCount / 10)
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
                            disabled={(matPage + 1) * 10 >= totalFilteredCount}
                            onClick={() => setMatPage(p => p + 1)}
                            className="w-8 h-8 rounded-lg text-xs font-black uppercase bg-[#111520] border border-[#1e2435] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer"
                          >
                            ›
                          </button>
                          <button
                            disabled={(matPage + 1) * 10 >= totalFilteredCount}
                            onClick={() => setMatPage(Math.ceil(totalFilteredCount / 10) - 1)}
                            className="w-8 h-8 rounded-lg text-xs font-black uppercase bg-[#111520] border border-[#1e2435] text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all cursor-pointer"
                          >
                            »
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mobile Cards */}
                    <div className="flex flex-col gap-2.5 p-4 md:hidden bg-[#05070B] overflow-y-auto">
                      {loading ? (
                        Array(3).fill(0).map((_, i) => <div key={i} className="h-24 animate-pulse bg-zinc-900 rounded-xl" />)
                      ) : paginatedMaterials.length === 0 ? (
                        <div className="flex flex-col items-center gap-4 text-zinc-600 py-10">
                          <Boxes size={48} className="opacity-10" />
                          <p className="text-sm font-bold uppercase tracking-widest">
                            No materials logged yet.
                          </p>
                        </div>
                      ) : (
                        paginatedMaterials.map((item) => {
                          const parsed = parseMaterialNotes(item.notes)
                          return (
                            <MaterialCard
                              key={item.id}
                              item={item}
                              cleanNotesVal={parsed.remarks || ''}
                              onDelete={handleDeleteMat}
                              onEdit={handleOpenEditMat}
                              onView={setSelectedDetailItem}
                              onTogglePayment={(item) => {
                                setPaymentItem(item)
                                setPaymentStatus(item.payment_status || 'unpaid')
                                const parsedNotes = parseMaterialNotes(item.notes)
                                setPaymentData({
                                  payment_mode: item.payment_mode || 'cash',
                                  account_name: item.account_name || '',
                                  payment_date: item.payment_date || item.date || format(new Date(), 'yyyy-MM-dd'),
                                  remarks: parsedNotes.remarks || ''
                                })
                                setShowPaymentModal(true)
                              }}
                            />
                          )
                        })
                      )}
                    </div>

                    {/* Mobile Pagination */}
                    {totalFilteredCount > 10 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 md:hidden shrink-0">
                        <button disabled={matPage === 0} onClick={() => setMatPage(p => p - 1)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                          style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
                        <span className="text-xs" style={{ color: '#6b7280' }}>{matPage + 1} / {Math.ceil(totalFilteredCount / 10)}</span>
                        <button disabled={(matPage + 1) * 10 >= totalFilteredCount} onClick={() => setMatPage(p => p + 1)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
                          style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
                      </div>
                    )}
                  </>
                )
              )}

              {activeTab === 'dashboard' && (
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                  {/* KPI Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-5 flex items-center justify-between shadow-xl">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Purchase Spend</p>
                        <p className="text-2xl font-black text-white">₹{dashboardStats.totalCost.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                        <DollarSign className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-5 flex items-center justify-between shadow-xl">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Purchases Logged</p>
                        <p className="text-2xl font-black text-white">{allMaterials.length} Deliveries</p>
                      </div>
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
                        <Boxes className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-5 flex items-center justify-between shadow-xl">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Top Spent Material</p>
                        <p className="text-sm font-black text-white uppercase truncate max-w-[150px]">{dashboardStats.highestPurchased}</p>
                      </div>
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-5 flex items-center justify-between shadow-xl">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Lowest Spent Material</p>
                        <p className="text-sm font-black text-white uppercase truncate max-w-[150px]">{dashboardStats.lowestPurchased}</p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                        <TrendingDown className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Details Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Purchases */}
                    <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-5 shadow-xl space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-[#1e2435]">
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">Recent Purchases</h4>
                        <button onClick={() => setActiveTab('purchases')} className="text-[10px] font-bold text-blue-400 hover:underline">View All</button>
                      </div>
                      <div className="space-y-3">
                        {allMaterials.slice(0, 5).map((item) => {
                          const parsed = parseMaterialNotes(item.notes);
                          return (
                            <div key={item.id} className="flex justify-between items-center p-3 rounded-xl bg-black/20 border border-zinc-800/40 text-xs">
                              <div>
                                <p className="font-bold text-white uppercase">{item.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{item.quantity} {item.unit} · {parsed.supplier}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-black text-white">₹{item.total_amount.toLocaleString('en-IN')}</p>
                                <p className="text-[9px] text-zinc-500 mt-0.5">{format(new Date(item.date), 'dd MMM')}</p>
                              </div>
                            </div>
                          );
                        })}
                        {allMaterials.length === 0 && (
                          <p className="text-xs text-zinc-500 italic text-center py-6">No purchases logged yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Alerts Panel */}
                    <div className="bg-[#111520] border border-[#1e2435] rounded-2xl p-5 shadow-xl space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-[#1e2435]">
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">System Notifications</h4>
                        <AlertTriangle size={14} className="text-amber-500" />
                      </div>
                      
                      <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                        {/* Price Alerts */}
                        {dashboardStats.priceAlerts.map((alert, idx) => (
                          <div key={`price-${idx}`} className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 items-start">
                            <TrendingUp size={16} className="text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-red-400">Price Inflation Warning</p>
                              <p className="text-xs text-zinc-300 font-semibold mt-1 leading-relaxed">{alert}</p>
                            </div>
                          </div>
                        ))}

                        {/* Low Stock Alerts */}
                        {dashboardStats.lowStockAlerts.map((alert, idx) => (
                          <div key={`stock-${idx}`} className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
                            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Consumption Threshold Alert</p>
                              <p className="text-xs text-zinc-300 font-semibold mt-1 leading-relaxed">{alert}</p>
                            </div>
                          </div>
                        ))}

                        {dashboardStats.priceAlerts.length === 0 && dashboardStats.lowStockAlerts.length === 0 && (
                          <div className="text-center py-12 text-zinc-500 italic text-xs space-y-2">
                            <Check className="w-8 h-8 text-emerald-400 mx-auto opacity-30" />
                            <p>All items within normal pricing & consumption limits.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {materialAnalytics.map((analysis) => {
                      const avgPrice = analysis.totalQty > 0 ? analysis.totalCost / analysis.totalQty : 0;
                      const hasTrend = analysis.prevPrice > 0;
                      const diff = analysis.lastPrice - analysis.prevPrice;
                      const pct = hasTrend && analysis.prevPrice > 0 ? (diff / analysis.prevPrice) * 100 : 0;

                      return (
                        <div 
                          key={analysis.name}
                          onClick={() => setActiveHistoryMaterial(analysis.name)}
                          className="bg-gradient-to-br from-[#111520] to-[#0c0f17] border border-zinc-800/80 hover:border-blue-500/50 rounded-2xl p-5 shadow-xl transition-all hover:scale-[1.01] cursor-pointer active:scale-95 flex flex-col justify-between"
                        >
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Material Type</p>
                                <h4 className="text-base font-black text-white mt-0.5">{analysis.name}</h4>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-[#1a1f2e] text-zinc-400">
                                {analysis.unit}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-3.5 bg-black/25 rounded-xl border border-zinc-800/40 text-xs">
                              <div>
                                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Total Volume</p>
                                <p className="font-bold text-white mt-0.5">{analysis.totalQty.toLocaleString('en-IN')} {analysis.unit}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Total Cost</p>
                                <p className="font-bold text-emerald-400 mt-0.5">₹{analysis.totalCost.toLocaleString('en-IN')}</p>
                              </div>
                            </div>

                            <div className="space-y-2 text-xs border-t border-zinc-900 pt-3">
                              <div className="flex justify-between">
                                <span className="text-zinc-500 font-semibold">Average Price</span>
                                <span className="text-white font-bold font-mono">₹{Math.round(avgPrice).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500 font-semibold">Price Range (Min-Max)</span>
                                <span className="text-zinc-300 font-semibold font-mono">₹{analysis.minPrice} - ₹{analysis.maxPrice}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-500 font-semibold">Last Purchase Price</span>
                                <div className="flex items-center gap-1.5 font-bold font-mono">
                                  <span className="text-white">₹{analysis.lastPrice}</span>
                                  {hasTrend && (
                                    <span className={cn(
                                      "text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5",
                                      diff > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                                    )}>
                                      {diff > 0 ? '▲' : '▼'} {Math.round(Math.abs(pct) * 10) / 10}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-zinc-900 pt-3 mt-4 flex justify-between items-center text-[10px] text-zinc-500 font-medium">
                            <span className="truncate max-w-[130px]">Last: {analysis.lastSupplier}</span>
                            <span>{format(new Date(analysis.lastDate), 'dd MMM yyyy')}</span>
                          </div>
                        </div>
                      );
                    })}
                    {materialAnalytics.length === 0 && (
                      <div className="col-span-full py-24 text-center">
                        <Boxes size={48} className="opacity-10 mx-auto" />
                        <p className="text-sm font-bold uppercase tracking-widest text-zinc-600 mt-4">No material analysis available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'estimations' && (
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                  {selectedProjectId === 'all' ? (
                    <div className="text-center py-24 text-zinc-500 italic text-xs space-y-3">
                      <Boxes className="w-12 h-12 text-zinc-700 mx-auto opacity-30" />
                      <p>Estimations can only be viewed and configured on a single project level.</p>
                      <p className="text-[10px] text-zinc-600 font-semibold">Please select a specific project from the filters menu.</p>
                    </div>
                  ) : (
                    <div className="border border-[#1e2435] rounded-2xl overflow-hidden shadow-xl bg-black/10">
                      <Table>
                        <TableHeader className="bg-zinc-900/60">
                          <TableRow className="border-zinc-800">
                            <TableHead className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Material Type</TableHead>
                            <TableHead className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Purchased</TableHead>
                            <TableHead className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Estimated Required</TableHead>
                            <TableHead className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Remaining to Purchase</TableHead>
                            <TableHead className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Completion %</TableHead>
                            <TableHead className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Current Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {MATERIAL_MASTER.map((master) => {
                            const name = master.name
                            const purchased = materialPurchasedTotals[name] || 0
                            const estimated = parseFloat(String(projectEstimations[name] || '0'))
                            const remaining = Math.max(0, estimated - purchased)
                            const cost = materialPurchasedCosts[name] || 0
                            const pct = estimated > 0 ? Math.min(100, Math.round((purchased / estimated) * 100)) : 0

                            if (purchased === 0 && estimated === 0) return null

                            return (
                              <TableRow key={name} className="border-zinc-800/60 hover:bg-white/5 transition-colors">
                                <TableCell className="px-5 py-3 font-bold text-white text-xs uppercase">{name}</TableCell>
                                <TableCell className="px-5 py-3 font-bold text-zinc-300 text-xs">
                                  {purchased.toLocaleString('en-IN')} {master.unit}
                                </TableCell>
                                <TableCell className="px-5 py-3 font-bold text-zinc-500 text-xs">
                                  {estimated > 0 ? `${estimated.toLocaleString('en-IN')} ${master.unit}` : 'Not Estimated'}
                                </TableCell>
                                <TableCell className="px-5 py-3 font-bold text-xs">
                                  {estimated > 0 ? (
                                    remaining > 0 ? (
                                      <span className="text-amber-400">{remaining.toLocaleString('en-IN')} {master.unit}</span>
                                    ) : (
                                      <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                                        <Check size={10} /> Fully Purchased
                                      </span>
                                    )
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="px-5 py-3 font-bold text-xs min-w-[150px]">
                                  {estimated > 0 ? (
                                    <div className="space-y-1 w-full max-w-[120px]">
                                      <div className="flex justify-between text-[9px] font-black text-zinc-400">
                                        <span>{pct}%</span>
                                      </div>
                                      <div className="w-full bg-[#1e2435] h-1.5 rounded-full overflow-hidden">
                                        <div 
                                          className={cn(
                                            "h-full rounded-full transition-all",
                                            pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-blue-500"
                                          )} 
                                          style={{ width: `${pct}%` }} 
                                        />
                                      </div>
                                    </div>
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="px-5 py-3 font-bold text-white text-xs text-right">
                                  ₹{cost.toLocaleString('en-IN')}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {Object.keys(projectEstimations).length === 0 && allMaterials.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="py-24 text-center">
                                <Boxes size={48} className="opacity-10 mx-auto" />
                                <p className="text-sm font-bold uppercase tracking-widest text-zinc-600 mt-4">
                                  No estimations defined. Configure estimations to begin monitoring site budgets.
                                </p>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DETAIL MODAL POPUP */}
      {selectedDetailItem && (() => {
        const parsed = parseMaterialNotes(selectedDetailItem.notes)
        const detailSupplierDisplay = parsed.supplier !== '—'
          ? (parsed.brand ? `${parsed.supplier} (${parsed.brand})` : parsed.supplier)
          : '—'
        const detailReceiptUrl = selectedDetailItem.receipt_url

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setSelectedDetailItem(null)}>
            <div className="rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col space-y-5 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-4 border-b border-[#1e2435] shrink-0">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Purchase Delivery Details</h3>
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
                {parsed.brand && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Brand Name</span>
                    <span className="text-white font-bold">{parsed.brand}</span>
                  </div>
                )}
                {parsed.invoice_number && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Invoice Number</span>
                    <span className="text-white font-bold">{parsed.invoice_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold">Quantity</span>
                  <span className="text-white font-bold">{selectedDetailItem.quantity} {selectedDetailItem.unit}</span>
                </div>
                {selectedDetailItem.cost_per_unit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Rate</span>
                    <span className="text-white font-bold font-mono">₹ {selectedDetailItem.cost_per_unit}</span>
                  </div>
                )}
                {parsed.transportation_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Transportation Cost</span>
                    <span className="text-white font-bold font-mono">₹ {parsed.transportation_cost.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {parsed.loading_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Loading/Hamali Labor Cost</span>
                    <span className="text-white font-bold font-mono">₹ {parsed.loading_cost.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {parsed.is_erp_v3 && (
                  <>
                    <div className="flex justify-between border-t border-zinc-800/60 pt-2">
                      <span className="text-zinc-400 font-bold">Calculated Grand Total</span>
                      <span className="text-white font-bold font-mono">₹ {parsed.calculated_total.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-bold">Final Paid Amount</span>
                      <span className="text-white font-bold font-mono">₹ {parsed.final_paid_amount.toLocaleString('en-IN')}</span>
                    </div>
                    {parsed.discount > 0 && (
                      <div className="flex justify-between items-center text-emerald-400">
                        <span className="font-black text-[10px] uppercase">Discount Saved</span>
                        <span className="font-black text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono">
                          ₹ {parsed.discount.toLocaleString('en-IN')} Saved
                        </span>
                      </div>
                    )}
                  </>
                )}
                {detailReceiptUrl && (
                  <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60">
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

              {/* Remarks / Notes */}
              {parsed.remarks && (
                <div className="bg-[#0b0e14]/50 p-4 rounded-xl text-xs text-zinc-300 leading-relaxed border border-zinc-900">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Remarks</p>
                  <p className="font-semibold text-zinc-300 leading-relaxed">{parsed.remarks}</p>
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

            {/* Paid / Unpaid Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('unpaid')}
                  className={cn(
                    "h-10 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer",
                    paymentStatus === 'unpaid'
                      ? "bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                      : "bg-[#0d1018] border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Unpaid
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('paid')}
                  className={cn(
                    "h-10 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer",
                    paymentStatus === 'paid'
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                      : "bg-[#0d1018] border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Paid
                </button>
              </div>
            </div>

            {paymentStatus === 'unpaid' ? (
              <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/10 text-[10px] font-bold text-red-400 leading-normal">
                ⚠️ Marking this entry as unpaid will clear any payment mode, online account names, and dates.
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in-50 duration-200">
                {/* Payment Mode Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentData({ ...paymentData, payment_mode: 'cash' })}
                      className={cn(
                        "h-9 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                        paymentData.payment_mode === 'cash'
                          ? "bg-blue-600/10 border-blue-500 text-blue-400"
                          : "bg-[#0d1018] border-zinc-900 text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      💵 Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentData({ ...paymentData, payment_mode: 'online' })}
                      className={cn(
                        "h-9 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                        paymentData.payment_mode === 'online'
                          ? "bg-blue-600/10 border-blue-500 text-blue-400"
                          : "bg-[#0d1018] border-zinc-900 text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      💳 Online
                    </button>
                  </div>
                </div>

                {/* Account Name for Online Mode */}
                {paymentData.payment_mode === 'online' && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Paid from Account Name</label>
                    <Input
                      placeholder="e.g. SBI Main, HDFC Construction"
                      value={paymentData.account_name}
                      onChange={e => setPaymentData({ ...paymentData, account_name: e.target.value })}
                      className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs"
                    />
                  </div>
                )}

                {/* Payment Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Date</label>
                  <Input
                    type="date"
                    value={paymentData.payment_date}
                    onChange={e => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                    className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs px-3"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>

                {/* Remarks Input Box */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Remarks</label>
                  <Input
                    placeholder="Enter payment remarks/notes..."
                    value={paymentData.remarks}
                    onChange={e => setPaymentData({ ...paymentData, remarks: e.target.value })}
                    className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-semibold text-white text-xs"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 h-10 rounded-xl text-xs font-black uppercase border border-zinc-800 text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={paymentSaving}
                onClick={() => handleSavePayment(paymentStatus)}
                className={cn(
                  "flex-1 h-10 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center cursor-pointer disabled:opacity-50",
                  paymentStatus === 'paid' ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-600" : "bg-red-500 text-white hover:bg-red-650"
                )}
              >
                {paymentSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowFilterModal(false)}>
          <div 
            className="rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95" 
            style={{ backgroundColor: '#111520', border: '1px solid #1e2435', height: '450px' }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-[#1e2435] bg-[#0d1018]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Filters</h3>
              </div>
              <button 
                onClick={() => setShowFilterModal(false)} 
                className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content: side-by-side tabs */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Side: Filter Options List */}
              <div className="w-1/3 bg-[#0c0e14] border-r border-[#1e2435] flex flex-col overflow-y-auto">
                {[
                  { id: 'category', label: 'Category', active: !!filterCategory },
                  { id: 'supplier', label: 'Supplier', active: !!filterSupplier },
                  { id: 'brand', label: 'Brand', active: !!filterBrand },
                  { id: 'project', label: 'Site / Project', active: !!selectedProjectId },
                  { id: 'date', label: 'Date Range', active: !!filterFrom || !!filterTo },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilterTab(tab.id as any)}
                    className={cn(
                      "w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider relative transition-colors border-b border-zinc-900/50 flex items-center justify-between",
                      activeFilterTab === tab.id
                        ? "bg-[#111520] text-blue-400 font-bold"
                        : "text-zinc-400 hover:bg-[#111520]/40"
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                    {activeFilterTab === tab.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Right Side: Options Value Selector */}
              <div className="w-2/3 p-4 overflow-y-auto bg-[#111520] custom-scrollbar flex flex-col gap-2">
                {activeFilterTab === 'category' && (
                  <div className="space-y-1">
                    {[
                      { value: '', label: 'All Categories' },
                      { value: 'Cement', label: 'Cement' },
                      { value: 'White Cement', label: 'White Cement' },
                      { value: 'Steel', label: 'Steel' },
                      { value: 'Binding Wire', label: 'Binding Wire' },
                      { value: 'Sand', label: 'Sand' },
                      { value: 'Coarse Aggregate', label: 'Coarse Aggregate' },
                      { value: 'Dust Powder', label: 'Dust Powder' },
                      { value: 'Bricks', label: 'Bricks' },
                      { value: 'Fly Ash Bricks', label: 'Fly Ash Bricks' },
                      { value: 'Tiles', label: 'Tiles' },
                      { value: 'Marble', label: 'Marble' },
                      { value: 'Granite', label: 'Granite' },
                      { value: 'Grout', label: 'Grout' },
                      { value: 'Plumbing Materials', label: 'Plumbing Materials' },
                      { value: 'Electrical Materials', label: 'Electrical Materials' },
                      { value: 'Door', label: 'Door' },
                      { value: 'Door Frame', label: 'Door Frame' },
                      { value: 'Window', label: 'Window' },
                      { value: 'Plywood', label: 'Plywood' },
                      { value: 'False Ceiling', label: 'False Ceiling' },
                      { value: 'Painting', label: 'Painting' },
                      { value: 'Water Tank', label: 'Water Tank' },
                      { value: 'Others', label: 'Others' }
                    ].map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => { setFilterCategory(cat.value); setMatPage(0); }}
                        className={cn(
                          "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                          filterCategory === cat.value
                            ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                            : "bg-[#0d1018] border-zinc-900 text-zinc-400 hover:text-white"
                        )}
                      >
                        <span>{cat.label}</span>
                        {filterCategory === cat.value && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))}
                  </div>
                )}

                {activeFilterTab === 'supplier' && (
                  <div className="space-y-1">
                    <button
                      onClick={() => { setFilterSupplier(''); setMatPage(0); }}
                      className={cn(
                        "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                        filterSupplier === ''
                          ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                          : "bg-[#0d1018] border-zinc-900 text-zinc-400 hover:text-white"
                      )}
                    >
                      <span>All Suppliers</span>
                      {filterSupplier === '' && <Check size={14} className="text-blue-400" />}
                    </button>
                    {dynamicSuppliers.map(sup => (
                      <button
                        key={sup}
                        onClick={() => { setFilterSupplier(sup); setMatPage(0); }}
                        className={cn(
                          "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                          filterSupplier === sup
                            ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                            : "bg-[#0d1018] border-zinc-900 text-zinc-400 hover:text-white"
                        )}
                      >
                        <span>{sup}</span>
                        {filterSupplier === sup && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))}
                  </div>
                )}

                {activeFilterTab === 'brand' && (
                  <div className="space-y-1">
                    <button
                      onClick={() => { setFilterBrand(''); setMatPage(0); }}
                      className={cn(
                        "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                        filterBrand === ''
                          ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                          : "bg-[#0d1018] border-zinc-900 text-zinc-400 hover:text-white"
                      )}
                    >
                      <span>All Brands</span>
                      {filterBrand === '' && <Check size={14} className="text-blue-400" />}
                    </button>
                    {dynamicBrands.map(brnd => (
                      <button
                        key={brnd}
                        onClick={() => { setFilterBrand(brnd); setMatPage(0); }}
                        className={cn(
                          "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                          filterBrand === brnd
                            ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                            : "bg-[#0d1018] border-zinc-900 text-zinc-400 hover:text-white"
                        )}
                      >
                        <span>{brnd}</span>
                        {filterBrand === brnd && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))}
                  </div>
                )}

                {activeFilterTab === 'project' && (
                  <div className="space-y-1">
                    <button
                      onClick={() => { setSelectedProjectId(''); setMatPage(0); }}
                      className={cn(
                        "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                        selectedProjectId === ''
                          ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                          : "bg-[#0d1018] border-zinc-900 text-zinc-400 hover:text-white"
                      )}
                    >
                      <span>All Projects / Sites</span>
                      {selectedProjectId === '' && <Check size={14} className="text-blue-400" />}
                    </button>
                    {projects.map(proj => (
                      <button
                        key={proj.id}
                        onClick={() => { setSelectedProjectId(proj.id); setMatPage(0); }}
                        className={cn(
                          "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                          selectedProjectId === proj.id
                            ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                            : "bg-[#0d1018] border-zinc-900 text-zinc-400 hover:text-white"
                        )}
                      >
                        <span>{proj.name}</span>
                        {selectedProjectId === proj.id && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))}
                  </div>
                )}

                {activeFilterTab === 'date' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">From Date</label>
                      <input
                        type="date"
                        value={filterFrom}
                        onChange={e => { setFilterFrom(e.target.value); setMatPage(0); }}
                        className="h-10 w-full px-3 rounded-xl text-xs font-bold bg-[#0d1018] border border-zinc-800 text-white outline-none focus:border-blue-500"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">To Date</label>
                      <input
                        type="date"
                        value={filterTo}
                        min={filterFrom}
                        onChange={e => { setFilterTo(e.target.value); setMatPage(0); }}
                        className="h-10 w-full px-3 rounded-xl text-xs font-bold bg-[#0d1018] border border-zinc-800 text-white outline-none focus:border-blue-500"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    {(filterFrom || filterTo) && (
                      <button
                        onClick={() => { setFilterFrom(''); setFilterTo(''); setMatPage(0); }}
                        className="w-full h-10 rounded-xl text-xs font-black uppercase bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
                      >
                        Clear Dates
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t border-[#1e2435] bg-[#0d1018]">
              <button
                onClick={() => {
                  setFilterFrom('')
                  setFilterTo('')
                  setSearchQuery('')
                  setFilterCategory('')
                  setFilterSupplier('')
                  setFilterBrand('')
                  setFilterInvoice('')
                  setSelectedProjectId('')
                  setMatPage(0)
                }}
                className="h-10 px-4 rounded-xl text-xs font-black uppercase border border-[#1e2435] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="h-10 px-5 rounded-xl text-xs font-black uppercase bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal (Purchase Builder) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowAddModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col space-y-6 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <h3 className="text-base font-black text-white uppercase tracking-wider">Inventory Purchase Builder</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              {/* Common Purchase Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Select Site Location *</label>
                  <select 
                    value={formData.project_id} 
                    onChange={e => setFormData({ ...formData, project_id: e.target.value })} 
                    className="styled-select w-full h-10 text-xs"
                    required
                  >
                    <option value="">Choose Site/Project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Supplier Name *</label>
                  <div className="relative">
                    <Input 
                      placeholder="e.g. Ultratech Distributors" 
                      value={commonSupplier} 
                      onChange={e => setCommonSupplier(e.target.value)} 
                      className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs" 
                      required 
                    />
                    {/* Autocomplete list */}
                    {commonSupplier.trim().length > 0 && dynamicSuppliers.some(s => s.toLowerCase().includes(commonSupplier.toLowerCase()) && s !== commonSupplier) && (
                      <div className="absolute left-0 right-0 z-30 bg-[#0d1018] border border-[#1e2435] rounded-xl overflow-hidden mt-1 shadow-2xl max-h-[150px] overflow-y-auto">
                        {dynamicSuppliers
                          .filter(s => s.toLowerCase().includes(commonSupplier.toLowerCase()))
                          .map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setCommonSupplier(s)}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-blue-500 hover:text-white transition-colors"
                            >
                              {s}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Invoice Number</label>
                  <Input 
                    placeholder="e.g. INV-2026-904" 
                    value={commonInvoice} 
                    onChange={e => setCommonInvoice(e.target.value)} 
                    className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Delivery Date</label>
                  <Input 
                    type="date" 
                    value={commonDate} 
                    onChange={e => setCommonDate(e.target.value)} 
                    className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs px-3" 
                  />
                </div>
              </div>

              {/* Quick Add shortcut panel */}
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Quick Add Material Rows</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ADD_MATERIALS.map(matName => (
                    <button
                      key={matName}
                      type="button"
                      onClick={() => handleQuickAdd(matName)}
                      className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                    >
                      + {matName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Purchase Items List Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center pb-1 border-b border-zinc-800">
                  <p className="text-xs font-black uppercase tracking-wider text-white">Itemized Materials List</p>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase">{purchaseItems.length} lines configured</span>
                </div>

                <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                  {purchaseItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-2 bg-black/20 p-4 md:p-3 rounded-xl border border-zinc-900 items-end relative">
                      <div className="col-span-2 md:col-span-3 space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-500">Material Type</label>
                        <select
                          value={item.name}
                          onChange={e => handleUpdateItem(idx, 'name', e.target.value)}
                          className="styled-select h-9 text-xs w-full"
                        >
                          <option value="">Select Material...</option>
                          {MATERIAL_MASTER.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                        </select>
                        {item.name === 'Other / Miscellaneous' && (
                          <Input
                            placeholder="Type custom material name..."
                            value={item.customName || ''}
                            onChange={e => handleUpdateItem(idx, 'customName', e.target.value)}
                            className="h-8 bg-zinc-950 border-zinc-800 rounded-lg text-xs text-white mt-1 animate-in slide-in-from-top-1 duration-150"
                          />
                        )}
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-500">Brand Name</label>
                        <Input
                          placeholder="Brand"
                          value={item.brand}
                          onChange={e => handleUpdateItem(idx, 'brand', e.target.value)}
                          className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-500">Quantity</label>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)}
                          className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-500 flex justify-between items-center">
                          <span>Unit</span>
                          <button 
                            type="button" 
                            onClick={() => handleUpdateItem(idx, 'unitLocked', !item.unitLocked)}
                            className="text-[7px] text-blue-400 uppercase font-black hover:underline"
                          >
                            {item.unitLocked ? 'Unlock' : 'Lock'}
                          </button>
                        </label>
                        {item.unitLocked ? (
                          <div className="h-9 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center px-2.5 text-xs font-black text-zinc-400 select-none uppercase truncate">
                            {item.unit}
                          </div>
                        ) : (
                          <Input
                            placeholder="Unit"
                            value={item.unit}
                            onChange={e => handleUpdateItem(idx, 'unit', e.target.value)}
                            className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-xs text-white"
                          />
                        )}
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="text-[8px] font-black uppercase text-zinc-500">Unit Price</label>
                        <Input
                          type="number"
                          placeholder="Rate"
                          value={item.cost_per_unit}
                          onChange={e => handleUpdateItem(idx, 'cost_per_unit', e.target.value)}
                          className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="absolute top-2.5 right-2.5 md:relative md:top-auto md:right-auto md:col-span-1 md:pb-1 md:text-center flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setPurchaseItems(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 md:p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                          title="Discard Row"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPurchaseItems(prev => [...prev, { name: 'Cement', brand: '', quantity: '', unit: 'Bags', cost_per_unit: '', unitLocked: true }])}
                  className="w-full h-9 rounded-xl text-xs font-bold uppercase bg-zinc-950 border border-zinc-900 hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5 text-zinc-400"
                >
                  <Plus size={12} /> Add Blank Material Line
                </button>
              </div>

              {/* Fees & Logistics details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-850">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={transportEnabled}
                      onChange={e => setTransportEnabled(e.target.checked)}
                      className="accent-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Transportation Cost</span>
                  </label>
                  {transportEnabled && (
                    <Input
                      type="number"
                      placeholder="Enter transport fee amount (₹)"
                      value={commonTransport}
                      onChange={e => setCommonTransport(e.target.value)}
                      className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs animate-in slide-in-from-top-1 duration-150"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hamaliEnabled}
                      onChange={e => setHamaliEnabled(e.target.checked)}
                      className="accent-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Hamali (Loading Labor) Cost</span>
                  </label>
                  {hamaliEnabled && (
                    <Input
                      type="number"
                      placeholder="Enter loading fee amount (₹)"
                      value={commonLoading}
                      onChange={e => setCommonLoading(e.target.value)}
                      className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-xs animate-in slide-in-from-top-1 duration-150"
                    />
                  )}
                </div>
              </div>

              {/* Remarks Textbox */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">General Remarks (Optional)</label>
                <Textarea
                  placeholder="Note down bill guidelines, quality remarks, or payment mode indicators..."
                  value={commonRemarks}
                  onChange={e => setCommonRemarks(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 rounded-xl text-xs font-semibold text-white p-3 h-16"
                />
              </div>

              {/* Bill Receipt Upload */}
              <div className="space-y-2 pt-2 border-t border-zinc-900">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Upload size={12} className="text-blue-400" /> Upload Invoice / Bill Receipt
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/svg+xml,application/pdf"
                    onChange={handleReceiptFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "h-14 rounded-xl border border-dashed flex flex-col items-center justify-center transition-all",
                    receiptFile ? "bg-emerald-500/5 border-emerald-500/30" : "bg-zinc-900/50 border-zinc-800 group-hover:border-zinc-700"
                  )}>
                    {receiptFile ? (
                      <p className="text-xs font-bold text-emerald-400 truncate max-w-[250px]">{receiptFile.name}</p>
                    ) : (
                      <p className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-zinc-400">Tap to upload bill image/pdf</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Details Selector */}
              <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-4 pt-3 border-t">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Payment Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreationPaymentStatus('unpaid')}
                      className={cn(
                        "h-10 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer",
                        creationPaymentStatus === 'unpaid'
                          ? "bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                          : "bg-[#0d1018] border-zinc-800 text-zinc-500 hover:text-zinc-350"
                      )}
                    >
                      Mark as Unpaid
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreationPaymentStatus('paid')}
                      className={cn(
                        "h-10 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer",
                        creationPaymentStatus === 'paid'
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                          : "bg-[#0d1018] border-zinc-800 text-zinc-500 hover:text-zinc-355"
                      )}
                    >
                      Mark as Paid
                    </button>
                  </div>
                </div>

                {creationPaymentStatus === 'paid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Paid Via</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCreationPaymentMode('cash')}
                          className={cn(
                            "h-9 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                            creationPaymentMode === 'cash'
                              ? "bg-blue-600/10 border-blue-500 text-blue-400"
                              : "bg-[#0d1018] border-zinc-900 text-zinc-550"
                          )}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreationPaymentMode('online')}
                          className={cn(
                            "h-9 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                            creationPaymentMode === 'online'
                              ? "bg-blue-600/10 border-blue-500 text-blue-400"
                              : "bg-[#0d1018] border-zinc-900 text-zinc-555"
                          )}
                        >
                          💳 Online
                        </button>
                      </div>
                    </div>

                    {creationPaymentMode === 'online' && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Paid from Account Name</label>
                        <Input
                          placeholder="e.g. SBI Main, HDFC Construction"
                          value={creationAccountName}
                          onChange={e => setCreationAccountName(e.target.value)}
                          className="h-9 bg-zinc-900 border-zinc-800 rounded-lg font-bold text-white text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Grand Total Summary Card */}
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex flex-col md:flex-row justify-between gap-4 items-center">
                <div className="space-y-1 w-full md:w-auto">
                  <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Calculated Purchase Total</p>
                  <p className="text-2xl font-black text-white">₹{purchaseStats.calculatedTotal.toLocaleString('en-IN')}</p>
                  <p className="text-[8px] text-zinc-500 font-bold">Base: ₹{purchaseStats.materialTotal.toLocaleString('en-IN')} | Logistics: +₹{(parseFloat(commonTransport) || 0) + (parseFloat(commonLoading) || 0)}</p>
                </div>

                <div className="flex flex-col gap-2 items-end w-full md:w-auto">
                  <div className="space-y-1.5 w-full md:w-[150px]">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Actual Paid Overrides</label>
                    <Input
                      type="number"
                      placeholder={String(purchaseStats.calculatedTotal)}
                      value={commonPaidAmount}
                      onChange={e => {
                        setCommonPaidAmount(e.target.value)
                        setIsPaidAmountManuallyEdited(true)
                      }}
                      className="h-9 bg-zinc-950 border-blue-500/30 rounded-lg text-xs font-black text-blue-400 font-mono text-right"
                    />
                  </div>

                  {purchaseStats.discount > 0 && (
                    <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                      ₹{purchaseStats.discount.toLocaleString('en-IN')} Discount Saved!
                    </div>
                  )}
                </div>
              </div>

              {/* Submit / Cancel Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 h-11 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-zinc-500 border border-[#1e2435]">Cancel</button>
                <Button type="submit" disabled={saving} className="flex-1 h-11 bg-blue-500 hover:bg-blue-600 rounded-xl text-xs font-black uppercase text-white shadow-xl shadow-blue-500/20">
                  {saving && <Loader2 className="animate-spin mr-1.5 w-4 h-4" />} Record Purchase
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {editingMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setEditingMat(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-[#1e2435]">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Edit Material Entry</h3>
              <button onClick={() => setEditingMat(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Material Type</label>
                <select
                  value={editMatData.name}
                  onChange={e => setEditMatData({ ...editMatData, name: e.target.value })}
                  className="styled-select w-full h-9 text-xs"
                >
                  {MATERIAL_MASTER.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>

              {editNotesParsed && (
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Brand Name</label>
                  <Input
                    placeholder="Brand"
                    value={editNotesParsed.brand || ''}
                    onChange={e => setEditNotesParsed({ ...editNotesParsed, brand: e.target.value })}
                    className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-xs text-white"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Quantity</label>
                <Input type="number" value={editMatData.quantity} onChange={e => setEditMatData({ ...editMatData, quantity: e.target.value })} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Unit</label>
                <Input value={editMatData.unit} onChange={e => setEditMatData({ ...editMatData, unit: e.target.value })} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Unit Rate (₹)</label>
                <Input type="number" value={editMatData.cost_per_unit} onChange={e => setEditMatData({ ...editMatData, cost_per_unit: e.target.value })} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white animate-in zoom-in-95" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Delivery Date</label>
                <Input type="date" value={editMatData.date} onChange={e => setEditMatData({ ...editMatData, date: e.target.value })} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white px-3" />
              </div>

              <div className="col-span-2 space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Supplier Name</label>
                <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white" />
              </div>

              {editNotesParsed && (
                <>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Invoice Number</label>
                    <Input value={commonInvoice} onChange={e => setCommonInvoice(e.target.value)} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Transportation Cost (₹)</label>
                    <Input type="number" value={commonTransport} onChange={e => setCommonTransport(e.target.value)} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Loading Cost (₹)</label>
                    <Input type="number" value={commonLoading} onChange={e => setCommonLoading(e.target.value)} className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-white font-mono" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Actual Paid Override (₹)</label>
                    <Input type="number" value={commonPaidAmount} onChange={e => setCommonPaidAmount(e.target.value)} className="h-9 bg-zinc-950 border-blue-500/35 rounded-lg text-blue-400 font-mono font-black" />
                  </div>
                </>
              )}

              <div className="col-span-2 space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Remarks</label>
                <Textarea value={editMatData.notes} onChange={e => setEditMatData({ ...editMatData, notes: e.target.value })} className="bg-zinc-900 border-zinc-800 rounded-xl text-white p-2.5 h-16" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingMat(null)} className="flex-1 h-10 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-zinc-500 border border-[#1e2435]">Cancel</button>
              <button onClick={handleSaveMat} disabled={editSaving} className="flex-1 h-10 rounded-xl text-xs font-black uppercase bg-blue-500 text-white disabled:opacity-50">{editSaving ? 'Saving...' : 'Save Changes'}</button>
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
                      const parsed = parseMaterialNotes(item.notes);
                      const supplierDisplay = parsed.supplier !== '—' ? (parsed.brand ? `${parsed.supplier} (${parsed.brand})` : parsed.supplier) : '—';
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
                            {parsed.transportation_cost > 0 && <p className="text-zinc-400 font-mono">Trsp: ₹{parsed.transportation_cost}</p>}
                            {parsed.loading_cost > 0 && <p className="text-zinc-400 font-mono">Hml: ₹{parsed.loading_cost}</p>}
                            {parsed.transportation_cost === 0 && parsed.loading_cost === 0 && '—'}
                          </TableCell>
                          <TableCell className="py-2 text-[10px] text-zinc-400 max-w-[150px] break-words">
                            {parsed.remarks || '—'}
                          </TableCell>
                          <TableCell className="py-2 text-right pr-6 font-black text-blue-400 text-sm whitespace-nowrap font-mono">
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
                  const parsed = parseMaterialNotes(item.notes);
                  const supplierDisplay = parsed.supplier !== '—' ? (parsed.brand ? `${parsed.supplier} (${parsed.brand})` : parsed.supplier) : '—';
                  const receiptUrl = item.receipt_url;

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

                      {(supplierDisplay !== '—' || parsed.transportation_cost > 0 || parsed.loading_cost > 0 || parsed.remarks) && (
                        <div className="border-t border-zinc-800/60 pt-2.5 mt-1 space-y-1.5 text-[11px] text-zinc-400">
                          {supplierDisplay !== '—' && (
                            <p><strong>Supplier:</strong> <span className="text-zinc-200">{supplierDisplay}</span></p>
                          )}
                          {(parsed.transportation_cost > 0 || parsed.loading_cost > 0) && (
                            <p>
                              <strong>Fees:</strong>{' '}
                              <span className="text-zinc-200">
                                {[parsed.transportation_cost > 0 && `Transport: ₹${parsed.transportation_cost}`, parsed.loading_cost > 0 && `Hamali: ₹${parsed.loading_cost}`].filter(Boolean).join(', ')}
                              </span>
                            </p>
                          )}
                          {parsed.remarks && (
                            <p><strong>Remarks:</strong> <span className="text-zinc-300 italic">{parsed.remarks}</span></p>
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

      {/* PRICE HISTORY MODAL */}
      {activeHistoryMaterial && (() => {
        const matHistory = allMaterials.filter(m => m.name === activeHistoryMaterial)
        const avgPrice = matHistory.reduce((a, b) => a + (b.cost_per_unit || 0), 0) / (matHistory.length || 1)

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setActiveHistoryMaterial(null)}>
            <div className="rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-5 bg-[#111520] border border-[#1e2435] shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sri Sai Constructions</p>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{activeHistoryMaterial} Price Log</h3>
                </div>
                <button onClick={() => setActiveHistoryMaterial(null)} className="text-zinc-500 hover:text-white p-1 hover:bg-white/5 rounded-lg"><X size={16} /></button>
              </div>

              {/* Price Stats Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-900 text-xs">
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Average Rate</p>
                  <p className="text-sm font-bold text-white mt-0.5">₹ {Math.round(avgPrice)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Latest Rate</p>
                  <p className="text-sm font-bold text-blue-400 mt-0.5">₹ {matHistory[0]?.cost_per_unit || 0}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Lowest Price</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">₹ {Math.min(...matHistory.map(m => m.cost_per_unit).filter(Boolean))}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Highest Price</p>
                  <p className="text-sm font-bold text-red-400 mt-0.5">₹ {Math.max(...matHistory.map(m => m.cost_per_unit).filter(Boolean))}</p>
                </div>
              </div>

              {/* Desktop logs grid */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black/10">
                <Table>
                  <TableHeader className="bg-zinc-950/40">
                    <TableRow className="border-zinc-800">
                      <TableHead className="px-4 py-2 uppercase text-[9px] font-black text-zinc-500">Date</TableHead>
                      <TableHead className="py-2 uppercase text-[9px] font-black text-zinc-500">Supplier Name</TableHead>
                      <TableHead className="py-2 uppercase text-[9px] font-black text-zinc-500">Brand Name</TableHead>
                      <TableHead className="py-2 uppercase text-[9px] font-black text-zinc-500">Qty purchased</TableHead>
                      <TableHead className="py-2 uppercase text-[9px] font-black text-zinc-500 text-right">Unit Rate</TableHead>
                      <TableHead className="py-2 uppercase text-[9px] font-black text-zinc-500 text-center">Trend Indicator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matHistory.map((item, idx) => {
                      const parsed = parseMaterialNotes(item.notes)
                      const rate = item.cost_per_unit || 0
                      const nextItem = matHistory[idx + 1]
                      const nextRate = nextItem?.cost_per_unit || 0
                      
                      let pctStr = '—'
                      let isInflation = false
                      let isDeflation = false

                      if (nextRate > 0 && rate > 0) {
                        const difference = rate - nextRate
                        const percent = (difference / nextRate) * 100
                        if (percent > 0.1) {
                          pctStr = `▲ ₹${Math.abs(Math.round(difference))} (+${Math.round(percent * 10) / 10}%)`
                          isInflation = true
                        } else if (percent < -0.1) {
                          pctStr = `▼ ₹${Math.abs(Math.round(difference))} (-${Math.round(Math.abs(percent) * 10) / 10}%)`
                          isDeflation = true
                        }
                      }

                      return (
                        <TableRow key={item.id} className="border-zinc-800/60 text-xs">
                          <TableCell className="px-4 py-2 text-zinc-400 font-bold">{format(new Date(item.date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="py-2 font-bold text-white uppercase">{parsed.supplier}</TableCell>
                          <TableCell className="py-2 text-zinc-400 font-bold uppercase">{parsed.brand || '—'}</TableCell>
                          <TableCell className="py-2 font-bold text-white">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="py-2 text-right font-black text-white font-mono">₹{rate}</TableCell>
                          <TableCell className="py-2 text-center font-bold">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-black uppercase font-mono",
                              isInflation ? "bg-red-500/10 text-red-400" : isDeflation ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-600"
                            )}>
                              {pctStr}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setActiveHistoryMaterial(null)} className="h-10 px-5 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-bold text-zinc-400 uppercase">Close History</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ESTIMATIONS CONFIG MODAL */}
      {showEstimationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50" onClick={() => setShowEstimationModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-5 bg-[#111520] border border-[#1e2435] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Configure Site Estimations</h3>
              </div>
              <button onClick={() => setShowEstimationModal(false)} className="text-zinc-500 hover:text-white p-1 hover:bg-white/5 rounded-lg"><X size={16} /></button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
              {MATERIAL_MASTER.map((m) => (
                <div key={m.name} className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="col-span-2 font-bold text-white uppercase truncate">{m.name}</span>
                  <div className="relative flex items-center">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={editingEstimations[m.name] || ''}
                      onChange={e => setEditingEstimations({ ...editingEstimations, [m.name]: e.target.value })}
                      className="h-9 bg-zinc-900 border-zinc-800 rounded-lg text-right font-black pr-8 text-white text-xs"
                    />
                    <span className="absolute right-2 text-[8px] font-black uppercase text-zinc-500 select-none">
                      {m.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-zinc-850">
              <button onClick={() => setShowEstimationModal(false)} className="flex-1 h-10 bg-zinc-950 border border-zinc-900 rounded-xl text-xs font-bold text-zinc-500 uppercase">Cancel</button>
              <button onClick={handleSaveEstimations} className="flex-1 h-10 bg-blue-500 hover:bg-blue-600 rounded-xl text-xs font-black uppercase text-white flex items-center justify-center">Save Estimations</button>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-PROJECT MATERIAL TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowTransferModal(false)}>
          <div className="rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col space-y-5 shadow-2xl animate-in zoom-in-95" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-[#1e2435] shrink-0">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Sri Sai Constructions</p>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Transfer Material</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Select Source Project */}
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 font-bold uppercase tracking-wide text-[10px]">Source Project</label>
                <select
                  value={transferSourceProj}
                  onChange={e => {
                    setTransferSourceProj(e.target.value)
                    setTransferMaterialId('')
                    setTransferQty('')
                  }}
                  className="h-10 px-3 rounded-lg bg-[#0d1018] border border-[#1e2435] text-white outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Select Source Project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Select Material from Source Project */}
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 font-bold uppercase tracking-wide text-[10px]">Select Material to Transfer</label>
                <select
                  value={transferMaterialId}
                  onChange={e => {
                    setTransferMaterialId(e.target.value)
                    const selected = sourceMaterials.find(m => m.id === e.target.value)
                    setTransferQty(selected ? String(selected.quantity) : '')
                  }}
                  disabled={!transferSourceProj || sourceMaterials.length === 0}
                  className="h-10 px-3 rounded-lg bg-[#0d1018] border border-[#1e2435] text-white outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="">{!transferSourceProj ? 'Select a source project first...' : sourceMaterials.length === 0 ? 'No transferrable materials found' : 'Choose material...'}</option>
                  {sourceMaterials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.quantity} {m.unit} available)</option>
                  ))}
                </select>
              </div>

              {/* Select Destination Project */}
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 font-bold uppercase tracking-wide text-[10px]">Destination Project</label>
                <select
                  value={transferDestProj}
                  onChange={e => setTransferDestProj(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-[#0d1018] border border-[#1e2435] text-white outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Select Destination Project...</option>
                  {projects
                    .filter(p => p.id !== transferSourceProj)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>

              {/* Quantity input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-zinc-400 font-bold uppercase tracking-wide text-[10px]">Quantity to Transfer</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={transferQty}
                    onChange={e => setTransferQty(e.target.value)}
                    placeholder="Enter quantity..."
                    className="h-10 px-3 rounded-lg bg-[#0d1018] border border-[#1e2435] text-white outline-none focus:border-blue-500 flex-1"
                  />
                  {transferMaterialId && (
                    <span className="text-zinc-500 font-black uppercase text-[10px]">
                      {sourceMaterials.find(m => m.id === transferMaterialId)?.unit}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1e2435] flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="h-10 px-4 rounded-xl text-xs font-black uppercase bg-[#1a1f2e] text-zinc-300 border border-[#1e2435] hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferConfirm}
                disabled={transferLoading || !transferSourceProj || !transferDestProj || !transferMaterialId || !transferQty}
                className="h-10 px-5 rounded-xl text-xs font-black uppercase bg-blue-500 text-white flex items-center justify-center gap-1.5 hover:bg-blue-600 disabled:opacity-50 transition-all cursor-pointer"
              >
                {transferLoading ? <Loader2 size={12} className="animate-spin" /> : null} Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
