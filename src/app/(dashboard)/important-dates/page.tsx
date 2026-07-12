'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { CalendarDays, Plus, X as XIcon, Edit3, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ImportantDatesPage() {
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)

    const [items, setItems] = useState<any[]>([])
    const [editingItem, setEditingItem] = useState<any | null>(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        title: '',
        description: ''
    })

    const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))

    const monthDays = useMemo(() => {
        const start = startOfMonth(monthCursor)
        const end = endOfMonth(monthCursor)
        return eachDayOfInterval({ start, end })
    }, [monthCursor])

    const groupedByDay = useMemo(() => {
        const map = new Map<string, any[]>()
        for (const it of items) {
            const key = it.date
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(it)
        }
        return map
    }, [items])

    useEffect(() => {
        fetchItems()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function fetchItems() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('important_dates')
                .select('*')
                .order('date', { ascending: true })

            if (error) throw error
            setItems(data || [])
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load important dates')
        } finally {
            setLoading(false)
        }
    }

    const openAddModal = () => {
        setEditingItem(null)
        setForm({
            date: format(new Date(), 'yyyy-MM-dd'),
            title: '',
            description: ''
        })
        setModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this date?')) return
        try {
            const { error } = await supabase
                .from('important_dates')
                .delete()
                .eq('id', id)
            if (error) throw error
            toast.success('Important date removed')
            fetchItems()
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete')
        }
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!form.date || !form.title.trim()) {
            toast.error('Date and Title are required')
            return
        }

        setAdding(true)
        try {
            if (editingItem) {
                const { error } = await supabase
                    .from('important_dates')
                    .update({
                        date: form.date,
                        title: form.title.trim(),
                        description: form.description?.trim() || null
                    })
                    .eq('id', editingItem.id)
                if (error) throw error
                toast.success('Important date updated')
            } else {
                const {
                    data: { user }
                } = await supabase.auth.getUser()

                const payload = {
                    user_id: user?.id,
                    date: form.date,
                    title: form.title.trim(),
                    description: form.description?.trim() || null
                }

                const { error } = await supabase.from('important_dates').insert(payload)
                if (error) throw error

                toast.success('Important date saved')
            }
            setModalOpen(false)
            setEditingItem(null)
            await fetchItems()
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save')
        } finally {
            setAdding(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Important Dates</h1>
                    <p className="mt-1 text-sm text-zinc-500">Construction milestones & personal reminders</p>
                </div>
                <Button
                    onClick={openAddModal}
                    className="btn-construction rounded-xl font-black uppercase"
                    style={{ backgroundColor: '#3b82f6' }}
                >
                    <Plus size={16} className="mr-2" /> Add
                </Button>
            </div>

            <Card className="panel-elevated text-white rounded-2xl overflow-hidden">
                <CardHeader className="p-5 border-b border-zinc-800 flex items-center justify-between gap-4">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic flex items-center gap-2">
                        <CalendarDays size={14} /> Calendar view
                    </CardTitle>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMonthCursor(d => startOfMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1)))}
                            className="px-3 py-1.5 rounded-xl text-xs font-black uppercase"
                            style={{ backgroundColor: '#1a1f2e', color: '#e5e7eb', border: '1px solid #1e2435' }}
                        >
                            Prev
                        </button>
                        <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>
                            {format(monthCursor, 'MMMM yyyy')}
                        </div>
                        <button
                            type="button"
                            onClick={() => setMonthCursor(d => startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1)))}
                            className="px-3 py-1.5 rounded-xl text-xs font-black uppercase"
                            style={{ backgroundColor: '#1a1f2e', color: '#e5e7eb', border: '1px solid #1e2435' }}
                        >
                            Next
                        </button>
                    </div>
                </CardHeader>

                <CardContent className="p-5">
                    {loading ? (
                        <div className="text-zinc-500 text-sm font-bold">Loading…</div>
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="text-[10px] font-black uppercase tracking-widest text-zinc-600 text-center">
                                    {d}
                                </div>
                            ))}

                            {monthDays.map(day => {
                                const key = format(day, 'yyyy-MM-dd')
                                const list = groupedByDay.get(key) || []
                                const isToday = isSameDay(day, new Date())

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            setForm(f => ({ ...f, date: key }))
                                            setModalOpen(true)
                                        }}
                                        className={cn(
                                            'min-h-[44px] sm:min-h-[62px] rounded-xl border transition-all p-1.5 sm:p-2 text-left',
                                            isToday
                                                ? 'border-blue-500/60 bg-blue-500/10'
                                                : 'border-zinc-800 bg-[#0d1018]/40 hover:border-blue-500/40'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-1">
                                            <span className={cn('text-[10px] font-black uppercase tracking-widest', isToday ? 'text-blue-400' : 'text-zinc-500')}>
                                                {format(day, 'd')}
                                            </span>
                                            {list.length > 0 && (
                                                <span className="text-[8px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-400/10 border border-emerald-400/20 px-1 sm:px-2 rounded-full">
                                                    {list.length}
                                                </span>
                                            )}
                                        </div>
                                        {list.slice(0, 2).map((it: any) => (
                                            <div key={it.id} className="mt-1 text-[10px] font-bold text-zinc-200 truncate hidden sm:block">
                                                {it.title}
                                            </div>
                                        ))}
                                        {list.length > 2 && (
                                            <div className="mt-1 text-[9px] font-bold text-zinc-500 truncate hidden sm:block">+{list.length - 2} more</div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="panel-elevated text-white rounded-2xl overflow-hidden">
                <CardHeader className="p-5 border-b border-zinc-800">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">All saved entries</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                    {items.length === 0 ? (
                        <div className="text-zinc-600 text-sm font-bold">No entries yet. Add your first milestone or reminder.</div>
                    ) : (
                        <div className="space-y-3">
                            {items
                                .slice()
                                .sort((a, b) => (a.date > b.date ? -1 : 1))
                                .map((it: any) => (
                                    <div
                                        key={it.id}
                                        className="rounded-2xl border border-zinc-800 bg-[#0d1018] p-4 flex items-center justify-between gap-4"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-black uppercase tracking-widest text-blue-400">
                                                {format(new Date(it.date.replace(/-/g, '/')), 'dd MMM yyyy')}
                                            </div>
                                            <div className="text-base font-black text-white truncate">{it.title}</div>
                                            {it.description ? (
                                                <div className="text-sm text-zinc-400 mt-1 leading-relaxed">{it.description}</div>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(it)
                                                    setForm({
                                                        date: it.date,
                                                        title: it.title,
                                                        description: it.description || ''
                                                    })
                                                    setModalOpen(true)
                                                }}
                                                className="p-2 rounded-xl bg-[#1a1f2e] border border-[#1e2435] text-zinc-400 hover:text-white transition-all cursor-pointer text-xs flex items-center justify-center"
                                                title="Edit Date"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(it.id)}
                                                className="p-2 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 hover:text-red-300 transition-all cursor-pointer text-xs flex items-center justify-center"
                                                title="Delete Date"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent
                    style={{ backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem', color: '#f0f0f0' }}
                    className="w-full max-w-lg p-0 overflow-hidden"
                >
                    <div className="px-6 py-5 border-b border-[#1e2435] bg-[#0d1018]">
                        <DialogHeader>
                            <DialogTitle className="text-white text-base font-black uppercase tracking-wide">
                                {editingItem ? 'Edit Important Date' : 'Add Important Date'}
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <form onSubmit={handleAdd} className="p-6 space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Date</label>
                            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Title / Heading</label>
                            <Input placeholder="e.g. Slab Day" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-12 bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Description</label>
                            <Textarea
                                placeholder="Optional details (beam casting, site notes, personal reminder info...)"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                className="bg-zinc-900 border-zinc-800 rounded-xl font-bold text-white p-4 min-h-[120px]"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="flex-1 h-12 rounded-xl text-xs font-black uppercase"
                                style={{ backgroundColor: '#1a1f2e', color: '#6b7280', border: '1px solid #1e2435' }}
                            >
                                Cancel
                            </button>
                            <Button type="submit" disabled={adding} className="flex-1 h-12 rounded-xl font-black uppercase" style={{ backgroundColor: '#3b82f6' }}>
                                {adding ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Quick close icon hint (kept minimal; Dialog handles close) */}
            {false && (
                <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="fixed top-4 right-4 z-[100] p-2 rounded-xl bg-[#111520] border border-[#1e2435] text-zinc-400 hover:text-white"
                >
                    <XIcon size={16} />
                </button>
            )}
        </div>
    )
}

