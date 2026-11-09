import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { bearingDegrees, directionWord, distanceMetres, fixIsRough, headingFromOrientation, turnBy, type Fix } from '../../domain/deviceSense'
import { PORT_COORDS } from '../../domain/ports'
import { readCode, type ScanResult } from '../../domain/scanCode'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

type OrientationEvt = Event & { webkitCompassHeading?: number; alpha?: number | null; absolute?: boolean }
type Gate = { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Which way and how far to the port, from the guest's own position (MOB-13) and, if they choose, the device compass (MOB-22). Each reading is one tap; nothing runs in the background or is stored. The port point is approximate. */
export function PortDirection({ port }: { port: string }) {
  const [fix, setFix] = useState<Fix | null>(null)
  const [problem, setProblem] = useState<'denied' | 'unavailable' | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [compassOn, setCompassOn] = useState(false)
  const [compassFailed, setCompassFailed] = useState(false)
  const coords = (PORT_COORDS as Record<string, [number, number] | undefined>)[port]

  useEffect(() => {
    if (!compassOn) return
    const on = (e: Event) => { const h = headingFromOrientation(e as OrientationEvt); if (h !== null) setHeading(h); else setCompassFailed(true) }
    window.addEventListener('deviceorientationabsolute', on)
    window.addEventListener('deviceorientation', on)
    return () => { window.removeEventListener('deviceorientationabsolute', on); window.removeEventListener('deviceorientation', on) }
  }, [compassOn])

  if (!coords) return null
  const target = { lat: coords[1], lon: coords[0] }
  const locate = () => {
    setProblem(null)
    if (!('geolocation' in navigator)) { setProblem('unavailable'); return }
    navigator.geolocation.getCurrentPosition(
      (p) => setFix({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy }),
      (e) => setProblem(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    )
  }
  const startCompass = async () => {
    setCompassFailed(false)
    const gate = (window as unknown as { DeviceOrientationEvent?: Gate }).DeviceOrientationEvent
    if (gate?.requestPermission) { try { if ((await gate.requestPermission()) !== 'granted') { setCompassFailed(true); return } } catch { setCompassFailed(true); return } }
    setCompassOn(true)
  }
  const bearing = fix ? bearingDegrees(fix, target) : 0
  const km = fix ? distanceMetres(fix, target) / 1000 : 0
  return (
    <Card labelledBy="pd-h">
      <h2 id="pd-h" className="card__title">{th('pd.title')}</h2>
      <p>{t('pd.intro')}</p>
      <Button variant="secondary" onClick={locate}>{t('pd.locate')}</Button>
      <div role="status" aria-live="polite">
        {problem && <p>{t(`pd.${problem}` as StringKey)}</p>}
        {fix && (fixIsRough(fix) ? <p>{t('pd.rough')}</p> : (
          <>
            <p>{t('pd.result', { km: km.toFixed(km < 10 ? 1 : 0), dir: t(`pd.dir.${directionWord(bearing)}` as StringKey), deg: bearing })}</p>
            {compassOn && heading !== null && (
              <>
                <svg className="nav-compass" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false"><circle className="nav-compass__ring" r="50" /><polygon className="nav-compass__arrow" points="0,-40 9,10 0,4 -9,10" transform={`rotate(${turnBy(heading, bearing)})`} /></svg>
                <p>{t('pd.turn', { deg: Math.abs(turnBy(heading, bearing)), side: t(turnBy(heading, bearing) < 0 ? 'pd.left' : 'pd.right') })}</p>
              </>
            )}
          </>
        ))}
        {compassFailed && <p>{t('pd.noCompass')}</p>}
      </div>
      {fix && !fixIsRough(fix) && !compassOn && <Button variant="secondary" onClick={startCompass}>{t('pd.compass')}</Button>}
      <p className="muted">{t('pd.note')}</p>
    </Card>
  )
}

declare class BarcodeDetector { constructor(o?: { formats: string[] }); detect(s: ImageBitmapSource): Promise<{ rawValue: string }[]> }

/** Read a QR code with the camera where the browser can, or type the code (MOB-10). A code only finds a place or a link in this app. It is never proof of boarding. */
export function CodeScanner() {
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    if (!scanning) return
    let stop = false
    let stream: MediaStream | null = null
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const el = video.current
        if (!el || stop) return
        el.srcObject = stream
        await el.play()
        const det = new BarcodeDetector({ formats: ['qr_code'] })
        while (!stop) {
          const found = await det.detect(el).catch(() => [])
          if (found[0]) { setResult(readCode(found[0].rawValue, window.location.origin)); setScanning(false); return }
          await new Promise((r) => setTimeout(r, 400))
        }
      } catch { setScanning(false) }
    })()
    return () => { stop = true; stream?.getTracks().forEach((x) => x.stop()) }
  }, [scanning])

  return (
    <Card labelledBy="qr-h">
      <h2 id="qr-h" className="card__title">{th('qr.title')}</h2>
      <p>{t('qr.intro')}</p>
      {canScan && !scanning && <Button variant="secondary" onClick={() => setScanning(true)}>{t('qr.scan')}</Button>}
      {scanning && <><video ref={video} className="qr-video" muted playsInline aria-label={t('qr.video')} /><Button variant="secondary" onClick={() => setScanning(false)}>{t('qr.stop')}</Button></>}
      <form onSubmit={(e) => { e.preventDefault(); setResult(readCode(typed, window.location.origin)) }}>
        <div className="field">
          <label htmlFor="qr-code">{t('qr.type')}</label>
          <input id="qr-code" className="field__input" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">{t('qr.read')}</Button>
      </form>
      <div role="status" aria-live="polite">
        {result?.kind === 'place' && <p>{t('qr.place', { name: result.place.name, deck: result.place.deck })}</p>}
        {result?.kind === 'link' && <p><Link to={result.path}>{t('qr.open')}</Link></p>}
        {result?.kind === 'text' && <p>{t('qr.text', { text: result.text })}</p>}
        {result?.kind === 'empty' && <p>{t('qr.empty')}</p>}
      </div>
      <p className="muted">{t('qr.note')}</p>
    </Card>
  )
}
