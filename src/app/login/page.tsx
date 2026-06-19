/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { signInWithPasskey } from '@/lib/passkey-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, HardHat, ShieldCheck, Fingerprint, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [loginInput, setLoginInput] = useState('') // Can be email or mobile number
  const [resolvedEmail, setResolvedEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'input' | 'otp'>('input')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleFingerprintLogin = async () => {
    setLoading(true)
    try {
      await signInWithPasskey(supabase)
      toast.success('Biometric verification successful!')
      window.location.href = '/'
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Biometric authentication failed. Ensure your fingerprint is registered.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const isEmail = loginInput.includes('@')
    let emailToSend = loginInput.trim()

    try {
      if (!isEmail) {
        // Look up email by mobile number
        const res = await fetch('/api/auth/lookup-mobile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileNumber: loginInput.trim() })
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to lookup mobile number')
        }

        emailToSend = data.email
      }

      setResolvedEmail(emailToSend)

      const { error } = await supabase.auth.signInWithOtp({
        email: emailToSend,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) throw error

      toast.success('OTP sent to your registered email!')
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
        email: resolvedEmail,
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
        email: resolvedEmail,
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
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:min-h-[90vh]">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-950/60 p-8 lg:p-10 flex flex-col justify-between order-2 lg:order-1"
        >
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="h-11 w-11 rounded-xl bg-blue-500/20 border border-blue-400/40 grid place-items-center">
                <HardHat className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-black tracking-wide">Nirmana</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300/70">Site Management Hub</p>
              </div>
            </div>

            <h1 className="text-3xl lg:text-5xl font-black leading-tight max-w-md">
              Site Operations, <span className="text-blue-400">Secured.</span>
            </h1>
            <p className="mt-4 text-zinc-300 max-w-md">
              Track projects, workforce, payments, and materials from one premium construction control room.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-900 text-xs text-zinc-500">
            For contractor support, contact administrator at saichevelly@gmail.com
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="flex items-center order-1 lg:order-2"
        >
          <Card className="w-full border border-zinc-800 bg-zinc-950/90 shadow-2xl rounded-3xl">
            <CardHeader className="space-y-2">
              <div className="w-12 h-12 bg-blue-500/15 border border-blue-400/30 rounded-xl flex items-center justify-center text-blue-400">
                <ShieldCheck size={22} />
              </div>
              <CardTitle className="text-2xl font-black text-white">Welcome Back</CardTitle>
              <CardDescription className="text-zinc-400">
                {step === 'input' 
                  ? 'Login using your Mobile Number or email (for admins)' 
                  : `Enter the 6-digit OTP sent to your email`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
               {step === 'input' ? (
                <div className="space-y-4">
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Mobile number or Email address"
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      required
                      className="h-12 bg-zinc-900 border-zinc-800 text-white rounded-xl"
                    />
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-black bg-blue-500 hover:bg-blue-600 text-zinc-900 cursor-pointer rounded-xl"
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

                  <div className="relative my-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                      <span className="bg-zinc-950 px-2 text-zinc-500 font-bold">New Contractor?</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => { window.location.href = '/register' }}
                    className="w-full h-12 text-sm font-black bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider rounded-xl"
                    disabled={loading}
                  >
                    <UserPlus className="h-4 w-4 text-emerald-400" />
                    Create New Registration
                  </Button>

                  <div className="relative my-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                      <span className="bg-zinc-950 px-2 text-zinc-500 font-bold">Or use biometrics</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleFingerprintLogin}
                    className="w-full h-12 text-xs font-black bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-blue-400 hover:text-blue-300 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider rounded-xl"
                    disabled={loading}
                  >
                    <Fingerprint className="h-4 w-4 text-blue-400 animate-pulse" />
                    Login with Fingerprint
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <Input
                    type="text"
                    placeholder="000 000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={6}
                    className="h-16 bg-zinc-900 border-zinc-800 text-center text-4xl font-black tracking-[0.3em] text-blue-400 rounded-xl"
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-black bg-blue-500 hover:bg-blue-600 text-zinc-900 rounded-xl"
                    disabled={loading || otp.length !== 6}
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
                    className="w-full h-11 text-sm font-semibold text-blue-400 hover:text-blue-300 hover:bg-zinc-900 rounded-xl"
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

