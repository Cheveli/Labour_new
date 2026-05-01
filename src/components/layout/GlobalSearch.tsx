'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, X, User, Briefcase, Package, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Result {
  type: 'worker' | 'project' | 'material'
  id: string
  title: string
  subtitle: string
  href: string
}

const ICON: Record<string, React.ReactNode> = {
  worker: <User size={13} className="text-blue-400" />,
  project: <Briefcase size={13} className="text-yellow-400" />,
  material: <Package size={13} className="text-green-400" />,
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(() => doSearch(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const doSearch = async (q: string) => {
    setLoading(true)
    const like = `%${q}%`
    const [{ data: workers }, { data: projects }, { data: materials }] = await Promise.all([
      supabase.from('labour').select('id,name,type').ilike('name', like).limit(5),
      supabase.from('projects').select('id,name,owner_name').ilike('name', like).limit(5),
      supabase.from('materials').select('id,name,projects(name)').ilike('name', like).limit(5),
    ])
    const res: Result[] = [
      ...(workers || []).map((w: any) => ({ type: 'worker' as const, id: w.id, title: w.name, subtitle: w.type, href: `/workers/${w.id}` })),
      ...(projects || []).map((p: any) => ({ type: 'project' as const, id: p.id, title: p.name, subtitle: p.owner_name || 'Project', href: '/projects' })),
      ...(materials || []).map((m: any) => ({ type: 'material' as const, id: m.id, title: m.name, subtitle: m.projects?.name || 'Material', href: '/materials' })),
    ]
    setResults(res)
    setLoading(false)
  }

  const handleSelect = (r: Result) => {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(r.href)
  }

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
        style={{ backgroundColor: '#111520', border: '1px solid #1e2435', color: '#6b7280' }}
        title="Search (Ctrl+K)"
      >
        <Search size={14} />
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden md:inline text-[9px] px-1.5 py-0.5 rounded font-black" style={{ backgroundColor: '#1a1f2e', color: '#6b7280' }}>⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#111520', border: '1px solid #1e2435' }} onClick={e => e.stopPropagation()}>
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#1e2435' }}>
              <Search size={16} style={{ color: '#6b7280' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search workers, projects, materials..."
                className="flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
              />
              {loading && <Loader2 size={14} className="animate-spin text-blue-400" />}
              <button onClick={() => setOpen(false)} style={{ color: '#6b7280' }}><X size={16} /></button>
            </div>

            {/* Results */}
            {results.length > 0 ? (
              <div className="py-2 max-h-80 overflow-y-auto">
                {results.map((r, i) => (
                  <button key={i} onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#1a1f2e' }}>{ICON[r.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{r.title}</p>
                      <p className="text-[10px] font-semibold truncate" style={{ color: '#6b7280' }}>{r.subtitle}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded" style={{ backgroundColor: '#1a1f2e', color: '#6b7280' }}>{r.type}</span>
                  </button>
                ))}
              </div>
            ) : query.trim() && !loading ? (
              <div className="px-4 py-8 text-center text-sm font-bold" style={{ color: '#6b7280' }}>No results for "{query}"</div>
            ) : !query && (
              <div className="px-4 py-6 text-center text-xs font-semibold" style={{ color: '#4b5563' }}>Type to search workers, projects, materials</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
