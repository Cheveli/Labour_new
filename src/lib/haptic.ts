/**
 * Triggers haptic feedback vibration on devices that support it.
 * Respects user preference stored in localStorage.
 */
export function haptic(pattern: number | number[] = 10) {
  try {
    if (typeof window === 'undefined') return
    const enabled = localStorage.getItem('ssc_haptic_enabled')
    if (enabled === 'false') return
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // Silently fail on unsupported devices
  }
}
