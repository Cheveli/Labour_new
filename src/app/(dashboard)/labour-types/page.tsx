'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'

export default function LabourTypesPage() {
  const [loading] = useState(false)
  
  const fixedTypes = [
    { code: 'MISTRY', display_name: 'Mistry (Skilled)', default_rate: 1300, gender: 'Male' },
    { code: 'LABOUR_WOMEN', display_name: 'Labour (Women)', default_rate: 800, gender: 'Female' },
    { code: 'PARAKADU', display_name: 'Parakadu (Helper)', default_rate: 1000, gender: 'Male' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Labour Types</h1>
          <p className="mt-1 text-sm text-zinc-500">Fixed labour types with default per-day salaries. These cannot be modified.</p>
        </div>
      </div>

      <Card className="border-none shadow-2xl bg-[#111827] text-white rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-zinc-800">
           <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Fixed Labour Types</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block">
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
          </div>
          
          {/* Mobile Cards */}
          <div className="flex flex-col md:hidden">
            {fixedTypes.map((type, index) => (
              <div key={index} className="p-4 border-b border-zinc-800 last:border-0 hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white text-sm">{type.display_name}</p>
                    <p className="text-[#00A3FF] text-[10px] font-black tracking-widest uppercase mt-1">{type.code}</p>
                    <p className="text-zinc-400 font-bold text-xs mt-1">{type.gender}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 font-black text-sm">₹ {type.default_rate.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 rounded-2xl p-6">
        <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
          Note: These types cannot be modified. Default rates can be overridden during attendance/payment entry.
        </p>
      </Card>
    </div>
  )
}
