'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Check, X, Calendar, Phone, Mail, FileText, Image as ImageIcon, ExternalLink, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export default function SubscriptionRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [feeInput, setFeeInput] = useState('1')
  const [updatingFee, setUpdatingFee] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email === 'saichevelly@gmail.com') {
        setIsAdmin(true)
        fetchRequests()
        fetchFee()
      } else {
        toast.error('Access Denied. Super Admin only.')
        window.location.href = '/'
      }
    }
    checkUser()
  }, [])

  async function fetchFee() {
    try {
      const res = await fetch('/api/subscription-amount')
      const data = await res.json()
      setFeeInput(String(data.amount || 1))
    } catch (err) {
      console.error('Failed to fetch fee:', err)
    }
  }

  async function fetchRequests() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/subscription-requests')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch requests')
      setRequests(data)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load subscription requests')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateFee = async () => {
    setUpdatingFee(true)
    try {
      const res = await fetch('/api/subscription-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(feeInput) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update fee')
      toast.success('Subscription amount updated successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update amount')
    } finally {
      setUpdatingFee(false)
    }
  }

  const handleApprove = async (userId: string, paymentId: string) => {
    if (!confirm('Are you sure you want to approve this contractor?')) return
    setActioningId(userId)
    try {
      const res = await fetch('/api/admin/approve-contractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, paymentId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Approval failed')
      toast.success(data.message || 'Contractor approved successfully')
      fetchRequests() // reload list
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve contractor')
    } finally {
      setActioningId(null)
    }
  }

  const handleReject = async (userId: string, paymentId: string) => {
    if (!confirm('Are you sure you want to reject this registration?')) return
    setActioningId(userId)
    try {
      const res = await fetch('/api/admin/reject-contractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, paymentId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rejection failed')
      toast.success(data.message || 'Contractor rejected')
      fetchRequests() // reload list
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject contractor')
    } finally {
      setActioningId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-zinc-400">
        <Loader2 className="animate-spin mr-2" /> Verifying administrator status...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="h-8 w-8 text-blue-400" />
            Contractor Subscription Requests
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Review and approve registered contractors by checking their UTR transaction references and receipts.
          </p>
        </div>
      </div>

      {/* Dynamic Fee Configuration Widget */}
      <Card className="border border-zinc-800 bg-zinc-950/40 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-300">Subscription Fee Settings</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Define the active registration amount payable by new contractors.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto items-center">
          <span className="text-sm font-bold text-zinc-400">₹</span>
          <Input 
            type="number" 
            value={feeInput}
            onChange={(e) => setFeeInput(e.target.value)}
            className="w-24 h-10 bg-zinc-900 border-zinc-800 text-white font-mono font-bold rounded-xl"
            min={0}
          />
          <Button 
            size="sm" 
            onClick={handleUpdateFee}
            disabled={updatingFee}
            className="bg-blue-500 hover:bg-blue-600 text-zinc-900 font-bold h-10 rounded-xl px-4 cursor-pointer"
          >
            {updatingFee ? 'Saving...' : 'Update Fee'}
          </Button>
        </div>
      </Card>


      {loading ? (
        <div className="flex h-60 items-center justify-center text-zinc-400">
          <Loader2 className="animate-spin mr-2" /> Loading pending requests...
        </div>
      ) : requests.length === 0 ? (
        <Card className="border border-zinc-800 bg-zinc-950/60 p-12 text-center rounded-3xl">
          <CardContent className="space-y-3 pt-6">
            <ImageIcon className="mx-auto h-12 w-12 text-zinc-600" />
            <h3 className="text-lg font-bold text-zinc-300">All caught up!</h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              There are no pending contractor subscription requests needing payment verification.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests.map((req) => {
            const payment = req.subscription_payments?.[0] || {}
            const isProcessing = actioningId === req.id

            return (
              <Card key={req.id} className="border border-zinc-800 bg-zinc-950/90 shadow-xl rounded-3xl overflow-hidden flex flex-col justify-between">
                <CardHeader className="border-b border-zinc-900 pb-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md capitalize mb-2">
                        {req.account_status} approval
                      </Badge>
                      <CardTitle className="text-xl font-bold text-white leading-tight">{req.full_name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="border-zinc-800 text-zinc-400 text-[10px] font-mono">
                      ₹{payment.amount || 1}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4 pt-5 flex-1">
                  {/* Personal details */}
                  <div className="grid grid-cols-1 gap-2 text-sm text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-zinc-500" />
                      <span>{req.mobile_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-zinc-500" />
                      <span className="truncate">{req.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-zinc-500" />
                      <span>Registered: {new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider">UTR Number</span>
                      <span className="text-blue-400 font-mono select-all font-bold text-sm bg-blue-500/5 px-2 py-0.5 border border-blue-500/10 rounded">{payment.utr_number || 'N/A'}</span>
                    </div>
                    
                    {payment.screenshot_url ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Screenshot Receipt</span>
                        
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger render={<button className="inline-flex shrink-0 items-center justify-center border text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white cursor-pointer h-7 px-2.5 rounded-lg gap-1.5 bg-zinc-900" />}>
                              <ImageIcon size={12} className="h-3 w-3" /> Preview
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] max-w-3xl bg-zinc-950 border-zinc-800 text-white rounded-3xl p-4 sm:p-6">
                              <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-white mb-2">UTR Receipt: {payment.utr_number}</DialogTitle>
                              </DialogHeader>
                              <div className="flex justify-center overflow-auto max-h-[80vh] rounded-xl border border-zinc-900 bg-zinc-900/40">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={payment.screenshot_url}
                                  alt="Receipt Screenshot"
                                  className="max-w-full h-auto rounded-lg object-contain"
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <a
                            href={payment.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="xs" variant="outline" className="text-xs border-zinc-800 text-blue-400 hover:text-blue-300 cursor-pointer h-7">
                              <ExternalLink size={12} className="mr-1" /> Open
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-rose-400">Missing payment receipt file.</div>
                    )}
                  </div>
                </CardContent>

                {/* Approve/Reject Actions */}
                <div className="border-t border-zinc-900 p-4 bg-zinc-900/10 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => handleApprove(req.id, payment.id)}
                    disabled={isProcessing}
                    className="w-full sm:flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer rounded-xl flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check size={16} /> Approve Account
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => handleReject(req.id, payment.id)}
                    disabled={isProcessing}
                    variant="outline"
                    className="w-full sm:flex-1 h-11 border-zinc-800 hover:bg-zinc-800/20 text-rose-400 hover:text-rose-300 cursor-pointer rounded-xl flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X size={16} /> Reject
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
