export function haptic(pattern = 200) {
  try {
    console.log('Haptic called')

    if (typeof window === 'undefined') return

    const enabled = localStorage.getItem('ssc_haptic_enabled')
    console.log('Enabled:', enabled)

    if (enabled === 'false') return

    if ('vibrate' in navigator) {
      console.log('Vibrate supported')
      navigator.vibrate(pattern)
    } else {
      console.log('Vibrate NOT supported')
    }
  } catch (e) {
    console.error(e)
  }
}