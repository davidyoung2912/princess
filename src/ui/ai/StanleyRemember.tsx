import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import stanley from '../../assets/stanley-small.png'
import {
  askPortMemory, buildMilestones, correctLine, costRange, dailyRecap, draftCaption, draftFeedback, mayPromoteRebooking, nextVoyageIdeas, removedLines, removeLine, renderStory,
  restoreLine, setTone, THANKS, TONES, VERSIONS, type FeedbackFacts, type RebookGate, type Thanks, type Tone, type Version, type Voyage,
} from '../../ai/stanleyRemember'
import { storyShows } from '../../ai/stanleyStory'
import { browseSailings, sailingFacts } from '../../domain/catalogueBrowse'
import { formatDate } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import type { Recap } from '../../domain/recap'
import { itinerary, portById } from '../../domain/sailings'
import { addNote, entriesFor, type TripEntry } from '../../domain/tripDiary'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { stanleyLevelFor } from '../../settings/settings'
import type { RebookOption } from '../../api/finishTypes'
import { Button } from '../Button'
import { Card } from '../Card'
import { TextArea } from '../Field'
import { WhyThis } from './WhyThis'

/** The open case in place of a rebooking prompt: what is open and how to see it. Stanley says nothing about booking again until it is settled. */
export function RebookCaseNote({ gate }: { gate: RebookGate | null }) {
  if (!gate || gate.cases.length === 0) return null
  return (
    <aside className="stanley-next no-print" aria-label={t('rem13.hold.label')}>
      <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
      <div>
        <p className="tip__text">{t(gate.mode === 'hold' ? 'rem13.hold.serious' : 'rem13.hold.open')}</p>
        <ul className="plain-bullets">{gate.cases.slice(0, 3).map((c) => <li key={c.id}>{c.label}</li>)}</ul>
        <p><Link to="/me/cases">{t('route.cases')}</Link></p>
      </div>
    </aside>
  )
}

/** Next-voyage ideas on the booking screen: only from the places the guest chose to keep, each saying why, with the range of the totals. Shown at Helpful and Chatty, and never while a case is open. */
export function StanleyVoyageIdeas({ options, gate }: { options: readonly RebookOption[]; gate: RebookGate | null }) {
  const [settings] = useSettings()
  const { state } = useMemory()
  const wants = state.remember.wants
  const ideas = useMemo(() => {
    const byDeparture = new Map(browseSailings().map((s) => [s.departure, sailingFacts(s)]))
    const voyages: Voyage[] = options.flatMap((o) => { const f = byDeparture.get(o.departure); return f ? [{ id: o.id, departure: o.departure, places: f.ports.map((p) => portById(p)?.name ?? p), totalCents: o.total }] : [] })
    return nextVoyageIdeas(wants, voyages)
  }, [options, wants])
  if (!storyShows(stanleyLevelFor(settings)) || gate === null || !mayPromoteRebooking(gate) || ideas.length === 0) return null
  const range = costRange(ideas)
  return (
    <Card labelledBy="rem13-ideas-h">
      <h2 id="rem13-ideas-h" className="card__title">{t('rem13.ideas.title')} <WhyThis kind="story" fact={t('rem13.ideas.why')} what={t('rem13.ideas.title')} /></h2>
      <p className="muted">{t('rem13.ideas.intro')}</p>
      <ul className="plain-bullets">
        {ideas.map((i) => <li key={i.id}>{t('rem13.ideas.line', { date: formatDate(i.departure), because: [...new Set(i.because.map((b) => b.place))].join(', '), want: [...new Set(i.because.map((b) => b.want))].join('; ') })}{i.totalCents !== null && <> · {t('reb.total', { amount: formatMoney(i.totalCents) })}</>}</li>)}
      </ul>
      {range && <p>{t('rem13.ideas.range', { low: formatMoney(range.low), high: formatMoney(range.high) })}</p>}
      <p className="muted">{t('rem13.ideas.note')}</p>
    </Card>
  )
}

