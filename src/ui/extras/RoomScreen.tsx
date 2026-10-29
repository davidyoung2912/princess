import { asRoomView } from '../../api/guards'
import type { RoomView } from '../../api/types'
import { CLEANING_WINDOWS, LIGHTS, SERVICE_MODES, TEMP_RANGE, type CleaningWindow, type Lights, type ServiceMode } from '../../domain/room'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { BackLink, Saved } from '../onboard/common'
import { useShipTime } from '../onboard/shipTime'
import { ExtraError } from './common'

/** The stateroom (ROM-01 to ROM-03, ROM-05): the information card kept on the phone, housekeeping and Do Not Disturb, and the mock room controls. */
export function RoomScreen() {
  const me = usePersona()
  const copy = useSavedCopy('room', me?.booker ?? 'none', () => api.room.view(), asRoomView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.room')}</h1>
      <Saved copy={copy}>{(r) => <Room r={r} reload={copy.retry} offline={copy.fromCopy} />}</Saved>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Room({ r, reload, offline }: { r: RoomView; reload: () => void; offline: boolean }) {
  const shipTime = useShipTime()
  const hk = useAction(async (patch: Parameters<typeof api.room.setHousekeeping>[0]) => { await api.room.setHousekeeping(patch); reload() })
  const dev = useAction(async (patch: Parameters<typeof api.room.setDevices>[0]) => { await api.room.setDevices(patch); reload() })
  const locked = offline || !r.canEdit
  return (
    <>
      <Card hero labelledBy="card-h">
        <h2 id="card-h" className="card__title">{t('room.card', { cabin: r.number })}</h2>
        <dl className="plain-dl">
          <div><dt>{t('room.deck')}</dt><dd>{t('map.deckShort', { deck: r.deck })}</dd></div>
          <div><dt>{t('room.steward')}</dt><dd>{r.steward}</dd></div>
          <div><dt>{t('room.station')}</dt><dd>{r.muster}</dd></div>
          <div><dt>{t('room.has')}</dt><dd>{r.amenities.map((a) => t(`room.amenity.${a}` as StringKey)).join(', ')}</dd></div>
        </dl>
        <ul className="plain-bullets">
          <li>{t('room.safe')}</li>
          <li>{t('room.wifi')}</li>
          <li>{t('room.route')}</li>
        </ul>
        <p className="muted">{t('room.key')}</p>
      </Card>

      {locked && !offline && <Banner kind="info" title={t('plan.readOnly.title')}><p>{t('plan.readOnly.body')}</p></Banner>}

      <section aria-labelledby="hk-h">
        <h2 id="hk-h">{t('room.housekeeping')}</h2>
        {r.checkDue && <Banner kind="warning" title={t('room.checkDue')}><p>{t('room.checkDueBody')}</p></Banner>}
        <fieldset className="plain-fieldset" disabled={locked}>
          <legend>{t('room.mode')}</legend>
          {SERVICE_MODES.map((m) => (
            <label key={m} className="choice choice--top">
              <input type="radio" name="room-mode" checked={r.housekeeping.mode === m} onChange={() => void hk.run({ mode: m as ServiceMode })} />
              <span>{t(`room.mode.${m}` as StringKey)}<small>{t(`room.modeHelp.${m}` as StringKey)}</small></span>
            </label>
          ))}
        </fieldset>
        {r.housekeeping.since !== null && <p role="status" className="muted">{t('room.since', { time: shipTime(r.housekeeping.since) })}</p>}
        <div className="field">
          <label htmlFor="room-window">{t('room.window')}</label>
          <select id="room-window" className="field__input" disabled={locked} value={r.housekeeping.window} onChange={(e) => void hk.run({ window: e.target.value as CleaningWindow })}>
            {CLEANING_WINDOWS.map((w) => <option key={w} value={w}>{t(`room.window.${w}` as StringKey)}</option>)}
          </select>
        </div>
        <label className="choice"><input type="checkbox" disabled={locked} checked={r.housekeeping.turndown} onChange={() => void hk.run({ turndown: !r.housekeeping.turndown })} /><span>{t('room.turndown')}</span></label>
        <ExtraError error={hk.error} />
      </section>

      <section aria-labelledby="ctl-h">
        <h2 id="ctl-h">{t('room.controls')}</h2>
        <p className="muted">{t('room.controlsNote')}</p>
        <div className="field">
          <label htmlFor="room-lights">{t('room.lights')}</label>
          <select id="room-lights" className="field__input" disabled={locked} value={r.devices.lights} onChange={(e) => void dev.run({ lights: e.target.value as Lights })}>
            {LIGHTS.map((l) => <option key={l} value={l}>{t(`room.lights.${l}` as StringKey)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="room-temp">{t('room.temp', { temp: r.devices.tempF })}</label>
          <div className="button-row">
            <Button variant="secondary" disabled={locked || r.devices.tempF <= TEMP_RANGE.min} onClick={() => void dev.run({ tempF: r.devices.tempF - 1 })}>{t('room.cooler')}</Button>
            <input id="room-temp" className="field__input field__input--short" type="number" readOnly value={r.devices.tempF} aria-describedby="room-temp-hint" />
            <Button variant="secondary" disabled={locked || r.devices.tempF >= TEMP_RANGE.max} onClick={() => void dev.run({ tempF: r.devices.tempF + 1 })}>{t('room.warmer')}</Button>
          </div>
          <p id="room-temp-hint" className="field__hint">{t('room.tempRange', { min: TEMP_RANGE.min, max: TEMP_RANGE.max })}</p>
        </div>
        <label className="choice"><input type="checkbox" disabled={locked} checked={r.devices.tv} onChange={() => void dev.run({ tv: !r.devices.tv })} /><span>{t('room.tv')}</span></label>
        {r.hasView && <label className="choice"><input type="checkbox" disabled={locked} checked={r.devices.shades === 'closed'} onChange={() => void dev.run({ shades: r.devices.shades === 'closed' ? 'open' : 'closed' })} /><span>{t('room.shades')}</span></label>}
        <ExtraError error={dev.error} />
      </section>
    </>
  )
}
