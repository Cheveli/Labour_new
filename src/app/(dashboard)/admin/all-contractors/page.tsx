'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Search, Filter, ShieldCheck, UserX, Clock, Calendar, Mail, Phone } from 'lucide-react'


export default function AllContractorsPage() {
  const [contractors, setContractors] = useState<any[]>([])
  const [filteredContractors, setFilteredContractors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all')
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email === 'saichevelly@gmail.com') {
        setIsAdmin(true)
        fetchContractors()
      } else {
        toast.error('Access Denied. Super Admin only.')
        window.location.href = '/'
      }
    }
    checkUser()
  }, [])

  async function fetchContractors() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/all-contractors')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch contractors')
      setContractors(data)
      setFilteredContractors(data)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load contractors list')
    } finally {
      setLoading(false)
    }
  }

  // Handle live searches and status filtering
  useEffect(() => {
    let result = [...contractors]

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.account_status === statusFilter)
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(c => 
        c.full_name?.toLowerCase().includes(query) ||
        c.mobile_number?.includes(query) ||
        c.email?.toLowerCase().includes(query)
      )
    }

    setFilteredContractors(result)
  }, [searchQuery, statusFilter, contractors])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md capitalize flex items-center gap-1.5 w-fit">
            <ShieldCheck size={12} /> Active / Approved
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md capitalize flex items-center gap-1.5 w-fit">
            <UserX size={12} /> Rejected
          </Badge>
        )
      default:
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md capitalize flex items-center gap-1.5 w-fit">
            <Clock size={12} /> Pending Approval
          </Badge>
        )
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-zinc-400">
        <Loader2 className="animate-spin mr-2" /> Checking administrator credentials...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-3xl font-black tracking-tight text-white">All Contractors</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Browse, search, and manage subscription statuses for all registered contractors on the platform.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search bar */}
        <div className="relative w-full md:max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 bg-zinc-950 border-zinc-800 text-white rounded-xl focus:border-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Button
            size="sm"
            onClick={() => setStatusFilter('all')}
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            className="rounded-xl font-bold cursor-pointer h-10 border-zinc-800"
          >
            All ({contractors.length})
          </Button>
          <Button
            size="sm"
            onClick={() => setStatusFilter('approved')}
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            className="rounded-xl font-bold cursor-pointer h-10 border-zinc-800 text-emerald-400 hover:text-emerald-300"
          >
            Active ({contractors.filter(c => c.account_status === 'approved').length})
          </Button>
          <Button
            size="sm"
            onClick={() => setStatusFilter('pending')}
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            className="rounded-xl font-bold cursor-pointer h-10 border-zinc-800 text-amber-400 hover:text-amber-300"
          >
            Pending ({contractors.filter(c => c.account_status === 'pending').length})
          </Button>
          <Button
            size="sm"
            onClick={() => setStatusFilter('rejected')}
            variant={statusFilter === 'rejected' ? 'default' : 'outline'}
            className="rounded-xl font-bold cursor-pointer h-10 border-zinc-800 text-rose-400 hover:text-rose-300"
          >
            Rejected ({contractors.filter(c => c.account_status === 'rejected').length})
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-zinc-400">
            <Loader2 className="animate-spin mr-2" /> Loading directory...
          </div>
        ) : filteredContractors.length === 0 ? (
          <Card className="border border-zinc-800 bg-zinc-950/80 p-12 text-center rounded-3xl">
            <div className="text-center text-zinc-500">
              No contractors match the current filter or query criteria.
            </div>
          </Card>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-4">
              {filteredContractors.map((c) => (
                <Card key={c.id} className="border border-zinc-800 bg-zinc-950/80 p-5 rounded-3xl space-y-4 shadow-lg">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-black text-white text-base leading-snug">{c.full_name}</h4>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-1 font-medium">
                        <Calendar size={11} className="text-zinc-600" />
                        Reg: {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(c.account_status)}
                  </div>
                  
                  <div className="border-t border-zinc-900 pt-3 space-y-2.5 text-xs text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-zinc-500 shrink-0" />
                      <span className="font-mono">{c.mobile_number}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail size={12} className="text-zinc-500 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block border border-zinc-800 bg-zinc-950/80 shadow-xl rounded-3xl overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-zinc-900/30 border-b border-zinc-900">
                    <TableRow className="border-b border-zinc-900 hover:bg-transparent">
                      <TableHead className="py-4 font-bold text-zinc-400">Contractor Name</TableHead>
                      <TableHead className="py-4 font-bold text-zinc-400">Mobile No</TableHead>
                      <TableHead className="py-4 font-bold text-zinc-400">Email Address</TableHead>
                      <TableHead className="py-4 font-bold text-zinc-400">Registration Date</TableHead>
                      <TableHead className="py-4 font-bold text-zinc-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContractors.map((c) => (
                      <TableRow key={c.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/10">
                        <TableCell className="py-4 font-bold text-white">{c.full_name}</TableCell>
                        <TableCell className="py-4 font-mono text-zinc-300">
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-zinc-600" />
                            {c.mobile_number}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-zinc-300">
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-zinc-600" />
                            {c.email}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-zinc-600" />
                            {new Date(c.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">{getStatusBadge(c.account_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
