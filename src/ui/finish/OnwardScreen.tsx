import { useState } from 'react'
import { Link } from 'react-router'
import { asOnwardView } from '../../api/guards'
import type { OnwardView } from '../../api/finishTypes'
import { ONWARD_MODES, ONWARD_NOTE_MAX, type OnwardMode } from '../../domain/disembark'
import { formatMoney } from '../../domain/pricing'
import { formatTime } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Field } from '../Field'
import { ExtraError } from '../extras/common'
import { BackLink, Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'

/** Onward travel (DEB-05): how you get home, the flight, and whether the time you leave the ship allows it. */
export function OnwardScreen() {
  const me = usePersona()
  const copy = useSavedCopy('onward', me?.booker ?? 'none', () => api.disembark.onward(), asOnwardView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.onward')}</h1>
      <p>{t('onw.intro')}</p>
      <Saved copy={copy}>{(v) => <Onward v={v} reload={copy.retry} />}</Saved>
      <BackLink to="/home/disembark" label={t('route.disembark')} />
    </div>
  )
}

function Onward({ v, reload }: { v: OnwardView; reload: () => void }) {
  const shipTime = useShipTime()
  const [mode, setMode] = useState<OnwardMode>(v.plan?.mode ?? 'airportTransfer')
  const [flightAt, setFlightAt] = useState(v.plan?.flightAt ?? '')
  const [flight, setFlight] = useState(v.plan?.flight ?? '')
  const [note, setNote] = useState(v.plan?.note ?? '')
  const save = useAction(async () => { await api.disembark.saveOnward({ mode, flightAt, flight, note }); reload() })
  const check = v.check
  return (
    <>
      <p>{t('onw.leaves', { time: shipTime(v.offFrom) })} <Link to="/home/disembark">{t('route.disembark')}</Link></p>
      <form onSubmit={(e) => { e.preventDefault(); void save.run() }}>
        <fieldset disabled={!v.canEdit}>
          <legend>{t('onw.how')}</legend>
          {ONWARD_MODES.map((m) => (
            <label key={m.id} className="choice choice--top">
              <input type="radio" name="onward-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
              <span>{t(`onw.mode.${m.id}` as StringKey)}<small>{t(`onw.modeBody.${m.id}` as StringKey)}</small><small>{m.cents > 0 ? t(m.perCar ? 'onw.costCar' : 'onw.costEach', { amount: formatMoney(m.cents) }) : t('onw.noCost')} · {t('onw.minutes', { count: m.minutes })}</small></span>
            </label>
          ))}
        </fieldset>
        <fieldset disabled={!v.canEdit}>
          <legend>{t('onw.flight')}</legend>
          <Field label={t('onw.flightAt')} hint={t('onw.flightAtHint')} type="time" value={flightAt} onChange={(e) => setFlightAt(e.target.value)} />
          <Field label={t('onw.flightNo')} maxLength={8} value={flight} onChange={(e) => setFlight(e.target.value)} />
          <Field label={t('onw.note')} maxLength={ONWARD_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        </fieldset>
        <ExtraError error={save.error} />
        {v.canEdit && <Button type="submit" disabled={save.busy}>{save.busy ? t('account.saving') : t('onw.save')}</Button>}
      </form>

      {check && (
        <section aria-labelledby="onw-check-h">
          <h2 id="onw-check-h">{t('onw.check')}</h2>
          {check.status === 'noFlight' ? <p>{t('onw.noFlight', { time: formatTime(check.earliestFlight) })}</p> : (
            <Banner kind={check.status === 'ok' ? 'success' : check.status === 'tight' ? 'warning' : 'danger'} title={t(`onw.status.${check.status}` as StringKey, { minutes: Math.abs(check.spare ?? 0) })}>
              <p>{t(`onw.statusBody.${check.status}` as StringKey, { leave: check.leaveBy !== null ? shipTime(check.leaveBy) : '', earliest: formatTime(check.earliestFlight) })}</p>
              {check.status !== 'ok' && <p><Link to="/home/disembark">{t('onw.changeOff')}</Link></p>}
            </Banner>
          )}
          {check.status !== 'noFlight' && <p>{t('onw.airline')}</p>}
        </section>
      )}

      <section aria-labelledby="onw-pick-h">
        <h2 id="onw-pick-h">{t('onw.pickup')}</h2>
        <p>{t(`onw.pickupBody.${mode}` as StringKey)}</p>
      </section>
    </>
  )
}
