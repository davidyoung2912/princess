import { useState } from 'react'
import { Link } from 'react-router'
import type { BoardingView } from '../../api/types'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { formatDate } from '../../domain/cruise'
import {
  addStub, bagWindow, cabinRoute, DRIVER_LANGS, DRIVER_LANG_NAMES, driveProgress, driverCard, hasStub, landmarksToMuster, lightFor, removeStub, sailAwaySpot, wifiQrText,
  WIFI_NETWORK, type DriverLang, type Light,
} from '../../domain/embarkDelights'
import { buildJourney, type JourneyPlan } from '../../domain/journey'
import { PORT_FACTS } from '../../domain/travel'
import { TERMINALS } from '../../domain/boarding'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useSettings } from '../../hooks/useSettings'
import { useTrip } from '../../hooks/useTrip'
import { t, th, type StringKey } from '../../i18n'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { CopyText } from '../CopyText'
import { QrCode } from '../checkin/QrCode'
import { useShipTime } from '../onboard/shipTime'

const LIGHT_SHAPE: Record<Light, string> = { green: '●', amber: '▲', red: '■' }

/** D4A-1: one card that answers "am I on track?" in a colour, a word and a shape, with the leave-by time as large as the screen allows. */
export function TrafficLightCard({ status, at, kind, time }: { status: 'onTrack' | 'tight' | 'atRisk'; at: number; kind: 'leave' | 'terminal'; time: (ms: number) => string }) {
  const light = lightFor(status)
  return (
    <section className={`traffic traffic--${light}`} aria-labelledby="dl6-light-h">
      <h2 id="dl6-light-h" className="traffic__word"><span aria-hidden="true">{LIGHT_SHAPE[light]}</span> {th(`dl6.light.${light}` as StringKey)}</h2>
      <p className="traffic__time" role="status">{t(kind === 'leave' ? 'dl6.light.leaveBy' : 'dl6.light.atTerminal', { time: time(at) })}</p>
    </section>
  )
}

/** D4A-2: big words for a driver, in the language chosen. The text on the card stays in that language whatever the app language is. */
export function DriverCardView({ terminal }: { terminal: string }) {
  const [lang, setLang] = useState<DriverLang>('en')
  const card = driverCard(lang, { terminal, address: PORT_FACTS.address })
  return (
    <Card labelledBy="dl6-driver-h">
      <h2 id="dl6-driver-h" className="card__title">{th('dl6.driver.title')}</h2>
      <p>{t('dl6.driver.body')}</p>
      <fieldset>
        <legend>{t('dl6.driver.lang')}</legend>
        {DRIVER_LANGS.map((l) => <label key={l} className="choice"><input type="radio" name="dl6-driver-lang" checked={lang === l} onChange={() => setLang(l)} /><span>{DRIVER_LANG_NAMES[l]}</span></label>)}
      </fieldset>
      <div className="driver-card" lang={lang}>
        {card.lines.map((l, i) => <p key={l} className={i === 1 ? 'driver-card__big' : undefined}>{l}</p>)}
      </div>
      <p className="muted">{t('dl6.driver.note')}</p>
    </Card>
  )
}

/** D4A-8: how far is left on the drive, in miles and in ship-lengths. */
export function ShipLengths({ plan, leaveByMs }: { plan: JourneyPlan; leaveByMs: number | null }) {
  const now = useNow()
  if (plan.mode !== 'drive') return null
  const p = driveProgress(plan.roadMinutes, leaveByMs, now)
  return <p className="calm-hide" role="status">{p.lengths === 0 ? t('dl6.lengths.arrived') : t('dl6.lengths.line', { lengths: p.lengths.toLocaleString('en-US'), miles: p.miles })}</p>
}

/** D4A-6: Home with only what matters on a travel day. */
export function EssentialsHome() {
  const { state } = useTrip()
  const sailing = useSailing()
  const time = useShipTime()
  const [, update] = useSettings()
  const plan: JourneyPlan = { ...state.journey.plan, windowStart: state.embark.window }
  const result = buildJourney(plan, sailing.departure, 0)
  return (
    <div className="page">
      <p>{t('dl6.essentials.body')}</p>
      <Card hero labelledBy="dl6-ess-pass">
        <h2 id="dl6-ess-pass" className="card__title">{th('route.boardingPass')}</h2>
        <LinkButton to="/home/boarding-pass" block>{t('home.showPass')}</LinkButton>
      </Card>
      <Card labelledBy="dl6-ess-time">
        <h2 id="dl6-ess-time" className="card__title">{th('dl6.essentials.leave')}</h2>
        <p className="traffic__time">{time(result.leaveBy ?? result.atTerminal)}</p>
        <p className="muted">{result.leaveBy === null ? t('dl6.light.atTerminal', { time: time(result.atTerminal) }) : t('dl6.essentials.leaveNote')}</p>
      </Card>
      <Card labelledBy="dl6-ess-phone">
        <h2 id="dl6-ess-phone" className="card__title">{th('dl6.essentials.phone')}</h2>
        <p className="traffic__time"><a href={`tel:${GUEST_SERVICES_NUMBER.replace(/[^\d+]/g, '')}`}>{GUEST_SERVICES_NUMBER}</a></p>
      </Card>
      <Button variant="secondary" onClick={() => update({ essentials: false })}>{t('dl6.essentials.off')}</Button>
    </div>
  )
}

