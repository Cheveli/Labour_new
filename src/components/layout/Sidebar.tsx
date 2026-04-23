'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  CalendarCheck, 
  Wallet, 
  Package, 
  TrendingUp, 
  PlusSquare,
  Menu,
  X,
  LogOut,
  Moon,
  Sun
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Projects', icon: Briefcase, href: '/projects' },
  { label: 'Labour', icon: Users, href: '/labour' },
  { label: 'Attendance', icon: CalendarCheck, href: '/attendance' },
  { label: 'Payments', icon: Wallet, href: '/payments' },
  { label: 'Materials', icon: Package, href: '/materials' },
  { label: 'Income', icon: TrendingUp, href: '/income' },
  { label: 'Extra Work', icon: PlusSquare, href: '/extra-work' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = React.useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-black border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-4 z-50">
        <h1 className="text-xl font-bold text-blue-600">ProBuild</h1>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white dark:bg-black border-r border-gray-100 dark:border-zinc-900 z-40">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-500 flex items-center gap-2">
            <Briefcase size={28} />
            ProBuild
          </h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none" 
                    : "text-gray-600 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-zinc-900 hover:text-blue-600"
                )}
              >
                <Icon size={20} className={cn(isActive ? "text-white" : "text-blue-600 dark:text-zinc-500 group-hover:text-blue-600")} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-zinc-900 space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 rounded-xl text-gray-600 dark:text-zinc-400"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-blue-600" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-black z-[70] lg:hidden flex flex-col"
            >
              <div className="p-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-blue-600">ProBuild</h1>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X />
                </Button>
              </div>
              <nav className="flex-1 px-4 overflow-y-auto space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                        isActive 
                          ? "bg-blue-600 text-white shadow-lg" 
                          : "text-gray-600 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-zinc-900"
                      )}
                    >
                      <Icon size={20} className={cn(isActive ? "text-white" : "text-blue-600")} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
              <div className="p-4 border-t border-gray-100 dark:border-zinc-900">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 rounded-xl mb-2"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  Theme
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start gap-3 rounded-xl text-red-500"
                  onClick={handleLogout}
                >
                  <LogOut size={20} />
                  Logout
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
