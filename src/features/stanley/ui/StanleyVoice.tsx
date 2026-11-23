import { useEffect, useState } from 'react'
import { dayPlanCard, pocketCard, speakable, voiceShortcut, voiceSupport, type VoiceShortcut } from '../logic/stanleyVoice'
import { savedFacts } from '../../../shared/feeds/stanleyFacts'
import { useMemory } from '../../../shared/hooks/useMemory'
import { useSailing } from '../../../shared/hooks/useDemo'
import { useCurrentDay, useDayPlan } from '../../../shared/hooks/useDayPlan'
import { t } from '../../../shared/i18n'
import { speechRecognitionOf } from '../../../domain/finishMore'
import { PrintCard } from '../../delights/ui/Cards'

/** Reads an answer aloud, only when the guest asks, at the speed they chose for read-aloud elsewhere (normal here). One thing is spoken at a time. */
export function ReadAloud({ text }: { text: string }) {
  const [reading, setReading] = useState(false)
  const supported = voiceSupport(typeof window === 'undefined' ? undefined : window).speak
  useEffect(() => () => { if (reading) window.speechSynthesis.cancel() }, [reading])
  if (!supported) return null
  const toggle = () => {
    const synth = window.speechSynthesis
    synth.cancel()
    if (reading) { setReading(false); return }
    const u = new SpeechSynthesisUtterance(speakable(text))
    u.onend = () => setReading(false)
    u.onerror = () => setReading(false)
    setReading(true)
    synth.speak(u)
  }
  return <button type="button" className="link-button" aria-pressed={reading} onClick={toggle}>{reading ? t('stanley.read.stop') : t('stanley.read.start')}</button>
}

/** The pocket card: one page of the guest's saved trip facts, contacts and needs, to print (large type if they want it) or keep. It works from what this phone already holds, so it opens with no signal. */
export function PocketPanel() {
  const sailing = useSailing()
  const { state: mem } = useMemory()
  const day = useCurrentDay()
  const plan = useDayPlan(day)
  const [large, setLarge] = useState(false)
  const [facts, setFacts] = useState(() => savedFacts.now() ?? [])
  useEffect(() => { void savedFacts.load().then(() => setFacts(savedFacts.now() ?? [])).catch(() => undefined) }, [])
  const card = pocketCard({
    title: t('stanley.pocket.title'), subtitle: t('stanley.pocket.sub', { date: sailing.departure }),
    facts, access: mem.access, allergy: mem.allergy,
    words: { facts: t('stanley.pocket.facts'), contacts: t('stanley.pocket.contacts'), guest: t('stanley.pocket.guest'), emergency: t('stanley.pocket.emergency'), needs: t('stanley.pocket.needs'), allergy: t('stanley.pocket.allergy'), step: t('stanley.pocket.step'), wheels: t('stanley.pocket.wheels'), none: t('stanley.pocket.none'), foot: t('stanley.pocket.foot') },
  }, large)
  return (
    <section className="stanley__pocket" aria-label={t('stanley.pocket.title')}>
      <label className="choice no-print"><input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} /><span>{t('stanley.pocket.large')}</span></label>
      <PrintCard card={card} label={t('stanley.pocket.title')} />
      <PrintCard label={t('stanley.pocket.day')} card={dayPlanCard({ title: t('stanley.pocket.day'), subtitle: t('stanley.pocket.daySub', { day, date: sailing.departure }), rows: plan.rows, ready: plan.ready, words: { empty: t('stanley.pocket.dayEmpty'), waiting: t('stanley.pocket.dayWaiting'), foot: t('stanley.pocket.dayFoot') } }, true)} />
      {facts.length === 0 && <p className="muted no-print">{t('stanley.pocket.empty')}</p>}
    </section>
  )
}

interface Recognition { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void }

/** Speak a question (ACT-07). It listens once, only after a tap, and puts what it heard in the question box; nothing is recorded, kept or sent, and sending is still a tap. Not shown where the phone cannot listen. */
export function ListenButton({ onHeard }: { onHeard: (heard: VoiceShortcut) => void }) {
  const [listening, setListening] = useState(false)
  const [failed, setFailed] = useState(false)
  const Recognizer = speechRecognitionOf(typeof window === 'undefined' ? undefined : window) as (new () => Recognition) | null
  if (!Recognizer) return null
  const start = () => {
    setFailed(false)
    const r = new Recognizer()
    r.lang = document.documentElement.lang || 'en-US'
    r.interimResults = false
    r.onresult = (e) => { onHeard(voiceShortcut(Array.from(e.results, (x) => x[0]?.transcript ?? '').join(' '))) }
    r.onend = () => setListening(false)
    r.onerror = () => { setListening(false); setFailed(true) }
    setListening(true)
    try { r.start() } catch { setListening(false); setFailed(true) }
  }
  return (
    <>
      <button type="button" className="link-button" disabled={listening} onClick={start}>{listening ? t('stanley.voice.listening') : t('stanley.voice.start')}</button>
      {listening && <span role="status" className="muted"> {t('stanley.voice.hint')}</span>}
      {failed && <span role="alert" className="field__error"> {t('stanley.voice.failed')}</span>}
    </>
  )
}