/** D5-1: a boarding-pass-shaped list that fills in line by line as check-in steps are done. */
export function TicketProgress({ lines, done, total }: { lines: { id: string; label: string; state: 'done' | 'current' | 'todo' }[]; done: number; total: number }) {
  const full = done >= total && total > 0
  return (
    <section className={`ticket${full ? ' ticket--full' : ''}`} aria-labelledby="dl6-ticket-h">
      <h2 id="dl6-ticket-h" className="ticket__head">{full ? th('dl6.ticket.full') : th('dl6.ticket.title')}</h2>
      <ol className="ticket__lines">
        {lines.map((l) => (
          <li key={l.id} className={`ticket__line ticket__line--${l.state}`}>
            <span aria-hidden="true">{l.state === 'done' ? '✓' : l.state === 'current' ? '→' : '○'}</span>
            <span>{l.label}</span>
            <span className="visually-hidden"> {t(`dl6.ticket.${l.state}` as StringKey)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** D5-3: when the stateroom is ready, its number and a plain route from the gangway. */
export function CabinReadyCard({ cabin, ready }: { cabin: string; ready: boolean }) {
  const r = cabinRoute(cabin)
  if (!ready || !r) return null
  const text = t('dl6.cabin.text', {
    cabin: r.cabin, deck: r.deck, from: r.fromDeck, bank: r.bank, section: t(`dl6.section.${r.section}` as StringKey),
    side: t(`dl6.side.${r.side}` as StringKey),
  })
  return (
    <Card hero labelledBy="dl6-cabin-h">
      <h2 id="dl6-cabin-h" className="card__title">{th('dl6.cabin.ready', { cabin: r.cabin })}</h2>
      <p className="traffic__time">{t('dl6.cabin.deck', { deck: r.deck })}</p>
      <p>{text}</p>
      <CopyText text={text} />
      <p className="muted">{t('dl6.cabin.note')}</p>
    </Card>
  )
}

/** D5-4: three places to look for between the cabin and the muster station. */
export function LandmarksCard({ cabin, muster }: { cabin: string; muster: string }) {
  const l = landmarksToMuster(cabin, muster)
  if (l.length === 0) return null
  return (
    <Card labelledBy="dl6-land-h">
      <h2 id="dl6-land-h" className="card__title">{th('dl6.land.title', { muster })}</h2>
      <p>{t('dl6.land.body')}</p>
      <ol>{l.map((x) => <li key={x.id}>{t('dl6.land.item', { name: x.name, deck: x.deck })}</li>)}</ol>
      <p className="muted"><Link to="/ship/muster">{t('route.muster')}</Link></p>
    </Card>
  )
}

/** D5-5: when bags usually reach cabins, until they have. */
export function BagWindowLine({ delivered }: { delivered: boolean }) {
  if (delivered) return null
  const w = bagWindow()
  return <p className="muted">{t('dl6.bags.window', { from: w.from, to: w.to, source: w.source })}</p>
}

/** D5-6: where to watch the ship leave, and when to be there. */
export function SailAwayCard() {
  const sailing = useSailing()
  const s = sailAwaySpot(sailing)
  if (!s) return null
  return (
    <Card labelledBy="dl6-sail-h">
      <h2 id="dl6-sail-h" className="card__title">{th('dl6.sail.title')}</h2>
      <p>{t('dl6.sail.body', { name: s.name, deck: s.deck, time: s.beThere, departs: s.departs })}</p>
      <p className="muted">{t('dl6.sail.note')}</p>
    </Card>
  )
}

/** D5-7: a QR to join the ship's network, and the steps that keep a phone off roaming. */
export function WifiQrCard() {
  return (
    <Card labelledBy="dl6-wifiqr-h">
      <h2 id="dl6-wifiqr-h" className="card__title">{th('dl6.wifi.title')}</h2>
      <p>{t('dl6.wifi.body', { network: WIFI_NETWORK })}</p>
      <QrCode text={wifiQrText()} label={t('dl6.wifi.qr', { network: WIFI_NETWORK })} className="qr--small" />
      <h3>{th('dl6.wifi.steps')}</h3>
      <ol className="plain-bullets">{(['airplane', 'roaming', 'join', 'portal'] as const).map((k) => <li key={k}>{t(`dl6.wifi.step.${k}` as StringKey)}</li>)}</ol>
    </Card>
  )
}

/** D5-8: keep the boarding pass as a stub in the trip memories. Asked for, never automatic. */
export function KeepStub({ pass }: { pass: BoardingView }) {
  const { state, update } = useMemory()
  const now = useNow()
  const kept = hasStub(state.embark.stubs, pass.number)
  const stub = { id: newMemoryId(), number: pass.number, date: pass.departure, terminal: pass.terminal.name || TERMINALS.usual, guests: pass.passes.length, savedAt: now }
  return (
    <div className="no-print">
      {kept ? (
        <p role="status">{t('dl6.stub.kept')} <Link to="/me/memories">{t('route.memories')}</Link></p>
      ) : (
        <Button variant="secondary" onClick={() => update((s) => ({ ...s, embark: { ...s.embark, stubs: addStub(s.embark.stubs, stub) } }))}>{t('dl6.stub.keep')}</Button>
      )}
    </div>
  )
}

/** The stubs kept so far, in the trip memories. */
export function StubsCard() {
  const { state, update } = useMemory()
  if (state.embark.stubs.length === 0) return null
  return (
    <Card labelledBy="dl6-stubs-h">
      <h2 id="dl6-stubs-h" className="card__title">{th('dl6.stub.title')}</h2>
      <ul className="stubs">
        {state.embark.stubs.map((s) => (
          <li key={s.id} className="stub">
            <p><strong>{formatDate(s.date)}</strong> · {t('trip.booking', { number: s.number })}</p>
            <p className="muted">{s.terminal} · {t('dl6.stub.guests', { count: s.guests })}</p>
            <Button variant="tertiary" onClick={() => update((m) => ({ ...m, embark: { ...m.embark, stubs: removeStub(m.embark.stubs, s.id) } }))}>{t('dl6.stub.remove')}<span className="visually-hidden"> {formatDate(s.date)}</span></Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
