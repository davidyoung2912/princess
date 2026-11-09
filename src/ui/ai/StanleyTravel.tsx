import { useEffect, useId, useState } from 'react'
import {
  BUDGETS, CROWDS, GOALS, INTERESTS, flightNeedsAttention, isReviewed, normalizeEmbark, normalizeEntry, normalizeFlight, normalizePack, normalizePhrases, normalizePort, normalizeTraffic, packText, planIsSafe,
  type Crowd, type EmbarkTour, type EntryInfo, type FlightReplan, type Goal, type Interest, type Phrases, type PortPack, type ShorePlan, type TrafficReplan, type TravelMode,
} from '../../ai/stanleyTravel'
import type { Mobility } from '../../domain/day'
import { formatMoney } from '../../domain/money'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th, type StringKey } from '../../i18n'
import { stanleyTravel } from '../../runtime'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'

const toggle = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

/** The time a provider answered, with the zone it is shown in, so no time stands without its clock. */
const asOfText = (at: number): string => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(at)

function CopyDraft({ text }: { text: string }) {
  const [state, setState] = useState<'' | 'done' | 'failed'>('')
  const copy = async () => { try { await navigator.clipboard.writeText(text); setState('done') } catch { setState('failed') } }
  return (
    <>
      <p className="quote">{text}</p>
      <Button variant="tertiary" onClick={() => void copy()}>{t('tr10.copy')}</Button>
      <span role="status" className="muted"> {state === 'done' ? t('tr10.copied') : state === 'failed' ? t('tr10.copyFailed') : ''}</span>
    </>
  )
}

/** Your onward flight rechecked against the flight status feed (phase 10): what the feed says, whether you still make it, other ways off the ship that work, and a message to send. Nothing is rebooked or changed. */
export function StanleyFlightCard({ sailingId }: { sailingId: string }) {
  const id = useId()
  const [flight, setFlight] = useState<FlightReplan | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const check = async () => {
    setBusy(true); setFailed(false)
    try { const f = normalizeFlight(await stanleyTravel.flight(sailingId)); setFlight(f); setFailed(f === null) } catch { setFailed(true) } finally { setBusy(false) }
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('tr10.flight.title')}</h2>
      <p>{t('tr10.flight.intro')}</p>
      <Button variant="secondary" onClick={() => void check()} disabled={busy}>{t('tr10.flight.check')}</Button>
      <div role="status">
        {failed && <p>{t('tr10.failed')}</p>}
        {flight?.state === 'noPlan' && <p>{t('tr10.flight.noPlan')}</p>}
        {flight?.state === 'unknown' && <p>{t('tr10.flight.unknown', { flight: flight.flight ?? '' })}</p>}
        {flight?.state === 'ok' && (
          <>
            <p><strong>{t(`tr10.flight.status.${flight.status}` as StringKey, { flight: flight.flight ?? '', minutes: String(flight.delayMinutes) })}</strong></p>
            <p className="muted">{t('tr10.source', { provider: flight.provider, time: asOfText(flight.asOf) })}</p>
            {flight.newFlightAt && <p>{t('tr10.flight.newTime', { time: flight.newFlightAt, clock: flight.clock })}</p>}
            <p className={flightNeedsAttention(flight) ? 'tag tag--warn' : 'tag tag--good'}>{t(`tr10.flight.verdict.${flight.verdict}` as StringKey)}</p>
            {flight.leaveBy && flight.offAt && <p>{t('tr10.flight.leave', { off: flight.offAt, by: flight.leaveBy, clock: flight.clock })}</p>}
            {flight.alternatives.length > 0 && <><h3>{t('tr10.flight.alts')}</h3><ul>{flight.alternatives.map((a) => <li key={`${a.offOption}-${a.mode}`}>{a.text}</li>)}</ul></>}
            <h3>{t('tr10.draft')}</h3>
            <CopyDraft text={flight.message} />
            <ul>{flight.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </>
        )}
      </div>
    </Card>
  )
}

