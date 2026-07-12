'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, MessageCircle, Info } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { playChatSound, showWebNotification } from '@/lib/audio-effects'

export default function ClientChatPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [newChatMessage, setNewChatMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/client/project-data')
        if (!res.ok) throw new Error('Failed to load project details.')
        const resData = await res.json()
        setData(resData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Auto scroll chat body to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (data?.project?.id) {
      localStorage.setItem(`ssc_client_chat_last_read_${data.project.id}`, new Date().toISOString())
      window.dispatchEvent(new Event('ssc_client_chat_read_reset'))
    }
    scrollToBottom()
  }, [data?.project?.chat, data?.project?.id])

  // Subscribe to real-time chat updates
  useEffect(() => {
    if (!data?.project?.id) return

    const channel = supabase
      .channel(`client-chat-${data.project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${data.project.id}`
        },
        (payload) => {
          const desc = payload.new.description
          if (desc && desc.startsWith('{')) {
            try {
              const parsed = JSON.parse(desc)
              const newChat = parsed.chat || []
              if (newChat.length > 0) {
                const lastMsg = newChat[newChat.length - 1]
                if (lastMsg.sender === 'contractor') {
                  showWebNotification('New Message from Builder 👷', lastMsg.text)
                }
              }
              setData((prev: any) => {
                if (!prev) return prev
                return {
                  ...prev,
                  project: {
                    ...prev.project,
                    chat: newChat
                  }
                }
              })
            } catch (e) {
              console.error('Error parsing realtime chat updates:', e)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [data?.project?.id])

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  if (!data?.project) return (
    <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl mt-12 space-y-4 max-w-md mx-auto text-white">
      <Info className="mx-auto text-zinc-500" size={32} />
      <h2 className="text-lg font-bold">No Project Associated</h2>
      <p className="text-xs text-zinc-400">Please contact the administrator or your contractor to link this client profile to your active site project.</p>
    </div>
  )

  const { project, companyDetails } = data
  const chatMessages = project.chat || []

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatMessage.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/client/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newChatMessage.trim(),
          projectId: project.id
        })
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to send message')
      }

      playChatSound('send')

      setData((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          project: {
            ...prev.project,
            chat: resData.chat
          }
        }
      })
      setNewChatMessage('')
    } catch (err: any) {
      toast.error('Message failed: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Communications,</p>
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-1">Contractor Chat</h1>
        <p className="text-xs text-zinc-400 mt-1">One-to-one messaging channel with Sri Sai Constructions.</p>
      </div>

      <Card className="border-none shadow-xl bg-white dark:bg-black overflow-hidden flex flex-col h-[580px]" style={PANEL}>
        {/* Chat Header */}
        <div className="p-4 border-b border-[#1e2435] bg-gray-50/50 dark:bg-zinc-950/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/25 grid place-items-center">
              <MessageCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase leading-none">{project.name}</p>
              <p className="text-[8px] uppercase tracking-widest text-zinc-500 mt-1.5 font-bold">Client: {project.owner_name} / Builder: {companyDetails.contractor}</p>
            </div>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/20 dark:bg-zinc-950/10 custom-scrollbar flex flex-col">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8 flex-1">
              <p className="text-sm text-zinc-500 italic">No messages exchanged yet. Send a greeting message to start chatting with your contractor!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatMessages.map((msg: any, idx: number) => {
                const isClient = msg.sender === 'client'
                return (
                  <div key={idx} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl p-4 space-y-1 shadow-sm ${
                      isClient 
                        ? 'bg-blue-600 text-white rounded-tr-none font-semibold' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-tl-none font-semibold'
                    }`}>
                      <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                      <p className={`text-[8px] text-right font-bold mt-1 opacity-70`}>
                        {format(new Date(msg.timestamp), 'hh:mm a')}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-[#1e2435] bg-white dark:bg-zinc-950 flex gap-3 shrink-0">
          <input
            type="text"
            placeholder="Type your message here..."
            value={newChatMessage}
            onChange={e => setNewChatMessage(e.target.value)}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold outline-none border border-zinc-800 bg-[#0d1018] text-white focus:border-blue-500/50"
            disabled={sending}
          />
          <Button type="submit" className="bg-blue-600 rounded-xl px-6 h-11 text-white font-bold" disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
          </Button>
        </form>
      </Card>

    </div>
  )
}
