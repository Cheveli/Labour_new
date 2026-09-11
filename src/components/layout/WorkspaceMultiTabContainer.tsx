'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { 
  LayoutDashboard, 
  CalendarCheck, 
  Package, 
  Wallet, 
  FileText, 
  Building2, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Settings, 
  Plus, 
  X, 
  Maximize2, 
  Minimize2, 
  Columns2, 
  Columns3, 
  Square, 
  ChevronDown, 
  RefreshCw, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { haptic } from '@/lib/haptic'

// Dynamic loaders for dashboard modules to render inside split panes
const AttendanceView = dynamic(() => import('@/app/(dashboard)/attendance/page'), {
  loading: () => <PaneLoading title="Attendance" color="#10b981" />
})
const MaterialsView = dynamic(() => import('@/app/(dashboard)/materials/page'), {
  loading: () => <PaneLoading title="Materials & Inventory" color="#f59e0b" />
})
const PaymentsView = dynamic(() => import('@/app/(dashboard)/payments/page'), {
  loading: () => <PaneLoading title="Payments & Wages" color="#ec4899" />
})
const ReportsView = dynamic(() => import('@/app/(dashboard)/reports/page'), {
  loading: () => <PaneLoading title="Reports & Export" color="#8b5cf6" />
})
const DashboardView = dynamic(() => import('@/app/(dashboard)/page'), {
  loading: () => <PaneLoading title="Overview Dashboard" color="#3b82f6" />
})
const ProjectsView = dynamic(() => import('@/app/(dashboard)/projects/page'), {
  loading: () => <PaneLoading title="Projects & Sites" color="#06b6d4" />
})
const WorkersView = dynamic(() => import('@/app/(dashboard)/labour/page'), {
  loading: () => <PaneLoading title="Workers Directory" color="#14b8a6" />
})
const ContractorPaymentsView = dynamic(() => import('@/app/(dashboard)/contractor-payments/page'), {
  loading: () => <PaneLoading title="Contractor Bills" color="#f97316" />
})
const IncomeView = dynamic(() => import('@/app/(dashboard)/income/page'), {
  loading: () => <PaneLoading title="Income & Advances" color="#22c55e" />
})
const SettingsView = dynamic(() => import('@/app/(dashboard)/settings/page'), {
  loading: () => <PaneLoading title="App Settings" color="#a855f7" />
})

export interface WorkspaceModule {
  id: string
  name: string
  teluguName: string
  path: string
  icon: React.ElementType
  color: string
  description: string
}

export const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    id: 'attendance',
    name: 'Attendance',
    teluguName: 'హాజరు',
    path: '/attendance',
    icon: CalendarCheck,
    color: '#10b981',
    description: 'Track daily & weekly labour attendance'
  },
  {
    id: 'materials',
    name: 'Materials',
    teluguName: 'మెటీరియల్స్',
    path: '/materials',
    icon: Package,
    color: '#f59e0b',
    description: 'Inventory, deliveries, logs & pricing'
  },
  {
    id: 'payments',
    name: 'Payments',
    teluguName: 'చెల్లింపులు',
    path: '/payments',
    icon: Wallet,
    color: '#ec4899',
    description: 'Worker wages, slips & cash settlements'
  },
  {
    id: 'reports',
    name: 'Reports & Bills',
    teluguName: 'రిపోర్టులు',
    path: '/reports',
    icon: FileText,
    color: '#8b5cf6',
    description: 'Export calculation, PDFs & printables'
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    teluguName: 'డ్యాష్‌బోర్డ్',
    path: '/',
    icon: LayoutDashboard,
    color: '#3b82f6',
    description: 'Overview, analytics & quick actions'
  },
  {
    id: 'projects',
    name: 'Projects',
    teluguName: 'ప్రాజెక్టులు',
    path: '/projects',
    icon: Building2,
    color: '#06b6d4',
    description: 'Manage sites, estimations & locations'
  },
  {
    id: 'workers',
    name: 'Workforce',
    teluguName: 'కూలీలు',
    path: '/labour',
    icon: Users,
    color: '#14b8a6',
    description: 'Worker registry, default rates & contacts'
  },
  {
    id: 'contractors',
    name: 'Contractors',
    teluguName: 'కాంట్రాక్టర్లు',
    path: '/contractor-payments',
    icon: Briefcase,
    color: '#f97316',
    description: 'Sub-contractor progress & billing'
  },
  {
    id: 'income',
    name: 'Income',
    teluguName: 'ఆదాయం',
    path: '/income',
    icon: TrendingUp,
    color: '#22c55e',
    description: 'Client receipts, advances & bank credits'
  },
  {
    id: 'settings',
    name: 'Settings',
    teluguName: 'సెట్టింగ్స్',
    path: '/settings',
    icon: Settings,
    color: '#a855f7',
    description: 'System preferences, backup & alerts'
  }
]

