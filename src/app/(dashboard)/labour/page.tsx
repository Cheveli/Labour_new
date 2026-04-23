'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  User, 
  Loader2,
  MoreVertical,
  MessageCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'

export default function LabourPage() {
  const [labourers, setLabourers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: 'male',
    type: 'labour',
    daily_rate: ''
  })
  const supabase = createClient()

  useEffect(() => {
    fetchLabour()
  }, [])

  async function fetchLabour() {
    setLoading(true)
    const { data, error } = await supabase
      .from('labour')
      .select('*')
      .order('name')
    
    if (error) {
      toast.error('Failed to fetch labour')
    } else {
      setLabourers(data || [])
    }
    setLoading(false)
  }

  const handleAddLabour = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { data, error } = await supabase
      .from('labour')
      .insert([{
        ...formData,
        daily_rate: parseFloat(formData.daily_rate)
      }])
      .select()

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Labour added successfully')
      setIsAddDialogOpen(false)
      setFormData({ name: '', phone: '', gender: 'male', type: 'labour', daily_rate: '' })
      fetchLabour()
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this worker?')) {
      const { error } = await supabase.from('labour').delete().eq('id', id)
      if (error) {
        toast.error('Failed to delete')
      } else {
        toast.success('Deleted successfully')
        fetchLabour()
      }
    }
  }

  const filteredLabourers = labourers.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone.includes(searchTerm)
  )

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'mistry': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'helper': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Labour Management</h1>
          <p className="text-gray-500">Track and manage your workforce directory.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700 h-11 px-6 rounded-xl shadow-lg shadow-blue-100 dark:shadow-none">
              <Plus className="mr-2 h-5 w-5" /> Add New Worker
            </Button>
          } />
          <DialogContent className="sm:max-w-[500px] rounded-xl p-8 border-none shadow-2xl overflow-hidden bg-white dark:bg-zinc-950">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold text-blue-600">Register New Labour</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddLabour} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Full Name</label>
                <Input 
                  placeholder="e.g. Ramesh Kumar" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                  className="rounded-xl h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Phone</label>
                  <Input 
                    placeholder="9876543210" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    required
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Daily Rate (₹)</label>
                  <Input 
                    type="number"
                    placeholder="800" 
                    value={formData.daily_rate}
                    onChange={e => setFormData({...formData, daily_rate: e.target.value})}
                    required
                    className="rounded-xl h-11"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Gender</label>
                  <Select onValueChange={(v: string | null) => setFormData({...formData, gender: (v as any) || 'male'})} defaultValue="male">
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-xl">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Type</label>
                  <Select onValueChange={(v: string | null) => setFormData({...formData, type: (v as any) || 'labour'})} defaultValue="labour">
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-xl">
                      <SelectItem value="mistry">Mistry (Skilled)</SelectItem>
                      <SelectItem value="labour">Labour (Women)</SelectItem>
                      <SelectItem value="helper">Helper (Pararak)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-blue-600 h-12 rounded-xl text-lg mt-4">
                {loading ? <Loader2 className="animate-spin" /> : 'Register Worker'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black overflow-hidden">
        <CardHeader className="border-b border-gray-50 dark:border-zinc-900 pb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search by name or phone..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-gray-50 dark:bg-zinc-900 border-none rounded-xl"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 dark:bg-zinc-900/50 border-none">
                <TableHead className="w-[300px] py-4">Worker Detail</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Daily Rate</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="h-16 animate-pulse bg-gray-50/20 dark:bg-zinc-900/20" />
                    </TableRow>
                  ))
                ) : filteredLabourers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center text-gray-500">
                      No labourers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLabourers.map((worker) => (
                    <motion.tr 
                      key={worker.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                    >
                      <TableCell className="py-4 font-medium px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                            {worker.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-zinc-100">{worker.name}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 capitalize">{worker.gender}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-zinc-400">
                          <Phone size={14} className="text-blue-500" />
                          {worker.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("rounded-lg font-medium", getTypeColor(worker.type))}>
                          {worker.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-gray-900 dark:text-white">
                        ₹{worker.daily_rate}
                      </TableCell>
                      <TableCell className="text-right px-6">
                         <div className="flex justify-end gap-2">
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                             onClick={() => {
                               const message = `Payment Summary for ${worker.name}:\nDaily Rate: ₹${worker.daily_rate}\nType: ${worker.type}`
                               window.open(`https://wa.me/${worker.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`)
                             }}
                            >
                             <MessageCircle size={18} />
                           </Button>
                           <DropdownMenu>
                             <DropdownMenuTrigger render={
                               <Button variant="ghost" size="icon" className="h-8 w-8">
                                 <MoreVertical size={18} />
                                </Button>
                             } />
                             <DropdownMenuContent align="end" className="rounded-xl border-none shadow-xl bg-white dark:bg-zinc-900">
                               <DropdownMenuItem className="gap-2">
                                 <Edit2 size={16} /> Edit Profile
                               </DropdownMenuItem>
                               <DropdownMenuItem 
                                 className="gap-2 text-red-500 hover:text-red-600 focus:text-red-600"
                                 onClick={() => handleDelete(worker.id)}
                                >
                                 <Trash2 size={16} /> Delete Worker
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
