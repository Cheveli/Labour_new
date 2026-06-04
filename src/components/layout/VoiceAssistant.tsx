/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, Loader2, X, RefreshCw, Bot, User, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

function PreviewCard({
  slots,
  onConfirm,
  onCancel,
  onRetry,
  isSaving
}: {
  slots: any;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
  isSaving: boolean;
}) {
  if (!slots || !slots.mode) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-4 rounded-xl border border-blue-500/20 bg-blue-950/20 space-y-3 max-w-[85%] mr-auto shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-[#1e2435] pb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
          {slots.mode === 'material' && 'Material Preview'}
          {slots.mode === 'attendance' && 'Attendance Preview'}
          {slots.mode === 'expense' && 'Expense Preview'}
          {slots.mode === 'payment' && 'Payment Preview'}
          {slots.mode === 'worker' && 'Worker Preview'}
        </span>
        <span className="text-[9px] font-bold text-zinc-500">{slots.date || 'Today'}</span>
      </div>

      <div className="space-y-2 text-xs text-zinc-200">
        {slots.mode === 'material' && slots.material && (
          <div className="space-y-1">
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Material:</span> <span className="font-bold text-white">{slots.material.material_name}</span></div>
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Quantity:</span> <span className="font-bold text-white">{slots.material.quantity} {slots.material.unit || 'bags'}</span></div>
            {slots.material.cost_per_unit > 0 && (
              <>
                <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Rate:</span> <span className="font-bold text-white">₹{slots.material.cost_per_unit}</span></div>
                <div className="text-sm font-black text-emerald-400">
                  <span className="text-zinc-500 font-bold uppercase text-[9px]">Total:</span> ₹{(slots.material.quantity * slots.material.cost_per_unit).toLocaleString()}
                </div>
              </>
            )}
            {slots.material.supplier_name && <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Supplier:</span> <span className="font-bold text-white">{slots.material.supplier_name}</span></div>}
          </div>
        )}

        {slots.mode === 'attendance' && slots.attendance && (
          <div className="space-y-2">
            <span className="text-zinc-500 font-bold uppercase text-[9px] block">Workers Marked:</span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {slots.attendance.records?.map((r: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-[#0d1018] px-2.5 py-1.5 rounded-lg border border-[#1e2435]">
                  <span className="font-bold text-zinc-200">{r.labour_name}</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider ${
                    r.status === 'P' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    r.status === 'H' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {r.status === 'P' ? 'PRESENT' : r.status === 'H' ? 'HALF DAY' : 'ABSENT'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {slots.mode === 'expense' && slots.expense && (
          <div className="space-y-1">
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Person:</span> <span className="font-bold text-white">{slots.expense.person_name}</span></div>
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Purpose:</span> <span className="font-bold text-white">{slots.expense.purpose}</span></div>
            <div className="text-sm font-black text-rose-400"><span className="text-zinc-500 font-bold uppercase text-[9px]">Amount:</span> ₹{slots.expense.amount}</div>
          </div>
        )}

        {slots.mode === 'payment' && slots.payment && (
          <div className="space-y-1">
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Worker:</span> <span className="font-bold text-white">{slots.payment.labour_name}</span></div>
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Type:</span> <span className="font-bold text-white">{slots.payment.payment_type || 'REGULAR'}</span></div>
            <div className="text-sm font-black text-emerald-400"><span className="text-zinc-500 font-bold uppercase text-[9px]">Amount:</span> ₹{slots.payment.amount}</div>
          </div>
        )}

        {slots.mode === 'worker' && slots.worker && (
          <div className="space-y-1">
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Name:</span> <span className="font-bold text-white">{slots.worker.name}</span></div>
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Role:</span> <span className="font-bold text-white">{slots.worker.type || 'Labour (Unskilled)'}</span></div>
            <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Daily Rate:</span> <span className="font-bold text-white">₹{slots.worker.daily_rate}</span></div>
            {slots.worker.phone && <div><span className="text-zinc-500 font-bold uppercase text-[9px]">Phone:</span> <span className="font-bold text-white">{slots.worker.phone}</span></div>}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-[#1e2435]">
        {slots.status === 'failed' ? (
          <button
            onClick={onRetry}
            disabled={isSaving}
            className="flex-1 h-9 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={12} className={isSaving ? 'animate-spin' : ''} />
            Retry Save (మళ్ళీ ప్రయత్నించు)
          </button>
        ) : (
          <>
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel (రద్దు)
            </button>
            <button
              onClick={onConfirm}
              disabled={isSaving}
              className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Confirm (సేవ్ చెయ్)
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default function VoiceAssistant() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'unsupported'>('idle')
  const welcomeText = 'నమస్కారం సోమయ్య గారు! చెప్పండి ఏం చేయాలి? మెటీరియల్ యాడ్ చేయాలా లేదా అటెండెన్స్ వేయాలా?'
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'ai', text: welcomeText }
  ])
  const [transcript, setTranscript] = useState('')
  const [currentState, setCurrentState] = useState<any>({
    mode: null,
    project_id: null,
    date: null,
    status: 'collecting'
  })

  // Refs to prevent stale closures in speech recognition event handlers
  const statusRef = useRef(status)
  statusRef.current = status

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript

  const currentStateRef = useRef(currentState)
  currentStateRef.current = currentState

  const recognitionRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  
  // Microphone lifecycle flags, state references, and silence timeouts
  const isListeningRef = useRef(false)
  const isRecognitionRunningRef = useRef(false)
  const consecutiveSilenceCountRef = useRef(0)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Safe SpeechRecognition start function
  const safeStartRecognition = () => {
    if (recognitionRef.current && !isRecognitionRunningRef.current) {
      isRecognitionRunningRef.current = true
      try {
        console.log('[Mic] Starting SpeechRecognition...')
        recognitionRef.current.start()
      } catch (err) {
        console.error('[Mic] Start exception:', err)
        isRecognitionRunningRef.current = false
      }
    }
  }

  // Safe SpeechRecognition stop function
  const safeStopRecognition = () => {
    if (recognitionRef.current && isRecognitionRunningRef.current) {
      isRecognitionRunningRef.current = false
      try {
        console.log('[Mic] Stopping SpeechRecognition...')
        recognitionRef.current.stop()
      } catch (err) {
        console.error('[Mic] Stop exception:', err)
      }
    }
  }

  // Initialize Speech Recognition once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioPlayerRef.current = new Audio()
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        setStatus('unsupported')
        return
      }

      const rec = new SpeechRecognition()
      rec.continuous = true // Keep listening across pauses
      rec.interimResults = true
      rec.lang = 'te-IN' // Primary recognition language is Telugu

      rec.onstart = () => {
        isRecognitionRunningRef.current = true
        setStatus('listening')
        setTranscript('')
      }

      rec.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptText = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText
          } else {
            interimTranscript += transcriptText
          }
        }

        const accumulatedText = (finalTranscript || interimTranscript).trim()
        if (accumulatedText) {
          setTranscript(accumulatedText)
        }

        // Reset consecutive silences on actual speech captured
        consecutiveSilenceCountRef.current = 0

        // Reset silence timeout of 1.5 seconds of silence
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current) {
            console.log('[Mic] 1.5s silence detected. Auto-stopping and processing voice.')
            stopListening()
          }
        }, 1500)
      }

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        
        // Handle permissions or persistent errors
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast.error(`Microphone error: ${event.error}. Please check permissions.`)
          setStatus('idle')
          isListeningRef.current = false
        }
      }

      rec.onend = () => {
        isRecognitionRunningRef.current = false
        console.log('[Mic] onend triggered')
        
        // Auto-recover/restart if status was supposed to be listening and we got cut off unexpectedly
        if (isListeningRef.current) {
          if (transcriptRef.current.trim()) {
            stopListening()
          } else {
            // Cap consecutive silences to prevent infinite looping
            if (consecutiveSilenceCountRef.current < 3) {
              consecutiveSilenceCountRef.current += 1
              console.log(`[Mic] Cut off without speech. Reconnecting... Attempt ${consecutiveSilenceCountRef.current}/3`)
              safeStartRecognition()
            } else {
              console.log('[Mic] Max consecutive silence reached. Idle.')
              isListeningRef.current = false
              setStatus('idle')
              consecutiveSilenceCountRef.current = 0
            }
          }
        } else {
          // If stopped intentionally and state is thinking, process speech
          if (statusRef.current === 'thinking') {
            handleProcessVoice()
          }
        }
      }

      recognitionRef.current = rec

      return () => {
        try {
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
          rec.abort()
        } catch (e) {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to bottom of chat log
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentState])

  // Pre-load synthesis voices on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
      const handleVoices = () => {
        window.speechSynthesis.getVoices()
      }
      window.speechSynthesis.addEventListener('voiceschanged', handleVoices)
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoices)
      }
    }
  }, [])

  // Helper to Speak AI replies in Telugu out loud
  const speakText = (text: string) => {
    console.log('[TTS] speakText called with:', text)
    
    if (typeof window === 'undefined') {
      console.log('[TTS] Window is undefined (SSR)')
      return
    }

    // Stop microphone if it was listening/speaking, to prevent clashes
    isListeningRef.current = false
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    safeStopRecognition()

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause()
        audioPlayerRef.current.src = ''
      } catch (err) {
        console.error('[TTS] Error pausing audio player:', err)
      }
    }
    
    const cleanText = text.replace(/Preview|Date:|Workers:|Status:|Material:|Quantity:|Rate:|Total:|Expense Type:|Amount:|Worker:|Type:|Name:|Role:|Daily Rate:|Phone:|Save:|Confirm:|Confirm cheyyala\?/gi, '').trim()

    // Native Speech Synthesis Fallback function
    const speakWithNativeFallback = (textToSpeak: string) => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        console.log('[TTS] Falling back to browser native speech synthesis...')
        setStatus('speaking')
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'te-IN'
        utterance.onend = () => {
          console.log('[TTS] Native speech synthesis completed')
          setStatus('idle')
        }
        utterance.onerror = (err) => {
          console.error('[TTS] Native speech synthesis error:', err)
          setStatus('idle')
        }
        window.speechSynthesis.speak(utterance)
      } else {
        setStatus('idle')
      }
    }

    console.log('[TTS] Requesting voice audio from Hugging Face proxy...')
    if (audioPlayerRef.current) {
      setStatus('speaking')
      const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&t=${Date.now()}`
      
      audioPlayerRef.current.src = audioUrl
      audioPlayerRef.current.defaultPlaybackRate = 1.25
      audioPlayerRef.current.playbackRate = 1.25
      
      audioPlayerRef.current.onended = () => {
        console.log('[TTS] Speech completed successfully')
        setStatus('idle')
      }
      
      audioPlayerRef.current.onerror = (e) => {
        const mediaError = audioPlayerRef.current?.error
        console.error('[TTS] Speech audio error:', e, 'Details:', mediaError ? { code: mediaError.code, message: mediaError.message } : 'none')
        console.log('[TTS] Trying native TTS fallback...')
        speakWithNativeFallback(cleanText)
      }
      
      audioPlayerRef.current.play().catch(err => {
        console.error('[TTS] Audio play failed:', err)
        console.log('[TTS] Trying native TTS fallback...')
        speakWithNativeFallback(cleanText)
      })
    }
  }

  const startListening = () => {
    if (status === 'unsupported') {
      toast.error('Voice recognition is not supported in this browser.')
      return
    }

    // Cancel speech synthesis if active
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause()
        audioPlayerRef.current.src = ''
      } catch (err) {
        console.error('[TTS] Error pausing audio player in startListening:', err)
      }
    }

    // Unlock context
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const unlockUtterance = new SpeechSynthesisUtterance('')
      unlockUtterance.volume = 0
      window.speechSynthesis.speak(unlockUtterance)
    }

    setTranscript('')
    setStatus('listening')
    isListeningRef.current = true
    consecutiveSilenceCountRef.current = 0
    
    safeStartRecognition()
  }

  const stopListening = () => {
    isListeningRef.current = false
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    setStatus('thinking')
    safeStopRecognition()
  }

  const toggleListening = () => {
    if (status === 'listening') {
      stopListening()
    } else {
      startListening()
    }
  }

  // Reset conversation session state
  const resetSession = () => {
    isListeningRef.current = false
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    setCurrentState({
      mode: null,
      project_id: null,
      date: null,
      status: 'collecting'
    })
    setMessages([
      { sender: 'ai', text: welcomeText }
    ])
    setTranscript('')
    setStatus('idle')
    consecutiveSilenceCountRef.current = 0
    
    safeStopRecognition()
    speakText(welcomeText)
  }

  // Confirm and save via API (Manual click action)
  const handleConfirmSave = async () => {
    setStatus('thinking')
    try {
      const res = await fetch('/api/voice-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSpeechText: 'confirm_save_action',
          currentState
        })
      })

      if (!res.ok) throw new Error('Failed to confirm save')
      const data = await res.json()

      if (data.dbError) {
        toast.error('Save failed. Try again.')
        setCurrentState((prev: any) => ({ ...prev, status: 'failed' }))
        setMessages((prev: Message[]) => [...prev, { sender: 'ai', text: 'సేవ్ చేయడం ఫెయిల్ అయింది. దయచేసి మళ్ళీ ట్రై చేయండి.' }])
        speakText('సేవ్ చేయడం ఫెయిల్ అయింది. దయచేసి మళ్ళీ ట్రై చేయండి.')
      } else {
        toast.success('Successfully saved!')
        setMessages((prev: Message[]) => [...prev, { sender: 'ai', text: data.replyText }])
        speakText(data.replyText)
        setCurrentState({
          mode: null,
          project_id: null,
          date: null,
          status: 'completed'
        })
        window.dispatchEvent(new Event('ssc_project_changed'))
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error. Failed to save.')
      setCurrentState((prev: any) => ({ ...prev, status: 'failed' }))
    } finally {
      setStatus('idle')
    }
  }

  // Cancel pending log
  const handleCancel = () => {
    setCurrentState({
      mode: null,
      project_id: null,
      date: null,
      status: 'collecting'
    })
    setMessages((prev: Message[]) => [...prev, { sender: 'ai', text: 'సేవ్ చేయడం రద్దు చేసినా భాయ్. ఇంకేం చేయాలి?' }])
    speakText('సేవ్ చేయడం రద్దు చేసినా భాయ్. ఇంకేం చేయాలి?')
  }

  // Retry failed log
  const handleRetrySave = async () => {
    setStatus('thinking')
    try {
      const res = await fetch('/api/voice-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSpeechText: 'retry_save',
          currentState
        })
      })

      if (!res.ok) throw new Error('Retry failed')
      const data = await res.json()

      if (data.dbError) {
        toast.error('Retry failed. Try again.')
        setCurrentState((prev: any) => ({ ...prev, status: 'failed' }))
      } else {
        toast.success('Successfully saved!')
        setMessages((prev: Message[]) => [...prev, { sender: 'ai', text: data.replyText }])
        speakText(data.replyText)
        setCurrentState({
          mode: null,
          project_id: null,
          date: null,
          status: 'completed'
        })
        window.dispatchEvent(new Event('ssc_project_changed'))
      }
    } catch (err) {
      console.error(err)
      toast.error('Network error during retry.')
    } finally {
      setStatus('idle')
    }
  }

  // Send captured speech to the Next.js API Route for processing
  const handleProcessVoice = async () => {
    const textToSend = transcriptRef.current.trim()
    if (!textToSend) {
      setStatus('idle')
      return
    }

    // Add user message to UI log
    setMessages((prev: Message[]) => [...prev, { sender: 'user', text: textToSend }])
    setTranscript('')

    try {
      const res = await fetch('/api/voice-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSpeechText: textToSend,
          currentState: currentStateRef.current
        })
      })

      if (!res.ok) {
        throw new Error('API processing error')
      }

      const data = await res.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      // Update state slots
      setCurrentState(data.slots)
      if (data.slots?.project_id) {
        localStorage.setItem('ssc_active_project_id', data.slots.project_id)
      }

      // Add AI reply to UI log
      setMessages((prev: Message[]) => [...prev, { sender: 'ai', text: data.replyText }])

      // Speak reply out loud
      speakText(data.replyText)

      // Handle voice controlled redirect
      if (data.redirectUrl) {
        toast.success(`Redirecting to ${data.redirectUrl}`)
        setTimeout(() => {
          router.push(data.redirectUrl)
          setIsOpen(false)
        }, 1500)
      }

      // If database write completed successfully
      if (data.isComplete && data.slots?.status === 'completed') {
        toast.success('Successfully logged into the database!')
        window.dispatchEvent(new Event('ssc_project_changed'))
      }

    } catch (err: any) {
      console.error(err)
      toast.error('Failed to parse command. Please try again.')
      setMessages((prev: Message[]) => [...prev, { sender: 'ai', text: 'క్షమించండి, మీ కమాండ్ ప్రాసెస్ చేయలేకపోయాను. దయచేసి మళ్ళీ చెప్పండి.' }])
      speakText('క్షమించండి, మీ కమాండ్ ప్రాసెస్ చేయలేకపోయాను. దయచేసి మళ్ళీ చెప్పండి.')
      setStatus('idle')
    }
  }

  return (
    <>
      {/* Floating Microphone Action Button */}
      <div className="fixed bottom-6 right-6 z-[80]">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setIsOpen(true)
            speakText(messages[messages.length - 1].text)
          }}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl hover:shadow-blue-500/30 transition-all cursor-pointer relative"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            boxShadow: '0 8px 30px rgba(59, 130, 246, 0.4)'
          }}
        >
          <Mic className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </span>
        </motion.button>
      </div>

      {/* Voice Assistant Panel Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            />

            {/* Chat Drawer */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-x-0 bottom-0 max-w-lg mx-auto z-[100] rounded-t-3xl border-t shadow-2xl flex flex-col h-[70vh] md:h-[60vh]"
              style={{
                backgroundColor: 'rgba(13, 16, 24, 0.95)',
                borderColor: '#1e2435',
                backdropFilter: 'blur(20px)'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2435]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-400">
                    <Bot size={16} />
                  </div>
                  <div>
                    <h3 className="text-white text-xs font-black uppercase tracking-wider">Nirmana Voice Assistant</h3>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Telangana Conversational AI</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetSession}
                    title="Reset Session"
                    className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Chat Log (Scrollable Area) */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      msg.sender === 'user' 
                        ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400' 
                        : 'bg-[#1a1f2e] border border-[#2e3752] text-zinc-300'
                    }`}>
                      {msg.sender === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </div>
                    <div className={`p-3 rounded-2xl max-w-[80%] text-xs font-semibold ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-[#111520] border border-[#1e2435] text-zinc-100 rounded-tl-none'
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                
                {/* Visual Preview Card (Verbal confirmation backup) */}
                {(currentState.status === 'confirming' || currentState.status === 'failed') && (
                  <PreviewCard
                    slots={currentState}
                    onConfirm={handleConfirmSave}
                    onCancel={handleCancel}
                    onRetry={handleRetrySave}
                    isSaving={status === 'thinking'}
                  />
                )}

                {/* Interim Transcript display */}
                {status === 'listening' && transcript && (
                  <div className="flex items-start gap-2.5 flex-row-reverse opacity-70">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/5 border border-blue-500/10 text-blue-500/70 flex items-center justify-center text-xs">
                      <User size={13} />
                    </div>
                    <div className="p-3 bg-zinc-900/40 border border-dashed border-zinc-800 text-zinc-400 text-xs rounded-2xl rounded-tr-none max-w-[80%] italic font-medium">
                      {transcript}
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Current Extraction Slots State Panel */}
              <div className="px-5 py-2.5 bg-[#0a0c12]/60 border-t border-[#1e2435] flex items-center justify-between text-[9px] font-bold text-zinc-500 tracking-wider uppercase">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                  <span>Active Mode: <strong className="text-white">{currentState.mode || 'None'}</strong></span>
                </div>
                {currentState.project_id && (
                  <div className="flex items-center gap-1">
                    <span>Site Match: <strong className="text-emerald-400 font-black">Linked</strong></span>
                  </div>
                )}
              </div>

              {/* Interaction Panel */}
              <div className="p-5 border-t border-[#1e2435] bg-[#0c0f17] flex flex-col items-center gap-4">
                
                {/* State Text indicator */}
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {status === 'idle' && 'Tap to Speak (మాట్లాడటానికి నొక్కండి)'}
                    {status === 'listening' && 'Listening... Speak now (వింటున్నాను...)'}
                    {status === 'thinking' && 'AI processing... (ప్రాసెస్ చేస్తున్నాను...)'}
                    {status === 'speaking' && 'AI speaking... (AI మాట్లాడుతోంది...)'}
                    {status === 'unsupported' && 'Web Speech API Not Supported'}
                  </p>
                  {status === 'listening' && (
                    <p className="text-[9px] text-red-400 font-bold mt-1 animate-pulse uppercase tracking-wider">Tap Mic again to stop and send</p>
                  )}
                </div>

                {/* Pulsating Microphone Controller Button */}
                <div className="relative">
                  {/* Wave animations behind mic */}
                  <AnimatePresence>
                    {status === 'listening' && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full bg-red-500 pointer-events-none"
                      />
                    )}
                    {status === 'speaking' && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1.4, opacity: 0 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full bg-blue-500 pointer-events-none"
                      />
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleListening}
                    disabled={status === 'thinking' || status === 'unsupported'}
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer relative z-10 transition-all ${
                      status === 'listening' 
                        ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' 
                        : status === 'speaking'
                        ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                        : 'bg-zinc-800 hover:bg-zinc-700 shadow-black/40'
                    }`}
                  >
                    {status === 'listening' ? (
                      <MicOff size={24} />
                    ) : status === 'thinking' ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : status === 'speaking' ? (
                      <Volume2 size={24} className="animate-bounce" />
                    ) : (
                      <Mic size={24} />
                    )}
                  </motion.button>
                </div>

                {/* Helpful Hints for Telugu Contractor */}
                <div className="flex gap-2.5 items-center justify-center p-2 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[9px] font-bold text-zinc-500 tracking-wide uppercase text-center w-full max-w-sm">
                  <HelpCircle size={12} className="text-blue-400" />
                  <span>
                    Try: "Today cement 50 bags vachayi" / "Attendance open cheyyi"
                  </span>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
