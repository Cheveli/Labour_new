export const playChatSound = (type: 'send' | 'receive' = 'receive') => {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    
    if (type === 'send') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(850, ctx.currentTime)
      gain.gain.setValueAtTime(0.06, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      
      osc.start()
      osc.stop(ctx.currentTime + 0.12)
    } else {
      // WhatsApp double-ping synthesis
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(580, ctx.currentTime)
      gain1.gain.setValueAtTime(0.1, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
      
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(860, ctx.currentTime + 0.07)
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.07)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      
      osc1.start()
      osc1.stop(ctx.currentTime + 0.08)
      osc2.start(ctx.currentTime + 0.07)
      osc2.stop(ctx.currentTime + 0.22)
    }
  } catch (e) {
    console.warn('Audio Context tone synthesis failed:', e)
  }
}

export function showWebNotification(title: string, body: string) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return

  // Play receive sound alongside visual alert
  playChatSound('receive')

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch (e) {
      // Fallback for mobile devices requiring ServiceWorker notifications
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, { body })
        })
      }
    }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, { body })
      }
    })
  }
}
