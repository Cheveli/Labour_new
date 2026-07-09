'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Settings, Save, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const DIM = '#6b7280'
const INPUT_ST = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.5rem' }

const DEFAULT_WORK_ITEMS = [
  'Cement', 'Steel', 'Bricks / Blocks', 'Sand', 'Coarse Aggregate (Metal)',
  'Fine Aggregate', 'Concrete Mix', 'Roof Height', 'Roof Design', 'Steel Quantity',
  'Water Supply', 'Walls', 'Doors', 'Windows', 'Painting', 'Flooring',
  'Staircase', 'Columns', 'Beams'
]

interface WorkItem {
  id: string
  name: string
}

export default function AgreementSettingsPage() {
  const [items, setItems] = useState<WorkItem[]>([])
  const [newItemName, setNewItemName] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('ssc_agreement_default_items')
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch (e) {
        loadDefaults()
      }
    } else {
      loadDefaults()
    }
  }, [])

  const loadDefaults = () => {
    const initialItems = DEFAULT_WORK_ITEMS.map((name, index) => ({
      id: `${index}-${Date.now()}-${Math.random()}`,
      name
    }))
    setItems(initialItems)
  }

  const handleSave = () => {
    localStorage.setItem('ssc_agreement_default_items', JSON.stringify(items))
    toast.success('Default agreement checklist saved successfully!')
  }

  const handleReset = () => {
    if (confirm('Reset checklist to standard 19 default items? Any custom items will be lost.')) {
      loadDefaults()
      toast.success('Reset to defaults')
    }
  }

  const addItem = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newItemName.trim()
    if (!trimmed) return
    const newItem = {
      id: `${Date.now()}-${Math.random()}`,
      name: trimmed
    }
    setItems([...items, newItem])
    setNewItemName('')
    toast.success(`"${trimmed}" added to defaults list`)
  }

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const updateItemName = (id: string, name: string) => {
    setItems(items.map(item => item.id === id ? { ...item, name } : item))
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const updated = [...items]
    const temp = updated[index]
    updated[index] = updated[index - 1]
    updated[index - 1] = temp
    setItems(updated)
  }

  const moveDown = (index: number) => {
    if (index === items.length - 1) return
    const updated = [...items]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    setItems(updated)
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-[#1e2435]"
            >
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <Settings size={22} className="text-purple-400" />
              Agreement Settings
            </h1>
          </div>
          <p className="text-sm mt-1 ml-11" style={{ color: DIM }}>
            Configure default work items list prefilled on new construction agreements.
          </p>
        </div>

        <div className="flex gap-2 ml-11 sm:ml-0">
          <button
            onClick={handleReset}
            className="h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Save size={14} /> Save Checklist
          </button>
        </div>
      </div>

      {/* Main Checklist Card */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2435]">
          <p className="text-xs font-black text-white uppercase tracking-wide">
            Agreement Items Checklist ({items.length})
          </p>
        </div>

        {/* Add Item form */}
        <form onSubmit={addItem} className="flex gap-2">
          <input
            type="text"
            placeholder="Add new checklist item (e.g. Waterproofing, False Ceiling)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1 h-11 px-3 text-xs font-semibold placeholder-zinc-600 outline-none focus:border-purple-500/50 transition-all"
            style={INPUT_ST}
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="h-11 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={14} /> Add
          </button>
        </form>

        {/* List of Items */}
        {items.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#1e2435] rounded-xl text-zinc-500 text-xs font-bold">
            No work items configured. Add one above or click Reset Defaults.
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0d1018] border border-[#1e2435] hover:border-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs font-black text-purple-400 w-6 text-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItemName(item.id, e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-purple-500/30 rounded px-1.5 py-1 min-w-0"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="p-2 rounded-lg text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === items.length - 1}
                    className="p-2 rounded-lg text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 rounded-lg text-red-500/10 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                    title="Delete Item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