/** Traffic on the way to the ship on embarkation day (phase 10), with a message for the driver. */
export function StanleyTrafficCard({ sailingId }: { sailingId: string }) {
  const id = useId()
  const [crowd, setCrowd] = useState<Crowd>('busy')
  const [r, setR] = useState<TrafficReplan | null>(null)
  const [failed, setFailed] = useState(false)
  const go = async () => {
    setFailed(false)
    try { const x = normalizeTraffic(await stanleyTravel.traffic({ sailingId, crowd })); setR(x); setFailed(x === null) } catch { setFailed(true) }
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('tr10.traffic.title')}</h2>
      <p>{t('tr10.traffic.intro')}</p>
      <div className="field">
        <label htmlFor={`${id}-c`}>{t('tr10.traffic.crowd')}</label>
        <select id={`${id}-c`} className="field__input" value={crowd} onChange={(e) => setCrowd(e.target.value as Crowd)}>
          {CROWDS.map((c) => <option key={c} value={c}>{t(`tr10.traffic.crowd.${c}` as StringKey)}</option>)}
        </select>
      </div>
      <Button variant="secondary" onClick={() => void go()}>{t('tr10.traffic.go')}</Button>
      <div role="status">
        {failed && <p>{t('tr10.failed')}</p>}
        {r && (
          <>
            <p className="muted">{t('tr10.source', { provider: r.provider, time: asOfText(r.asOf) })}</p>
            <ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            <h3>{t('tr10.draft')}</h3>
            <CopyDraft text={r.message} />
          </>
        )}
      </div>
    </Card>
  )
}

/** The offline port pack: the last good copy is kept on this device, so it opens with no signal (and says so). */
function PortPackSection({ sailingId, day }: { sailingId: string; day: number }) {
  const copy = useSavedCopy<PortPack | null>('portPack', `${sailingId}.${day}`, async () => normalizePack(await stanleyTravel.pack({ sailingId, day })), (raw) => (raw === null ? null : normalizePack(raw)), [sailingId, day])
  return (
    <section aria-label={t('tr10.pack.title')} role="status">
      <h3>{t('tr10.pack.title')}</h3>
      {copy.status === 'loading' && !copy.data && <p className="muted">{t('account.loading')}</p>}
      {copy.status === 'error' && !copy.data && <p>{t('tr10.failed')}</p>}
      {copy.data && (
        <>
          <p className="muted">{copy.fromCopy ? t('tr10.pack.copy', { port: copy.data.portName }) : t('tr10.pack.kept', { port: copy.data.portName })}</p>
          <pre className="pack-text">{packText(copy.data)}</pre>
          <p className="muted">{copy.data.basis}</p>
        </>
      )}
    </section>
  )
}

const MOBILITY: readonly Mobility[] = ['any', 'easy', 'wheelchair']

/**
 * Your own shore plan for a port day (phase 10): pick what you like, how you get about and how long you have; the server lays it out inside the ship's real window and the usual opening hours, ends with a return
 * brief, offers reviewed phrases (or the words to show a person) and keeps an offline pack on this device.
 */
