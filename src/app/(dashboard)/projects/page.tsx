'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Plus, 
  Search, 
  Briefcase, 
  Layers, 
  ArrowUpRight,
  TrendingUp,
  Package,
  Calendar,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })
  const supabase = createClient()

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        labour_count: attendance(labour_id),
        material_cost: materials(total_cost),
        income_sum: income(amount)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      toast.error('Failed to fetch projects')
    } else {
      // Process aggregates manually since Supabase select count/sum needs different syntax or simple processing
      const processed = data?.map(proj => {
        const uniqueLabour = new Set((proj.labour_count || []).map((l: any) => l.labour_id)).size
        const totalMat = (proj.material_cost || []).reduce((acc: number, curr: any) => acc + Number(curr.total_cost), 0)
        const totalInc = (proj.income_sum || []).reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
        
        return {
          ...proj,
          uniqueLabour,
          totalMat,
          totalInc
        }
      })
      setProjects(processed || [])
    }
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.from('projects').insert([newProject]).select()

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Project created successfully')
      setIsAddDialogOpen(false)
      setNewProject({ name: '', description: '' })
      fetchProjects()
    }
    setLoading(false)
  }

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Active Projects</h1>
          <p className="text-gray-500">Track costs, attendance and materials per site.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700 h-11 px-6 rounded-xl shadow-lg shadow-blue-100 dark:shadow-none">
              <Plus className="mr-2 h-5 w-5" /> Start New Project
            </Button>
          } />
          <DialogContent className="rounded-xl border-none shadow-2xl p-8 bg-white dark:bg-zinc-950">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-blue-600">Company Project Detail</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Project Name</label>
                <Input 
                  placeholder="e.g. Skyline Heights Phase 2" 
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                  required
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Short Description</label>
                <Input 
                  placeholder="Street Address or Site ID" 
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                  className="rounded-xl h-12"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl text-lg mt-4">
                {loading ? <Loader2 className="animate-spin" /> : 'Create Project'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input 
          placeholder="Search site name..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-11 h-12 bg-white dark:bg-zinc-900 border-none shadow-xl shadow-gray-100/50 dark:shadow-none rounded-2xl"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {loading ? (
             Array(3).fill(0).map((_, i) => (
               <Card key={i} className="h-[250px] animate-pulse bg-gray-100/50 dark:bg-zinc-900/50 rounded-3xl border-none" />
             ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full py-20 text-center text-gray-500 bg-white dark:bg-zinc-900 rounded-3xl">
              No projects found. Start by adding one.
            </div>
          ) : (
            filteredProjects.map((proj) => (
              <motion.div
                key={proj.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
              >
                <Link href={`/projects/${proj.id}`}>
                  <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none bg-white dark:bg-black rounded-3xl group overflow-hidden h-full flex flex-col">
                    <CardHeader className="p-6 pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                          <Briefcase size={24} />
                        </div>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-none rounded-lg font-bold">
                          ACTIVE
                        </Badge>
                      </div>
                      <CardTitle className="text-xl font-black group-hover:text-blue-600 transition-colors">
                        {proj.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">{proj.description || 'No description provided.'}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 space-y-6 flex-1">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-zinc-900 p-3 rounded-2xl">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Labour</p>
                          <div className="flex items-center gap-2">
                            <Layers size={14} className="text-blue-500" />
                            <span className="font-bold">{proj.uniqueLabour || 0} active</span>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-900 p-3 rounded-2xl">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Material</p>
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-orange-500" />
                            <span className="font-bold">₹{proj.totalMat?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                         <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <span>Total Revenue</span>
                           <span className="text-emerald-500">₹{proj.totalInc?.toLocaleString()}</span>
                         </div>
                         <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: '60%' }}
                             className="h-full bg-emerald-500"
                           />
                         </div>
                      </div>

                      <div className="pt-4 border-t border-gray-50 dark:border-zinc-900 flex items-center justify-between group-hover:text-blue-600">
                        <span className="text-sm font-bold">Manage Details</span>
                        <ArrowUpRight size={18} className="translate-x-[-10px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
