import { getSettings } from '../settings/store'
import { funLevelFor, type Settings } from '../settings/settings'

/** The three confirmation sounds (docs/look-and-feel-recommendations.md, S1). Each is a couple of soft notes, under 150 ms, made with the Web Audio API so there are no files to download. */
export type CueName = 'confirm' | 'success' | 'no'

export interface Note { freq: number; start: number; dur: number; gain: number }

/** Notes in seconds from the start of the cue. A soft positive click; a brighter two-note click; a low, gentle tick. */
export const CUES: Record<CueName, readonly Note[]> = {
  confirm: [{ freq: 880, start: 0, dur: 0.06, gain: 0.05 }],
  success: [{ freq: 784, start: 0, dur: 0.06, gain: 0.05 }, { freq: 1175, start: 0.07, dur: 0.08, gain: 0.05 }],
  no: [{ freq: 220, start: 0, dur: 0.09, gain: 0.04 }],
}

/** True when a cue may play: the guest has sounds on and the fun level is not Quiet (calm mode counts as Quiet). Sound is never the only signal, so nothing depends on this. */
export const cuesAllowed = (s: Pick<Settings, 'sounds' | 'calm' | 'fun'>): boolean => s.sounds && funLevelFor(s) !== 'quiet'

let context: AudioContext | null = null

/** Plays a cue if the settings allow it. Call only from a guest's own action (browsers refuse audio before a tap, so the context is made on first use). Returns whether it played. */
export function playCue(name: CueName, s: Pick<Settings, 'sounds' | 'calm' | 'fun'> = getSettings()): boolean {
  if (!cuesAllowed(s) || typeof window === 'undefined') return false
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return false
  try {
    context ??= new Ctx()
    if (context.state === 'suspended') void context.resume()
    const t0 = context.currentTime
    for (const n of CUES[name]) {
      const osc = context.createOscillator()
      const amp = context.createGain()
      osc.type = 'sine'
      osc.frequency.value = n.freq
      amp.gain.setValueAtTime(0.0001, t0 + n.start)
      amp.gain.exponentialRampToValueAtTime(n.gain, t0 + n.start + 0.01)
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur)
      osc.connect(amp).connect(context.destination)
      osc.start(t0 + n.start)
      osc.stop(t0 + n.start + n.dur + 0.02)
    }
    return true
  } catch {
    return false
  }
}