export function StanleyShoreCard({ sailingId, day }: { sailingId: string; day: number }) {
  const id = useId()
  const [interests, setInterests] = useState<Interest[]>([])
  const [mode, setMode] = useState<TravelMode>('walk')
  const [minutes, setMinutes] = useState<number>(240)
  const [near, setNear] = useState(false)
  const [mobility, setMobility] = useState<Mobility>('any')
  const [plan, setPlan] = useState<ShorePlan | null>(null)
  const [query, setQuery] = useState('')
  const [phrases, setPhrases] = useState<Phrases | null>(null)
  const [showPack, setShowPack] = useState(false)
  const [failed, setFailed] = useState(false)
  const run = async (work: () => Promise<void>) => { setFailed(false); try { await work() } catch { setFailed(true) } }
  const build = () => run(async () => {
    const p = normalizePort(await stanleyTravel.port({ sailingId, day, interests, mode, minutes, distance: near ? 'near' : 'any', mobility }))
    setPlan(p); if (!p) setFailed(true)
  })
  const speak = () => run(async () => { const p = normalizePhrases(await stanleyTravel.phrases({ sailingId, day, query: query.trim() || undefined })); setPhrases(p); if (!p) setFailed(true) })
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('tr10.shore.title')}</h2>
      <p>{t('tr10.shore.intro')}</p>
      <fieldset>
        <legend>{t('tr10.shore.interests')}</legend>
        <div className="chip-row">{INTERESTS.map((i) => <Chip key={i} pressed={interests.includes(i)} onToggle={() => setInterests(toggle(interests, i))}>{t(`tr10.interest.${i}` as StringKey)}</Chip>)}</div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-mode`}>{t('tr10.shore.mode')}</label>
        <select id={`${id}-mode`} className="field__input" value={mode} onChange={(e) => setMode(e.target.value as TravelMode)}>
          <option value="walk">{t('tr10.mode.walk')}</option><option value="taxi">{t('tr10.mode.taxi')}</option>
        </select>
        <label htmlFor={`${id}-min`}>{t('tr10.shore.minutes')}</label>
        <select id={`${id}-min`} className="field__input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {BUDGETS.map((b) => <option key={b} value={b}>{t('tr10.shore.hours', { hours: String(b / 60) })}</option>)}
        </select>
        <label htmlFor={`${id}-mob`}>{t('tr10.shore.mobility')}</label>
        <select id={`${id}-mob`} className="field__input" value={mobility} onChange={(e) => setMobility(e.target.value as Mobility)}>
          {MOBILITY.map((m) => <option key={m} value={m}>{t(`tr10.mobility.${m}` as StringKey)}</option>)}
        </select>
      </div>
      <label className="choice"><input type="checkbox" checked={near} onChange={(e) => setNear(e.target.checked)} /><span>{t('tr10.shore.near')}</span></label>
      <div className="button-row">
        <Button variant="secondary" onClick={() => void build()}>{t('tr10.shore.go')}</Button>
        <Button variant="tertiary" onClick={() => setShowPack(true)}>{t('tr10.pack.open')}</Button>
      </div>
      <div role="status">
        {failed && <p>{t('tr10.failed')}</p>}
        {plan && (
          <>
            <p className="muted">{t('tr10.shore.window', { from: plan.ashoreFrom, clock: plan.clock })}</p>
            {plan.stops.length === 0 && <p>{t('tr10.shore.none')}</p>}
            <ol>
              {plan.stops.map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong> {t('tr10.shore.stop', { start: s.start, end: s.end, clock: plan.clock })}
                  <small> {t(`tr10.mode.${s.mode}` as StringKey)}{s.travelMinutes > 0 ? ` · ${t('tr10.shore.ride', { minutes: String(s.travelMinutes) })}` : ''} · {s.cost === 'paid' ? formatMoney(s.cents / 100) : t('tr10.free')} · {t('tr10.shore.typical', { opens: s.opens, closes: s.closes })}</small>
                  <br /><small>{s.why}</small>
                </li>
              ))}
            </ol>
            <h3>{t('tr10.shore.return')}</h3>
            <p className={planIsSafe(plan) || plan.stops.length === 0 ? '' : 'tag tag--warn'}><strong>{plan.returnBrief.text}</strong></p>
            <ul>{plan.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </>
        )}
      </div>
      <h3>{t('tr10.phrase.title')}</h3>
      <div className="field">
        <label htmlFor={`${id}-q`}>{t('tr10.phrase.ask')}</label>
        <input id={`${id}-q`} className="field__input" maxLength={200} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Button variant="secondary" onClick={() => void speak()}>{t('tr10.phrase.go')}</Button>
      <div role="status">
        {phrases && (
          <>
            <p className="muted">{phrases.note}</p>
            <ul>
              {phrases.phrases.map((p) => (
                <li key={p.id}><strong lang={p.language === 'Spanish' ? 'es' : undefined}>{p.say}</strong> {p.means} <small>({p.sounds})</small> <span className="tag">{isReviewed(p) ? t('tr10.phrase.reviewed') : t('tr10.phrase.machine')}</span></li>
              ))}
            </ul>
            {phrases.showPerson && (
              <div className="show-person">
                <p className="muted">{t('tr10.phrase.showPerson')} <span className="tag">{phrases.showPerson.label}</span></p>
                <p className="large-text" lang="en"><strong>{phrases.showPerson.text}</strong></p>
              </div>
            )}
          </>
        )}
      </div>
      {showPack && <PortPackSection sailingId={sailingId} day={day} />}
    </Card>
  )
}

/** The embark goals tour (phase 10): choose what matters first and get a short walk round the ship in a sensible order. */
export function StanleyEmbarkTour({ sailingId }: { sailingId: string }) {
  const id = useId()
  const [goals, setGoals] = useState<Goal[]>(['essentials'])
  const [mobility, setMobility] = useState<Mobility>('any')
  const [tour, setTour] = useState<EmbarkTour | null>(null)
  const [failed, setFailed] = useState(false)
  const go = async () => {
    setFailed(false)
    try { const x = normalizeEmbark(await stanleyTravel.embark({ sailingId, goals, mobility })); setTour(x); setFailed(x === null) } catch { setFailed(true) }
  }
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('tr10.embark.title')}</h2>
      <p>{t('tr10.embark.intro')}</p>
      <fieldset>
        <legend>{t('tr10.embark.goals')}</legend>
        <div className="chip-row">{GOALS.map((g) => <Chip key={g} pressed={goals.includes(g)} onToggle={() => setGoals(toggle(goals, g))}>{t(`tr10.goal.${g}` as StringKey)}</Chip>)}</div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-m`}>{t('tr10.shore.mobility')}</label>
        <select id={`${id}-m`} className="field__input" value={mobility} onChange={(e) => setMobility(e.target.value as Mobility)}>
          {MOBILITY.map((m) => <option key={m} value={m}>{t(`tr10.mobility.${m}` as StringKey)}</option>)}
        </select>
      </div>
      <Button variant="secondary" onClick={() => void go()} disabled={goals.length === 0}>{t('tr10.embark.go')}</Button>
      <div role="status">
        {failed && <p>{t('tr10.failed')}</p>}
        {tour && (
          <>
            <ol>
              {tour.steps.map((s) => (
                <li key={s.placeId}>
                  <strong>{s.name}</strong> {t('tr10.embark.where', { deck: String(s.deck), section: s.section })}
                  <small> {t('tr10.embark.walk', { minutes: String(s.walkFromPrevious) })}{s.stepFree ? ` · ${t('tr10.embark.stepFree')}` : ''}</small>
                  <br /><small>{s.note ?? s.why}</small>
                </li>
              ))}
            </ol>
            <ul>{tour.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </>
        )}
      </div>
    </Card>
  )
}

/** Entry, visa and customs rules are not Stanley's to state (phase 10): each country on the sailing, who decides, and where to read it. */
export function StanleyEntrySources({ sailingId }: { sailingId: string }) {
  const id = useId()
  const [info, setInfo] = useState<EntryInfo | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    stanleyTravel.entry(sailingId).then((raw) => { if (live) { const x = normalizeEntry(raw); setInfo(x); setFailed(x === null) } }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [sailingId])
  return (
    <Card labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{th('tr10.entry.title')}</h2>
      <div role="status">
        {failed && <p>{t('tr10.failed')}</p>}
        {info && (
          <>
            <p>{info.note}</p>
            <ul>
              {info.sources.map((s) => (
                <li key={s.jurisdiction}>
                  <strong>{s.jurisdiction}</strong> · {s.role}<br />
                  {s.authority}<br />
                  {s.links.map((l) => <span key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>{' '}</span>)}
                  <br /><small>{s.note}</small>
                </li>
              ))}
            </ul>
            <p className="muted">{t('tr10.entry.reviewed', { date: info.reviewedOn })}</p>
          </>
        )}
      </div>
    </Card>
  )
}
