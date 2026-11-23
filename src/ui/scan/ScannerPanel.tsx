import { useId, useState } from 'react'
import { Link } from 'react-router'
import { useCodeScanner } from '../../hooks/useCodeScanner'
import { readCode, type ScanResult } from '../../domain/scanCode'
import { readerFor, type ScanPhase } from '../../domain/scanSession'
import { t } from '../../i18n'
import { Button } from '../Button'
import { ReceiveSheet } from './ReceiveSheet'

/** What a scan or a typed code found. A code only finds things: it never acts by itself, and a code from another site is shown as words and never opened. */
export function ScanResultView({ result, onLeave }: { result: ScanResult | null; onLeave?: () => void }) {
  if (result?.kind === 'share') return <ReceiveSheet path={result.path} onDone={onLeave ?? (() => undefined)} />
  return (
    <div role="status" aria-live="polite">
      {result?.kind === 'place' && <p>{t('qr.place', { name: result.place.name, deck: result.place.deck })}</p>}
      {result?.kind === 'link' && <p><Link to={result.path} onClick={onLeave}>{t('qr.open')}</Link></p>}
      {result?.kind === 'text' && <p>{t('qr.text', { text: result.text })}</p>}
      {result?.kind === 'empty' && <p>{t('qr.empty')}</p>}
    </div>
  )
}

const hasReader = (): boolean => typeof navigator !== 'undefined' && readerFor({ mediaDevices: navigator.mediaDevices, hasDetector: typeof window !== 'undefined' && 'BarcodeDetector' in window }) !== 'none'

const PHASE_WORDS: Partial<Record<ScanPhase, 'scan.asking' | 'scan.looking' | 'scan.paused' | 'scan.denied' | 'scan.unavailable' | 'scan.error'>> = {
  asking: 'scan.asking', looking: 'scan.looking', paused: 'scan.paused', denied: 'scan.denied', unavailable: 'scan.unavailable', error: 'scan.error',
}

/**
 * The scanner: the camera view with a spoken status, and a box to type the code for a guest who declines (or has no) camera. Used by the top-bar scan dialog (which starts at once) and by the
 * Tools card. The camera is released as soon as a code is read, the panel is stopped or closed, or the page is hidden.
 */
export function ScannerPanel({ autoStart = false, onLeave }: { autoStart?: boolean; onLeave?: () => void }) {
  const inputId = useId()
  const [scanning, setScanning] = useState(autoStart && hasReader())
  const [attempt, setAttempt] = useState(0)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const { phase, video } = useCodeScanner(scanning, (raw) => { setResult(readCode(raw, window.location.origin)); setScanning(false) }, attempt)
  const failed = phase === 'denied' || phase === 'unavailable' || phase === 'error'
  const words = PHASE_WORDS[phase]
  return (
    <div className="scan-panel">
      {hasReader() && !scanning && <Button variant="secondary" onClick={() => { setResult(null); setScanning(true) }}>{result ? t('scan.again') : t('qr.scan')}</Button>}
      {scanning && (
        <>
          <video ref={video} className="qr-video" muted playsInline aria-label={t('qr.video')} hidden={failed} />
          <p role="status" className="muted">{words ? t(words) : ''}</p>
          {failed && phase !== 'unavailable' && <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{t('scan.retry')}</Button>}
          <Button variant="secondary" onClick={() => setScanning(false)}>{t('qr.stop')}</Button>
        </>
      )}
      <form onSubmit={(e) => { e.preventDefault(); setResult(readCode(typed, window.location.origin)) }}>
        <div className="field">
          <label htmlFor={inputId}>{t('qr.type')}</label>
          <input id={inputId} className="field__input" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">{t('qr.read')}</Button>
      </form>
      <ScanResultView result={result} onLeave={() => { setResult(null); onLeave?.() }} />
    </div>
  )
}
