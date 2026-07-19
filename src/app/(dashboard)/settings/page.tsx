'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registerPasskey } from '@/lib/passkey-helpers'
import { toast } from 'sonner'
import AnalogueTimePicker from '@/components/ui/AnalogueTimePicker'
import {
  Fingerprint, ShieldCheck, Trash2, Loader2, Briefcase,
  Bell, BellOff, Vibrate, Settings, CheckCircle2, Clock,
  CalendarCheck, Building2, LogOut, FileText
} from 'lucide-react'

const PANEL: React.CSSProperties = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const DIM = '#6b7280'
const INPUT_ST: React.CSSProperties = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.75rem' }

const THEME_OPTIONS = [
  {
    id: 'original_navy',
    name: 'Original Color',
    primary: 'rgb(13, 27, 62)',
    secondary: 'rgb(245, 158, 11)',
    tertiary: 'rgb(37, 99, 235)',
  },
  {
    id: 'classic_blue',
    name: 'Classic Blue',
    primary: 'rgb(37, 99, 235)',
    secondary: 'rgb(13, 27, 62)',
    tertiary: 'rgb(37, 99, 235)',
  },
  {
    id: 'emerald_green',
    name: 'Emerald Green',
    primary: 'rgb(6, 78, 59)',
    secondary: 'rgb(16, 185, 129)',
    tertiary: 'rgb(6, 78, 59)',
  },
  {
    id: 'royal_blue',
    name: 'Royal Blue',
    primary: 'rgb(30, 58, 138)',
    secondary: 'rgb(59, 130, 246)',
    tertiary: 'rgb(30, 58, 138)',
  },
  {
    id: 'slate_charcoal',
    name: 'Slate Charcoal',
    primary: 'rgb(30, 41, 59)',
    secondary: 'rgb(100, 116, 139)',
    tertiary: 'rgb(30, 41, 59)',
  },
  {
    id: 'sunset_amber',
    name: 'Sunset Amber',
    primary: 'rgb(120, 53, 4)',
    secondary: 'rgb(245, 158, 11)',
    tertiary: 'rgb(120, 53, 4)',
  },
]

