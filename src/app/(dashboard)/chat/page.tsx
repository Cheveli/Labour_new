'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, MessageCircle, Info } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { playChatSound, showWebNotification } from '@/lib/audio-effects'

export default function ContractorChatPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projectData, setProjectData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [newChatMessage, setNewChatMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load all projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .neq('status', 'SYSTEM')
          .order('name', { ascending: true })

        if (error) throw error
        setProjects(data || [])
        if (data && data.length > 0) {
          setSelectedProjectId(data[0].id)
        }
      } catch (err: any) {
        toast.error('Failed to load projects: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

  // Load chat messages when a project is selected
  useEffect(() => {
    if (!selectedProjectId) return

    // Initialize/Reset read state for contractor
    localStorage.setItem(`ssc_chat_last_read_${selectedProjectId}`, new Date().toISOString())
    window.dispatchEvent(new Event('ssc_chat_read_reset'))

    async function loadProjectDetails() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', selectedProjectId)
        .single()

      if (data) {
        setProjectData(data)
        if (data.description && data.description.startsWith('{')) {
          try {
            const parsed = JSON.parse(data.description)
            setChatMessages(parsed.chat || [])
          } catch (e) {
            setChatMessages([])
          }
        } else {
          setChatMessages([])
        }
      }
    }
    loadProjectDetails()

    // Subscribe to real-time chat updates
    const channel = supabase
      .channel(`contractor-chat-${selectedProjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${selectedProjectId}`
        },
        (payload) => {
          const desc = payload.new.description
          if (desc && desc.startsWith('{')) {
            try {
              const parsed = JSON.parse(desc)
              const newChat = parsed.chat || []
              if (newChat.length > 0) {
                const lastMsg = newChat[newChat.length - 1]
                if (lastMsg.sender === 'client') {
                  showWebNotification('New Message from Client 👤', lastMsg.text)
                }
              }
              setChatMessages(newChat)
            } catch (e) {
              console.error('Error parsing contractor chat updates:', e)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedProjectId])

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem(`ssc_chat_last_read_${selectedProjectId}`, new Date().toISOString())
      window.dispatchEvent(new Event('ssc_chat_read_reset'))
    }
    scrollToBottom()
  }, [chatMessages, selectedProjectId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatMessage.trim() || !selectedProjectId || sending) return

    setSending(true)
    try {
      // 1. Fetch latest description payload
      const { data: latestProj } = await supabase
        .from('projects')
        .select('description')
        .eq('id', selectedProjectId)
        .single()

      let meta = {
        address: '',
        project_type: 'Material Contract',
        client_email: '',
        client_mobile: '',
        client_id: null,
        progress_updates: [],
        chat: [],
        money_requests: [],
        material_requests: []
      }

      if (latestProj?.description && latestProj.description.startsWith('{')) {
        try {
          meta = { ...meta, ...JSON.parse(latestProj.description) }
        } catch (e) {}
      } else {
        meta.address = latestProj?.description || ''
      }

      const newMessage = {
        sender: 'contractor',
        text: newChatMessage.trim(),
        timestamp: new Date().toISOString()
      }

      const updatedPayload = JSON.stringify({
        ...meta,
        chat: [...(meta.chat || []), newMessage]
      })

      const { error } = await supabase
        .from('projects')
        .update({ description: updatedPayload })
        .eq('id', selectedProjectId)

      if (error) throw error

      playChatSound('send')

      setChatMessages(prev => [...prev, newMessage])
      setNewChatMessage('')
    } catch (err: any) {
      toast.error('Failed to send message: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const PANEL = { backgroundColor: '#111520', border: '1px solid #1e2435', borderRadius: '1.25rem' }

  if (loading) return (
    <div className="h-[70vh] flex items-center justify-center">
      <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Client Portal Chats</h1>
        <p className="text-xs text-zinc-400 mt-1">One-to-one real-time messenger with your site clients.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[600px]">
        
        {/* Projects Selector Sidebar */}
        <div style={PANEL} className="lg:col-span-4 p-4 flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Active Site Projects</p>
          <div className="space-y-2 flex-1">
            {projects.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No projects found.</p>
            ) : (
              projects.map(p => {
                const isSelected = p.id === selectedProjectId
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full text-left p-3.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-3 ${
                      isSelected 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-950/40 text-zinc-400 hover:bg-white/[0.02] hover:text-white border border-zinc-900'
                    }`}
                  >
                    <MessageCircle size={16} />
                    <span className="truncate">{p.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Chat Room */}
        <div style={PANEL} className="lg:col-span-8 overflow-hidden flex flex-col">
          {selectedProjectId && projectData ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-[#1e2435] bg-gray-50/50 dark:bg-zinc-950/50 flex justify-between items-center shrink-0">
                <div>
                  <p className="text-sm font-black text-white uppercase leading-none">{projectData.name}</p>
                  <p className="text-[8px] uppercase tracking-widest text-zinc-500 mt-1.5 font-bold">Client: {projectData.owner_name || 'Not Linked'}</p>
                </div>
              </div>

              {/* Chat Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/20 dark:bg-zinc-950/10 custom-scrollbar flex flex-col">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-8 flex-1">
                    <p className="text-sm text-zinc-500 italic">No messages exchanged yet. Send a greeting to the client!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg: any, idx: number) => {
                      const isContractor = msg.sender === 'contractor'
                      return (
                        <div key={idx} className={`flex ${isContractor ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-2xl p-4 space-y-1 shadow-sm ${
                            isContractor 
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

              {/* Chat Input */}
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <MessageCircle size={32} className="mb-2 text-zinc-600" />
              <p className="text-sm font-semibold">Select a project from the sidebar to chat with the client.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
