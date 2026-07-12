'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, HardHat, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

export default function ClientLoginPage() {
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailOrPhone || !password) {
      toast.error('Email/Mobile and Password are required')
      return
    }

    setLoading(true)
    try {
      let loginEmail = emailOrPhone.trim()

      // If it looks like a phone number (e.g. only digits, length >= 8)
      if (/^\d+$/.test(loginEmail)) {
        const { data: allProj } = await supabase.from('projects').select('description')
        let foundEmail = null
        if (allProj) {
          for (const p of allProj) {
            if (p.description && p.description.startsWith('{')) {
              try {
                const parsed = JSON.parse(p.description)
                if (parsed.client_mobile?.trim() === loginEmail) {
                  foundEmail = parsed.client_email
                  break
                }
              } catch (e) {}
            }
          }
        }
        if (foundEmail) {
          loginEmail = foundEmail
        } else {
          throw new Error('No client account linked to this mobile number.')
        }
      }

      // 1. Authenticate user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password
      })

      if (authError) throw authError

      // 2. Query user profile to verify role
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role, account_status')
        .eq('id', authData.user?.id)
        .single()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        throw new Error('User profile not found.')
      }

      if (profile.role !== 'client') {
        await supabase.auth.signOut()
        throw new Error('Access denied. This login is reserved for client accounts.')
      }

      toast.success('Login successful!')
      window.location.href = '/client/dashboard'
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed. Please verify credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#05070B] text-white p-4 lg:p-8 flex items-center justify-center">
      <div className="mx-auto max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-950/40 p-6 sm:p-8 space-y-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-2 justify-center">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-400/40 grid place-items-center">
              <HardHat className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-md font-black tracking-wide">Nirmana</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-blue-300/70">Client Portal Hub</p>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black tracking-tight">Client Portal Access</h1>
            <p className="text-xs text-zinc-400">Enter your registered email and password provided by the contractor.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Email or Mobile Number</label>
              <input
                type="text"
                placeholder="e.g. client@example.com or 9999999999"
                value={emailOrPhone}
                onChange={e => setEmailOrPhone(e.target.value)}
                className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-zinc-800 bg-zinc-950 text-white focus:border-blue-500/50 transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-11 px-3 rounded-xl text-sm font-semibold outline-none border border-zinc-800 bg-zinc-950 text-white focus:border-blue-500/50 transition-colors"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign In to Portal
            </Button>
          </form>

          <div className="text-center text-[10px] text-zinc-500 pt-2">
            Having trouble logging in? Contact your contractor for assistance.
          </div>
        </motion.div>
      </div>
    </div>
  )
}