export default function SettingsPage() {
  const supabase = createClient()

  /* eslint-disable react-hooks/immutability */
  const handleLogout = async () => {
    // 1. Supabase SignOut
    await supabase.auth.signOut()
    
    // 2. Clear all auth cookies manually just in case
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';')
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim()
        if (cookie.startsWith('sb-')) {
          const name = cookie.split('=')[0]
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        }
      }
      
      // 3. Clear local/session storage
      localStorage.clear()
      sessionStorage.clear()
    }

    toast.success('Logged out completely')
    window.location.href = '/login'
  }
  /* eslint-enable react-hooks/immutability */

  // ── Section E: Construction Details ─────────────────
  const [companyName, setCompanyName] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [companyPhone1, setCompanyPhone1] = useState('')
  const [companyPhone2, setCompanyPhone2] = useState('')
  const [companySlogan, setCompanySlogan] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [pdfTheme, setPdfTheme] = useState('original_navy')

  const handleSaveCompanyDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameVal = companyName.trim()
    const contractorVal = contractorName.trim()
    const phone1Val = companyPhone1.trim()
    const phone2Val = companyPhone2.trim()
    const sloganVal = companySlogan.trim()
    const addressVal = companyAddress.trim()

    localStorage.setItem('ssc_company_name', nameVal)
    localStorage.setItem('ssc_contractor_name', contractorVal)
    localStorage.setItem('ssc_company_phone_1', phone1Val)
    localStorage.setItem('ssc_company_phone_2', phone2Val)
    localStorage.setItem('ssc_company_slogan', sloganVal)
    localStorage.setItem('ssc_company_address', addressVal)
    localStorage.setItem('ssc_pdf_theme', pdfTheme)

    const settingsObj = {
      company_name: nameVal,
      contractor_name: contractorVal,
      phone_1: phone1Val,
      phone_2: phone2Val,
      slogan: sloganVal,
      address: addressVal,
      pdf_theme: pdfTheme
    }

    try {
      // 1. Try to upsert into company_settings
      const rows = Object.entries(settingsObj).map(([key, value]) => ({ key, value }))
      await supabase.from('company_settings').upsert(rows)
      
      // 2. Also upsert fallback special project row
      await supabase.from('projects').upsert({
        id: '00000000-0000-0000-0000-000000000000',
        name: 'SYSTEM_SETTINGS',
        owner_name: 'SYSTEM',
        status: 'SYSTEM',
        description: JSON.stringify(settingsObj)
      })
      toast.success('Branding & Contractor details updated!')
    } catch (err) {
      console.error('Settings sync failed:', err)
      toast.success('Branding details updated!')
    }

    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  // ── Section A: Biometrics ────────────────────────────
  interface PasskeyItem {
    id: string
    friendly_name: string
    created_at: string
  }

  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(true)
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [friendlyName, setFriendlyName] = useState('')

  const fetchPasskeys = async () => {
    setLoadingPasskeys(true)
    try {
      const { data, error } = await supabase.auth.passkey.list()
      if (error) throw error
      setPasskeys((data || []) as unknown as PasskeyItem[])
    } catch (err: unknown) {
      console.error('Error listing passkeys:', err)
    } finally {
      setLoadingPasskeys(false)
    }
  }

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendlyName.trim()) {
      toast.error('Please enter a name for this fingerprint.')
      return
    }
    if (passkeys.length >= 2) {
      toast.error('Maximum limit of 2 fingerprints reached. Delete one first.')
      return
    }
    setRegisteringPasskey(true)
    try {
      await registerPasskey(supabase, friendlyName.trim())
      toast.success('Fingerprint registered successfully!')
      setFriendlyName('')
      fetchPasskeys()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast.error(errMsg || 'Failed to register fingerprint.')
    } finally {
      setRegisteringPasskey(false)
    }
  }

  const handleDeletePasskey = async (id: string) => {
    if (!confirm('Delete this fingerprint?')) return
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: id })
      if (error) throw error
      toast.success('Fingerprint deleted.')
      fetchPasskeys()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast.error(errMsg || 'Failed to delete fingerprint.')
    }
  }

  // ── Section B: Default Project ───────────────────────
  interface SettingsProject {
    id: string
    name: string
    description?: string | null
  }

  const [projects, setProjects] = useState<SettingsProject[]>([])
  const [defaultProjectId, setDefaultProjectId] = useState<string>('')
  const [projectBudgets, setProjectBudgets] = useState<Record<string, string>>({})
  const [budgetSavingId, setBudgetSavingId] = useState<string | null>(null)

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name, description').neq('status', 'SYSTEM').order('name')
    setProjects(data || [])
  }

  useEffect(() => {
    if (projects.length > 0) {
      const budgets: Record<string, string> = {}
      projects.forEach(p => {
        if (p.description) {
          try {
            const parsed = JSON.parse(p.description)
            budgets[p.id] = parsed.budget_limit ? String(parsed.budget_limit) : ''
          } catch (e) {
            budgets[p.id] = ''
          }
        } else {
          budgets[p.id] = ''
        }
      })
      setProjectBudgets(budgets)
    }
  }, [projects])

  const saveProjectBudget = async (projectId: string) => {
    const budgetStr = projectBudgets[projectId] || ''
    const budgetVal = parseFloat(budgetStr)
    
    setBudgetSavingId(projectId)
    try {
      const proj = projects.find(p => p.id === projectId)
      if (!proj) throw new Error('Project not found')
      
      let parsedDesc: Record<string, any> = {}
      if (proj.description) {
        try {
          parsedDesc = JSON.parse(proj.description)
        } catch (e) {}
      }
      
      if (isNaN(budgetVal) || budgetStr.trim() === '') {
        delete parsedDesc.budget_limit
      } else {
        parsedDesc.budget_limit = budgetVal
      }
      
      const { error } = await supabase
        .from('projects')
        .update({ description: JSON.stringify(parsedDesc) })
        .eq('id', projectId)
        
      if (error) throw error
      
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, description: JSON.stringify(parsedDesc) } : p))
      toast.success('Project budget rate updated successfully!')
      window.dispatchEvent(new Event('ssc_settings_updated'))
    } catch (err: any) {
      toast.error(err.message || 'Failed to save budget rate')
    } finally {
      setBudgetSavingId(null)
    }
  }

  const saveDefaultProject = async (id: string) => {
    setDefaultProjectId(id)
    localStorage.setItem('ssc_default_project_id', id)
    toast.success('Default project updated!')
    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  // ── Section C: Notification Settings ─────────────────
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [attendanceReminderEnabled, setAttendanceReminderEnabled] = useState(false)
  const [attendanceReminderTime, setAttendanceReminderTime] = useState('09:00')
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false)

  const checkNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission)
    }
  }

  const requestNotifPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)
      if (permission === 'granted') {
        toast.success('Notifications allowed!')
      } else {
        toast.error('Notifications permission denied.')
      }
    }
  }

  const loadNotifPrefs = () => {
    const attEnabled = localStorage.getItem('ssc_notif_attendance_enabled') === 'true'
    const attTime = localStorage.getItem('ssc_notif_attendance_time') || '09:00'
    const weeklyEnabled = localStorage.getItem('ssc_notif_weekly_enabled') === 'true'

    setAttendanceReminderEnabled(attEnabled)
    setAttendanceReminderTime(attTime)
    setWeeklyReportEnabled(weeklyEnabled)
  }

  const saveAttendanceReminder = (enabled: boolean) => {
    setAttendanceReminderEnabled(enabled)
    localStorage.setItem('ssc_notif_attendance_enabled', String(enabled))
    toast.success(`Daily attendance reminder ${enabled ? 'enabled' : 'disabled'}`)
    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  const saveWeeklyReminder = (enabled: boolean) => {
    setWeeklyReportEnabled(enabled)
    localStorage.setItem('ssc_notif_weekly_enabled', String(enabled))
    toast.success(`Weekly report reminder ${enabled ? 'enabled' : 'disabled'}`)
    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  // ── Section D: Haptic feedback settings ──────────────
  const [hapticEnabled, setHapticEnabled] = useState(true)
  const toggleHaptic = (val: boolean) => {
    setHapticEnabled(val)
    localStorage.setItem('ssc_haptic_enabled', String(val))
    if (val && 'vibrate' in navigator) {
      navigator.vibrate([10, 30, 10])
    }
    toast.success(`Haptic feedback ${val ? 'enabled' : 'disabled'}.`)
  }

  // ── On Mount ─────────────────────────────────────────
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchPasskeys()
    fetchProjects()
    loadNotifPrefs()
    const saved = localStorage.getItem('ssc_haptic_enabled')
    setHapticEnabled(saved !== 'false')
    const savedDefault = localStorage.getItem('ssc_default_project_id')
    if (savedDefault) setDefaultProjectId(savedDefault)

    // Load company details
    const localName = localStorage.getItem('ssc_company_name')
    if (localName) {
      setCompanyName(localStorage.getItem('ssc_company_name') || 'SRI SAI CONSTRUCTIONS')
      setContractorName(localStorage.getItem('ssc_contractor_name') || 'Cheveli Somaiah')
      setCompanyPhone1(localStorage.getItem('ssc_company_phone_1') || '9849678296')
      setCompanyPhone2(localStorage.getItem('ssc_company_phone_2') || '9550017985')
      setCompanySlogan(localStorage.getItem('ssc_company_slogan') || 'BUILDING YOUR VISION')
      setCompanyAddress(localStorage.getItem('ssc_company_address') || 'Boduppal, Hyderabad')
      setPdfTheme(localStorage.getItem('ssc_pdf_theme') || 'original_navy')
    } else {
      // First try to load from company_settings table
      supabase.from('company_settings').select('key, value').then(({ data }) => {
        if (data && data.length > 0) {
          const map = new Map(data.map(item => [item.key, item.value]))
          const name = map.get('company_name') || 'SRI SAI CONSTRUCTIONS'
          const contractor = map.get('contractor_name') || 'Cheveli Somaiah'
          const phone1 = map.get('company_phone_1') || '9849678296'
          const phone2 = map.get('company_phone_2') || '9550017985'
          const slogan = map.get('company_slogan') || 'BUILDING YOUR VISION'
          const address = map.get('company_address') || 'Boduppal, Hyderabad'
          const theme = map.get('pdf_theme') || 'original_navy'

          setCompanyName(name)
          setContractorName(contractor)
          setCompanyPhone1(phone1)
          setCompanyPhone2(phone2)
          setCompanySlogan(slogan)
          setCompanyAddress(address)
          setPdfTheme(theme)

          localStorage.setItem('ssc_company_name', name)
          localStorage.setItem('ssc_contractor_name', contractor)
          localStorage.setItem('ssc_company_phone_1', phone1)
          localStorage.setItem('ssc_company_phone_2', phone2)
          localStorage.setItem('ssc_company_slogan', slogan)
          localStorage.setItem('ssc_company_address', address)
          localStorage.setItem('ssc_pdf_theme', theme)
        } else {
          // Fallback to legacy projects configuration description
          supabase.from('projects').select('description').eq('id', '00000000-0000-0000-0000-000000000000').single().then(({ data: legacyData }) => {
            if (legacyData && legacyData.description) {
              try {
                const parsed = JSON.parse(legacyData.description)
                const name = parsed.company_name || 'SRI SAI CONSTRUCTIONS'
                const contractor = parsed.contractor_name || 'Cheveli Somaiah'
                const phone1 = parsed.phone_1 || '9849678296'
                const phone2 = parsed.phone_2 || '9550017985'
                const slogan = parsed.slogan || 'BUILDING YOUR VISION'
                const address = parsed.address || 'Boduppal, Hyderabad'
                const theme = parsed.pdf_theme || 'original_navy'

                setCompanyName(name)
                setContractorName(contractor)
                setCompanyPhone1(phone1)
                setCompanyPhone2(phone2)
                setCompanySlogan(slogan)
                setCompanyAddress(address)
                setPdfTheme(theme)

                localStorage.setItem('ssc_company_name', name)
                localStorage.setItem('ssc_contractor_name', contractor)
                localStorage.setItem('ssc_company_phone_1', phone1)
                localStorage.setItem('ssc_company_phone_2', phone2)
                localStorage.setItem('ssc_company_slogan', slogan)
                localStorage.setItem('ssc_company_address', address)
                localStorage.setItem('ssc_pdf_theme', theme)
              } catch (e) {}
            }
          })
        }
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sectionClass = 'space-y-4'

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
          <Settings size={22} className="text-blue-400" />
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: DIM }}>Manage security, preferences and notifications.</p>
      </div>

      {/* ── Section A: Biometric / Fingerprint ──────── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Fingerprint size={18} className="text-blue-400 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Fingerprint / Biometrics</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              Register up to 2 fingerprints for secure login
            </p>
          </div>
        </div>

        {/* Registered List */}
        <div className={sectionClass}>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Registered Fingerprints ({passkeys.length}/2)
          </p>
          {loadingPasskeys ? (
            <div className="flex items-center justify-center py-6 text-zinc-500 text-xs font-bold gap-2">
              <Loader2 className="animate-spin text-blue-500" size={16} /> Loading...
            </div>
          ) : passkeys.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#1e2435] rounded-xl text-zinc-500 text-xs font-semibold">
              No fingerprints registered yet.
            </div>
          ) : (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0d1018] border border-[#1e2435]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{pk.friendly_name || 'Biometric Key'}</p>
                      <p className="text-[9px] text-zinc-500 font-medium">Added: {new Date(pk.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePasskey(pk.id)}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Register Form */}
        {passkeys.length < 2 ? (
          <form onSubmit={handleRegisterPasskey} className="space-y-3 pt-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Add New Fingerprint</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Father's Phone, My Device"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                className="flex-1 h-11 px-3 text-xs font-semibold placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-all"
                style={INPUT_ST}
                disabled={registeringPasskey}
              />
              <button
                type="submit"
                disabled={registeringPasskey || !friendlyName.trim()}
                className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                {registeringPasskey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint size={14} />}
                Register
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500/80 font-bold uppercase tracking-wider text-center">
            Maximum 2 fingerprints limit reached. Delete one to add another.
          </div>
        )}
      </div>

      {/* ── Section B: Default Project ───────────────── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Briefcase size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Default Project</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              The project that loads automatically when you open the app
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
            Select Default Project
          </label>

          {projects.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-[#1e2435] bg-[#0d1018]">
              <Briefcase size={16} className="text-zinc-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-zinc-500">No projects found</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Add a project first from the Projects page, then come back here to set a default.</p>
              </div>
            </div>
          ) : (
            <>
              <select
                value={defaultProjectId}
                onChange={(e) => saveDefaultProject(e.target.value)}
                className="w-full h-11 px-4 text-sm font-semibold outline-none focus:border-emerald-500 transition-all"
                style={INPUT_ST}
              >
                <option value="">— No Default (load last used) —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {defaultProjectId && projects.find(p => p.id === defaultProjectId) && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <p className="text-xs font-bold text-emerald-400">
                    Default: {projects.find(p => p.id === defaultProjectId)?.name}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Section B.2: Project Budget Limits ────────────── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Briefcase size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Project Budget Limits</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              Set custom budget limits/rates for active projects
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {projects.length === 0 ? (
            <p className="text-xs text-zinc-500 font-bold">No active projects found.</p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {projects.map((proj) => (
                <div key={proj.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-white uppercase">{proj.name}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase">
                      Current: {(() => {
                        try {
                          const parsed = JSON.parse(proj.description || '{}')
                          return parsed.budget_limit ? `₹${parsed.budget_limit.toLocaleString('en-IN')}` : 'Not set (uses agreement fallback)'
                        } catch (e) {
                          return 'Not set (uses agreement fallback)'
                        }
                      })()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-zinc-500 text-xs font-bold">₹</span>
                      <input
                        type="number"
                        placeholder="Enter budget limit"
                        value={projectBudgets[proj.id] || ''}
                        onChange={(e) => setProjectBudgets({ ...projectBudgets, [proj.id]: e.target.value })}
                        className="w-40 h-9 pl-6 pr-3 text-xs font-bold placeholder-zinc-700 outline-none focus:border-blue-500/50 transition-all rounded-lg"
                        style={INPUT_ST}
                      />
                    </div>
                    <button
                      onClick={() => saveProjectBudget(proj.id)}
                      disabled={budgetSavingId === proj.id}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {budgetSavingId === proj.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section F: Agreements Defaults ───────────────── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <FileText size={18} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Agreement Checklist Settings</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              Manage the default list of construction work specifications
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs leading-relaxed" style={{ color: DIM }}>
            Configure the standard list of 23 material/work details (like Cement, Steel, Sand) that are prefilled by default when generating a new construction agreement. You can add new items, delete them, or reorder the rows.
          </p>
          <div>
            <Link
              href="/settings/agreements"
              className="inline-flex h-11 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider items-center gap-1.5 transition-all cursor-pointer"
            >
              <Settings size={14} /> Customize Default Checklist
            </Link>
          </div>
        </div>
      </div>

      {/* ── Section E: Construction & Branding Details ── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Building2 size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Construction &amp; Branding Details</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              Customize details shown on exported PDF receipts and statements
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCompanyDetails} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Construction Name</label>
              <input
                type="text"
                placeholder="e.g. SRI SAI CONSTRUCTIONS"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                style={INPUT_ST}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Contractor Name</label>
              <input
                type="text"
                placeholder="e.g. Cheveli Somaiah"
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                style={INPUT_ST}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Primary Mobile Number</label>
              <input
                type="text"
                placeholder="e.g. 9849678296"
                value={companyPhone1}
                onChange={(e) => setCompanyPhone1(e.target.value)}
                className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                style={INPUT_ST}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Secondary Mobile Number</label>
              <input
                type="text"
                placeholder="e.g. 9550017985"
                value={companyPhone2}
                onChange={(e) => setCompanyPhone2(e.target.value)}
                className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
                style={INPUT_ST}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Company Slogan / Tagline</label>
            <input
              type="text"
              placeholder="e.g. BUILDING YOUR VISION"
              value={companySlogan}
              onChange={(e) => setCompanySlogan(e.target.value)}
              className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
              style={INPUT_ST}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
              PDF Report Theme Color
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {THEME_OPTIONS.map((theme) => {
                const isSelected = pdfTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setPdfTheme(theme.id)
                      if (hapticEnabled && 'vibrate' in navigator) {
                        navigator.vibrate([15])
                      }
                    }}
                    className={`relative flex flex-col p-3 rounded-xl border text-left transition-all group overflow-hidden cursor-pointer select-none ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/15'
                        : 'border-[#1e2435] bg-[#0d1018] hover:border-zinc-700 hover:bg-[#111520]'
                    }`}
                  >
                    {/* Mini PDF Header Mockup Preview */}
                    <div className="w-full h-14 rounded-lg overflow-hidden border border-zinc-800 flex flex-col mb-3 bg-[#0d1018]">
                      {/* Header Primary Block */}
                      <div
                        className="h-6 transition-all duration-300 relative"
                        style={{ backgroundColor: theme.primary }}
                      >
                        {/* Mockup visual document lines */}
                        <div className="absolute left-2 top-1.5 w-8 h-0.5 bg-white/20 rounded" />
                        <div className="absolute left-2 top-3.5 w-12 h-0.5 bg-white/10 rounded" />
                        <div className="absolute right-2 top-1.5 w-6 h-0.5 bg-white/20 rounded" />
                      </div>
                      {/* Accent gold/secondary strip */}
                      <div
                        className="h-1.5 transition-all duration-300"
                        style={{ backgroundColor: theme.secondary }}
                      />
                      {/* Table Header Row Mockup */}
                      <div className="flex-1 flex gap-1 px-2 items-center bg-[#07090e]">
                        <div className="h-1.5 rounded flex-1" style={{ backgroundColor: theme.tertiary }} />
                        <div className="h-1.5 rounded flex-1" style={{ backgroundColor: theme.tertiary }} />
                        <div className="h-1.5 rounded flex-1" style={{ backgroundColor: theme.tertiary }} />
                      </div>
                    </div>

                    {/* Theme Label */}
                    <div className="flex items-center justify-between gap-1 mt-auto">
                      <span className={`text-[11px] font-bold tracking-tight truncate ${isSelected ? 'text-blue-400' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                        {theme.name}
                      </span>
                      {isSelected && (
                        <CheckCircle2 size={13} className="text-blue-400 shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Office Address</label>
            <input
              type="text"
              placeholder="e.g. Boduppal, Hyderabad"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full h-11 px-3 text-xs font-semibold outline-none focus:border-blue-500/50 transition-all"
              style={INPUT_ST}
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Save Details
            </button>
          </div>
        </form>
      </div>

      {/* ── Section C: Reminders ───────────────── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Bell size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Notification Reminders</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              Browser push reminders for daily attendance &amp; weekly reports
            </p>
          </div>
        </div>

        {/* Permission Status */}
        {notifPermission !== 'granted' ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <div>
              <p className="text-xs font-black text-amber-400 uppercase tracking-wide">Permission Required</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Allow notifications to use reminders</p>
            </div>
            <button
              onClick={requestNotifPermission}
              className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wide text-white flex items-center gap-2 transition-all"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
            >
              <Bell size={13} /> Allow
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <p className="text-xs font-bold text-emerald-400">Notifications allowed</p>
          </div>
        )}

        {/* ── Daily Attendance Reminder + Analogue Clock ── */}
        <div className="rounded-xl bg-[#0d1018] border border-[#1e2435] overflow-hidden">
          {/* Header row */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-blue-400 shrink-0" />
              <div>
                <p className="text-xs font-black text-white uppercase tracking-wide">Daily Attendance Reminder</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Set your time below, then enable</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {attendanceReminderEnabled && (
                <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Active
                </span>
              )}
              <button
                onClick={() => {
                  if (notifPermission !== 'granted') {
                    toast.error('Please allow notifications first.')
                    return
                  }
                  saveAttendanceReminder(!attendanceReminderEnabled)
                }}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${attendanceReminderEnabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${attendanceReminderEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Analogue Clock */}
          <div className="flex justify-center py-4 border-t border-[#1e2435]" style={{ backgroundColor: '#0a0c12' }}>
            <AnalogueTimePicker
              value={attendanceReminderTime}
              onChange={(t) => {
                setAttendanceReminderTime(t)
                localStorage.setItem('ssc_notif_attendance_time', t)
                window.dispatchEvent(new Event('ssc_settings_updated'))
              }}
              disabled={notifPermission !== 'granted'}
            />
          </div>
        </div>

        {/* ── Weekly Report Reminder — Saturday 7:00 PM fixed ── */}
        <div className="rounded-xl bg-[#0d1018] border border-[#1e2435] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarCheck size={18} className="text-purple-400 shrink-0" />
              <div>
                <p className="text-xs font-black text-white uppercase tracking-wide">Weekly Report Reminder</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Every Saturday at 7:00 PM — export your weekly report</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (notifPermission !== 'granted') {
                  toast.error('Please allow notifications first.')
                  return
                }
                saveWeeklyReminder(!weeklyReportEnabled)
              }}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${weeklyReportEnabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${weeklyReportEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Fixed time badge */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1e2435]">
            <Clock size={13} className="text-purple-400 shrink-0" />
            <p className="text-[10px] font-bold text-zinc-500">
              Fixed time: <span className="text-purple-400 font-black">Saturday, 7:00 PM</span>
              {weeklyReportEnabled && <span className="ml-2 text-purple-400">· Active</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Section D: Haptic Feedback ───────────────── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <Vibrate size={18} className="text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Haptic Feedback</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              Vibrate on button taps & interactions (mobile only)
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-[#0d1018] border border-[#1e2435]">
          <div className="flex items-center gap-3">
            {hapticEnabled
              ? <Vibrate size={18} className="text-rose-400 shrink-0" />
              : <BellOff size={18} className="text-zinc-500 shrink-0" />
            }
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wide">
                {hapticEnabled ? 'Haptic ON' : 'Haptic OFF'}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {hapticEnabled ? 'Vibration active on supported devices' : 'Vibration disabled'}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleHaptic(!hapticEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${hapticEnabled ? 'bg-rose-600' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hapticEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* ── Section F: Account & Logout ───────────────── */}
      <div style={PANEL} className="p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1e2435]">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
            <LogOut size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">Account</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              Manage your session and account security
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/15">
          <div>
            <p className="text-xs font-black text-white uppercase tracking-wide">Log Out</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">End your current session</p>
          </div>
          <button
            onClick={handleLogout}
            className="h-10 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
