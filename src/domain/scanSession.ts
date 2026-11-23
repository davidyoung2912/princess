/** The camera side of scanning a code (framework-free, so it is tested in node): which reader a device can use, what a camera failure means, and how often a frame is read. */

/** Where the scanner is. `paused` is the camera switched off because the page was hidden; it starts again by itself when the page is back. */
export type ScanPhase = 'idle' | 'asking' | 'looking' | 'paused' | 'denied' | 'unavailable' | 'error'

/** A frame is read at most this often: a code held in view is found within a moment, and the phone is not kept busy. */
export const SCAN_EVERY_MS = 250

/** The widest a frame is drawn for the fallback reader. Smaller is faster, and a code held up to the camera is large. */
export const FALLBACK_WIDTH = 640

/** `native` is the browser's own reader (fast, no extra download), `fallback` is the small JavaScript reader loaded when needed, `none` is a device with no camera access. */
export type Reader = 'native' | 'fallback' | 'none'

export interface Capabilities { mediaDevices?: { getUserMedia?: unknown } | null; hasDetector: boolean }

export function readerFor(caps: Capabilities): Reader {
  if (typeof caps.mediaDevices?.getUserMedia !== 'function') return 'none'
  return caps.hasDetector ? 'native' : 'fallback'
}

/** What a failed camera request means to the guest: they said no (or the host blocks it), there is no usable camera, or something else went wrong. */
export function phaseOfError(error: unknown): 'denied' | 'unavailable' | 'error' {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'unavailable'
  return 'error'
}

/** Whether it is time to read another frame. */
export const dueForFrame = (now: number, last: number): boolean => now - last >= SCAN_EVERY_MS

/** The size to draw a video frame at for the fallback reader: no wider than `FALLBACK_WIDTH`, same shape, whole pixels, never zero. */
export function frameSize(width: number, height: number): { w: number; h: number } {
  if (!(width > 0) || !(height > 0)) return { w: 0, h: 0 }
  const scale = Math.min(1, FALLBACK_WIDTH / width)
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
}

/** The camera is on only while the scanner is open, and only while the page can be seen. */
export const cameraWanted = (active: boolean, hidden: boolean): boolean => active && !hidden
