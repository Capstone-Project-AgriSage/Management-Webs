import { useSyncExternalStore } from 'react'
import type { AlertSound } from './alertAudio'

/** Fired when a new or cancelled order is announced (StoreAlerts), so an open order list reloads. */
export const NEW_ORDER_EVENT = 'agrisage-new-order'

// Per-browser alert settings (localStorage) and whether the browser is blocking sound right now. Settings are a
// convenience of this computer: losing them only brings back the defaults (every sound on, Windows notifications off).
export interface AlertSettings {
  /** One switch per sound; `pending` is the reminder every two minutes while online orders wait. */
  sounds: Record<AlertSound, boolean>
  desktop: boolean
}

interface AlertState {
  settings: AlertSettings
  soundBlocked: boolean
}

const SETTINGS_KEY = 'agrisage_store_alert_settings'
const SOUND_KEYS: AlertSound[] = ['newOrder', 'pending', 'paid', 'cancelled', 'returnRequested']

function loadSettings(): AlertSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as { sounds?: Partial<Record<AlertSound, unknown>>; desktop?: unknown }
    return {
      sounds: Object.fromEntries(SOUND_KEYS.map(key => [key, typeof stored.sounds?.[key] === 'boolean' ? stored.sounds[key] : true])) as Record<AlertSound, boolean>,
      desktop: typeof stored.desktop === 'boolean' ? stored.desktop : false,
    }
  } catch {
    return { sounds: Object.fromEntries(SOUND_KEYS.map(key => [key, true])) as Record<AlertSound, boolean>, desktop: false }
  }
}

let state: AlertState = { settings: loadSettings(), soundBlocked: false }
const listeners = new Set<() => void>()

function emit(next: AlertState) {
  state = next
  listeners.forEach(listener => listener())
}

function save(settings: AlertSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* kept for this page only */ }
  emit({ ...state, settings })
}

export function setAlertSound(sound: AlertSound, on: boolean) {
  save({ ...state.settings, sounds: { ...state.settings.sounds, [sound]: on } })
}

export function setDesktopAlerts(desktop: boolean) {
  save({ ...state.settings, desktop })
}

export function setSoundBlocked(soundBlocked: boolean) {
  if (state.soundBlocked !== soundBlocked) emit({ ...state, soundBlocked })
}

export function getAlertState() {
  return state
}

export function useAlertState(): AlertState {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => state,
  )
}

// Which notifications already rang on this computer, shared by its tabs so only one of them plays the sound.
// Ids older than a week are dropped.
const RANG_KEY = 'agrisage_store_alerts_rang'
const WEEK = 7 * 24 * 3600_000

export function readRang(userId: string): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem(RANG_KEY) || '{}') as Record<string, Record<string, number>>
    return all[userId] ?? {}
  } catch {
    return {}
  }
}

export function writeRang(userId: string, rang: Record<string, number>) {
  try {
    const all = JSON.parse(localStorage.getItem(RANG_KEY) || '{}') as Record<string, Record<string, number>>
    const now = Date.now()
    all[userId] = Object.fromEntries(Object.entries(rang).filter(([, at]) => now - at < WEEK))
    localStorage.setItem(RANG_KEY, JSON.stringify(all))
  } catch { /* storage unavailable: each tab rings on its own */ }
}

// The last sound on this computer, so the two-minute reminder does not ring on top of an alert or of another tab.
const LAST_RING_KEY = 'agrisage_store_alerts_last_ring'

export function lastRingAt(): number {
  try { return Number(localStorage.getItem(LAST_RING_KEY) || 0) } catch { return 0 }
}

export function markRing() {
  try { localStorage.setItem(LAST_RING_KEY, String(Date.now())) } catch { /* ignore */ }
}
