// Sounds of the store alerts: the store's own recordings in public/sounds. Browsers play sound only after the person has
// interacted with the page once, or when the site may autoplay; until then play() is refused with NotAllowedError and
// the caller shows a "turn sound on" prompt. Any click or key press unlocks it (unlockAlertAudio).

export type PlayResult = 'played' | 'blocked' | 'failed'

export type AlertSound = 'newOrder' | 'pending' | 'paid' | 'cancelled' | 'returnRequested'

export const ALERT_SOUNDS: Record<AlertSound, { file: string; text: string }> = {
  newOrder: { file: 'new-order.mp3', text: 'Có đơn hàng mới' },
  pending: { file: 'order-pending.mp3', text: 'Còn đơn hàng chưa xác nhận' },
  paid: { file: 'payment-received.mp3', text: 'Khách đã thanh toán' },
  cancelled: { file: 'order-cancelled.mp3', text: 'Khách đã huỷ đơn' },
  returnRequested: { file: 'return-requested.mp3', text: 'Có yêu cầu trả hàng' },
}

const elements = new Map<AlertSound, HTMLAudioElement>()
let chimeContext: AudioContext | null = null
let unlocked = false

/** True once a sound has played or a click unlocked audio on this page. */
export const isAlertAudioUnlocked = () => unlocked

function element(sound: AlertSound) {
  let audio = elements.get(sound)
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}sounds/${ALERT_SOUNDS[sound].file}`)
    audio.preload = 'auto'
    elements.set(sound, audio)
  }
  return audio
}

const blocked = (error: unknown) => error instanceof DOMException && error.name === 'NotAllowedError'

/** One recording; the browser's Vietnamese voice, or a chime, when the file cannot play. */
export async function playAlertSound(sound: AlertSound): Promise<PlayResult> {
  const audio = element(sound)
  try {
    audio.currentTime = 0
    await audio.play()
    unlocked = true
    return 'played'
  } catch (error) {
    if (blocked(error)) return 'blocked'
    return speak(ALERT_SOUNDS[sound].text) ? 'played' : playChime()
  }
}

/** Several alerts at once: one after the other, never on top of each other. */
export async function playAlertSounds(sounds: AlertSound[]): Promise<PlayResult> {
  let result: PlayResult = 'played'
  for (const [index, sound] of sounds.entries()) {
    result = await playAlertSound(sound)
    if (result === 'blocked') return result
    if (index < sounds.length - 1) await ended(element(sound))
  }
  return result
}

function ended(audio: HTMLAudioElement) {
  return new Promise<void>(resolve => {
    const done = () => { audio.removeEventListener('ended', done); window.clearTimeout(timer); resolve() }
    const timer = window.setTimeout(done, 4_000)
    audio.addEventListener('ended', done)
  })
}

/** Called from a click or key press: lets later sounds play without one. */
export async function unlockAlertAudio(): Promise<boolean> {
  const audio = element('newOrder')
  try {
    audio.muted = true
    await audio.play()
    audio.pause()
    audio.currentTime = 0
    audio.muted = false
    chimeContext ??= new AudioContext()
    void chimeContext.resume()
    unlocked = true
    return true
  } catch {
    audio.muted = false
    return false
  }
}

async function playChime(): Promise<PlayResult> {
  try {
    chimeContext ??= new AudioContext()
    // resume() never settles without a user gesture in some browsers: do not wait for it forever.
    if (chimeContext.state !== 'running') {
      await Promise.race([chimeContext.resume(), new Promise(resolve => window.setTimeout(resolve, 300))])
    }
    if (chimeContext.state !== 'running') return 'blocked'
    const start = chimeContext.currentTime
    for (const [offset, frequency] of [[0, 880], [0.18, 1318.5]] as const) {
      const oscillator = chimeContext.createOscillator()
      const gain = chimeContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5)
      oscillator.connect(gain).connect(chimeContext.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.55)
    }
    return 'played'
  } catch {
    return 'failed'
  }
}

// Only a Vietnamese voice: another language's voice would read the words badly.
function speak(text: string): boolean {
  const synthesis = window.speechSynthesis
  const voice = synthesis?.getVoices().find(v => v.lang.toLowerCase().startsWith('vi'))
  if (!synthesis || !voice) return false
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  synthesis.cancel()
  synthesis.speak(utterance)
  return true
}
