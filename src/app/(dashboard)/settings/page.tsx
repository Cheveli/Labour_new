'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registerPasskey } from '@/lib/passkey-helpers'
import { toast } from 'sonner'
import AnalogueTimePicker from '@/components/ui/AnalogueTimePicker'
import {
  Fingerprint, ShieldCheck, Trash2, Loader2, Briefcase,
  Bell, BellOff, Vibrate, Settings, CheckCircle2, Clock,
  CalendarCheck
} from 'lucide-react'

const PANEL: React.CSSProperties = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '0.875rem' }
const DIM = '#6b7280'
const INPUT_ST: React.CSSProperties = { backgroundColor: '#0d1018', border: '1px solid #1e2435', color: '#f0f0f0', borderRadius: '0.75rem' }

export default function SettingsPage() {
  const supabase = createClient()

  // ── Section A: Biometrics ────────────────────────────
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(true)
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [friendlyName, setFriendlyName] = useState('')

  const fetchPasskeys = async () => {
    setLoadingPasskeys(true)
    try {
      const { data, error } = await supabase.auth.passkey.list()
      if (error) throw error
      setPasskeys(data || [])
    } catch (err: any) {
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to register fingerprint.')
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete fingerprint.')
    }
  }

  // ── Section B: Default Project ───────────────────────
  const [projects, setProjects] = useState<any[]>([])
  const [defaultProjectId, setDefaultProjectId] = useState<string>('')

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name')
    setProjects(data || [])
  }

  const handleSetDefaultProject = (id: string) => {
    setDefaultProjectId(id)
    if (id) {
      localStorage.setItem('ssc_default_project_id', id)
      localStorage.setItem('ssc_active_project_id', id)
      localStorage.setItem('ssc_overview_selection', id)
    } else {
      localStorage.removeItem('ssc_default_project_id')
    }
    toast.success(id ? 'Default project updated.' : 'Default project cleared.')
    window.dispatchEvent(new Event('ssc_project_changed'))
  }

  // ── Section C: Notification Reminders ───────────────
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [attendanceReminderEnabled, setAttendanceReminderEnabled] = useState(false)
  const [attendanceReminderTime, setAttendanceReminderTime] = useState('08:00')
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false)

  const loadNotifPrefs = () => {
    setAttendanceReminderEnabled(localStorage.getItem('ssc_notif_attendance') === 'true')
    setAttendanceReminderTime(localStorage.getItem('ssc_notif_attendance_time') || '08:00')
    setWeeklyReportEnabled(localStorage.getItem('ssc_notif_weekly_report') === 'true')
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission)
    }
  }

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Notifications are not supported in this browser.')
      return
    }
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    if (result === 'granted') {
      toast.success('Notification permission granted!')
    } else {
      toast.error('Permission denied. Please enable notifications from browser settings.')
    }
  }

  const saveAttendanceReminder = (enabled: boolean, time?: string) => {
    const t = time ?? attendanceReminderTime
    localStorage.setItem('ssc_notif_attendance', String(enabled))
    if (time) localStorage.setItem('ssc_notif_attendance_time', t)
    setAttendanceReminderEnabled(enabled)
    if (time) setAttendanceReminderTime(t)

    if (enabled && notifPermission === 'granted') {
      toast.success(`Attendance reminder set for ${t} daily.`)
    } else if (!enabled) {
      toast.success('Attendance reminder disabled.')
    }
    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  const saveWeeklyReminder = (enabled: boolean) => {
    localStorage.setItem('ssc_notif_weekly_report', String(enabled))
    setWeeklyReportEnabled(enabled)
    if (enabled && notifPermission === 'granted') {
      toast.success('Weekly reminder set for every Saturday at 7:00 PM.')
    } else if (!enabled) {
      toast.success('Weekly report reminder disabled.')
    }
    window.dispatchEvent(new Event('ssc_settings_updated'))
  }

  // ── Section D: Haptic Feedback ───────────────────────
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
    fetchPasskeys()
    fetchProjects()
    loadNotifPrefs()
    const saved = localStorage.getItem('ssc_haptic_enabled')
    setHapticEnabled(saved !== 'false')
    const savedDefault = localStorage.getItem('ssc_default_project_id')
    if (savedDefault) setDefaultProjectId(savedDefault)
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
                onChange={(e) => handleSetDefaultProject(e.target.value)}
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
    </div>
  )
}
