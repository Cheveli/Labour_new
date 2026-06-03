/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, Loader2, X, RefreshCw, Bot, User, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export default function VoiceAssistant() {
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
    date: null
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
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

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
      rec.continuous = false
      rec.interimResults = true
      rec.lang = 'te-IN' // Primary recognition language is Telugu

      rec.onstart = () => {
        setStatus('listening')
        setTranscript('')
      }

      rec.onresult = (event: any) => {
        const currentResult = event.results[event.results.length - 1]
        const text = currentResult[0].transcript
        setTranscript(text)
      }

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        if (event.error !== 'no-speech') {
          toast.error(`Recognition error: ${event.error}`)
          setStatus('idle')
        }
      }

      rec.onend = () => {
        // Use statusRef.current inside event handler to avoid stale state closure
        if (statusRef.current === 'listening') {
          setStatus('thinking')
          handleProcessVoice()
        }
      }

      recognitionRef.current = rec
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to bottom of chat log
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    // Cancel any active native speech synthesis if running
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    // Stop the persistent HTML5 audio player if it was playing
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause()
        audioPlayerRef.current.src = ''
      } catch (err) {
        console.error('[TTS] Error pausing audio player:', err)
      }
    }
    
    // Always use the server-side Hugging Face API proxy endpoint to play the custom male voice
    console.log('[TTS] Requesting voice audio from Hugging Face proxy...')
    if (audioPlayerRef.current) {
      setStatus('speaking')
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&t=${Date.now()}`
      
      audioPlayerRef.current.src = audioUrl
      audioPlayerRef.current.defaultPlaybackRate = 1.25
      audioPlayerRef.current.playbackRate = 1.25
      
      audioPlayerRef.current.onended = () => {
        console.log('[TTS] Speech completed successfully')
        setStatus('idle')
      }
      
      audioPlayerRef.current.onerror = (e) => {
        console.error('[TTS] Speech audio error:', e)
        setStatus('idle')
      }
      
      audioPlayerRef.current.play().catch(err => {
        console.error('[TTS] Audio play failed:', err)
        setStatus('idle')
      })
    }
  }

  // Trigger microphone toggle
  const toggleListening = () => {
    if (status === 'unsupported') {
      toast.error('Voice recognition is not supported in this browser. Please use Google Chrome.')
      return
    }

    // Unlock speech synthesis context on user gesture
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const unlockUtterance = new SpeechSynthesisUtterance('')
      unlockUtterance.volume = 0
      window.speechSynthesis.speak(unlockUtterance)
    }

    if (status === 'listening') {
      recognitionRef.current?.stop()
      setStatus('idle')
    } else {
      // Cancel speech synthesis if AI was talking
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause()
          audioPlayerRef.current.src = ''
        } catch (err) {
          console.error('[TTS] Error pausing audio player in toggleListening:', err)
        }
      }
      setStatus('idle')
      try {
        recognitionRef.current?.stop()
      } catch (e) {}
      
      setTimeout(() => {
        try {
          recognitionRef.current?.start()
        } catch (err) {
          console.error('Failed to start recognition:', err)
          toast.error('Microphone failed to start. Please try again.')
          setStatus('idle')
        }
      }, 100)
    }
  }

  // Reset conversation session state
  const resetSession = () => {
    setCurrentState({
      mode: null,
      project_id: null,
      date: null
    })
    setMessages([
      { sender: 'ai', text: welcomeText }
    ])
    setTranscript('')
    setStatus('idle')
    
    // Explicitly stop the speech recognition to prevent background ghosting
    try {
      recognitionRef.current?.stop()
    } catch (e) {
      console.error('Error stopping recognition on reset:', e)
    }
    
    speakText(welcomeText)
  }

  // Send captured speech to the Next.js API Route for processing
  const handleProcessVoice = async () => {
    // Read from transcriptRef.current to avoid stale state closure
    const textToSend = transcriptRef.current.trim()
    if (!textToSend) {
      setStatus('idle')
      return
    }

    // Add user message to UI log
    setMessages(prev => [...prev, { sender: 'user', text: textToSend }])
    setTranscript('')

    try {
      const res = await fetch('/api/voice-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSpeechText: textToSend,
          currentState: currentStateRef.current // Read from currentStateRef.current to avoid stale state closure
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

      // Add AI reply to UI log
      setMessages(prev => [...prev, { sender: 'ai', text: data.replyText }])

      // Speak reply out loud
      speakText(data.replyText)

      // If complete, trigger updates to other dashboard pages (like materials history / attendance tables)
      if (data.isComplete) {
        toast.success('Successfully logged into the database!')
        // Dispatch global events to reload page tables in real-time
        window.dispatchEvent(new Event('ssc_project_changed'))
        // Reset slots after successful log
        setTimeout(() => {
          setCurrentState({
            mode: null,
            project_id: null,
            date: null
          })
        }, 1500)
      }

    } catch (err: any) {
      console.error(err)
      toast.error('Failed to parse command. Please try again.')
      setMessages(prev => [...prev, { sender: 'ai', text: 'క్షమించండి, మీ కమాండ్ ప్రాసెస్ చేయలేకపోయాను. దయచేసి మళ్ళీ చెప్పండి.' }])
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
            speakText(messages[0].text)
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
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Telugu Conversational AI</p>
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
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
                
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
                    {status === 'listening' && 'Listening... Speak now (వింటున్నాను... మాట్లాడండి)'}
                    {status === 'thinking' && 'AI processing... (ప్రాసెస్ చేస్తున్నాను...)'}
                    {status === 'speaking' && 'AI speaking... (AI మాట్లాడుతోంది...)'}
                    {status === 'unsupported' && 'Web Speech API Not Supported'}
                  </p>
                  {status === 'listening' && (
                    <p className="text-[9px] text-red-400 font-bold mt-1 animate-pulse uppercase tracking-wider">Tap Mic again to stop</p>
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
                    Try: "Raju vacchindu" (రాజు వచ్చిండు) / "Eeda 2 bags cement add cheyyi"
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
