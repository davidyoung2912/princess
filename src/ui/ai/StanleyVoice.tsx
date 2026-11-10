import { useEffect, useRef, useState } from 'react'
import { dayPlanCard, pocketCard, speakable, voiceSupport } from '../../ai/stanleyVoice'
import { savedFacts } from '../../feeds/stanleyFacts'
import { useMemory } from '../../hooks/useMemory'
import { useSailing } from '../../hooks/useDemo'
import { useCurrentDay, useDayPlan } from '../../hooks/useDayPlan'
import { speechRecognitionOf } from '../../domain/finishMore'
import { t } from '../../i18n'
import { Button } from '../Button'
import { PrintCard } from '../delights/Cards'

interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

/** Speak into the question box. The words only fill the box: the guest still reads them and taps Send. Hidden where the device has no speech recognition. */
export function MicButton({ onHeard }: { onHeard: (text: string) => void }) {
  const [on, setOn] = useState(false)
  const [note, setNote] = useState('')
  const rec = useRef<Recognition | null>(null)
  const supported = voiceSupport(typeof window === 'undefined' ? undefined : window).listen
  useEffect(() => () => { rec.current?.stop() }, [])
  if (!supported) return null
  const toggle = () => {
    if (on) { rec.current?.stop(); return }
    const Ctor = speechRecognitionOf(window) as (new () => Recognition) | null
    if (!Ctor) return
    const r = new Ctor()
    r.lang = document.documentElement.lang || 'en-US'
    r.interimResults = false
    r.onresult = (e) => { const heard = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' '); onHeard(heard) }
    r.onerror = () => { setNote(t('stanley.voice.error')); setOn(false) }
    r.onend = () => setOn(false)
    rec.current = r
    setNote('')
    setOn(true)
    try { r.start() } catch { setOn(false); setNote(t('stanley.voice.error')) }
  }
  return (
    <>
      <Button type="button" variant="secondary" aria-pressed={on} onClick={toggle}>{on ? t('stanley.voice.stop') : t('stanley.voice.start')}</Button>
      <span role="status" className="visually-hidden">{on ? t('stanley.voice.listening') : ''}</span>
      {note && <span role="alert" className="field__error">{note}</span>}
    </>
  )
}

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
