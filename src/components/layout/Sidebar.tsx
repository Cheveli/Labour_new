/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client'


import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Users, 
  Briefcase, 
  CalendarCheck, 
  Wallet, 
  TrendingUp, 
  Package, 
  Zap,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  FileText,
  HardHat,
  Calculator,
  BarChart3,
  Phone,
  Fingerprint,
  Trash2,
  Loader2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { registerPasskey } from '@/lib/passkey-helpers'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEffect } from 'react'

const menuItems = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Workforce', href: '/labour', icon: Users },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { label: 'Materials', href: '/materials', icon: Package },
  { label: 'Payments', href: '/payments', icon: Wallet },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Export Calculation', href: '/export-calculation', icon: Calculator },
  { label: 'Revenue', href: '/income', icon: TrendingUp },
  { label: 'Subcontracts', href: '/contractor-payments', icon: HardHat },
  { label: 'Projects', href: '/projects', icon: Briefcase },
  { label: 'Contacts', href: '/contacts', icon: Phone },
  { label: 'Personal Expenses', href: '/personal-expenses', icon: Wallet },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

  // Collapsed State (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString())
  }, [isCollapsed])

  const showExpanded = !isCollapsed || isOpen

  // Passkey Biometrics states
  const [showBiometricsModal, setShowBiometricsModal] = useState(false)
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(false)
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [friendlyName, setFriendlyName] = useState('')

  const fetchPasskeys = async () => {
    setLoadingPasskeys(true)
    try {
      const { data, error } = await supabase.auth.passkey.list()
      if (error) throw error
      setPasskeys(data || [])
    } catch (err: any) {
      console.error("Error listing passkeys:", err)
    } finally {
      setLoadingPasskeys(false)
    }
  }

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendlyName.trim()) {
      toast.error("Please enter a name for this fingerprint.")
      return
    }
    if (passkeys.length >= 2) {
      toast.error("Maximum limit of 2 fingerprints reached. Delete one first.")
      return
    }

    setRegisteringPasskey(true)
    try {
      await registerPasskey(supabase, friendlyName.trim())

      toast.success("Fingerprint registered successfully!")
      setFriendlyName('')
      fetchPasskeys()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to register fingerprint. Ensure your device biometrics are set up.")
    } finally {
      setRegisteringPasskey(false)
    }
  }

  const handleDeletePasskey = async (id: string) => {
    try {
      const { error } = await supabase.auth.passkey.delete({
        passkeyId: id
      })
      if (error) throw error

      toast.success("Fingerprint deleted successfully.")
      fetchPasskeys()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to delete fingerprint.")
    }
  }

  useEffect(() => {
    if (showBiometricsModal) {
      const timer = setTimeout(() => {
        fetchPasskeys()
      }, 0)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBiometricsModal])

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

  return (
    <>
      {/* Mobile header bar */}
      <div
        className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50 border-b"
        style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
            <HardHat className="w-4 h-4 text-[#0a0c12]" />
          </div>
          <span className="font-black text-sm tracking-widest uppercase text-white">Nirmana</span>
        </div>
        <button onClick={() => setIsOpen(true)} className="text-zinc-400 hover:text-white" suppressHydrationWarning>
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Stylesheet injection for sidebar utilities */}
      <style dangerouslySetInnerHTML={{ __html: `
        ${isCollapsed ? `
          @media (min-width: 1024px) {
            main {
              padding-left: 5rem !important;
            }
          }
        ` : ''}
        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}} />

      {/* Sidebar panel */}
      <div
        suppressHydrationWarning
        className={cn(
          'fixed inset-y-0 left-0 z-[70] transition-all duration-300 lg:translate-x-0 flex flex-col border-r',
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:w-auto'
        )}
        style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Toggle Header */}
          <div className={cn("py-5 border-b border-[#1e2435]", !showExpanded ? "px-2 flex justify-center" : "px-5")}>
            <div className="flex items-center justify-between w-full">
              {showExpanded ? (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>
                      <HardHat className="w-5 h-5 text-[#0a0c12]" />
                    </div>
                    <div className="truncate">
                      <p className="font-black text-sm tracking-widest uppercase text-white leading-none">Nirmana</p>
                      <p className="text-[9px] uppercase tracking-[0.18em] font-bold mt-0.5 truncate" style={{ color: '#3b82f6' }}>Site Management Hub</p>
                    </div>
                  </div>
                  {/* Desktop Collapse Button */}
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border border-[#1e2435] shrink-0"
                    title="Collapse Menu"
                  >
                    <Menu size={16} />
                  </button>
                  {/* Mobile Close Button */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="lg:hidden text-zinc-400 hover:text-white shrink-0"
                    suppressHydrationWarning
                  >
                    <X size={20} />
                  </button>
                </>
              ) : (
                /* Collapsed Mode - Show only Hamburger Menu button to expand */
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="hidden lg:flex items-center justify-center w-10 h-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border border-[#1e2435]"
                  title="Expand Menu"
                >
                  <Menu size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
            {menuItems.map((item, idx) => {
              const isActive = item.href !== '#' && (
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              )
              const Icon = item.icon
              return (
                <Link
                  key={`${item.label}-${idx}`}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 py-[10px] rounded-xl text-sm font-semibold transition-all duration-150',
                    !showExpanded ? 'justify-center px-0 w-10 h-10 mx-auto' : 'px-4',
                    isActive ? 'text-[#0a0c12] font-bold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                  style={isActive ? {
                    background: 'linear-gradient(90deg,#3b82f6,#2563eb)',
                    boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
                  } : undefined}
                >
                  <Icon size={18} className={cn(isActive ? 'text-[#0a0c12]' : 'text-zinc-500 group-hover:text-blue-400', "shrink-0")} />
                  {showExpanded && <span>{item.label}</span>}
                  {!showExpanded && (
                    <div className="absolute left-20 hidden group-hover:block bg-[#111520] border border-[#1e2435] px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white z-50 pointer-events-none shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                      {item.label}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Admin Profile & Actions */}
          <div className="px-3 py-4 border-t border-[#1e2435] space-y-3">
            {/* Admin Profile */}
            <div className={cn("flex items-center gap-3", !showExpanded ? "justify-center" : "px-2")}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-[#0a0c12] shrink-0"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
                A
              </div>
              {showExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">Admin</p>
                  <p className="text-[10px] text-zinc-500 truncate">Site Administrator</p>
                </div>
              )}
            </div>

            {/* Manage Fingerprints */}
            <button
              onClick={() => {
                setIsOpen(false)
                setShowBiometricsModal(true)
              }}
              suppressHydrationWarning
              className={cn(
                "group relative w-full flex items-center gap-2 h-10 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors border border-zinc-800 hover:bg-white/5 cursor-pointer",
                !showExpanded ? "justify-center" : "justify-center lg:justify-start lg:px-4"
              )}
            >
              <Fingerprint size={14} className="text-blue-400 shrink-0" />
              {showExpanded && <span>Manage Fingerprints</span>}
              {!showExpanded && (
                <div className="absolute left-20 hidden group-hover:block bg-[#111520] border border-[#1e2435] px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white z-50 pointer-events-none shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  Manage Fingerprints
                </div>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              suppressHydrationWarning
              className={cn(
                "group relative w-full flex items-center gap-2 h-10 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors cursor-pointer",
                !showExpanded ? "justify-center" : "justify-center lg:justify-start lg:px-4"
              )}
              style={{ background: '#1a1f2e' }}
            >
              <LogOut size={14} className="shrink-0" />
              {showExpanded && <span>Logout</span>}
              {!showExpanded && (
                <div className="absolute left-20 hidden group-hover:block bg-[#111520] border border-[#1e2435] px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white z-50 pointer-events-none shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                  Logout
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Biometrics Management Dialog Modal */}
      <Dialog open={showBiometricsModal} onOpenChange={setShowBiometricsModal}>
        <DialogContent
          style={{
            backgroundColor: '#0d1018',
            border: '1px solid #1e2435',
            color: '#f0f0f0',
            maxWidth: '480px',
            borderRadius: '1.25rem'
          }}
          className="p-6 space-y-6"
        >
          <DialogHeader className="border-b border-[#1e2435] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400">
                <Fingerprint className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-black uppercase tracking-wide">Manage Fingerprints</DialogTitle>
                <DialogDescription className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  Register up to 2 fingerprints for secure login
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* List of enrolled fingerprints */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Registered Fingerprints ({passkeys.length}/2)</p>
              {loadingPasskeys ? (
                <div className="flex items-center justify-center py-6 text-zinc-500 text-xs font-bold gap-2">
                  <Loader2 className="animate-spin text-blue-500" size={16} /> Loading fingerprints...
                </div>
              ) : passkeys.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-[#1e2435] rounded-xl text-zinc-500 text-xs font-semibold">
                  No fingerprints registered yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {passkeys.map((pk) => (
                    <div key={pk.id} className="flex items-center justify-between p-3 rounded-xl bg-[#111520] border border-[#1e2435]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{pk.friendly_name || 'Biometric Key'}</p>
                          <p className="text-[9px] text-zinc-500 font-medium truncate">Added: {new Date(pk.created_at).toLocaleDateString()}</p>
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

            {/* Registration Form */}
            {passkeys.length < 2 ? (
              <form onSubmit={handleRegisterPasskey} className="space-y-3 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Add New Fingerprint</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Father's Phone, Backup"
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    className="flex-1 h-10 px-3 bg-black/40 border border-[#1e2435] rounded-xl text-xs font-semibold text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
                    disabled={registeringPasskey}
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                    disabled={registeringPasskey || !friendlyName.trim()}
                  >
                    {registeringPasskey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>Add</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500/80 font-bold uppercase tracking-wider text-center">
                Maximum 2 fingerprints limit reached.
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-[#1e2435]">
            <button
              onClick={() => setShowBiometricsModal(false)}
              className="w-full h-10 rounded-xl bg-[#1a1f2e] text-[#f0f0f0] border border-[#1e2435] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

