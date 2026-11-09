import { useId, useState } from 'react'
import { Link } from 'react-router'
import {
  PACES, SCENARIOS, SOURCES, cleanNote, hardConflicts, isReady, normalizeDay, normalizeEvening, normalizeHour, normalizeMeeting,
  type Evening, type Meeting, type Pace, type PlannedDay, type PlannedHour, type AccessSource, type Scenario,
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
  const [who, setWho] = useState(false)
  const [name, setName] = useState('')
  const [pace, setPace] = useState<Pace>('steady')
  const [source, setSource] = useState<AccessSource>('unknown')
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

  const run = async (kind: Busy, work: () => Promise<void>) => {
    setBusy(kind); setFailed(false)
    try { await work() } catch { setFailed(true) } finally { setBusy('') }
  }
  const shape = () => run('shape', async () => {
    const traveller = who ? { name: name.trim().slice(0, 30), mobility, pace, source } : undefined
    setPlanned(normalizeDay(await stanleyPlanner.shape({ sailingId, day, scenario, mobility, traveller })))
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
      <label className="choice"><input type="checkbox" checked={who} onChange={(e) => setWho(e.target.checked)} /><span>{t('plan9.who')}</span></label>
      {who && (
        <div className="field">
          <label htmlFor={`${ids}-name`}>{t('plan9.whoName')}</label>
          <input id={`${ids}-name`} className="field__input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          <fieldset className="rate">
            <legend>{t('plan9.whoPace')}</legend>
            {PACES.map((p) => <label key={p} className="choice"><input type="radio" name={`${ids}-pace`} checked={pace === p} onChange={() => setPace(p)} /><span>{t(`plan9.pace.${p}` as StringKey)}</span></label>)}
          </fieldset>
          <fieldset className="rate">
            <legend>{t('plan9.whoSource')}</legend>
            {SOURCES.map((s) => <label key={s} className="choice"><input type="radio" name={`${ids}-src`} checked={source === s} onChange={() => setSource(s)} /><span>{t(`plan9.source.${s}` as StringKey)}</span></label>)}
          </fieldset>
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
              <h3>{planned.traveller.name}</h3>
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
