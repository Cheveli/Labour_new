'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, X, Zap } from 'lucide-react'

interface MaterialConfig {
  id: string
  name: string
  teluguName: string
  image: string
  unit: string
  hasTransport: boolean
}

const MATERIALS_LIST: MaterialConfig[] = [
  {
    id: 'cement',
    name: 'Cement',
    teluguName: 'సిమెంట్',
    image: '/images/materials/cement_bags.png',
    unit: 'bags',
    hasTransport: false
  },
  {
    id: 'sand',
    name: 'Sand',
    teluguName: 'ఇసుక',
    image: '/images/materials/sand_pile.png',
    unit: 'tons',
    hasTransport: true
  },
  {
    id: 'aggregate',
    name: 'Coarse Aggregate',
    teluguName: 'కంకర (Kankara)',
    image: '/images/materials/coarse_aggregate.png',
    unit: 'tons',
    hasTransport: true
  },
  {
    id: 'bricks',
    name: 'Bricks',
    teluguName: 'ఇటుకలు',
    image: '/images/materials/bricks_stack.png',
    unit: 'pieces',
    hasTransport: false
  },
  {
    id: 'steel',
    name: 'Steel Rods',
    teluguName: 'స్టీల్ రాడ్స్',
    image: '/images/materials/steel_rods.png',
    unit: 'kgs',
    hasTransport: false
  },
  {
    id: 'dust',
    name: 'Dust Powder',
    teluguName: 'డస్ట్ పౌడర్',
    image: '/images/materials/dust_powder.png',
    unit: 'tons',
    hasTransport: true
  }
]

const TELUGU_WORD_MAP: Record<string, string> = {
  cheveli: 'చేవెళ్ళ',
  project: 'ప్రాజెక్ట్',
  demo: 'డెమో',
  sri: 'శ్రీ',
  sai: 'సాయి',
  constructions: 'కన్స్ట్రక్షన్స్',
  construction: 'కన్స్ట్రక్షన్',
  residency: 'రెసిడెన్సీ',
  residencies: 'రెసిడెన్సీస్',
  tower: 'టవర్',
  towers: 'టవర్స్',
  gachibowli: 'గచ్చిబౌలి',
  pranati: 'ప్రణతి',
  villa: 'విల్లా',
  villas: 'విల్లాస్',
  house: 'ఇల్లు (హౌస్)',
  building: 'భవనం (బిల్డింగ్)',
  apartments: 'అపార్ట్‌మెంట్లు',
  apartment: 'అపార్ట్‌మెంట్',
  site: 'సైట్',
  office: 'ఆఫీస్',
  home: 'హోమ్',
  road: 'రోడ్',
  layout: 'లేఅవుట్',
  hitech: 'హైటెక్',
  city: 'సిటీ',
  plazas: 'ప్లాజాలు',
  plaza: 'ప్లాజా',
  garden: 'గార్డెన్',
  gardens: 'గార్డెన్స్',
  enclave: 'ఎన్‌క్లేవ్',
  heights: 'హైట్స్',
  valley: 'వ్యాలీ',
  park: 'పార్క్',
  green: 'గ్రీన్',
  view: 'వ్యూ',
  hills: 'హిల్స్',
  hill: 'హిల్',
  colony: 'కాలనీ',
  nagar: 'నగర్',
  avenue: 'అవెన్యూ',
  court: 'కోర్ట్',
  estates: 'ఎస్టేట్స్',
  estate: 'ఎస్టేట్',
  lakeside: 'లేక్‌సైడ్',
  lake: 'లేక్'
}

function getTeluguProjectName(englishName: string): string {
  if (!englishName) return ''
  const words = englishName.toLowerCase().trim().split(/\s+/)
  const translatedWords = words.map(word => {
    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    return TELUGU_WORD_MAP[cleanWord] || word
  })
  return translatedWords.join(' ')
}

interface QuickMaterialModalProps {
  isOpen: boolean
  onClose: () => void
  activeProjectId?: string
  onSuccess?: () => void
}

