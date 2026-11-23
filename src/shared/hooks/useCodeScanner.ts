import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLatest } from './useLatest'
import { cameraWanted, dueForFrame, frameSize, phaseOfError, readerFor, type ScanPhase } from '../../domain/scanSession'

interface Detector { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> }
interface DetectorClass { new (options?: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> }

/** Reads one frame and returns the code's text, or null. */
type Decode = () => Promise<string | null>

/** The browser's own reader when it reads QR codes, otherwise the small JavaScript reader (loaded only now, so the app does not carry it until someone scans). */
async function makeDecoder(video: HTMLVideoElement): Promise<Decode> {
  const Native = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (Native && (await Native.getSupportedFormats?.().catch(() => [] as string[]))?.includes('qr_code') !== false) {
    const detector = new Native({ formats: ['qr_code'] })
    return async () => (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null
  }
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  return async () => {
    const { w, h } = frameSize(video.videoWidth, video.videoHeight)
    if (!context || w === 0) return null
    canvas.width = w
    canvas.height = h
    context.drawImage(video, 0, 0, w, h)
    return jsQR(context.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

/**
 * Reads QR codes from the camera while `active`, and calls `onCode` once with the first one found (the camera is then released). The camera is on only while the scanner is open and the page can be seen: it
 * stops when the page is hidden (phase `paused`) and starts again by itself when the page is back. `attempt` restarts it after a failure. It asks for the camera only when `active` becomes true.
 */
export function useCodeScanner(active: boolean, onCode: (raw: string) => void, attempt = 0): { phase: ScanPhase; video: RefObject<HTMLVideoElement | null> } {
  const video = useRef<HTMLVideoElement>(null)
  const [failure, setFailure] = useState<'denied' | 'unavailable' | 'error' | null>(null)
  const [looking, setLooking] = useState(false)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const found = useLatest(onCode)

  useEffect(() => {
    const change = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])

  const on = cameraWanted(active, hidden)
  useEffect(() => {
    if (!on) return
    let stopped = false
    let stream: MediaStream | null = null
    let frame = 0
    const el = video.current
    const release = () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      if (el) el.srcObject = null
    }
    ;(async () => {
      try {
        if (readerFor({ mediaDevices: navigator.mediaDevices, hasDetector: 'BarcodeDetector' in window }) === 'none') { setFailure('unavailable'); return }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped || !el) { stream.getTracks().forEach((track) => track.stop()); return }
        el.srcObject = stream
        await el.play()
        const decode = await makeDecoder(el)
        if (stopped) return
        setLooking(true)
        let last = 0
        let busy = false
        const tick = (now: number) => {
          if (stopped) return
          if (!busy && el.readyState >= 2 && dueForFrame(now, last)) {
            last = now
            busy = true
            void decode().then((raw) => {
              busy = false
              if (raw && !stopped) { release(); found(raw) }
            }, () => { busy = false })
          }
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      } catch (error) {
        if (!stopped) setFailure(phaseOfError(error))
      }
    })()
    return () => { release(); setLooking(false); setFailure(null) }
  }, [on, attempt, found])

  const phase: ScanPhase = !active ? 'idle' : hidden ? 'paused' : failure ?? (looking ? 'looking' : 'asking')
  return { phase, video }
}
