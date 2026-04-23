'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Plus, 
  Search, 
  Package, 
  HardHat,
  Loader2,
  Trash2,
  FileText,
  Truck,
  TrendingUp,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    quantity: '',
    unit: 'bags',
    cost_per_unit: '',
    date: format(new Date(), 'yyyy-MM-dd')
  })
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: matData } = await supabase.from('materials').select('*, projects(name)').order('date', { ascending: false })
    const { data: projectData } = await supabase.from('projects').select('*').order('name')
    
    setMaterials(matData || [])
    setProjects(projectData || [])
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const qty = parseFloat(formData.quantity)
    const cpu = parseFloat(formData.cost_per_unit)
    const total = qty * cpu

    const { error } = await supabase.from('materials').insert([{
      ...formData,
      quantity: qty,
      cost_per_unit: cpu,
      total_cost: total
    }])

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Material tracking updated')
      setIsAddDialogOpen(false)
      setFormData({ project_id: '', name: '', quantity: '', unit: 'bags', cost_per_unit: '', date: format(new Date(), 'yyyy-MM-dd') })
      fetchData()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Material Logistics</h1>
          <p className="text-gray-500">Inventory and cost tracking for site materials.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-orange-600 hover:bg-orange-700 h-11 px-6 rounded-xl shadow-lg shadow-orange-100 dark:shadow-none">
              <Plus className="mr-2 h-5 w-5" /> Receive Material
            </Button>
          } />
          <DialogContent className="rounded-3xl border-none shadow-2xl p-8 bg-white dark:bg-zinc-950 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                <Truck size={24} /> Material Inbound
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Select Project</label>
                  <Select onValueChange={(v: string | null) => setFormData({...formData, project_id: v ?? ''})}>
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="Project site" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Date Received</label>
                  <Input 
                    type="date" 
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="rounded-xl h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Material Name</label>
                <Input 
                  placeholder="e.g. UltraTech Cement, 16mm Steel Bars" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                  className="rounded-xl h-12"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Quantity</label>
                  <Input 
                    type="number" 
                    placeholder="100" 
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: e.target.value})}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Unit</label>
                  <Select onValueChange={(v: string | null) => setFormData({...formData, unit: v ?? 'bags'})} defaultValue="bags">
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bags">Bags (Cement)</SelectItem>
                      <SelectItem value="kg">KG (Steel)</SelectItem>
                      <SelectItem value="tons">Tons (Sand/Gravel)</SelectItem>
                      <SelectItem value="units">Units (Fittings)</SelectItem>
                      <SelectItem value="sqft">Sq. Ft (Tiles)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Cost per Unit (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="450" 
                    value={formData.cost_per_unit}
                    onChange={e => setFormData({...formData, cost_per_unit: e.target.value})}
                    required
                    className="rounded-xl h-12"
                  />
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex justify-between items-center">
                 <span className="font-bold text-orange-700">Estimated Total Cost:</span>
                 <span className="text-xl font-black text-orange-700">
                   ₹{(parseFloat(formData.quantity || '0') * parseFloat(formData.cost_per_unit || '0')).toLocaleString()}
                 </span>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 h-12 rounded-xl text-lg mt-2 shadow-lg shadow-orange-100">
                {loading ? <Loader2 className="animate-spin" /> : 'Log Inbound Material'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SummaryCard 
          title="Cement (Bags)" 
          value={materials.filter(m => m.unit === 'bags').reduce((acc, m) => acc + Number(m.quantity), 0).toString()} 
          icon={<Package className="text-blue-500" />}
        />
        <SummaryCard 
          title="Steel (KG)" 
          value={materials.filter(m => m.unit === 'kg').reduce((acc, m) => acc + Number(m.quantity), 0).toLocaleString()} 
          icon={<HardHat className="text-orange-500" />}
        />
        <SummaryCard 
          title="Total Mat. Spend" 
          value={`₹${materials.reduce((acc, m) => acc + Number(m.total_cost), 0).toLocaleString()}`} 
          icon={<TrendingUp className="text-emerald-500" />}
        />
        <SummaryCard 
          title="Last Order" 
          value={materials.length > 0 ? format(new Date(materials[0].date), 'MMM dd') : 'N/A'} 
          icon={<Calendar className="text-purple-500" />}
        />
      </div>

      <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50">
                <TableHead className="px-6 py-4">Status</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Project Site</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead className="text-right px-6">Bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map(mat => (
                <TableRow key={mat.id} className="group">
                  <TableCell className="px-6">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="font-bold text-gray-900 dark:text-zinc-100">{mat.name}</div>
                    <div className="text-xs text-gray-500">{format(new Date(mat.date), 'MMM dd, yyyy')}</div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{mat.projects?.name}</TableCell>
                  <TableCell className="font-mono">{mat.quantity} {mat.unit}</TableCell>
                  <TableCell className="font-black text-gray-900 dark:text-white">₹{mat.total_cost.toLocaleString()}</TableCell>
                  <TableCell className="text-right px-6">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                      <FileText size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, value, icon }: any) {
  return (
    <Card className="border-none shadow-xl bg-white dark:bg-black rounded-3xl">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
          <div className="p-2 bg-gray-50 dark:bg-zinc-900 rounded-lg">{icon}</div>
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white">{value}</h3>
      </CardContent>
    </Card>
  )
}