export default function QuickMaterialModal({
  isOpen,
  onClose,
  activeProjectId,
  onSuccess
}: QuickMaterialModalProps) {
  const supabase = createClient()

  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialConfig | null>(null)
  const [supplier, setSupplier] = useState('')
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('')
  const [transportCost, setTransportCost] = useState('')
  const [total, setTotal] = useState('')
  const [isPendingPricing, setIsPendingPricing] = useState(false)
  const [isTotalManuallyEdited, setIsTotalManuallyEdited] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch projects list
  useEffect(() => {
    if (!isOpen) return

    async function fetchProjects() {
      try {
        setLoadingProjects(true)
        const { data, error } = await supabase.from('projects').select('id, name').neq('status', 'SYSTEM').order('name')
        if (error) throw error
        setProjects(data || [])
        
        // Match active project prop or localStorage
        const activeProjId = activeProjectId || localStorage.getItem('ssc_active_project_id')
        if (activeProjId && data?.some(p => p.id === activeProjId)) {
          setSelectedProjectId(activeProjId)
        } else if (data && data.length > 0) {
          setSelectedProjectId(data[0].id)
        }
      } catch (err: any) {
        console.error('Error fetching projects:', err)
        toast.error('Failed to load projects: ' + err.message)
      } finally {
        setLoadingProjects(false)
      }
    }
    fetchProjects()
  }, [isOpen, activeProjectId])

  // Reset form state on close or reopening
  useEffect(() => {
    if (!isOpen) {
      setSelectedMaterial(null)
      setSupplier('')
      setQty('')
      setRate('')
      setTransportCost('')
      setTotal('')
      setIsPendingPricing(false)
      setIsTotalManuallyEdited(false)
    }
  }, [isOpen])

  // Auto-calculation of total amount based on material type formula
  useEffect(() => {
    if (isPendingPricing) {
      setTotal('0')
      return
    }
    if (!selectedMaterial || isTotalManuallyEdited) return

    const q = parseFloat(qty) || 0
    const r = parseFloat(rate) || 0
    const t = selectedMaterial.hasTransport ? (parseFloat(transportCost) || 0) : 0

    if (q > 0 && r > 0) {
      const calculated = parseFloat(((q * r) + t).toFixed(2))
      setTotal(String(calculated))
    } else if (t > 0 && q === 0 && r === 0) {
      setTotal(String(t))
    } else if (!isTotalManuallyEdited) {
      // keep current or clear
      if (q === 0 && r === 0 && t === 0) {
        setTotal('')
      }
    }
  }, [qty, rate, transportCost, selectedMaterial, isTotalManuallyEdited, isPendingPricing])

  const handleMaterialSelect = (mat: MaterialConfig) => {
    setSelectedMaterial(mat)
    setSupplier('')
    setQty('')
    setRate('')
    setTransportCost('')
    setTotal('')
    setIsPendingPricing(false)
    setIsTotalManuallyEdited(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId) {
      toast.error('Please select a site (ప్రాజెక్ట్ సెలెక్ట్ చేయండి)')
      return
    }
    if (!selectedMaterial) {
      toast.error('Please select a material')
      return
    }

    const qVal = parseFloat(qty) || 1
    const rVal = isPendingPricing ? 0 : (selectedMaterial.id === 'steel' ? 0 : (parseFloat(rate) || 0))
    const tVal = selectedMaterial.hasTransport && !isPendingPricing ? (parseFloat(transportCost) || 0) : 0
    const finalTotal = isPendingPricing ? 0 : (parseFloat(total) || parseFloat(((qVal * rVal) + tVal).toFixed(2)) || 0)

    if (!isPendingPricing && finalTotal <= 0 && qVal <= 0) {
      toast.error('Please enter a valid amount or toggle Price Pending')
      return
    }

    setSaving(true)
    try {
      const notesObj = {
        is_erp_v3: true,
        purchase_id: `PO-${Date.now().toString().slice(-6)}`,
        supplier: supplier.trim() || 'Direct / Site Delivery',
        brand: null,
        transportation_cost: tVal,
        loading_cost: 0,
        discount: 0,
        calculated_total: finalTotal,
        final_paid_amount: finalTotal,
        remarks: isPendingPricing ? 'Quick Entry · Price Pending / Settle Later' : 'Quick Entry',
        is_pending_pricing: isPendingPricing
      }

      const payload = {
        project_id: selectedProjectId,
        name: selectedMaterial.name,
        quantity: parseFloat(qty) || 1,
        unit: selectedMaterial.unit,
        cost_per_unit: rVal,
        total_amount: finalTotal,
        date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
        notes: JSON.stringify(notesObj),
        payment_system_v2: true,
        payment_status: isPendingPricing ? 'pending' : 'unpaid'
      }

      const { error } = await supabase.from('materials').insert([payload])
      if (error) throw error

      toast.success(isPendingPricing ? `${selectedMaterial.name} recorded (Price Pending)!` : `${selectedMaterial.name} recorded successfully!`)
      
      // Close modal and notify success
      onClose()
      if (onSuccess) {
        onSuccess()
      }

      // Sync local storage in case active project changed
      localStorage.setItem('ssc_active_project_id', selectedProjectId)
      window.dispatchEvent(new Event('ssc_project_changed'))
      
    } catch (err: any) {
      console.error('Error saving material:', err)
      toast.error('Error recording entry: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 border flex flex-col space-y-6"
        style={{
          backgroundColor: '#111520',
          borderColor: '#1e2435',
          background: 'linear-gradient(135deg, #111520 0%, #0d1018 100%)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Block */}
        <div className="flex justify-between items-start pb-4 border-b border-[#1e2435]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight uppercase">
                Quick Material Entry
              </h2>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                వేగవంతమైన మెటీరియల్ నమోదు · Touch Friendly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Screen 1: Catalog view */}
        {!selectedMaterial ? (
          <div className="space-y-6">
            {/* Project Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                Select Site / Project (సైట్ ఎంచుకోండి) *
              </label>
              {loadingProjects ? (
                <div className="h-12 w-full bg-zinc-900/40 animate-pulse rounded-xl border border-zinc-800" />
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value)
                    localStorage.setItem('ssc_active_project_id', e.target.value)
                    window.dispatchEvent(new Event('ssc_project_changed'))
                  }}
                  className="w-full h-12 px-4 rounded-xl text-sm font-bold bg-zinc-900 border border-[#1e2435] text-white outline-none focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="">Choose Site location</option>
                  {projects.map((p) => {
                    const telugu = getTeluguProjectName(p.name)
                    const displayLabel = telugu && telugu.toLowerCase() !== p.name.toLowerCase()
                      ? `${p.name} / ${telugu}`
                      : p.name
                    return (
                      <option key={p.id} value={p.id}>
                        {displayLabel}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>

            {/* Grid Catalog */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                Select Material / మెటీరియల్ ఎంచుకోండి
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MATERIALS_LIST.map((mat) => (
                  <div
                    key={mat.id}
                    onClick={() => handleMaterialSelect(mat)}
                    className="group rounded-2xl border border-[#1e2435] bg-[#0c0f17]/50 hover:bg-[#111520] hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 p-4 flex flex-col items-center justify-between transition-all duration-200 cursor-pointer active:scale-95 text-center min-h-[160px]"
                  >
                    {/* Image */}
                    <div className="w-20 h-20 relative flex items-center justify-center overflow-hidden mb-2">
                      <img
                        src={mat.image}
                        alt={mat.name}
                        className="object-contain w-full h-full max-w-full max-h-full transition-transform duration-200 group-hover:scale-105"
                      />
                    </div>

                    {/* Labels */}
                    <div>
                      <h3 className="text-xs font-black text-white tracking-wide uppercase group-hover:text-emerald-400 transition-colors">
                        {mat.name}
                      </h3>
                      <p className="text-[10px] font-bold text-zinc-500 mt-0.5">
                        {mat.teluguName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Screen 2: Compact Entry Form */
          <div className="space-y-5">
            {/* Back to Catalog Header */}
            <div className="flex items-center gap-3 bg-[#0c0f17] border border-[#1e2435] p-3 rounded-2xl">
              <button
                type="button"
                onClick={() => setSelectedMaterial(null)}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-12 h-12 relative overflow-hidden bg-zinc-900 rounded-xl p-1 border border-zinc-800 flex items-center justify-center shrink-0">
                <img src={selectedMaterial.image} alt={selectedMaterial.name} className="object-contain w-full h-full" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wide truncate">
                  {selectedMaterial.name} ({selectedMaterial.teluguName})
                </h3>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  Mapped Unit: <strong className="text-emerald-400">{selectedMaterial.unit.toUpperCase()}</strong>
                </p>
              </div>
            </div>

            {/* Entry Form */}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Pricing Mode Toggle */}
              <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Pricing Mode (ధర స్థితి)
                  </span>
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-md",
                    isPendingPricing ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  )}>
                    {isPendingPricing ? "⏳ Settle Later" : "💵 Price Decided"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPendingPricing(false)
                      setIsTotalManuallyEdited(false)
                    }}
                    className={cn(
                      "py-2 px-3 rounded-lg text-xs font-bold transition-all border text-left",
                      !isPendingPricing
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-black shadow-sm"
                        : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-white"
                    )}
                  >
                    💵 Price Decided
                    <div className="text-[9px] font-normal opacity-70">Log with amount</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPendingPricing(true)
                      setRate('0')
                      setTotal('0')
                    }}
                    className={cn(
                      "py-2 px-3 rounded-lg text-xs font-bold transition-all border text-left",
                      isPendingPricing
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-black shadow-sm"
                        : "bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-white"
                    )}
                  >
                    ⏳ Price Pending
                    <div className="text-[9px] font-normal opacity-70">Settle later on bill</div>
                  </button>
                </div>
              </div>

              {/* Optional Supplier Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Supplier / Vendor Name <span className="text-zinc-600 font-normal">(Optional)</span>
                </label>
                <Input
                  placeholder="e.g. Sri Balaji Traders, Direct Site..."
                  value={supplier}
                  onChange={(e: any) => setSupplier(e.target.value)}
                  className="h-10 bg-zinc-900 border-zinc-800 rounded-xl text-xs font-medium text-white placeholder:text-zinc-600"
                />
              </div>

              {/* Field 1: Quantity */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {selectedMaterial.id === 'steel'
                    ? 'Total KG (బరువు)'
                    : `Quantity (${selectedMaterial.unit === 'bags' ? 'Bags / సంచులు' : selectedMaterial.unit === 'pieces' ? 'Pieces / ముక్కలు' : selectedMaterial.unit === 'kgs' ? 'KGs / కిలోలు' : 'Tonnes / టన్నులు'})`}
                  <span className="text-zinc-600 font-normal ml-1">(Optional)</span>
                </label>
                <div className="relative">
                  <Input
                    placeholder={selectedMaterial.id === 'steel' ? "e.g. 1500" : "e.g. 50"}
                    type="number"
                    step="any"
                    value={qty}
                    onChange={(e: any) => setQty(e.target.value)}
                    autoFocus
                    className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-base pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wider text-emerald-400">
                    {selectedMaterial.unit}
                  </span>
                </div>
              </div>

              {/* Field 2: Rate Per Unit (When not pending) */}
              {!isPendingPricing && selectedMaterial.id !== 'steel' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Rate Per {selectedMaterial.unit === 'bags' ? 'Bag' : selectedMaterial.unit === 'pieces' ? 'Piece' : selectedMaterial.unit === 'kgs' ? 'KG' : 'Tonne'} (ధర)
                    <span className="text-zinc-600 font-normal ml-1">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="e.g. 420"
                      type="number"
                      step="any"
                      value={rate}
                      onChange={(e: any) => setRate(e.target.value)}
                      className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-base pl-8"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-500">
                      ₹
                    </span>
                  </div>
                </div>
              )}

              {/* Field 3: Transport Cost (Only for Sand, Aggregate, Dust when not pending) */}
              {!isPendingPricing && selectedMaterial.hasTransport && (
                <div className="space-y-1 animate-in slide-in-from-top-1 duration-150">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Transport Cost (రవాణా ఖర్చు)
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="e.g. 1500"
                      type="number"
                      step="any"
                      value={transportCost}
                      onChange={(e: any) => setTransportCost(e.target.value)}
                      className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white text-base pl-8"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-500">
                      ₹
                    </span>
                  </div>
                </div>
              )}

              {/* Field 4: Total Amount (Editable / Settle Later indicator) */}
              {isPendingPricing ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
                  <div className="text-xl">⏳</div>
                  <div>
                    <p className="text-xs font-bold text-amber-300">Amount Pending Settlement</p>
                    <p className="text-[10px] text-amber-400/80">
                      Entry will be saved at ₹0 with a prominent "Settle Price" badge to update once the bill arrives.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      {selectedMaterial.id === 'steel' ? 'Total Cost (మొత్తం ధర)' : 'Total / Lumpsum Amount (మొత్తం ధర)'}
                    </label>
                    {isTotalManuallyEdited && selectedMaterial.id !== 'steel' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsTotalManuallyEdited(false)
                          const q = parseFloat(qty) || 0
                          const r = parseFloat(rate) || 0
                          const t = selectedMaterial.hasTransport ? (parseFloat(transportCost) || 0) : 0
                          setTotal(String(parseFloat(((q * r) + t).toFixed(2))))
                        }}
                        className="text-[9px] text-zinc-500 hover:text-emerald-400 uppercase font-black tracking-widest"
                      >
                        Reset Auto
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <Input
                      placeholder="0.00"
                      type="number"
                      step="any"
                      value={total}
                      onChange={(e: any) => {
                        setTotal(e.target.value)
                        setIsTotalManuallyEdited(true)
                      }}
                      className="h-11 bg-zinc-950 border-emerald-500/30 rounded-xl font-black text-emerald-400 text-lg pl-8"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-500">
                      ₹
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500">
                    Auto-calculated from qty × rate, or type direct total override.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMaterial(null)}
                  className="w-full sm:flex-1 h-11 rounded-xl text-xs font-black uppercase border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-300 transition-all cursor-pointer"
                  style={{ backgroundColor: '#1a1f2e', borderColor: '#1e2435' }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:flex-1 h-11 rounded-xl text-xs font-black uppercase text-white hover:opacity-95 flex items-center justify-center gap-2 hover:shadow-lg transition-all cursor-pointer"
                  style={{
                    background: isPendingPricing
                      ? 'linear-gradient(135deg, #d97706, #b45309)'
                      : 'linear-gradient(135deg, #10b981, #059669)'
                  }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isPendingPricing ? 'Save Pending (సేవ్ చేయి)' : 'Save (సేవ్ చేయి)'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
