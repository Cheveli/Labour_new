'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Package, Truck, Boxes, Plus, Search, Loader2, Calendar, Briefcase, History } from 'lucide-react'
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
    total_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  })
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

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
    const { error } = await supabase.from('materials').insert([{
      ...formData,
      quantity: parseFloat(formData.quantity) || 0,
      cost_per_unit: parseFloat(formData.cost_per_unit) || 0,
      total_amount: parseFloat(formData.total_amount)
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Inventory recorded')
      setFormData({ project_id: '', name: '', quantity: '', unit: 'bags', cost_per_unit: '', total_amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' })
      fetchData()
    }
    setSaving(false)
  }

  const exportPDF = () => {
    toast.info('Material reports are now available in the Reports section')
  }

  const exportExcel = () => {
    toast.info('Material exports are now available in the Reports section')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-zinc-500">Record site deliveries, stock levels, and resource costs.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="btn-construction rounded-xl font-bold uppercase tracking-tight gap-2 px-8">
            <Truck size={18} /> Add Stock
          </Button>
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
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Project</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Material</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Qty</TableHead>
                      <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Remarks</TableHead>
                      <TableHead className="text-right px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Total Val</TableHead>
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
                        <TableCell colSpan={6} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                              <Boxes size={48} className="opacity-10" />
                              <p className="text-sm font-bold uppercase tracking-widest">No material history found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      materials.map((item) => (
                        <TableRow key={item.id} className="border-zinc-800 transition-colors hover:bg-white/5">
                          <TableCell className="px-8 py-5 font-bold text-gray-400 text-xs">
                            {format(new Date(item.date), 'M/d/yyyy')}
                          </TableCell>
                          <TableCell className="py-5 font-bold text-white text-sm lowercase">{item.projects?.name}</TableCell>
                          <TableCell className="py-5 font-black text-gray-200 text-xs tracking-tight uppercase">{item.name}</TableCell>
                          <TableCell className="py-5 font-bold text-zinc-500 text-xs">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="py-5 text-xs text-zinc-400 max-w-[220px] truncate">{item.notes || '—'}</TableCell>
                          <TableCell className="py-5 text-right px-8 font-black text-white text-sm">₹ {item.total_amount?.toLocaleString() || item.total_cost?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

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
                  materials.map((item) => (
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
                      {item.notes && <p className="text-xs text-zinc-400">{item.notes}</p>}
                    </div>
                  ))
                )}
              </div>
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
                  <Select onValueChange={(v: string | null) => setFormData({...formData, project_id: v ?? ''})} value={formData.project_id}>
                    <SelectTrigger className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold">
                      <SelectValue placeholder="Delivery location" items={Object.fromEntries(projects.map(p => [p.id, p.name]))} />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl">
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-3 font-bold hover:bg-zinc-800">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Qty (optional)</label>
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
                    <Select onValueChange={(v: string | null) => setFormData({...formData, unit: v ?? 'bags'})} value={formData.unit}>
                      <SelectTrigger className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold">
                        <SelectValue items={{ bags: 'Bags', kgs: 'Kg', tons: 'Tons', 'no-unit': 'No Unit' }} />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl">
                        <SelectItem value="bags" className="py-3 font-bold">Bags</SelectItem>
                        <SelectItem value="kgs" className="py-3 font-bold">Kg</SelectItem>
                        <SelectItem value="tons" className="py-3 font-bold">Tons</SelectItem>
                        <SelectItem value="no-unit" className="py-3 font-bold">No Unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Cost Per Unit (₹) (optional)</label>
                  <Input 
                    placeholder="0.00" 
                    type="number"
                    value={formData.cost_per_unit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, cost_per_unit: e.target.value})}
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Amount (₹) *</label>
                  <Input 
                    placeholder="Enter total amount" 
                    type="number"
                    value={formData.total_amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, total_amount: e.target.value})}
                    required
                    className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white"
                  />
                  <p className="text-[9px] font-medium text-zinc-500 italic mt-1 leading-tight">Enter the total amount directly (not auto-calculated).</p>
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
    </div>
  )
}
