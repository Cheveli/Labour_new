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
import { Plus, Edit2, Trash2, Loader2, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export default function LabourTypesPage() {
  const [loading, setLoading] = useState(true)
  
  const fixedTypes = [
    { code: 'MISTRY', display_name: 'Mistry (Skilled)', default_rate: 1300, gender: 'Male' },
    { code: 'LABOUR_WOMEN', display_name: 'Labour (Women)', default_rate: 800, gender: 'Female' },
    { code: 'PARAKADU', display_name: 'Parakadu (Helper)', default_rate: 1000, gender: 'Male' },
  ]

  useEffect(() => {
    setLoading(false)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Labour Types</h1>
          <p className="mt-2 text-zinc-500 font-medium">Fixed labour types with default per-day salaries. These cannot be modified.</p>
        </div>
      </div>

      <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-zinc-800">
           <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Fixed Labour Types</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#0F172A]">
              <TableRow className="border-zinc-800 hover:bg-[#0F172A]">
                <TableHead className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Type Code</TableHead>
                <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Display Name</TableHead>
                <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Gender</TableHead>
                <TableHead className="py-6 uppercase text-[10px] font-black tracking-widest text-zinc-400">Default Salary/Day</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i} className="animate-pulse border-zinc-800">
                    <TableCell colSpan={4} className="h-16 px-8 bg-zinc-800/10"></TableCell>
                  </TableRow>
                ))
              ) : (
                fixedTypes.map((type, index) => (
                  <TableRow key={index} className="border-zinc-800 transition-colors hover:bg-white/5">
                    <TableCell className="px-8 py-5 font-black text-[#00A3FF] text-xs tracking-widest">{type.code}</TableCell>
                    <TableCell className="py-5 font-bold text-white text-sm">{type.display_name}</TableCell>
                    <TableCell className="py-5 font-bold text-zinc-400 text-sm">{type.gender}</TableCell>
                    <TableCell className="py-5 font-black text-gray-400 text-sm">₹ {type.default_rate.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 rounded-2xl p-6">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
          Note: These types cannot be modified. Default rates can be overridden during attendance/payment entry.
        </p>
      </Card>
    </div>
  )
}
