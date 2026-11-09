import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import {
  PACES, SCENARIOS, SOURCES, TRAVELLER_NOTE_MAX, cleanNote, hardConflicts, isReady, newTravellerId, normalizeDay, normalizeEvening, normalizeHour, normalizeMeeting, normalizeTravellers, travellerBody,
  type Evening, type Meeting, type Pace, type PlannedDay, type PlannedHour, type AccessSource, type PlannerMobility, type Scenario, type Traveller,
} from '../../ai/stanleyPlanner'
import { PLACES } from '../../domain/deck'
import type { Mobility } from '../../domain/day'
import { formatMoney } from '../../domain/money'
import { t, th, type StringKey } from '../../i18n'
import { stanleyPlanner } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'

type Busy = '' | 'shape' | 'hour' | 'evening' | 'meeting'

/**
 * Stanley's planner (phase 9). Shapes the chosen day for a mood on top of what the guest already holds, shows clashes as must-fix or worth-a-look, the free windows, three ways to spend the next hour, the
 * evening in order, and a meeting message to send. Every time, clash and price comes from the server; nothing here books, moves or pays.
 */
export function StanleyPlannerPanel({ sailingId, day, mobility }: { sailingId: string; day: number; mobility: Mobility }) {
  const ids = useId()
  const [scenario, setScenario] = useState<Scenario>('mixed')
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [saved, setSaved] = useState<Traveller[]>([])
  const [pick, setPick] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string; mobility: PlannerMobility; pace: Pace; source: AccessSource; checkedOn: string; note: string } | null>(null)
  const [large, setLarge] = useState(false)
  const [planned, setPlanned] = useState<PlannedDay | null>(null)
  const [at, setAt] = useState('10:00')
  const [hour, setHour] = useState<PlannedHour | null>(null)
  const [evening, setEvening] = useState<Evening | null>(null)
  const [place, setPlace] = useState('piazza')
  const [time, setTime] = useState('17:00')
  const [note, setNote] = useState('')
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<Busy>('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    stanleyPlanner.travellers().then((raw) => { if (live) setSaved(normalizeTravellers(raw).travellers) }, () => undefined)
    return () => { live = false }
  }, [])
  const saveEditing = async () => {
    if (!editing) return
    setFailed(false)
    try { setSaved(normalizeTravellers(await stanleyPlanner.saveTraveller(editing.id, travellerBody(editing))).travellers); setPick(editing.id); setEditing(null) } catch { setFailed(true) }
  }
  const forget = async (id: string) => {
    setFailed(false)
    try { setSaved(normalizeTravellers(await stanleyPlanner.forgetTraveller(id)).travellers); if (pick === id) setPick('') } catch { setFailed(true) }
  }
  const mine = saved.find((x) => x.id === pick)

  const run = async (kind: Busy, work: () => Promise<void>) => {
    setBusy(kind); setFailed(false)
    try { await work() } catch { setFailed(true) } finally { setBusy('') }
  }
  const shape = () => run('shape', async () => {
    setPlanned(normalizeDay(await stanleyPlanner.shape({ sailingId, day, scenario, mobility, travellerId: pick || undefined })))
  })
  const askHour = () => run('hour', async () => setHour(normalizeHour(await stanleyPlanner.hour({ sailingId, day, from: at, mobility }))))
  const askEvening = () => run('evening', async () => setEvening(normalizeEvening(await stanleyPlanner.evening({ sailingId, day, mobility }))))
  const draft = () => run('meeting', async () => { setCopied(false); setMeeting(normalizeMeeting(await stanleyPlanner.meeting({ sailingId, day, placeId: place, time, note: cleanNote(note) || undefined }))) })
  const copy = async () => { try { await navigator.clipboard.writeText(meeting?.text ?? ''); setCopied(true) } catch { setCopied(false) } }

  return (
    <Card labelledBy={`${ids}-h`}>
      <h2 id={`${ids}-h`} className="card__title">{th('plan9.title')}</h2>
      <p>{t('plan9.intro')}</p>
      <fieldset className="chip-group">
        <legend>{t('plan9.scenario')}</legend>
        {SCENARIOS.map((s) => <Chip key={s} pressed={scenario === s} onToggle={() => setScenario(s)}>{t(`plan9.scenario.${s}` as StringKey)}</Chip>)}
      </fieldset>
      <div className="field">
        <label htmlFor={`${ids}-who`}>{t('plan9.who')}</label>
        <select id={`${ids}-who`} className="field__input" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{t('plan9.whoNobody')}</option>
          {saved.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {mine && (
          <p className="muted">{t(`plan9.source.${mine.source}` as StringKey)} · {t(`plan9.confidence.${mine.confidence}` as StringKey)}{mine.checkedOn ? ` · ${t('plan9.checkedOn', { date: mine.checkedOn })}` : ''}{mine.stale ? ` · ${t('plan9.stale')}` : ''}</p>
        )}
        <div className="button-row">
          <Button variant="tertiary" onClick={() => setEditing({ id: newTravellerId(Date.now(), Math.random()), name: '', mobility, pace: 'steady', source: 'unknown', checkedOn: '', note: '' })}>{t('plan9.whoAdd')}</Button>
          {mine && <Button variant="tertiary" onClick={() => setEditing({ id: mine.id, name: mine.name, mobility: mine.mobility, pace: mine.pace, source: mine.source, checkedOn: mine.checkedOn ?? '', note: mine.note })}>{t('plan9.whoEdit')}</Button>}
          {mine && <Button variant="tertiary" onClick={() => void forget(mine.id)}>{t('plan9.whoForget')}<span className="visually-hidden"> {mine.name}</span></Button>}
        </div>
      </div>
      {editing && (
        <div className="field">
          <label htmlFor={`${ids}-name`}>{t('plan9.whoName')}</label>
          <input id={`${ids}-name`} className="field__input" value={editing.name} maxLength={30} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <fieldset className="rate">
            <legend>{t('day.mobility')}</legend>
            {(['any', 'easy', 'wheelchair'] as const).map((m) => <label key={m} className="choice"><input type="radio" name={`${ids}-mob`} checked={editing.mobility === m} onChange={() => setEditing({ ...editing, mobility: m })} /><span>{t(`day.mobility.${m}` as StringKey)}</span></label>)}
          </fieldset>
          <fieldset className="rate">
            <legend>{t('plan9.whoPace')}</legend>
            {PACES.map((p) => <label key={p} className="choice"><input type="radio" name={`${ids}-pace`} checked={editing.pace === p} onChange={() => setEditing({ ...editing, pace: p })} /><span>{t(`plan9.pace.${p}` as StringKey)}</span></label>)}
          </fieldset>
          <fieldset className="rate">
            <legend>{t('plan9.whoSource')}</legend>
            {SOURCES.map((x) => <label key={x} className="choice"><input type="radio" name={`${ids}-src`} checked={editing.source === x} onChange={() => setEditing({ ...editing, source: x })} /><span>{t(`plan9.source.${x}` as StringKey)}</span></label>)}
          </fieldset>
          {editing.source === 'verified' && (
            <>
              <label htmlFor={`${ids}-date`}>{t('plan9.whoDate')}</label>
              <input id={`${ids}-date`} type="date" className="field__input" value={editing.checkedOn} max={today} onChange={(e) => setEditing({ ...editing, checkedOn: e.target.value })} />
            </>
          )}
          <label htmlFor={`${ids}-wnote`}>{t('plan9.whoNote')}</label>
          <input id={`${ids}-wnote`} className="field__input" value={editing.note} maxLength={TRAVELLER_NOTE_MAX} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
          <div className="button-row">
            <Button onClick={() => void saveEditing()} disabled={editing.name.trim() === '' || (editing.source === 'verified' && editing.checkedOn === '')}>{t('plan9.whoSave')}</Button>
            <Button variant="tertiary" onClick={() => setEditing(null)}>{t('plan9.whoCancel')}</Button>
          </div>
        </div>
      )}
      <Button onClick={() => void shape()} disabled={busy !== ''}>{t('plan9.shape')}</Button>
      <div role="status">{failed && <p>{t('plan9.failed')}</p>}</div>

      {planned && (
        <div className={large ? 'plan9 plan9--large' : 'plan9'}>
          <p><strong>{isReady(planned) ? t('plan9.ready') : t('plan9.notReady')}</strong></p>
          <ol className="build-list">
            {planned.segments.map((s) => (
              <li key={`${s.kind}-${s.id}`}>
                <p className="build-list__time">{s.start}–{s.end} <span className="muted">{t(`plan9.clock.${s.clock}` as StringKey)}</span></p>
                <div>
                  <p><strong>{s.title}</strong> <span className="muted">· {t(s.source === 'reserved' ? 'plan9.held' : 'plan9.suggested')} · {t(`plan9.cost.${s.cost}` as StringKey)}{s.cost === 'paid' && s.cents > 0 ? ` ${formatMoney(s.cents)}` : ''}</span></p>
                </div>
              </li>
            ))}
          </ol>
          {planned.backBy && <p>{t('day.backBy', { time: planned.backBy })}</p>}
          {planned.conflicts.length > 0 && (
            <ul>{planned.conflicts.map((c) => <li key={c.code + c.ids.join()}><strong>{t(c.severity === 'hard' ? 'plan9.hard' : 'plan9.soft')}:</strong> {c.text}</li>)}</ul>
          )}
          {hardConflicts(planned).length === 0 && planned.windows.length > 0 && (
            <>
              <h3>{t('plan9.windows')}</h3>
              <ul>{planned.windows.map((w) => <li key={w.start}>{t('plan9.windowLine', { start: w.start, end: w.end, minutes: w.minutes })}</li>)}</ul>
            </>
          )}
          {planned.notes.length > 0 && <ul className="muted">{planned.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          {planned.traveller && (
            <div>
              <h3>{planned.traveller.name} <span className="muted">· {t(`plan9.confidence.${planned.traveller.confidence}` as StringKey)}</span></h3>
              <ul>{planned.traveller.changes.map((c) => <li key={c.id + c.text}><strong>{t(c.severity === 'change' ? 'plan9.change' : 'plan9.check')}:</strong> {c.text}</li>)}</ul>
              <p className="muted">{planned.traveller.note}</p>
            </div>
          )}
          <label className="choice"><input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} /><span>{t('plan9.large')}</span></label>
          <Button variant="secondary" onClick={() => window.print()}>{t('plan9.print')}</Button>
        </div>
      )}

      <h3>{t('plan9.hour')}</h3>
      <div className="field">
        <label htmlFor={`${ids}-at`}>{t('plan9.hourFrom')}</label>
        <input id={`${ids}-at`} type="time" className="field__input" value={at} onChange={(e) => setAt(e.target.value)} />
      </div>
      <Button variant="secondary" onClick={() => void askHour()} disabled={busy !== '' || at === ''}>{t('plan9.hourGo')}</Button>
      {hour && (
        <div>
          {hour.options.length === 0 ? <p>{t('plan9.none')}</p> : (
            <ul>
              {hour.options.map((o) => (
                <li key={o.kind + o.id}>
                  <strong>{o.title}</strong> <span className="muted">· {t(`plan9.cost.${o.cost}` as StringKey)} · {t('plan9.walk', { n: o.walk })}{o.meets.length > 0 ? ' · ' + o.meets.map((m) => t(`plan9.meets.${m}` as StringKey)).join(', ') : ''}</span>
                  <br /><span className="muted">{o.why}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">{hour.occupancy}</p>
        </div>
      )}

      <h3>{t('plan9.evening')}</h3>
      <Button variant="secondary" onClick={() => void askEvening()} disabled={busy !== ''}>{t('plan9.eveningGo')}</Button>
      {evening && (
        <div>
          <ol className="build-list">
            {evening.steps.map((s) => (
              <li key={s.kind}>
                <p className="build-list__time">{s.start}–{s.end}</p>
                <div>
                  <p><strong>{s.title}</strong> <span className="muted">· {s.place ?? ''}{s.walkFromPrevious > 0 ? ` · ${t('plan9.walk', { n: s.walkFromPrevious })}` : ''}</span></p>
                  {s.route && <p><Link to={s.route}>{t('plan9.eveningBook')}</Link></p>}
                  {s.kind === 'dinner' && s.source === 'suggested' && <p><Link to={`/home/ask?q=${encodeURIComponent(`Book dinner on night ${day} at ${s.start}`)}`}>{t('plan9.eveningAsk')}</Link></p>}
                </div>
              </li>
            ))}
          </ol>
          {evening.notes.length > 0 && <ul className="muted">{evening.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      )}

      <h3>{t('plan9.meeting')}</h3>
      <div className="field">
        <label htmlFor={`${ids}-place`}>{t('plan9.meetPlace')}</label>
        <select id={`${ids}-place`} className="field__input" value={place} onChange={(e) => setPlace(e.target.value)}>
          {PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label htmlFor={`${ids}-time`}>{t('plan9.meetTime')}</label>
        <input id={`${ids}-time`} type="time" className="field__input" value={time} onChange={(e) => setTime(e.target.value)} />
        <label htmlFor={`${ids}-note`}>{t('plan9.meetNote')}</label>
        <input id={`${ids}-note`} className="field__input" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button variant="secondary" onClick={() => void draft()} disabled={busy !== '' || time === ''}>{t('plan9.meetGo')}</Button>
      {meeting && (
        <div role="status">
          <p>{meeting.text}</p>
          <Button variant="tertiary" onClick={() => void copy()}>{t('plan9.meetCopy')}</Button>
          {copied && <p>{t('plan9.meetCopied')}</p>}
        </div>
      )}
    </Card>
  )
}