export function getModuleByPath(path: string): WorkspaceModule {
  if (path === '/') return WORKSPACE_MODULES.find(m => m.id === 'dashboard')!
  const found = WORKSPACE_MODULES.find(m => m.path !== '/' && (path === m.path || path.startsWith(m.path + '/')))
  return found || WORKSPACE_MODULES[0]
}

function PaneLoading({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[350px] p-6 text-center animate-in fade-in-50">
      <div 
        className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse mb-3"
        style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
      >
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color }} />
      </div>
      <p className="text-xs font-black uppercase tracking-wider text-white">Loading {title}...</p>
      <p className="text-[10px] text-zinc-500 font-bold mt-1">Preparing workspace data...</p>
    </div>
  )
}

interface WorkspacePane {
  id: string
  moduleId: string
  key: number
}

interface WorkspaceMultiTabContainerProps {
  children: React.ReactNode
}

export default function WorkspaceMultiTabContainer({ children }: WorkspaceMultiTabContainerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const currentModule = getModuleByPath(pathname)

  const [panes, setPanes] = useState<WorkspacePane[]>([
    { id: 'pane-1', moduleId: currentModule.id, key: Date.now() }
  ])
  const [maximizedPaneId, setMaximizePaneId] = useState<string | null>(null)
  const [isModulePickerOpen, setIsModulePickerOpen] = useState(false)
  const [switchingPaneId, setSwitchingPaneId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync first pane if user navigates via regular URL / sidebar when 1 pane is active
  useEffect(() => {
    if (panes.length === 1 && panes[0].moduleId !== currentModule.id) {
      setPanes([{ id: panes[0].id, moduleId: currentModule.id, key: Date.now() }])
    }
  }, [pathname, currentModule.id, panes.length])

  const handleAddPane = () => {
    if (panes.length >= 3) {
      toast.info('Maximum 3 split workspaces allowed simultaneously')
      return
    }
    haptic(20)
    setSwitchingPaneId(null)
    setIsModulePickerOpen(true)
  }

  const handleSelectModuleForNewPane = (mod: WorkspaceModule) => {
    if (switchingPaneId) {
      // Switching an existing pane
      setPanes(prev => prev.map(p => p.id === switchingPaneId ? { ...p, moduleId: mod.id, key: Date.now() } : p))
      setSwitchingPaneId(null)
      toast.success(`Switched pane to ${mod.name}`)
    } else {
      // Adding a new pane
      if (panes.length >= 3) return
      const newId = `pane-${Date.now()}`
      setPanes(prev => [...prev, { id: newId, moduleId: mod.id, key: Date.now() }])
      toast.success(`Opened ${mod.name} in split view`)
    }
    setIsModulePickerOpen(false)
  }

  const handleClosePane = (paneId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    haptic(15)
    if (panes.length <= 1) return

    setPanes(prev => {
      const filtered = prev.filter(p => p.id !== paneId)
      return filtered
    })

    if (maximizedPaneId === paneId) {
      setMaximizePaneId(null)
    }
  }

  const handleRefreshPane = (paneId: string) => {
    haptic(15)
    setPanes(prev => prev.map(p => p.id === paneId ? { ...p, key: Date.now() } : p))
    toast.success('Workspace pane refreshed')
  }

  const renderModuleComponent = (moduleId: string, paneId: string) => {
    // If only 1 pane is open and it matches the current route, render Next.js children for instant SSR & SEO
    if (panes.length === 1 && moduleId === currentModule.id) {
      return children
    }

    switch (moduleId) {
      case 'attendance':
        return <AttendanceView />
      case 'materials':
        return <MaterialsView />
      case 'payments':
        return <PaymentsView />
      case 'reports':
        return <ReportsView />
      case 'dashboard':
        return <DashboardView />
      case 'projects':
        return <ProjectsView />
      case 'workers':
        return <WorkersView />
      case 'contractors':
        return <ContractorPaymentsView />
      case 'income':
        return <IncomeView />
      case 'settings':
        return <SettingsView />
      default:
        return children
    }
  }

  const paneCount = panes.length

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      {/* Top Workspace Tab Bar (Desktop Only) */}
      <div 
        className="hidden lg:flex items-center justify-between gap-3 px-3 py-2 mb-3 rounded-2xl border"
        style={{
          backgroundColor: '#0d1018',
          borderColor: '#1e2435',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        {/* Left: Tab list */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
          <div className="flex items-center gap-1.5 pr-2 border-r border-[#1e2435] shrink-0">
            <Layers size={14} className="text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Workspace
            </span>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {paneCount}/3
            </span>
          </div>

          {panes.map((pane, idx) => {
            const mod = WORKSPACE_MODULES.find(m => m.id === pane.moduleId) || WORKSPACE_MODULES[0]
            const Icon = mod.icon
            const isMaximized = maximizedPaneId === pane.id

            return (
              <div
                key={pane.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none",
                  isMaximized
                    ? "bg-blue-600/15 border-blue-500/40 text-white shadow-lg shadow-blue-500/10"
                    : "bg-[#111520] border-[#1e2435] text-zinc-300 hover:border-zinc-700 hover:text-white"
                )}
                style={
                  !isMaximized
                    ? { borderLeft: `3px solid ${mod.color}` }
                    : { borderLeft: `3px solid ${mod.color}` }
                }
                onClick={() => {
                  if (maximizedPaneId && maximizedPaneId !== pane.id) {
                    setMaximizePaneId(pane.id)
                  }
                }}
              >
                <div 
                  className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${mod.color}20` }}
                >
                  <Icon size={12} style={{ color: mod.color }} />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black tracking-tight uppercase truncate">
                      {mod.name}
                    </span>
                    <span className="text-[8px] font-bold text-zinc-500 hidden xl:inline">
                      ({mod.teluguName})
                    </span>
                  </div>
                </div>

                {/* Pane switch dropdown button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSwitchingPaneId(pane.id)
                    setIsModulePickerOpen(true)
                  }}
                  className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                  title="Switch module"
                >
                  <ChevronDown size={12} />
                </button>

                {/* Close tab button (if > 1 pane) */}
                {panes.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleClosePane(pane.id, e)}
                    className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-0.5"
                    title="Close tab pane"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}

          {/* Plus Add Tab Button (Enabled when < 3 panes) */}
          {panes.length < 3 ? (
            <button
              type="button"
              onClick={handleAddPane}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 hover:text-blue-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              title="Add split workspace tab (Max 3)"
            >
              <Plus size={14} />
              <span>Add Tab</span>
            </button>
          ) : (
            <div 
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-black uppercase tracking-wider cursor-not-allowed select-none shrink-0"
              title="Maximum 3 tabs limit reached"
            >
              <span>Max 3 Tabs</span>
            </div>
          )}
        </div>

        {/* Right: Layout Preset Controls */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-[#1e2435] shrink-0">
          <div className="flex bg-[#111520] p-0.5 rounded-xl border border-[#1e2435]">
            <button
              type="button"
              onClick={() => {
                if (panes.length > 1) {
                  setPanes([panes[0]])
                  setMaximizePaneId(null)
                  toast.info('Switched to single workspace layout')
                }
              }}
              className={cn(
                "px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer",
                paneCount === 1 && !maximizedPaneId
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Single view (100%)"
            >
              <Square size={10} />
              <span>Single</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (panes.length === 1) {
                  const remaining = WORKSPACE_MODULES.filter(m => m.id !== panes[0].moduleId)
                  const secondMod = remaining.find(m => m.id === 'materials') || remaining[0]
                  setPanes([...panes, { id: `pane-${Date.now()}`, moduleId: secondMod.id, key: Date.now() }])
                  setMaximizePaneId(null)
                } else if (panes.length === 3) {
                  setPanes([panes[0], panes[1]])
                  setMaximizePaneId(null)
                }
              }}
              className={cn(
                "px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer",
                paneCount === 2 && !maximizedPaneId
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Dual split view (50% / 50%)"
            >
              <Columns2 size={10} />
              <span>Split (2)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (panes.length === 1) {
                  const m1 = panes[0].moduleId
                  const m2 = m1 === 'attendance' ? 'materials' : 'attendance'
                  const m3 = (m1 !== 'payments' && m2 !== 'payments') ? 'payments' : 'reports'
                  setPanes([
                    panes[0],
                    { id: `pane-${Date.now()}-2`, moduleId: m2, key: Date.now() + 1 },
                    { id: `pane-${Date.now()}-3`, moduleId: m3, key: Date.now() + 2 }
                  ])
                  setMaximizePaneId(null)
                } else if (panes.length === 2) {
                  const used = panes.map(p => p.moduleId)
                  const nextMod = WORKSPACE_MODULES.find(m => !used.includes(m.id)) || WORKSPACE_MODULES[0]
                  setPanes([...panes, { id: `pane-${Date.now()}`, moduleId: nextMod.id, key: Date.now() }])
                  setMaximizePaneId(null)
                }
              }}
              className={cn(
                "px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer",
                paneCount === 3 && !maximizedPaneId
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Tri split view (33% / 33% / 33%)"
            >
              <Columns3 size={10} />
              <span>Tri (3)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area: Side-by-side rectangular blocks */}
      <div className="flex-1 min-h-0 w-full">
        {/* On Mobile: Always standard 1-column view */}
        <div className="lg:hidden w-full h-full">
          {children}
        </div>

        {/* On Desktop: Dynamic multi-pane grid / flex split */}
        <div className="hidden lg:block w-full h-full">
          {maximizedPaneId ? (
            /* Focus / Maximized Single Pane Mode */
            (() => {
              const maxPane = panes.find(p => p.id === maximizedPaneId) || panes[0]
              const mod = WORKSPACE_MODULES.find(m => m.id === maxPane.moduleId) || WORKSPACE_MODULES[0]
              const Icon = mod.icon

              return (
                <div 
                  key={maxPane.key}
                  className="rounded-2xl border flex flex-col h-[calc(100vh-130px)] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
                  style={{ backgroundColor: '#0d1018', borderColor: '#1e2435' }}
                >
                  <div 
                    className="flex items-center justify-between px-4 py-2 border-b shrink-0 select-none"
                    style={{ backgroundColor: '#111520', borderColor: '#1e2435' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${mod.color}20` }}>
                        <Icon size={14} style={{ color: mod.color }} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-white">
                        {mod.name} <span className="text-zinc-500 text-[10px]">({mod.teluguName})</span>
                      </span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Maximized View
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRefreshPane(maxPane.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                        title="Refresh pane"
                      >
                        <RefreshCw size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaximizePaneId(null)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                        title="Restore split view"
                      >
                        <Minimize2 size={12} />
                        <span>Restore Split</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {renderModuleComponent(maxPane.moduleId, maxPane.id)}
                  </div>
                </div>
              )
            })()
          ) : (
            /* Multi-Pane Split Workspace Grid */
            <div 
              className={cn(
                "grid gap-3 w-full h-full transition-all duration-300",
                paneCount === 1 && "grid-cols-1",
                paneCount === 2 && "grid-cols-2",
                paneCount === 3 && "grid-cols-3"
              )}
            >
              {panes.map((pane, idx) => {
                const mod = WORKSPACE_MODULES.find(m => m.id === pane.moduleId) || WORKSPACE_MODULES[0]
                const Icon = mod.icon

                return (
                  <div
                    key={`${pane.id}-${pane.key}`}
                    className="rounded-2xl border flex flex-col h-[calc(100vh-130px)] min-h-[500px] overflow-hidden shadow-2xl transition-all relative"
                    style={{
                      backgroundColor: '#0c0f17',
                      borderColor: '#1e2435',
                      background: 'linear-gradient(180deg, #0f131f 0%, #0a0c12 100%)'
                    }}
                  >
                    {/* Pane Mini Toolbar Header */}
                    <div 
                      className="flex items-center justify-between px-3 py-2 border-b shrink-0 select-none"
                      style={{ 
                        backgroundColor: '#111520', 
                        borderColor: '#1e2435',
                        borderTop: `2px solid ${mod.color}` 
                      }}
                    >
                      {/* Left: Module identity + Switcher button */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${mod.color}20` }}
                        >
                          <Icon size={13} style={{ color: mod.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-tight text-white truncate flex items-center gap-1.5">
                            <span>{mod.name}</span>
                            <span className="text-[8px] font-bold text-zinc-500 hidden xl:inline">
                              {mod.teluguName}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Switch module button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSwitchingPaneId(pane.id)
                            setIsModulePickerOpen(true)
                          }}
                          className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer flex items-center gap-1"
                          title="Switch module in this pane"
                        >
                          <span>Switch</span>
                          <ChevronDown size={10} />
                        </button>

                        {/* Refresh */}
                        <button
                          type="button"
                          onClick={() => handleRefreshPane(pane.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title="Refresh pane"
                        >
                          <RefreshCw size={12} />
                        </button>

                        {/* Maximize toggle */}
                        <button
                          type="button"
                          onClick={() => setMaximizePaneId(pane.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title="Maximize pane"
                        >
                          <Maximize2 size={12} />
                        </button>

                        {/* Close pane (if > 1 pane) */}
                        {panes.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleClosePane(pane.id, e)}
                            className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Close pane"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pane Content Body with isolated scrolling */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-3">
                      {renderModuleComponent(pane.moduleId, pane.id)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Module Selector Modal / Dialog */}
      {isModulePickerOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in-50"
          onClick={() => setIsModulePickerOpen(false)}
        >
          <div 
            className="rounded-2xl p-6 w-full max-w-xl shadow-2xl border animate-in zoom-in-95 flex flex-col space-y-5"
            style={{ backgroundColor: '#111520', borderColor: '#1e2435' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2435]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {switchingPaneId ? 'Switch Workspace Module' : 'Open in Split Workspace'}
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                    Select a section to work simultaneously
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModulePickerOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Module Cards Grid */}
            <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {WORKSPACE_MODULES.map((mod) => {
                const Icon = mod.icon
                const isCurrentlyOpen = panes.some(p => p.moduleId === mod.id)

                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectModuleForNewPane(mod)}
                    className={cn(
                      "group p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer relative overflow-hidden",
                      isCurrentlyOpen
                        ? "bg-[#0d1018] border-zinc-800 hover:border-zinc-700"
                        : "bg-[#0d1018]/80 hover:bg-[#151a28] border-[#1e2435] hover:border-blue-500/50 hover:shadow-lg"
                    )}
                    style={{ borderLeft: `3px solid ${mod.color}` }}
                  >
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: `${mod.color}15`, border: `1px solid ${mod.color}30` }}
                    >
                      <Icon size={18} style={{ color: mod.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-black uppercase text-white tracking-wide group-hover:text-blue-400 transition-colors truncate">
                          {mod.name}
                        </p>
                        {isCurrentlyOpen && (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                            Open
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-zinc-500 mt-0.5">
                        {mod.teluguName}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-medium line-clamp-1 mt-1">
                        {mod.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="pt-2 border-t border-[#1e2435] flex justify-between items-center text-[10px] text-zinc-500 font-bold">
              <span>Tip: You can open up to 3 split tabs side-by-side.</span>
              <button
                type="button"
                onClick={() => setIsModulePickerOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white uppercase font-black"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