/** The Voyage Story: every line with its source, the guest's removals and corrections, a tone, and three versions. Nothing is shared from here except the text the guest copies or sends themselves. */
export function StanleyVoyageStory({ recap }: { recap: Recap }) {
  const { state, update } = useMemory()
  const choices = state.remember.story
  const [version, setVersion] = useState<Version>('private')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null)
  const ms = useMemo(() => buildMilestones({ party: recap.party, shipName: recap.shipName, cruiseName: recap.cruiseName, nights: recap.nights, dates: recap.dates, ports: recap.ports, seaDays: recap.seaDays, tourNames: recap.tourNames, favouriteMeal: recap.favouriteMeal, photos: recap.photos }, state.journal), [recap, state.journal])
  const story = renderStory(recap, ms, choices, version)
  const put = (next: typeof choices) => update((s) => ({ ...s, remember: { ...s.remember, story: next } }))
  const gone = removedLines(ms, choices, version)
  const copy = async () => {
    try { await navigator.clipboard.writeText(story.text); setCopied('copied') } catch { setCopied('failed') }
  }
  return (
    <Card labelledBy="rem13-story-h">
      <h2 id="rem13-story-h" className="card__title">{t('rem13.story.title')} <WhyThis kind="story" fact={t('rem13.story.why')} what={t('rem13.story.title')} /></h2>
      <p className="muted">{t('rem13.story.intro')}</p>
      <div className="chip-row" role="group" aria-label={t('rem13.story.version')}>
        {VERSIONS.map((v) => <button key={v} type="button" className="chip-q" aria-pressed={version === v} onClick={() => { setVersion(v); setCopied(null) }}>{t(`rem13.version.${v}` as StringKey)}</button>)}
      </div>
      <p className="muted">{t(`rem13.version.${version}.note` as StringKey)}</p>
      <div className="field">
        <label htmlFor="rem13-tone">{t('rem13.story.tone')}</label>
        <select id="rem13-tone" className="field__input" value={choices.tone} onChange={(e) => put(setTone(choices, e.target.value as Tone))}>
          {TONES.map((x) => <option key={x} value={x}>{t(`rem13.tone.${x}` as StringKey)}</option>)}
        </select>
      </div>
      <h3>{story.title}</h3>
      <p>{story.opening}</p>
      <ul className="plain-list">
        {story.lines.map((l) => (
          <li key={l.id}>
            {editing === l.id ? (
              <>
                <TextArea label={t('rem13.story.correctLabel')} value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} />
                <div className="button-row">
                  <Button onClick={() => { put(correctLine(choices, l.id, draft)); setEditing(null) }}>{t('rem13.story.saveCorrection')}</Button>
                  <Button variant="tertiary" onClick={() => setEditing(null)}>{t('rem13.story.cancel')}</Button>
                </div>
              </>
            ) : (
              <>
                <span>{l.text}</span> <span className="muted">({l.source})</span>
                <span className="button-row">
                  <Button variant="tertiary" onClick={() => { setDraft(l.text); setEditing(l.id) }}>{t('rem13.story.correct')}<span className="visually-hidden"> {l.text.slice(0, 40)}</span></Button>
                  <Button variant="tertiary" onClick={() => put(removeLine(choices, l.id))}>{t('rem13.story.remove')}<span className="visually-hidden"> {l.text.slice(0, 40)}</span></Button>
                  {l.corrected && <Button variant="tertiary" onClick={() => put(correctLine(choices, l.id, ''))}>{t('rem13.story.original')}</Button>}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p>{story.closing}</p>
      {gone.length > 0 && (
        <details>
          <summary>{t('rem13.story.removed', { count: gone.length })}</summary>
          <ul className="plain-list">{gone.map((m) => <li key={m.id}><span>{m.text}</span> <Button variant="tertiary" onClick={() => put(restoreLine(choices, m.id))}>{t('rem13.story.restore')}<span className="visually-hidden"> {m.text.slice(0, 40)}</span></Button></li>)}</ul>
        </details>
      )}
      <div className="button-row"><Button onClick={() => void copy()}>{t('rem13.story.copy')}</Button></div>
      {copied && <p role="status">{t(`rem13.story.${copied}` as StringKey)}</p>}
    </Card>
  )
}

/** "Help me write this" on the feedback form: a draft from the crew and ratings the guest chose. It is added to the comment only when the guest says so; the form's own Send is the only way it goes anywhere. */
export function StanleyFeedbackDrafter({ crew, overall, liked, disliked, comment, max, onUse }: { crew: readonly string[]; overall: number; liked: readonly string[]; disliked: readonly string[]; comment: string; max: number; onUse: (text: string) => void }) {
  const [settings] = useSettings()
  const [tone, setToneState] = useState<Tone>('warm')
  const [thanks, setThanks] = useState<Thanks[]>([])
  const [open, setOpen] = useState(false)
  if (stanleyLevelFor(settings) === 'off') return null
  const facts: FeedbackFacts = { crew, thanks, tone, overall, liked, disliked }
  const draft = draftFeedback(facts, max)
  const use = () => { onUse(comment.trim() === '' ? draft : `${comment.trim()} ${draft}`.slice(0, max)); setOpen(false) }
  return (
    <section className="plain-fieldset" aria-labelledby="rem13-fb-h">
      <h3 id="rem13-fb-h">{t('rem13.fb.title')}</h3>
      <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{t('rem13.fb.open')}</Button>
      {open && (
        <div>
          <p className="field__hint">{t('rem13.fb.hint')}</p>
          {crew.length > 0 && (
            <fieldset className="plain-fieldset">
              <legend>{t('rem13.fb.thanksFor')}</legend>
              {THANKS.map((k) => <label key={k} className="choice"><input type="checkbox" checked={thanks.includes(k)} onChange={() => setThanks(thanks.includes(k) ? thanks.filter((x) => x !== k) : [...thanks, k])} /><span>{t(`rem13.thanks.${k}` as StringKey)}</span></label>)}
            </fieldset>
          )}
          <div className="field">
            <label htmlFor="rem13-fb-tone">{t('rem13.story.tone')}</label>
            <select id="rem13-fb-tone" className="field__input" value={tone} onChange={(e) => setToneState(e.target.value as Tone)}>{TONES.map((x) => <option key={x} value={x}>{t(`rem13.tone.${x}` as StringKey)}</option>)}</select>
          </div>
          <p><strong>{t('rem13.fb.draft')}</strong></p>
          <p>{draft}</p>
          <p className="muted">{t('rem13.fb.edit')}</p>
          <Button onClick={use}>{comment.trim() === '' ? t('rem13.fb.use') : t('rem13.fb.add')}</Button>
        </div>
      )}
    </section>
  )
}

/** A caption suggestion for one photo the guest chose, from that day and the diary lines they kept. The picture is never looked at and nobody is named. The guest copies it or leaves it. */
export function StanleyCaption({ photoDay, title }: { photoDay: number; title: string }) {
  const sailing = useSailing()
  const { state } = useMemory()
  const [tone, setToneState] = useState<Tone>('warm')
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const day = itinerary(sailing).find((d) => d.day === photoDay)
  const port = day && day.port !== 'sea' ? (portById(day.port)?.name ?? null) : null
  const caption = draftCaption({ port, day: photoDay, tone, diary: entriesFor(state.diary, sailing.id).filter((e) => e.day === photoDay) })
  return (
    <span className="no-print">
      <Button variant="tertiary" aria-expanded={open} onClick={() => setOpen(!open)}>{t('rem13.cap.open')}<span className="visually-hidden"> {title}</span></Button>
      {open && (
        <span role="group" aria-label={t('rem13.cap.label', { title })}>
          <select aria-label={t('rem13.story.tone')} className="field__input" value={tone} onChange={(e) => setToneState(e.target.value as Tone)}>{TONES.map((x) => <option key={x} value={x}>{t(`rem13.tone.${x}` as StringKey)}</option>)}</select>
          <p>{caption}</p>
          <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(caption).then(() => setCopied(true), () => setCopied(false)) }}>{t('rem13.cap.copy')}</Button>
          {copied && <span role="status"> {t('rem13.cap.copied')}</span>}
          <span className="muted"> {t('rem13.cap.note')}</span>
        </span>
      )}
    </span>
  )
}

/** The day's recap from the lines already in the diary, and, after a port day with nothing the guest wrote, one question about what to keep. The answer is the guest's own words, saved as a diary note; no place or photo is attached. */
export function StanleyDayRecap({ day }: { day: number }) {
  const sailing = useSailing()
  const now = useNow()
  const [settings] = useSettings()
  const { state, update } = useMemory()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  if (!storyShows(stanleyLevelFor(settings))) return null
  const entries: readonly TripEntry[] = entriesFor(state.diary, sailing.id)
  const info = itinerary(sailing).find((d) => d.day === day)
  const port = info && info.port !== 'sea' ? (portById(info.port)?.name ?? null) : null
  const lines = dailyRecap(entries, day)
  const ask = askPortMemory(entries, day, port) && !saved
  if (lines.length === 0 && !ask && !saved) return null
  const keep = () => {
    update((s) => { const diary = addNote(s.diary, { id: newMemoryId(), sailingId: sailing.id, day, at: now, text }); return diary === s.diary ? s : { ...s, diary } })
    setSaved(true); setText('')
  }
  return (
    <aside className="stanley-ask no-print" aria-label={t('rem13.day.title', { day })}>
      <div className="stanley-ask__bubble">
        <img className="stanley-answer__face" src={stanley} alt="" width="192" height="192" />
        <div>
          <h2 className="stanley-ask__q">{t('rem13.day.title', { day })} <WhyThis kind="story" fact={t('rem13.day.why')} what={t('rem13.day.title', { day })} /></h2>
          {lines.length > 0 ? <><p className="muted">{t('rem13.day.intro')}</p><ul className="plain-bullets">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul></> : null}
          {ask && (
            <>
              <p>{t('rem13.port.ask', { port: port ?? '' })}</p>
              <TextArea label={t('rem13.port.label', { port: port ?? '' })} value={text} maxLength={280} onChange={(e) => setText(e.target.value)} />
              <p className="muted">{t('rem13.port.note')}</p>
              <Button onClick={keep} disabled={text.trim() === ''}>{t('rem13.port.keep')}</Button>
            </>
          )}
          {saved && <p role="status">{t('rem13.port.saved')}</p>}
        </div>
      </div>
    </aside>
  )
}
