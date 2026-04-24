'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, HardHat, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) throw error

      toast.success('OTP sent to your email!')
      setStep('otp')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })

      if (error) throw error

      toast.success('Login successful!')
      window.location.href = '/'
    } catch (error: any) {
      toast.error(error.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      })
      if (error) throw error
      toast.success('New OTP sent!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#05070B] text-white p-4 lg:p-8">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[90vh]">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-950/60 p-8 lg:p-10"
        >
          <div className="flex items-center gap-3 mb-10">
            <div className="h-11 w-11 rounded-xl bg-blue-500/20 border border-blue-400/40 grid place-items-center">
              <HardHat className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-black tracking-wide">LABOUR</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300/70">Management System</p>
            </div>
          </div>

          <h1 className="text-3xl lg:text-5xl font-black leading-tight max-w-md">
            Site Operations, <span className="text-blue-400">Secured.</span>
          </h1>
          <p className="mt-4 text-zinc-300 max-w-md">
            Track projects, workforce, payments, and materials from one premium construction control room.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs text-zinc-400 uppercase tracking-widest">Active Sites</p>
              <p className="text-2xl font-black text-blue-400">12</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs text-zinc-400 uppercase tracking-widest">Workforce</p>
              <p className="text-2xl font-black text-emerald-400">128</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="flex items-center"
        >
          <Card className="w-full border border-zinc-800 bg-zinc-950/90 shadow-2xl rounded-3xl">
            <CardHeader className="space-y-2">
              <div className="w-12 h-12 bg-blue-500/15 border border-blue-400/30 rounded-xl flex items-center justify-center text-blue-400">
                <ShieldCheck size={22} />
              </div>
              <CardTitle className="text-2xl font-black text-white">Welcome Back</CardTitle>
              <CardDescription className="text-zinc-400">
                {step === 'email' ? 'Login with your registered email' : 'Enter the 8-digit OTP sent to your email'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'email' ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-zinc-900 border-zinc-800 text-white"
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-black bg-blue-500 hover:bg-blue-600 text-zinc-900"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      'Send OTP'
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Enter 8-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={8}
                    className="h-12 bg-zinc-900 border-zinc-800 text-center text-2xl tracking-widest text-white"
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-black bg-blue-500 hover:bg-blue-600 text-zinc-900"
                    disabled={loading || otp.length !== 8}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Login'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-11 text-sm font-semibold text-blue-400 hover:text-blue-300 hover:bg-zinc-900"
                    onClick={handleResendOTP}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Resend OTP
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
