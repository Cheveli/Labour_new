'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ShieldAlert, LogOut } from 'lucide-react'
import { useState } from 'react'

export default function PendingVerificationPage() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleLogout = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#05070B] text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-zinc-800 bg-zinc-950/90 shadow-2xl rounded-3xl text-center">
        <CardHeader className="space-y-4 pt-8">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-400/20 rounded-2xl flex items-center justify-center text-amber-400">
            <ShieldAlert size={32} className="animate-pulse" />
          </div>
          <CardTitle className="text-2xl font-black text-white">Verification Pending</CardTitle>
          <CardDescription className="text-zinc-400 max-w-sm mx-auto">
            Your account is pending admin verification. You will receive confirmation once approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-sm text-zinc-400 leading-relaxed text-left">
            <p className="font-bold text-zinc-300 mb-1">What happens next?</p>
            Our administration is reviewing your subscription payment. Once the UTR number and receipt screenshot are validated, your dashboard access will activate automatically.
          </div>

          <Button
            onClick={handleLogout}
            disabled={loading}
            variant="outline"
            className="w-full h-12 text-sm font-semibold border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Sign Out & Switch Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
