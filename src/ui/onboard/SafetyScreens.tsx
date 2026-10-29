import { useState } from 'react'
import { Link } from 'react-router'
import { asMusterView } from '../../api/guards'
import type { MusterView } from '../../api/types'
import { EMERGENCY_NUMBER } from '../../domain/contacts'
import { formatTime } from '../../domain/cruise'
import { DRILL_ALTERNATIVES, DRILL_LANGUAGES, DRILL_STEPS, EMERGENCY_CONTACTS, isEmergencyCard, MEDICAL_HOURS } from '../../domain/safety'
import type { PersonaId } from '../../domain/personas'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { Phone, Siren } from '../icons'
import { ActionError } from '../account/parts'
import { BackLink, Saved } from './common'
import { UrgentIssues } from './UrgentIssues'
import { useShipTime } from './shipTime'

/** The muster drill (SAF-01): where to go, how to check in, the briefing in five languages, and ways to take part if the usual way does not work. */
export function MusterScreen() {
  const me = usePersona()
  const copy = useSavedCopy('muster', me?.booker ?? 'none', () => api.onboard.muster(), asMusterView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.muster')}</h1>
      <p>{t('muster.intro')}</p>
      <Saved copy={copy}>{(m) => <Station m={m} reload={copy.retry} />}</Saved>
      <Briefing />
      <Alternatives />
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Station({ m, reload }: { m: MusterView; reload: () => void }) {
  const shipTime = useShipTime()
  const [picked, setPicked] = useState<PersonaId[]>([])
  const confirm = useAction(async () => { await api.onboard.confirmMuster(picked); setPicked([]); reload() })
  const waiting = m.guests.filter((g) => g.confirmedAt === null)
  const err = confirm.error
  return (
    <>
      <Card hero labelledBy="station-h">
        <h2 id="station-h" className="card__title">{m.station}</h2>
        <p className="muster__big"><strong>{m.stationName}</strong>, {t('map.deckShort', { deck: m.deck })}</p>
        <p>{t('muster.when', { time: shipTime(m.at) })}</p>
        <p>{t('muster.lift', { letter: m.station.slice(-1) })}</p>
      </Card>

      <section aria-labelledby="checkin-h">
        <h2 id="checkin-h">{t('muster.checkin')}</h2>
        {m.done ? <Banner kind="success" title={t('muster.allDone')} /> : <p>{t('muster.checkinBody')}</p>}
        <ul className="plain-bullets">
          {m.guests.map((g) => (
            <li key={g.id}>
              {g.confirmedAt !== null ? <span>{t('muster.checked', { name: g.name, time: shipTime(g.confirmedAt) })}</span> : (
                m.canConfirm ? (
                  <label className="choice">
                    <input type="checkbox" checked={picked.includes(g.id)} onChange={() => setPicked(picked.includes(g.id) ? picked.filter((x) => x !== g.id) : [...picked, g.id])} />
                    <span>{g.name}</span>
                  </label>
                ) : <span>{t('muster.notChecked', { name: g.name })}</span>
              )}
            </li>
          ))}
        </ul>
        {err && (err.code === 'conflict' ? <p role="alert" className="field__error">{err.message === 'notOpen' ? t('muster.notOpen', { time: shipTime(m.at - 60 * 60_000) }) : t('muster.closed')}</p> : <ActionError error={err} />)}
        {m.canConfirm && waiting.length > 0 && <Button disabled={confirm.busy || picked.length === 0} onClick={() => void confirm.run()}>{t('muster.confirm')}</Button>}
        {!m.canConfirm && <p className="muted">{t('muster.supervised')}</p>}
        <p className="muted">{t('muster.crew')}</p>
      </section>
    </>
  )
}

function Briefing() {
  const [lang, setLang] = useState('en')
  const chosen = DRILL_LANGUAGES.find((l) => l.code === lang) ?? DRILL_LANGUAGES[0]
  return (
    <section aria-labelledby="brief-h">
      <h2 id="brief-h">{t('muster.briefing')}</h2>
      <p>{t('muster.briefingBody')}</p>
      <ol className="plain-bullets">{DRILL_STEPS.map((s) => <li key={s}>{t(`muster.step.${s}` as StringKey)}</li>)}</ol>
      <div className="chip-row" role="group" aria-label={t('muster.language')}>
        {DRILL_LANGUAGES.map((l) => <Chip key={l.code} pressed={l.code === lang} onToggle={() => setLang(l.code)}>{l.name}</Chip>)}
      </div>
      <div lang={chosen.code}>
        <ul className="plain-bullets">{chosen.lines.map((line) => <li key={line}>{line}</li>)}</ul>
      </div>
      <p className="muted">{t('muster.video')}</p>
    </section>
  )
}

function Alternatives() {
  return (
    <section aria-labelledby="alt-h">
      <h2 id="alt-h">{t('muster.alt')}</h2>
      <ul className="plain-bullets">{DRILL_ALTERNATIVES.map((a) => <li key={a}>{t(`muster.alt.${a}` as StringKey)}</li>)}</ul>
      <p><Link to="/plan/assistance">{t('route.assistance')}</Link></p>
    </section>
  )
}

/** The emergency card (SAF-02, SAF-08): stateroom, station, who to call, and what to say. Kept on the phone and also built into the app, so it opens with no signal. */
export function EmergencyScreen() {
  const me = usePersona()
  const copy = useSavedCopy('emergency', me?.id ?? 'none', () => api.onboard.emergency(), (raw) => (isEmergencyCard(raw) ? raw : null), [me?.id])
  const card = copy.data
  return (
    <div className="page">
      <h1>{t('route.emergency')}</h1>
      <Card hero labelledBy="help-now-h">
        <h2 id="help-now-h" className="card__title"><Siren aria-hidden="true" /> {t('emerg.now')}</h2>
        <p className="emerg__big">{t('emerg.dial')}</p>
        <a className="btn btn--danger btn--block emerg__call" href={`tel:${EMERGENCY_NUMBER}`}><Phone aria-hidden="true" /> {t('emerg.call', { number: EMERGENCY_NUMBER })}</a>
        <p>{t('emerg.medical')}</p>
      </Card>

      {card ? (
        <>
          <Card labelledBy="say-h">
            <h2 id="say-h" className="card__title">{t('emerg.say')}</h2>
            <p className="emerg__big">{card.script}</p>
            <dl className="plain-dl emerg__facts">
              <div><dt>{t('emerg.stateroom')}</dt><dd>{card.stateroom}, {t('map.deckShort', { deck: card.deck })}</dd></div>
              <div><dt>{t('emerg.station')}</dt><dd>{card.muster}{card.musterPlace ? `: ${card.musterPlace.name}` : ''}</dd></div>
            </dl>
          </Card>
          {copy.fromCopy && <Banner kind="offline" title={t('onb.offline')}><p>{t('emerg.copy')}</p></Banner>}
        </>
      ) : copy.status === 'error' ? (
        <Banner kind="info" title={t('emerg.noCard')}><p>{t('emerg.noCardBody')}</p></Banner>
      ) : <p role="status" className="muted">{t('account.loading')}</p>}

      <section aria-labelledby="who-h">
        <h2 id="who-h">{t('emerg.contacts')}</h2>
        <ul className="plain-bullets">
          {EMERGENCY_CONTACTS.map((c) => <li key={c.label}><strong>{t(`emerg.contact.${c.label}` as StringKey)}</strong>: <a href={`tel:${c.number}`}>{c.number}</a><br /><span className="muted">{c.note}</span></li>)}
        </ul>
      </section>

      <UrgentIssues headingId="emerg-urgent-h" />

      <section aria-labelledby="med-h">
        <h2 id="med-h">{t('emerg.hours')}</h2>
        <dl className="plain-dl">
          {(['sea', 'port'] as const).map((d) => <div key={d}><dt>{t(`ven.hours.${d}` as StringKey)}</dt><dd>{MEDICAL_HOURS[d].map(([a, b]) => `${formatTime(a)} to ${formatTime(b)}`).join(', ')}</dd></div>)}
        </dl>
        <p className="muted">{t('emerg.fees')}</p>
      </section>
      <p className="muted">{t('help.sample')}</p>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}
