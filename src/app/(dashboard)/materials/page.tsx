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
import { Boxes, Loader2, Trash2, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
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
  }, [])

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
      notes: editMatData.notes || null,
      date: editMatData.date
    }).eq('id', editingMat.id)
    setEditSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Updated'); setEditingMat(null); fetchData() }
  }

  async function fetchData() {
    setLoading(true)
    const { data: matData } = await supabase.from('materials').select('*, projects(name)').order('date', { ascending: false })
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    setMaterials(matData || [])
    setProjects(projData || [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.project_id || !formData.name || !formData.total_amount) {
      toast.error('Required fields missing')
      return
    }

    setSaving(true)
    const transport = transportEnabled ? (parseFloat(transportFee) || 0) : 0
    const hamali = hamaliEnabled ? (parseFloat(hamaliFee) || 0) : 0
    const finalAmt = parseFloat(formData.total_amount) || 0
    const baseAmt = parseFloat(formData.base_amount) || 0
    const notesWithFees = [
      supplierName ? `Supplier: ${supplierName}${supplierPhone ? ' (' + supplierPhone + ')' : ''}` : '',
      formData.notes,
      baseAmt > 0 ? `Material Amount: Rs.${baseAmt}` : '',
      transport > 0 ? `Transportation: Rs.${transport}` : '',
      hamali > 0 ? `Hamali: Rs.${hamali}` : ''
    ].filter(Boolean).join(' | ')

    const { base_amount, ...dbPayload } = formData;
    
    const { error } = await supabase.from('materials').insert([{
      ...dbPayload,
      quantity: parseFloat(formData.quantity) || 0,
      cost_per_unit: parseFloat(formData.cost_per_unit) || 0,
      total_amount: finalAmt,
      notes: notesWithFees || null
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Inventory recorded')
      setFormData({ project_id: '', name: '', quantity: '', unit: 'bags', cost_per_unit: '', base_amount: '', total_amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      setSupplierName(''); setSupplierPhone('')
      setTransportEnabled(false); setTransportFee('')
      setHamaliEnabled(false); setHamaliFee('')
      setMatPage(0)
      fetchData()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Material Inventory</h1>
          <p className="mt-1 text-sm text-zinc-500">Record site deliveries, stock levels, and resource costs.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>{materials.length} entries</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Material List */}
        <div className="lg:col-span-8">
          <Card className="panel-elevated text-white rounded-2xl overflow-hidden min-h-full">
            <CardHeader className="p-8 border-b border-zinc-800">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Inventory History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-zinc-900/80">
                    <TableRow className="border-zinc-800 hover:bg-zinc-900/80">
                      <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Date</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Supplier</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Project</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Material / Qty</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Cost</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Remarks</TableHead>
                      <TableHead className="text-right px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Grand Total</TableHead>
                      <TableHead className="py-6 w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5).fill(0).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-zinc-800">
                          <TableCell colSpan={6} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                        </TableRow>
                      ))
                    ) : materials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                              <Boxes size={48} className="opacity-10" />
                              <p className="text-sm font-bold uppercase tracking-widest">No material history found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      materials.slice(matPage * 10, matPage * 10 + 10).map((item) => {
                        const notes = item.notes || '';
                        const supplierMatch = notes.match(/Supplier:\s(.*?)(?:\s\||$)/);
                        const matAmtMatch = notes.match(/Material Amount:\sRs\.([\d,.]+)/);
                        const transportMatch = notes.match(/Transportation:\sRs\.([\d,.]+)/);
                        const hamaliMatch = notes.match(/Hamali:\sRs\.([\d,.]+)/);
                        
                        const supplier = supplierMatch ? supplierMatch[1] : '—';
                        const matAmt = matAmtMatch ? `₹${matAmtMatch[1]}` : (item.quantity > 0 && item.cost_per_unit > 0 ? `₹${(item.quantity * item.cost_per_unit).toLocaleString()}` : '');
                        const transport = transportMatch ? `₹${transportMatch[1]}` : '—';
                        const hamali = hamaliMatch ? `₹${hamaliMatch[1]}` : '—';
                        
                        let cleanNotes = notes
                          .replace(/Supplier:\s(.*?)(?:\s\||$)/, '')
                          .replace(/Material Amount:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                          .replace(/Transportation:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                          .replace(/Hamali:\sRs\.([\d,.]+)(?:\s\||$)/, '')
                          .replace(/^[\s\|]+|[\s\|]+$/g, '')
                          .trim();

                        return (
                          <TableRow key={item.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                            <TableCell className="px-8 py-5 font-bold text-gray-400 text-xs whitespace-nowrap">
                              {format(new Date(item.date), 'dd-MM-yyyy')}
                            </TableCell>
                            <TableCell className="py-5">
                              <p className="font-bold text-white text-sm">{supplier}</p>
                            </TableCell>
                            <TableCell className="py-5">
                              <p className="font-bold text-white text-sm lowercase">{item.projects?.name}</p>
                            </TableCell>
                            <TableCell className="py-5">
                              <p className="font-black text-gray-200 text-xs tracking-tight uppercase">{item.name}</p>
                              <p className="font-bold text-zinc-500 text-[10px] uppercase mt-1">{item.quantity} {item.unit} {item.cost_per_unit > 0 ? ` @ ₹${item.cost_per_unit}` : ''}</p>
                            </TableCell>
                            <TableCell className="py-5">
                              {matAmt && <p className="text-[10px] font-bold text-zinc-400">Material Amount: <span className="text-emerald-400">{matAmt}</span></p>}
                              {transport !== '—' && <p className="text-[10px] font-bold text-zinc-400">Transport: <span className="text-white">{transport}</span></p>}
                              {hamali !== '—' && <p className="text-[10px] font-bold text-zinc-400">Hamali: <span className="text-white">{hamali}</span></p>}
                            </TableCell>
                            <TableCell className="py-5 text-xs text-zinc-400 max-w-[200px] break-words">{cleanNotes || '—'}</TableCell>
                            <TableCell className="py-5 text-right px-8 font-black text-white text-sm whitespace-nowrap">₹ {item.total_amount?.toLocaleString() || item.total_cost?.toLocaleString()}</TableCell>
                            <TableCell className="py-3 pr-4">
                              <div className="flex items-center gap-1 justify-end">
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
                  )})
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
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Add Form */}
        <div className="lg:col-span-4">
           <Card className="panel-elevated text-white rounded-2xl overflow-hidden p-8">
              <h3 className="text-lg font-black uppercase tracking-tight mb-8">Stock Entry</h3>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Site</label>
                  <select value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})} className="styled-select">
                    <option value="">Delivery Location</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Material Name</label>
                  <Input 
                    placeholder="e.g. Cement, Sand, Steel" 
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, name: e.target.value})}
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, quantity: e.target.value})}
                      className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Unit</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="styled-select">
                      <option value="bags">Bags</option>
                      <option value="kgs">Kg</option>
                      <option value="tons">Tons</option>
                      <option value="no-unit">No Unit</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Per Unit (₹)</label>
                    <Input 
                      placeholder="0.00" 
                      type="number"
                      value={formData.cost_per_unit}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, cost_per_unit: e.target.value})}
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, base_amount: e.target.value})}
                    required
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Delivery Date</label>
                  <Input 
                    type="date"
                    value={formData.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, date: e.target.value})}
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
                      className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
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
                      className="h-11 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                    />
                  )}
                </div>

                <div className="space-y-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mt-4">
                  <label className="text-xs font-black text-blue-400 uppercase tracking-widest">Grand Total (₹) *</label>
                  <Input 
                    placeholder="Total including fees" 
                    type="number"
                    value={formData.total_amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, total_amount: e.target.value})}
                    required
                    className="h-12 bg-zinc-950 border-blue-500/30 rounded-xl font-black text-blue-400 text-lg"
                  />
                </div>



                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Remarks (optional)</label>
                  <Textarea 
                    placeholder="Supplier, transport, quality, bill details..."
                    value={formData.notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
                    className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4"
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full h-14 btn-construction rounded-xl font-black uppercase tracking-tight text-lg">
                  {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Record Delivery
                </Button>
              </form>
           </Card>
        </div>
      </div>

      {/* Edit Material Modal */}
      {editingMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingMat(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-white uppercase tracking-wide">Edit Material Entry</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Material Name</label>
                <Input value={editMatData.name} onChange={e => setEditMatData({...editMatData, name: e.target.value})} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Qty</label>
                <Input type="number" value={editMatData.quantity} onChange={e => setEditMatData({...editMatData, quantity: e.target.value})} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Unit</label>
                <select value={editMatData.unit} onChange={e => setEditMatData({...editMatData, unit: e.target.value})} className="styled-select">
                  <option value="bags">Bags</option><option value="kgs">Kg</option><option value="tons">Tons</option><option value="no-unit">No Unit</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Amount (₹)</label>
                <Input type="number" value={editMatData.total_amount} onChange={e => setEditMatData({...editMatData, total_amount: e.target.value})} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</label>
                <Input type="date" value={editMatData.date} onChange={e => setEditMatData({...editMatData, date: e.target.value})} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Remarks</label>
                <Input value={editMatData.notes} onChange={e => setEditMatData({...editMatData, notes: e.target.value})} className="h-10 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingMat(null)} className="flex-1 h-10 rounded-xl text-xs font-black uppercase" style={{ backgroundColor: '#1a1f2e', color: '#6b7280', border: '1px solid #1e2435' }}>Cancel</button>
              <button onClick={handleSaveMat} disabled={editSaving} className="flex-1 h-10 rounded-xl text-xs font-black uppercase text-[#0a0c12] disabled:opacity-50" style={{ backgroundColor: '#3b82f6' }}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
