'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, CalendarCheck, Wallet, Package, TrendingUp, Briefcase, Zap, Loader2, Sparkles, Send, Search, Bot, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, differenceInCalendarMonths, addMonths } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalProjects: 0, totalRevenue: 0, totalLabourCost: 0, totalMaterialCost: 0, totalExtraWork: 0, totalPersonalExpenses: 0, netCash: 0 })
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsModalType, setDetailsModalType] = useState<string>('')
  const [detailsModalData, setDetailsModalData] = useState<any[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsPage, setDetailsPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectCosts, setProjectCosts] = useState<any[]>([])
  const [projectBreakdown, setProjectBreakdown] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [isInitialized, setIsInitialized] = useState(false)
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null)

  // AI Command & Chat states
  const [searchQuery, setSearchQuery] = useState('')
  const [modalQuery, setModalQuery] = useState('')
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const handleAISearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    const query = searchQuery
    setSearchQuery('')
    triggerAIChat(query)
  }

  const handleAIModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalQuery.trim()) return

    const query = modalQuery
    setModalQuery('')
    triggerAIChat(query, true)
  }

  const triggerAIChat = async (query: string, append = false) => {
    setAiModalOpen(true)
    setAiLoading(true)

    const userMessage = { role: 'user', content: query }
    const updatedMessages = append ? [...messages, userMessage] : [userMessage]
    setMessages(updatedMessages)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Failed to query AI')
      }

      const data = await res.json()
      setMessages([...updatedMessages, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      console.error(err)
      toast.error('AI Assistant is currently offline or rate-limited.')
      setMessages([...updatedMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please verify your NVIDIA API key in environment variables or try again later.' }])
    } finally {
      setAiLoading(false)
    }
  }

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (aiModalOpen) {
      scrollToBottom()
      const t1 = setTimeout(scrollToBottom, 50)
      const t2 = setTimeout(scrollToBottom, 150)
      const t3 = setTimeout(scrollToBottom, 300)
      const t4 = setTimeout(scrollToBottom, 500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
        clearTimeout(t4)
      }
    }
  }, [messages, aiLoading, aiModalOpen])

  async function fetchStats() {
    try {
      setLoading(true)
      // 1. Fetch Projects List (always needed for the filter)
      const { data: projList } = await supabase.from('projects').select('id, name, status, created_at').order('name')
      setProjects(projList || [])

      // Handle Default Project from localStorage
      const savedDefault = localStorage.getItem('ssc_default_project_id')
      const savedActive = localStorage.getItem('ssc_active_project_id')
      setDefaultProjectId(savedDefault)

      const currentProjectId = selectedProjectId === 'all' ? '' : selectedProjectId

      // 2. Prepare queries with optional project filter
      let incomeQ = supabase.from('income').select('amount, date, project_id')
      let attQ = supabase.from('attendance').select('date, days_worked, custom_rate, overtime_amount, project_id, labour(daily_rate)')
      let matQ = supabase.from('materials').select('total_amount, date, project_id')
      let subQ = supabase.from('contractor_payments').select('*')
      let peQ = supabase.from('personal_expenses').select('amount, date')

      if (currentProjectId) {
        incomeQ = incomeQ.eq('project_id', currentProjectId)
        attQ = attQ.eq('project_id', currentProjectId)
        matQ = matQ.eq('project_id', currentProjectId)
      }

      const [incomeRes, attRes, matRes, subRes, peRes] = await Promise.all([
        incomeQ,
        attQ,
        matQ,
        subQ,
        peQ
      ])

      const incomeData = incomeRes.data
      const attAllData = attRes.data
      const materialData = matRes.data
      const contractorPaymentsData = subRes.data || []
      const personalExpensesData = peRes.data || []

      // Extract subcontractor work entries (based on actual payment installments)
      const subWorkEntries: any[] = []
      contractorPaymentsData.forEach((sub: any) => {
        let parsedNotes = { description: '', project_id: '', project_name: '' }
        try {
          if (sub.notes && (sub.notes.startsWith('{') || sub.notes.startsWith('['))) {
            parsedNotes = JSON.parse(sub.notes)
          } else {
            parsedNotes = {
              description: sub.notes || '',
              project_id: '',
              project_name: ''
            }
          }
        } catch (e) {
          parsedNotes = {
            description: sub.notes || '',
            project_id: '',
            project_name: ''
          }
        }

        let installments = sub.installments || []
        const sumInstallments = installments.reduce((sum: number, inst: any) => sum + Number(inst.amount || 0), 0)

        // Inject legacy balance payment if total_amount is greater than recorded installments
        if (sub.total_amount > sumInstallments) {
          const diff = sub.total_amount - sumInstallments
          installments = [
            {
              amount: diff,
              date: sub.date || format(new Date(sub.created_at), 'yyyy-MM-dd'),
              receipt_number: 1,
              site_project: parsedNotes.project_name || 'Legacy Project',
              notes: 'Legacy Balance / Migrated Payout'
            },
            ...installments.map((inst: any, idx: number) => ({ ...inst, receipt_number: idx + 2 }))
          ]
        }

        installments.forEach((inst: any) => {
          const matchedProj = projList?.find(p => p.name === inst.site_project)
          const projId = matchedProj ? matchedProj.id : parsedNotes.project_id

          subWorkEntries.push({
            id: `${sub.id}-${inst.receipt_number}`,
            work_name: `Payment #${inst.receipt_number}`,
            amount: inst.amount,
            date: inst.date,
            notes: inst.notes || '',
            project_id: projId,
            project_name: inst.site_project || parsedNotes.project_name || '-',
            subcontractor_name: sub.name,
            subcontractor_id: sub.id,
            work_nature: sub.work_nature
          })
        })
      })

      // Filter work entries by selected project ID if any
      const filteredWorkEntries = currentProjectId
        ? subWorkEntries.filter((entry: any) => entry.project_id === currentProjectId)
        : subWorkEntries

      const totalRevenue = incomeData?.reduce((a, c) => a + Number(c.amount), 0) || 0
      const totalLabourCost = attAllData?.reduce((a, c) => {
        const l: any = c.labour
        const rate = c.custom_rate || (Array.isArray(l) ? l[0]?.daily_rate : l?.daily_rate) || 0
        return a + (Number(c.days_worked) * Number(rate)) + Number(c.overtime_amount || 0)
      }, 0) || 0
      const totalMaterialCost = materialData?.reduce((a, c) => a + Number(c.total_amount || 0), 0) || 0
      const totalExtraWork = filteredWorkEntries.reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
      const totalPersonalExpenses = personalExpensesData.reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0)
      const netCash = totalRevenue - (totalLabourCost + totalMaterialCost + totalExtraWork + totalPersonalExpenses)

      setStats({
        totalProjects: (selectedProjectId && selectedProjectId !== 'all') ? 1 : (projList?.length || 0),
        totalRevenue,
        totalLabourCost,
        totalMaterialCost,
        totalExtraWork,
        totalPersonalExpenses,
        netCash
      })

      // Build dynamic monthly data based on project creation/transaction dates
      const today = new Date()
      // Default fallback: last 6 months
      let startDateForGraph = startOfMonth(subMonths(today, 5))

      // Gather all transaction dates to find earliest transaction date
      const allTxDates = [
        ...(incomeData || []).map(r => r.date),
        ...(attAllData || []).map(r => r.date),
        ...(materialData || []).map(r => r.date),
        ...filteredWorkEntries.map((r: any) => r.date),
        ...personalExpensesData.map((r: any) => r.date),
      ].filter(Boolean)

      let earliestTxDate: Date | null = null
      if (allTxDates.length > 0) {
        const sortedTxDates = allTxDates
          .map(d => new Date(d))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime())
        if (sortedTxDates.length > 0) {
          earliestTxDate = sortedTxDates[0]
        }
      }

      if (projList && projList.length > 0) {
        if (currentProjectId) {
          // Fetch from specific selected project creation date compared with its earliest transaction
          const selectedProj = projList.find(p => p.id === currentProjectId)
          let projDate = selectedProj?.created_at ? new Date(selectedProj.created_at) : null

          let dates = [projDate, earliestTxDate].filter((d): d is Date => d !== null)
          if (dates.length > 0) {
            startDateForGraph = startOfMonth(new Date(Math.min(...dates.map(d => d.getTime()))))
          }
        } else {
          // Fetch from the earliest project creation date among all projects compared with earliest overall transaction
          const validProjDates = projList
            .filter(p => p.created_at)
            .map(p => new Date(p.created_at))

          let dates = [...validProjDates, earliestTxDate].filter((d): d is Date => d !== null)
          if (dates.length > 0) {
            startDateForGraph = startOfMonth(new Date(Math.min(...dates.map(d => d.getTime()))))
          }
        }
      }

      // Safeguard: Limit the graph timeline to a maximum of 12 months history
      const maxHistoricalDate = startOfMonth(subMonths(today, 11))
      if (startDateForGraph < maxHistoricalDate) {
        startDateForGraph = maxHistoricalDate
      }

      // Safeguard: If start date is in the future compared to current month start, cap it at current month
      const currentMonthStart = startOfMonth(today)
      if (startDateForGraph > currentMonthStart) {
        startDateForGraph = currentMonthStart
      }

      // Always show at least 6 months starting from startDateForGraph
      const totalMonthsToShow = Math.max(6, differenceInCalendarMonths(today, startDateForGraph) + 1)

      const months = Array.from({ length: totalMonthsToShow }, (_, i) => {
        const d = addMonths(startDateForGraph, i)
        return {
          key: format(d, 'yyyy-MM'),
          label: format(d, 'MMM'),
          start: format(startOfMonth(d), 'yyyy-MM-dd'),
          end: format(endOfMonth(d), 'yyyy-MM-dd')
        }
      })

      const monthly = months.map(m => ({
        month: m.label,
        Revenue: incomeData?.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.amount), 0) || 0,
        Labour: attAllData?.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => {
          const l: any = c.labour
          const rate = c.custom_rate || (Array.isArray(l) ? l[0]?.daily_rate : l?.daily_rate) || 0
          return a + (Number(c.days_worked) * Number(rate)) + Number(c.overtime_amount || 0)
        }, 0) || 0,
        Material: materialData?.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.total_amount || 0), 0) || 0,
        ExtraWork: filteredWorkEntries.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.amount || 0), 0) || 0,
        PersonalExpenses: personalExpensesData.filter(r => r.date >= m.start && r.date <= m.end).reduce((a, c) => a + Number(c.amount || 0), 0) || 0,
      }))
      setMonthlyData(monthly)

      // Expense Distribution
      setProjectCosts([
        { name: 'Labour', value: totalLabourCost },
        { name: 'Material', value: totalMaterialCost },
        { name: 'Subcontracts', value: totalExtraWork },
        { name: 'Personal Expenses', value: totalPersonalExpenses }
      ].filter(c => c.value > 0))

      // Project-wise breakdown
      const breakdown = (projList || [])
        .filter(p => !selectedProjectId || selectedProjectId === 'all' || p.id === selectedProjectId)
        .map(p => {
          const rev = (incomeData || []).filter(r => r.project_id === p.id).reduce((s, r) => s + Number(r.amount), 0)
          const mat = (materialData || []).filter(r => r.project_id === p.id).reduce((s, r) => s + Number(r.total_amount || 0), 0)
          const ew = subWorkEntries.filter(r => r.project_id === p.id).reduce((s, r) => s + Number(r.amount || 0), 0)
          const lab = (attAllData || [])
            .filter(r => r.project_id === p.id)
            .reduce((s, c) => {
              const l: any = c.labour
              const rate = c.custom_rate || (Array.isArray(l) ? l[0]?.daily_rate : l?.daily_rate) || 0
              return s + (Number(c.days_worked) * Number(rate)) + Number(c.overtime_amount || 0)
            }, 0) || 0

          const isCheveli = p.name.toLowerCase().includes('cheveli') || p.name.toLowerCase().includes('chevelly')
          const isOnlyProject = projList?.length === 1
          const personalCost = (isCheveli || isOnlyProject) ? totalPersonalExpenses : 0

          return { 
            name: p.name, 
            status: p.status, 
            revenue: rev, 
            labour: lab, 
            material: mat, 
            extraWork: ew, 
            personal: personalCost, 
            net: rev - lab - mat - ew - personalCost 
          }
        }).filter(p => p.revenue > 0 || p.labour > 0 || p.material > 0 || p.extraWork > 0 || p.personal > 0)

      setProjectBreakdown(breakdown)

      // Recent Activities — last 5 across income, materials, subWorkEntries
      const [incRecent, matRecent] = await Promise.all([
        supabase.from('income').select('id, date, amount, notes, projects(name)').order('date', { ascending: false }).limit(5),
        supabase.from('materials').select('id, date, total_amount, name, projects(name)').order('date', { ascending: false }).limit(5),
      ])
      const sortedSubEntries = [...subWorkEntries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
      const combined = [
        ...(incRecent.data || []).map((r: any) => ({ date: r.date, label: r.notes || 'Revenue', sub: r.projects?.name || '—', amount: Number(r.amount), type: 'revenue' as const })),
        ...(matRecent.data || []).map((r: any) => ({ date: r.date, label: r.name, sub: r.projects?.name || '—', amount: Number(r.total_amount || 0), type: 'material' as const })),
        ...sortedSubEntries.map((r: any) => ({ date: r.date, label: `${r.subcontractor_name} - ${r.work_name}`, sub: r.project_name || '—', amount: Number(r.amount || 0), type: 'extra' as const })),
      ]
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setRecentActivities(combined.slice(0, 5))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    if (!isInitialized) return
    fetchStats()

    // Always save the overview selection
    localStorage.setItem('ssc_overview_selection', selectedProjectId)

    // Only update ssc_active_project_id if a specific project is selected
    if (selectedProjectId && selectedProjectId !== 'all') {
      localStorage.setItem('ssc_active_project_id', selectedProjectId)
    }

    window.dispatchEvent(new Event('ssc_project_changed'))
  }, [selectedProjectId, isInitialized])

  // Mount useEffect to read saved state on load
  useEffect(() => {
    const savedOverview = localStorage.getItem('ssc_overview_selection')
    const savedActive = localStorage.getItem('ssc_active_project_id')
    const savedDefault = localStorage.getItem('ssc_default_project_id')
    if (savedOverview) {
      setSelectedProjectId(savedOverview)
    } else if (savedActive) {
      setSelectedProjectId(savedActive)
    } else if (savedDefault) {
      setSelectedProjectId(savedDefault)
    } else {
      setSelectedProjectId('all')
    }
    setIsInitialized(true)
  }, [])

  // Reload page stats when a material entry is successfully added globally
  useEffect(() => {
    const handleProjectChangedGlobal = () => {
      fetchStats()
    }
    window.addEventListener('ssc_project_changed', handleProjectChangedGlobal)
    return () => {
      window.removeEventListener('ssc_project_changed', handleProjectChangedGlobal)
    }
  }, [selectedProjectId])

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
  const GOLD = '#3b82f6'
  const DIM = '#6b7280'
  const EXPENSE_COLORS: Record<string, string> = {
    'Labour': '#3b82f6',     // Blue
    'Material': '#06b6d4',   // Cyan
    'Extra Work': '#f97316', // Orange
    'Subcontracts': '#f97316', // Orange
    'Contractor': '#8b5cf6',  // Purple
    'Personal Expenses': '#f43f5e' // Rose
  }
  const tooltipStyle = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '8px', color: '#f0f0f0', fontSize: 12 }

  const topCards = [
    { type: 'REVENUE', label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, icon: <TrendingUp size={18} color="#10b981" />, bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', clickable: true },
    { type: 'LABOUR', label: 'Labour Cost', value: `₹${stats.totalLabourCost.toLocaleString('en-IN')}`, icon: <Wallet size={18} color="#3b82f6" />, bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', clickable: true },
    { type: 'MATERIAL', label: 'Material Cost', value: `₹${stats.totalMaterialCost.toLocaleString('en-IN')}`, icon: <Package size={18} color="#06b6d4" />, bg: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', clickable: true },
    { type: 'EXTRA_WORK', label: 'Subcontracts', value: `₹${stats.totalExtraWork.toLocaleString('en-IN')}`, icon: <Zap size={18} color="#f97316" />, bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316', clickable: true },
    { type: 'PERSONAL_EXPENSE', label: 'Personal Expenses', value: `₹${stats.totalPersonalExpenses.toLocaleString('en-IN')}`, icon: <DollarSign size={18} color="#f43f5e" />, bg: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', clickable: true },
    { type: 'NET_CASH', label: 'Net Cash', value: `₹${stats.netCash.toLocaleString('en-IN')}`, icon: <TrendingUp size={18} color={stats.netCash >= 0 ? '#10b981' : '#ef4444'} />, bg: stats.netCash >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: stats.netCash >= 0 ? '#10b981' : '#ef4444', clickable: false },
  ]

  const fetchDetailsData = async (type: string, filterStart?: string, filterEnd?: string) => {
    setDetailsLoading(true)
    try {
      let q: any
      if (type === 'REVENUE') {
        q = supabase.from('income').select('date, amount, notes, projects(name)').order('date', { ascending: true })
      } else if (type === 'LABOUR') {
        q = supabase.from('attendance').select('date, days_worked, custom_rate, overtime_amount, labour(name, daily_rate), projects(name)').order('date', { ascending: true })
      } else if (type === 'MATERIAL') {
        q = supabase.from('materials').select('date, total_amount, name, quantity, unit, notes, projects(name)').order('date', { ascending: true })
      } else if (type === 'PERSONAL_EXPENSE') {
        q = supabase.from('personal_expenses').select('date, amount, person_name, purpose').order('date', { ascending: true })
      } else if (type === 'EXTRA_WORK') {
        // Handled in memory
      }

      let data: any[] = []
      if (type === 'EXTRA_WORK') {
        const { data: subDataRaw } = await supabase.from('contractor_payments').select('*')
        const subWorkEntries: any[] = []
        subDataRaw?.forEach((sub: any) => {
          let parsedNotes = { description: '', project_id: '', project_name: '' }
          try {
            if (sub.notes && (sub.notes.startsWith('{') || sub.notes.startsWith('['))) {
              parsedNotes = JSON.parse(sub.notes)
            } else {
              parsedNotes = {
                description: sub.notes || '',
                project_id: '',
                project_name: ''
              }
            }
          } catch (e) {
            parsedNotes = {
              description: sub.notes || '',
              project_id: '',
              project_name: ''
            }
          }

          let installments = sub.installments || []
          const sumInstallments = installments.reduce((sum: number, inst: any) => sum + Number(inst.amount || 0), 0)

          if (sub.total_amount > sumInstallments) {
            const diff = sub.total_amount - sumInstallments
            installments = [
              {
                amount: diff,
                date: sub.date || format(new Date(sub.created_at), 'yyyy-MM-dd'),
                receipt_number: 1,
                site_project: parsedNotes.project_name || 'Legacy Project',
                notes: 'Legacy Balance / Migrated Payout'
              },
              ...installments.map((inst: any, idx: number) => ({ ...inst, receipt_number: idx + 2 }))
            ]
          }

          installments.forEach((inst: any) => {
            const matchedProj = projects.find(p => p.name === inst.site_project)
            const projId = matchedProj ? matchedProj.id : parsedNotes.project_id
            const projName = matchedProj ? matchedProj.name : (inst.site_project || parsedNotes.project_name || '-')

            subWorkEntries.push({
              id: `${sub.id}-${inst.receipt_number}`,
              work_name: `Payment #${inst.receipt_number}`,
              amount: inst.amount,
              date: inst.date,
              notes: inst.notes || '',
              project_id: projId,
              project_name: projName,
              subcontractor_name: sub.name,
              subcontractor_id: sub.id,
              work_nature: sub.work_nature
            })
          })
        })

        const currentProjectId = selectedProjectId === 'all' ? '' : selectedProjectId
        const filtered = currentProjectId
          ? subWorkEntries.filter((entry: any) => entry.project_id === currentProjectId)
          : subWorkEntries

        data = filtered.map((e: any) => ({
          date: e.date,
          amount: e.amount,
          work_name: `${e.subcontractor_name} - ${e.work_name}`,
          notes: e.notes || '',
          projects: { name: e.project_name || '-' }
        }))
        if (filterStart) data = data.filter((e: any) => e.date >= filterStart)
        if (filterEnd) data = data.filter((e: any) => e.date <= filterEnd)
      } else if (type === 'PERSONAL_EXPENSE') {
        const res = await q
        data = (res.data || []).map((e: any) => ({
          date: e.date,
          amount: e.amount,
          work_name: `${e.person_name} - ${e.purpose}`,
          notes: '',
          projects: { name: 'Personal' }
        }))
        if (filterStart) data = data.filter((e: any) => e.date >= filterStart)
        if (filterEnd) data = data.filter((e: any) => e.date <= filterEnd)
      } else {
        if (selectedProjectId && selectedProjectId !== 'all') q = q.eq('project_id', selectedProjectId)
        if (filterStart) q = q.gte('date', filterStart)
        if (filterEnd) q = q.lte('date', filterEnd)
        const res = await q
        data = res.data || []
      }
      setDetailsModalData(data)
      setDetailsPage(0)
    } catch (err) { console.error(err) } finally { setDetailsLoading(false) }
  }

  const handleCardClick = async (type: string) => {
    if (!['REVENUE', 'LABOUR', 'MATERIAL', 'EXTRA_WORK', 'PERSONAL_EXPENSE'].includes(type)) return
    setDetailsModalType(type)
    setDetailsModalOpen(true)
    setDetailsModalData([])
    fetchDetailsData(type)
  }

  const handleSetDefault = () => {
    if (!selectedProjectId || selectedProjectId === 'all') {
      localStorage.removeItem('ssc_default_project_id')
      setDefaultProjectId(null)
      toast.success('Default project cleared')
    } else {
      localStorage.setItem('ssc_default_project_id', selectedProjectId)
      setDefaultProjectId(selectedProjectId)
      toast.success('Project set as default')
    }
  }

  return (
    <div className="space-y-5 pb-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: DIM }}>{(selectedProjectId && selectedProjectId !== 'all') ? `Financial details for ${projects.find(p => p.id === selectedProjectId)?.name}` : 'Financial summary across all active sites.'}</p>
        </div>
        <div className="flex flex-row items-center gap-2 flex-wrap">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            suppressHydrationWarning
            className="h-10 px-4 rounded-xl text-xs font-bold bg-[#111520] border border-[#1e2435] text-white outline-none focus:border-blue-500 transition-all min-w-[150px]"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selectedProjectId !== 'all' && selectedProjectId !== defaultProjectId && (
            <button
              onClick={handleSetDefault}
              className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 whitespace-nowrap"
            >
              <Zap size={12} /> Set as Default
            </button>
          )}

          {selectedProjectId !== 'all' && selectedProjectId === defaultProjectId && selectedProjectId !== '' && (
            <div className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
              <Zap size={12} className="fill-blue-400" /> Default Project
            </div>
          )}
        </div>
      </div>

      {/* Premium AI Command Center Search Bar */}
      <div
        className="p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden"
        style={{
          backgroundColor: '#111520',
          borderColor: '#1e2435',
          background: 'linear-gradient(135deg, #111520 0%, #151a28 100%)'
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          {/* Label row */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400 shrink-0">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AI Assistant — Ask anything about your site</span>
          </div>
          {/* Search row */}
          <form onSubmit={handleAISearchSubmit} className="flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Ask about worker salaries, material costs, site P&L..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                suppressHydrationWarning
                className="w-full h-11 pl-10 pr-3 bg-black/30 border border-[#1e2435] rounded-xl text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>
            <button
              type="submit"
              suppressHydrationWarning
              className="h-11 px-4 sm:px-5 rounded-xl text-xs font-black uppercase tracking-wider text-white hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              style={{ background: 'linear-gradient(90deg,#3b82f6,#2563eb)' }}
            >
              <Send className="w-3.5 h-3.5" /><span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>
      </div>

      {/* Top Cards — mobile layout vs desktop layout */}
      {/* Mobile layout */}
      <div className="block lg:hidden">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {topCards.slice(0, 5).map((c, i) => (
            <div
              key={i}
              style={PANEL}
              className={`p-4 ${c.clickable ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''} ${i === 4 ? 'col-span-2' : ''}`}
              onClick={() => c.clickable && handleCardClick(c.type)}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: DIM }}>{c.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>{c.icon}</div>
              </div>
              <p className="text-xl font-black" style={{ color: c.color }}>{loading ? '—' : c.value}</p>
              {c.clickable && <p className="text-[7px] font-bold uppercase tracking-widest mt-1" style={{ color: DIM }}>Click for full history</p>}
            </div>
          ))}
        </div>
        {/* Net Cash — full width */}
        {topCards[5] && (
          <div
            style={PANEL}
            className="p-5 cursor-default"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: DIM }}>{topCards[5].label}</p>
                <p className="text-3xl font-black" style={{ color: topCards[5].color }}>{loading ? '—' : topCards[5].value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: topCards[5].bg }}>{topCards[5].icon}</div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop layout — 4-col grid layout (6 cards + Pie Chart) */}
      <div className="hidden lg:grid grid-cols-4 gap-4">
        {topCards.slice(0, 5).map((c, i) => (
          <div
            key={i}
            style={PANEL}
            className={`p-5 ${c.clickable ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
            onClick={() => c.clickable && handleCardClick(c.type)}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: DIM }}>{c.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>{c.icon}</div>
            </div>
            <p className="text-2xl font-black" style={{ color: c.color }}>{loading ? '—' : c.value}</p>
            {c.clickable && <p className="text-[8px] font-bold uppercase tracking-widest mt-2" style={{ color: DIM }}>Click for full history</p>}
          </div>
        ))}

        {/* Net Cash — spans 2 columns in the second row */}
        {topCards[5] && (
          <div
            style={PANEL}
            className="p-5 cursor-default col-span-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: DIM }}>{topCards[5].label}</p>
                <p className="text-3xl font-black" style={{ color: topCards[5].color }}>{loading ? '—' : topCards[5].value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: topCards[5].bg }}>{topCards[5].icon}</div>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-widest mt-2" style={{ color: DIM }}>Overall Balance</p>
          </div>
        )}

        {/* Pie Chart — same compact size as stat cards */}
        <div style={PANEL} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: DIM }}>Expense Split</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#a855f7" strokeWidth="1.5" /><path d="M7 7 L7 1 A6 6 0 0 1 13 7 Z" fill="#a855f7" opacity="0.7" /></svg>
            </div>
          </div>
          {projectCosts.length === 0 ? (
            <p className="text-2xl font-black" style={{ color: DIM }}>—</p>
          ) : (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={64} height={64}>
                <PieChart>
                  <Pie data={projectCosts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={30} innerRadius={14} paddingAngle={2} isAnimationActive={false}>
                    {projectCosts.map((c) => <Cell key={c.name} fill={EXPENSE_COLORS[c.name] || GOLD} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Cost']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1">
                {projectCosts.map((c) => (
                  <div key={c.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[c.name] || GOLD }} />
                    <span className="text-[9px] font-bold text-zinc-400 truncate">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[8px] font-bold uppercase tracking-widest mt-2" style={{ color: DIM }}>Cost distribution</p>
        </div>
      </div>

      {/* Charts Row: Bar Graph (left) + Recent Activities (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Labour vs Material vs Subcontracts */}
        <div style={PANEL} className="p-5 lg:col-span-2">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Labour vs Material vs Subcontracts (Monthly)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2435" />
              <XAxis dataKey="month" tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DIM, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString('en-IN')}`, name]} cursor={{ fill: 'transparent' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: DIM }} />
              <Bar dataKey="Labour" fill={EXPENSE_COLORS['Labour']} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Material" fill={EXPENSE_COLORS['Material']} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="ExtraWork" name="Subcontracts" fill={EXPENSE_COLORS['Subcontracts']} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="PersonalExpenses" name="Personal Expenses" fill={EXPENSE_COLORS['Personal Expenses']} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activities (replaces Pie in charts row, desktop only) */}
        <div style={PANEL} className="p-5 flex flex-col">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: DIM }}>Recent Activities</p>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-500" size={20} />
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="text-xs text-zinc-600 font-bold">No activity yet</p>
          ) : (
            <div className="flex flex-col gap-3 flex-1">
              {recentActivities.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${a.type === 'revenue' ? 'bg-emerald-500/10' :
                    a.type === 'material' ? 'bg-cyan-500/10' : 'bg-orange-500/10'
                    }`}>
                    {a.type === 'revenue' ? <TrendingUp size={13} className="text-emerald-400" /> :
                      a.type === 'material' ? <Package size={13} className="text-cyan-400" /> :
                        <Zap size={13} className="text-orange-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{a.label}</p>
                    <p className="text-[9px] text-zinc-500 truncate">{a.sub} · {format(new Date(a.date), 'dd MMM')}</p>
                  </div>
                  <p className={`text-xs font-black shrink-0 ${a.type === 'revenue' ? 'text-emerald-400' : 'text-zinc-300'
                    }`}>
                    {a.type === 'revenue' ? '+' : '−'}₹{a.amount.toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile — Pie Chart shown below bar chart on small screens */}
        <div style={PANEL} className="p-5 lg:hidden">
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: DIM }}>Expense Distribution</p>
          {projectCosts.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-xs" style={{ color: DIM }}>No expenses yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={projectCosts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={0} paddingAngle={2} isAnimationActive={false}>
                  {projectCosts.map((c) => <Cell key={c.name} fill={EXPENSE_COLORS[c.name] || GOLD} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Cost']} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: DIM }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={PANEL} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Quick Actions</p>
        </div>

        {/* Prominent Full-Width Green Gradient Button for Quick Material Entry Modal */}
        <button
          onClick={() => window.dispatchEvent(new Event('ssc_open_quick_material'))}
          suppressHydrationWarning
          className="flex items-center justify-center gap-2 w-full px-4 py-3.5 mb-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-95 active:scale-[0.99] cursor-pointer"
          style={{ background: 'linear-gradient(90deg,#22c55e,#15803d)', boxShadow: '0 4px 14px rgba(34,197,94,0.3)' }}
        >
          <Zap size={16} className="text-white fill-white animate-pulse" />
          <span>Quick Material Entry / వేగవంతమైన మెటీరియల్ నమోదు</span>
        </button>

        {/* Mobile layout: Create Payment full-width hero, others 2x2 */}
        <div className="block md:hidden space-y-2">
          <Link href="/payments"
            className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl text-sm font-black text-white transition-all"
            style={{ background: 'linear-gradient(90deg,#3b82f6,#2563eb)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
          >
            <Wallet size={16} /> Create Payment
          </Link>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/labour', label: 'Add Worker', icon: <Users size={14} /> },
              { href: '/attendance', label: 'Mark Attendance', icon: <CalendarCheck size={14} /> },
              { href: '/materials', label: 'Add Material', icon: <Package size={14} /> },
              { href: '/income', label: 'Record Revenue', icon: <TrendingUp size={14} /> },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all"
                style={{ backgroundColor: '#1a1f2e' }}
              >
                <span style={{ color: GOLD }}>{a.icon}</span>{a.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop layout: all 5 in a row */}
        <div className="hidden md:grid grid-cols-5 gap-2">
          {[
            { href: '/labour', label: 'Add Worker', icon: <Users size={14} /> },
            { href: '/attendance', label: 'Mark Attendance', icon: <CalendarCheck size={14} /> },
            { href: '/materials', label: 'Add Material', icon: <Package size={14} /> },
            { href: '/payments', label: 'Create Payment', icon: <Wallet size={14} /> },
            { href: '/income', label: 'Record Revenue', icon: <TrendingUp size={14} /> },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all"
              style={{ backgroundColor: '#1a1f2e' }}
            >
              <span style={{ color: GOLD }}>{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Project-Wise Breakdown */}
      {projectBreakdown.length > 0 && (
        <div style={PANEL} className="overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: '#1e2435' }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>Project-Wise Breakdown</p>
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#0d1018' }}>
                <tr style={{ borderBottom: '1px solid #1e2435' }}>
                  {['Project', 'Revenue', 'Labour', 'Material', 'Subcontracts', 'Personal', 'Net P&L'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: DIM }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectBreakdown.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1e2435' }} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-bold text-white">{p.name}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#22c55e' }}>₹{p.revenue.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#3b82f6' }}>₹{p.labour.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#60a5fa' }}>₹{p.material.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#f59e0b' }}>₹{p.extraWork.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 font-bold" style={{ color: '#f43f5e' }}>₹{p.personal.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 font-black" style={{ color: p.net >= 0 ? '#22c55e' : '#ef4444' }}>
                      {p.net < 0 ? `-₹${Math.abs(p.net).toLocaleString('en-IN')}` : `₹${p.net.toLocaleString('en-IN')}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-[#1e2435]">
            {projectBreakdown.map((p, i) => (
              <div key={i} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-white">{p.name}</p>
                  <p className="text-sm font-black" style={{ color: p.net >= 0 ? '#22c55e' : '#ef4444' }}>
                    {p.net < 0 ? `-₹${Math.abs(p.net).toLocaleString('en-IN')}` : `₹${p.net.toLocaleString('en-IN')}`}
                  </p>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  <div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Revenue</p>
                    <p className="text-[10px] font-bold text-[#22c55e]">₹{p.revenue.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Labour</p>
                    <p className="text-[10px] font-bold text-[#3b82f6]">₹{p.labour.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Material</p>
                    <p className="text-[10px] font-bold text-[#60a5fa]">₹{p.material.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Subcontracts</p>
                    <p className="text-[10px] font-bold text-[#f59e0b]">₹{p.extraWork.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-zinc-500 mb-1">Personal</p>
                    <p className="text-[10px] font-bold text-[#f43f5e]">₹{p.personal.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent
          style={{
            backgroundColor: '#111520',
            border: '1px solid #1e2435',
            color: '#f0f0f0',
            borderRadius: '1.25rem',
            width: 'min(90vw, 960px)',
            maxWidth: 'min(90vw, 960px)',
          }}
          className="max-h-[90vh] h-[90vh] flex flex-col p-0 overflow-hidden gap-0"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#1e2435] bg-[#0d1018] flex items-center justify-between shrink-0">
            <div>
              <DialogTitle className="text-white text-base font-black uppercase tracking-wide">
                {detailsModalType === 'REVENUE' ? '📈 Total Revenue' : detailsModalType === 'LABOUR' ? '💼 Labour Cost' : detailsModalType === 'MATERIAL' ? '📦 Material Cost' : '⚡ Subcontracts'} — Full History
              </DialogTitle>
              <DialogDescription className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                {detailsModalData.length} records found · All time
              </DialogDescription>
            </div>
            <div className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                {detailsModalData.length} Total Entries
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {detailsLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" style={{ color: '#3b82f6' }} size={32} /></div>
            ) : detailsModalData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: '#6b7280' }}>
                <p className="font-bold text-sm">No records found</p>
              </div>
            ) : (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '120px' }} />
                  <col />
                  {detailsModalType === 'MATERIAL' && <col style={{ width: '90px' }} />}
                  <col style={{ width: '130px' }} />
                </colgroup>
                <TableHeader style={{ backgroundColor: '#0d1018', position: 'sticky', top: 0, zIndex: 10 }}>
                  <TableRow style={{ borderColor: '#1e2435' }}>
                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Date</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>
                      {detailsModalType === 'REVENUE' ? 'Source / Project' : detailsModalType === 'LABOUR' ? 'Worker / Project' : detailsModalType === 'MATERIAL' ? 'Material / Project' : 'Subcontract / Project'}
                    </TableHead>
                    {detailsModalType === 'MATERIAL' && <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Qty</TableHead>}
                    <TableHead className="pr-6 py-4 text-right text-[10px] font-black uppercase tracking-widest" style={{ color: '#6b7280' }}>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsModalData.slice(detailsPage * 25, detailsPage * 25 + 25).map((row: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-white/[0.02] transition-colors" style={{ borderColor: '#1e2435' }}>
                      <TableCell className="px-6 py-3.5 text-xs font-bold" style={{ color: '#6b7280' }}>{format(new Date(row.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="py-3.5 font-bold text-white text-sm">
                        <span className="block truncate">
                          {detailsModalType === 'REVENUE' ? `${row.projects?.name || 'General'} ${row.notes ? '· ' + row.notes : ''}` :
                            detailsModalType === 'LABOUR' ? `${row.labour?.name || 'Unknown'} · ${row.projects?.name || 'No Site'}` :
                              detailsModalType === 'MATERIAL' ? `${row.name} · ${row.projects?.name || 'No Site'}` :
                                `${row.work_name} · ${row.projects?.name || 'No Site'}`}
                        </span>
                      </TableCell>
                      {detailsModalType === 'MATERIAL' && <TableCell className="py-3.5 text-xs" style={{ color: '#6b7280' }}>{row.quantity} {row.unit}</TableCell>}
                      <TableCell className="pr-6 py-3.5 text-right font-black text-base" style={{ color: '#3b82f6' }}>
                        ₹{Number(row.amount || row.total_amount || (row.days_worked * (row.custom_rate || row.labour?.daily_rate || 0) + (row.overtime_amount || 0))).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer Pagination */}
          <div className="px-6 py-4 border-t border-[#1e2435] bg-[#0d1018] flex items-center justify-between shrink-0">
            <span className="text-xs font-bold" style={{ color: '#6b7280' }}>
              Showing {Math.min(detailsPage * 25 + 1, detailsModalData.length)}–{Math.min(detailsPage * 25 + 25, detailsModalData.length)} of {detailsModalData.length}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={detailsPage === 0} onClick={() => setDetailsPage(p => p - 1)}
                className="px-4 py-2 text-xs font-bold rounded-xl disabled:opacity-40 transition-all hover:bg-white/5"
                style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>← Prev</button>
              <span className="px-3 py-2 text-xs font-black text-white">
                {detailsPage + 1} / {Math.ceil(detailsModalData.length / 25) || 1}
              </span>
              <button disabled={(detailsPage + 1) * 25 >= detailsModalData.length} onClick={() => setDetailsPage(p => p + 1)}
                className="px-4 py-2 text-xs font-bold rounded-xl disabled:opacity-40 transition-all hover:bg-white/5"
                style={{ backgroundColor: '#1a1f2e', color: '#f0f0f0', border: '1px solid #1e2435' }}>Next →</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Chat Assistant Dialog Modal */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent
          style={{
            backgroundColor: '#0d1018',
            border: '1px solid #1e2435',
            color: '#f0f0f0',
            maxWidth: '650px',
            borderRadius: '1.25rem'
          }}
          className="max-h-[85vh] flex flex-col p-0 overflow-hidden"
        >
          {/* Dialog Header */}
          <div className="px-6 py-5 border-b border-[#1e2435] bg-[#111520]/80 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-black uppercase tracking-wide">Sri Sai AI Assistant</DialogTitle>
                <DialogDescription className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Connected to Database
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Chat Messages Area */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px] max-h-[50vh] bg-[#0a0c12]/50"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800/10 flex items-center justify-center text-blue-400">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-sm font-bold text-white uppercase tracking-wide">Ask Anything About Your Business</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">Ask about workers, payroll, project income, material records, extra billing, and personal expenses.</p>
                </div>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed max-w-[80%] shadow-sm ${m.role === 'user'
                      ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                      : 'bg-[#111520] border border-[#1e2435] text-zinc-200 rounded-tl-none font-medium'
                      }`}
                  >
                    {m.role === 'assistant' ? (
                      <div className="markdown-content whitespace-pre-line">
                        {renderMarkdown(m.content)}
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))
            )}

            {aiLoading && (
              <div className="flex items-start gap-3 justify-start animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-4 rounded-2xl bg-[#111520] border border-[#1e2435] rounded-tl-none text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  Analyzing database records...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Modal Input Form */}
          <div className="p-4 border-t border-[#1e2435] bg-[#111520]">
            <form onSubmit={handleAIModalSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask follow-up question..."
                value={modalQuery}
                onChange={(e) => setModalQuery(e.target.value)}
                className="flex-1 h-11 px-4 bg-black/40 border border-[#1e2435] rounded-xl text-sm font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                disabled={aiLoading}
              />
              <button
                type="submit"
                disabled={aiLoading || !modalQuery.trim()}
                className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function renderMarkdown(text: string) {
  if (!text || typeof text !== 'string') return null

  // Split text by lines
  const lines = text.split('\n')
  const elements: string[] = []

  let inList = false
  let inTable = false
  let tableHeaders: string[] = []
  let tableRows: string[][] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Check if line is a table row (starts and ends with pipe or contains multiple pipes)
    if (line.startsWith('|') && line.split('|').length > 2) {
      if (inList) {
        elements.push('</ul>')
        inList = false
      }

      // Parse table cells
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)

      // Skip separator row (e.g. |---------|------|)
      if (cells.every(c => c.match(/^:?-+:?$/))) {
        continue
      }

      if (!inTable) {
        inTable = true
        tableHeaders = cells
      } else {
        tableRows.push(cells)
      }
      continue
    } else {
      if (inTable) {
        // Output compiled table
        let tableHtml = '<div class="overflow-x-auto my-3"><table class="w-full text-[11px] border-collapse rounded-xl overflow-hidden border border-[#1e2435]">'
        tableHtml += '<thead class="bg-[#111520]"><tr>'
        tableHeaders.forEach(h => {
          tableHtml += `<th class="px-3 py-2 text-left font-black uppercase tracking-wider text-zinc-400 border-b border-[#1e2435]">${parseInline(h)}</th>`
        })
        tableHtml += '</tr></thead><tbody>'
        tableRows.forEach(row => {
          tableHtml += '<tr class="border-b border-[#1e2435] hover:bg-white/[0.02] transition-colors">'
          row.forEach(cell => {
            tableHtml += `<td class="px-3 py-2 font-medium text-white">${parseInline(cell)}</td>`
          })
          tableHtml += '</tr>'
        })
        tableHtml += '</tbody></table></div>'
        elements.push(tableHtml)

        inTable = false
        tableHeaders = []
        tableRows = []
      }
    }

    // Check if line is a list item
    if (line.startsWith('-') || line.startsWith('*')) {
      if (!inList) {
        elements.push('<ul class="list-disc pl-5 my-2 space-y-1">')
        inList = true
      }
      const content = line.substring(1).trim()
      elements.push(`<li class="text-zinc-300 font-medium">${parseInline(content)}</li>`)
      continue
    } else {
      if (inList) {
        elements.push('</ul>')
        inList = false
      }
    }

    // Regular line
    if (line !== '') {
      elements.push(`<p class="my-1.5 text-zinc-300 font-medium">${parseInline(line)}</p>`)
    }
  }

  // Handle any remaining open tags
  if (inList) elements.push('</ul>')
  if (inTable) {
    let tableHtml = '<div class="overflow-x-auto my-3"><table class="w-full text-[11px] border-collapse rounded-xl overflow-hidden border border-[#1e2435]">'
    tableHtml += '<thead class="bg-[#111520]"><tr>'
    tableHeaders.forEach(h => {
      tableHtml += `<th class="px-3 py-2 text-left font-black uppercase tracking-wider text-zinc-400 border-b border-[#1e2435]">${parseInline(h)}</th>`
    })
    tableHtml += '</tr></thead><tbody>'
    tableRows.forEach(row => {
      tableHtml += '<tr class="border-b border-[#1e2435] hover:bg-white/[0.02] transition-colors">'
      row.forEach(cell => {
        tableHtml += `<td class="px-3 py-2 font-medium text-white">${parseInline(cell)}</td>`
      })
      tableHtml += '</tr>'
    })
    tableHtml += '</tbody></table></div>'
    elements.push(tableHtml)
  }

  return <div className="space-y-1" dangerouslySetInnerHTML={{ __html: elements.join('\n') }} />
}

function parseInline(text: string): string {
  let html = text

  // Standard bold formatting
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Mismatched asterisk safety checks (e.g. *text** or **text*)
  html = html.replace(/\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*\*(.*?)\*/g, '<strong>$1</strong>')

  // Standard single asterisk formatting (fallback to bold for clean presentation)
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>')

  // Indian rupees highlighting
  html = html.replace(/(₹[0-9,]+(\.[0-9]+)?)/g, '<span class="text-blue-400 font-bold">$1</span>')

  return html
}
