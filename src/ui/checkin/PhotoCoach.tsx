import { useEffect, useRef, useState } from 'react'
import { coachTip, measurePhoto, type CoachTip, type PhotoMetrics } from '../../domain/checkin'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'

/** Draws a small copy of the current video frame and measures it, the same way a chosen picture is measured. */
function measureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): PhotoMetrics | null {
  const sw = video.videoWidth
  const sh = video.videoHeight
  if (!sw || !sh) return null
  const scale = Math.min(1, 96 / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)
  return measurePhoto(w, h, ctx.getImageData(0, 0, w, h).data, sw, sh)
}

/**
 * Photo coach (H27): a live camera view with an oval to fit the head and shoulders in, and one plain tip at a time ("more light", "hold steady").
 * It only helps the guest take a better picture. The frame is measured on this phone and never sent; the taken picture goes through the same check as a chosen one.
 */
export function PhotoCoach({ disabled, onTaken }: { disabled: boolean; onTaken: (m: PhotoMetrics) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [on, setOn] = useState(false)
  const [failed, setFailed] = useState(false)
  const [tip, setTip] = useState<CoachTip | null>(null)
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    if (!on) return undefined
    let stream: MediaStream | null = null
    let cancelled = false
    canvas.current ??= document.createElement('canvas')
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }).then((s) => {
      if (cancelled) { s.getTracks().forEach((x) => x.stop()); return }
      stream = s
      const v = video.current
      if (!v) return
      v.srcObject = s
      void v.play().catch(() => undefined)
    }).catch(() => { if (!cancelled) { setFailed(true); setOn(false) } })
    return () => { cancelled = true; stream?.getTracks().forEach((x) => x.stop()) }
  }, [on])

  useVisibleInterval(() => {
    const m = video.current && canvas.current ? measureFrame(video.current, canvas.current) : null
    if (m) setTip(coachTip(m))
  }, 700, on)

  const take = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    const m = measureFrame(v, c)
    if (m) onTaken(m)
  }

  if (!supported) return null
  return (
    <div className="photo-coach">
      {!on && <Button variant="secondary" disabled={disabled} onClick={() => { setFailed(false); setTip(null); setOn(true) }}>{t('checkin.coach.start')}</Button>}
      {failed && <p role="alert" className="field__error">{t('checkin.coach.failed')}</p>}
      {on && (
        <>
          <div className="photo-coach__frame">
            <video ref={video} className="photo-coach__video" muted playsInline aria-label={t('checkin.coach.video')} />
            <div className="photo-coach__oval" aria-hidden="true" />
          </div>
          <p className="muted">{t('checkin.coach.oval')}</p>
          <p role="status" className={tip === 'good' ? 'photo-coach__tip photo-coach__tip--good' : 'photo-coach__tip'}>{tip ? t(`checkin.coach.tip.${tip}` as StringKey) : t('checkin.coach.starting')}</p>
          <div className="button-row">
            <Button disabled={disabled || !tip} onClick={take}>{t('checkin.coach.take')}</Button>
            <Button variant="tertiary" onClick={() => setOn(false)}>{t('checkin.coach.stop')}</Button>
          </div>
        </>
      )}
    </div>
  )
}
