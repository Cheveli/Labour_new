'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, HardHat, ArrowLeft, Upload, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'


export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [utrNumber, setUtrNumber] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [amount, setAmount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  // Fetch the configurable subscription amount
  useEffect(() => {
    async function fetchAmount() {
      try {
        const res = await fetch('/api/subscription-amount')
        const data = await res.json()
        setAmount(data.amount || 1)
      } catch (err) {
        console.error('Failed to load subscription fee:', err)
      }
    }
    fetchAmount()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG/JPG)')
        return
      }
      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be under 5MB')
        return
      }
      setScreenshotFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!screenshotFile) {
      toast.error('Please upload a screenshot of your payment receipt')
      return
    }
    if (utrNumber.trim().length < 12) {
      toast.error('UTR number must be at least 12 digits long')
      return
    }

    setSubmitting(true)

    try {
      // 1. Upload payment screenshot to Supabase Storage
      const fileExt = screenshotFile.name.split('.').pop()
      const fileName = `${Math.random().toString(36).slice(2)}-${Date.now()}.${fileExt}`
      const filePath = `receipts/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(filePath, screenshotFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error('Failed to upload screenshot. Please make sure storage bucket is set up.')
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(filePath)

      // 2. Submit details to the registration API route
      const regRes = await fetch('/api/auth/register-contractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          mobileNumber,
          utrNumber,
          screenshotUrl: publicUrl,
          amount
        })
      })

      const regData = await regRes.json()

      if (!regRes.ok) {
        // Cleanup uploaded file if DB insertion failed
        await supabase.storage.from('payment-screenshots').remove([filePath])
        throw new Error(regData.error || 'Failed to complete registration')
      }

      toast.success('Registration request submitted successfully!')
      // Redirect to login screen
      setTimeout(() => {
        window.location.href = '/login'
      }, 1500)

    } catch (error: any) {
      toast.error(error.message || 'An error occurred during submission')
    } finally {
      setSubmitting(false)
    }
  }

  // Construct UPI deep link
  const upiLink = `upi://pay?pa=chevelisai@ybl&pn=Sai%20Cheveli&am=${amount}&cu=INR&tn=Subscription%20Verification`
  // Generate QR Code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`

  return (
    <div className="min-h-screen bg-[#05070B] text-white p-4 lg:p-8 flex items-center justify-center">
      <div className="mx-auto max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-6 md:min-h-[80vh]">

        {/* Left column: UPI Payment Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="md:col-span-5 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 flex flex-col justify-between order-2 md:order-1"
        >
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/25 grid place-items-center">
                <HardHat className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-sm font-black tracking-wide">Subscription Payment</p>
            </div>

            <div className="text-center p-4 bg-white rounded-2xl mb-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt="UPI Payment QR Code"
                className="w-48 h-48 border-2 border-zinc-100 rounded-lg shadow-sm"
              />
            </div>

            <div className="space-y-3 text-sm text-zinc-300">
              <p className="text-center font-bold text-blue-400 mb-4">Scan QR to pay with GPay / PhonePe / Paytm</p>

              <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">UPI ID</span>
                  <span className="text-white font-mono select-all">chevelisai@ybl</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">Mobile No</span>
                  <span className="text-white font-mono">9550017985</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">Fee</span>
                  <span className="text-emerald-400 font-bold">₹{amount}</span>
                </div>
              </div>

              <div className="text-xs text-zinc-500 leading-relaxed pt-2 space-y-1">
                <p>1. Scan the QR code or pay manually using details.</p>
                <p>2. Complete the ₹{amount} payment.</p>
                <p>3. Note down the 12-digit UTR/UPI reference number.</p>
                <p>4. Take a screenshot of the payment receipt.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-900 mt-6">
            <Link href="/login" className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors">
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        </motion.div>

        {/* Right column: Contractor Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="md:col-span-7 order-1 md:order-2"
        >
          <Card className="h-full border border-zinc-800 bg-zinc-950 shadow-2xl rounded-3xl">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-white">Create Registration</CardTitle>
              <CardDescription className="text-zinc-400">
                Register as a new contractor. Approval will be granted once subscription payment is verified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Personal details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Full Name</label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-12 bg-zinc-900 border-zinc-800 text-white rounded-xl focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Mobile Number</label>
                    <Input
                      type="tel"
                      placeholder="9876543210"
                      pattern="[0-9]{10}"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      required
                      className="h-12 bg-zinc-900 border-zinc-800 text-white rounded-xl focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Email Address</label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-zinc-900 border-zinc-800 text-white rounded-xl focus:border-blue-500"
                  />
                </div>

                {/* UTR reference */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">UTR / Transaction Reference Number</label>
                  <Input
                    type="text"
                    placeholder="12-digit UTR number"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                    required
                    className="h-12 bg-zinc-900 border-zinc-800 text-white font-mono tracking-widest text-center text-lg rounded-xl focus:border-blue-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Provide the exact 12-digit bank reference number to speed up approval.</p>
                </div>

                {/* Screenshot Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Upload Payment Screenshot</label>

                  <div className="relative border-2 border-dashed border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors bg-zinc-900/20 text-center flex flex-col items-center justify-center min-h-[140px] cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      required
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    {screenshotFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 size={36} className="text-emerald-400" />
                        <span className="text-xs font-semibold text-zinc-300 max-w-[240px] truncate">{screenshotFile.name}</span>
                        <span className="text-[10px] text-zinc-500">{(screenshotFile.size / (1024 * 1024)).toFixed(2)} MB - Click to replace</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={32} className="text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                        <span className="text-xs font-bold text-zinc-300">Click to upload payment receipt</span>
                        <span className="text-[10px] text-zinc-500">Supported formats: JPG, PNG (Max 5MB)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 text-base font-black bg-blue-500 hover:bg-blue-600 text-zinc-900 cursor-pointer rounded-xl flex items-center justify-center gap-2 mt-4 shadow-xl shadow-blue-500/10"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting Request...
                    </>
                  ) : (
                    'Submit Verification Request'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </div>
  )
}
