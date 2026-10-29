import { useState } from 'react'
import { Link } from 'react-router'
import { asFamilyView } from '../../api/guards'
import type { FamilyKid, FamilyView } from '../../api/types'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import { KID_ZONES, MEETING_PLACES, clubById, placeName, type ReunionPlan } from '../../domain/family'
import { formatTime } from '../../domain/cruise'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { Phone } from '../icons'
import { BackLink, Saved } from '../onboard/common'
import { duration, useShipTime } from '../onboard/shipTime'
import { ExtraError } from './common'

/** Find my family and the children's clubs (SAF-05, ENT-04): where each child was last seen, zones, club check-in and check-out, who may collect, and a meeting plan. */
export function FamilyScreen() {
  const me = usePersona()
  const copy = useSavedCopy('family', me?.booker ?? 'none', () => api.family.view(), asFamilyView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.family')}</h1>
      <p>{t('fam.intro')}</p>
      <Banner kind="info" title={t('fam.honest')}><p>{t('fam.honestBody')}</p></Banner>
      <Saved copy={copy}>{(v) => <Family v={v} reload={copy.retry} offline={copy.fromCopy} />}</Saved>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Family({ v, reload, offline }: { v: FamilyView; reload: () => void; offline: boolean }) {
  return (
    <>
      {!v.canEdit && <Banner kind="info" title={t('plan.readOnly.title')}><p>{t('plan.readOnly.body')}</p></Banner>}
      {v.kids.length === 0 ? <p>{t('fam.noKids')}</p> : v.kids.map((k) => <Kid key={k.id} k={k} v={v} reload={reload} offline={offline} locked={offline || !v.canEdit} />)}
      <Reunion plan={v.reunion} reload={reload} locked={offline || !v.canEdit} />
      {v.log.length > 0 && <Log v={v} />}
    </>
  )
}

function Log({ v }: { v: FamilyView }) {
  const shipTime = useShipTime()
  return (
    <section aria-labelledby="fam-log-h">
      <h2 id="fam-log-h">{t('fam.log')}</h2>
      <ul className="plain-bullets">{v.log.map((l) => <li key={l.id}>{shipTime(l.at)}: {l.text}</li>)}</ul>
    </section>
  )
}

function Kid({ k, v, reload, offline, locked }: { k: FamilyKid; v: FamilyView; reload: () => void; offline: boolean; locked: boolean }) {
  const now = useNow()
  const shipTime = useShipTime()
  const [zones, setZones] = useState<string[]>(k.zones)
  const [pickup, setPickup] = useState(k.auth.pickup)
  const [alone, setAlone] = useState(k.auth.signOutAlone)
  const [photos, setPhotos] = useState(k.auth.photos)
  const checkIn = useAction(async () => { await api.family.checkIn(k.id); reload() })
  const checkOut = useAction(async () => { await api.family.checkOut(k.id); reload() })
  const saveZones = useAction(async () => { await api.family.setZones(k.id, zones); reload() })
  const saveAuth = useAction(async () => { await api.family.setAuth(k.id, { pickup, signOutAlone: alone, photos }); reload() })
  const minutes = Math.max(0, Math.round((now - k.seen.at) / 60_000))
  const place = placeName(k.seen.placeId)
  const aloneFrom = k.club ? (clubById(k.club.id)?.aloneFrom ?? null) : null
  const aloneOk = aloneFrom !== null && k.age >= aloneFrom
  const id = `kid-${k.id}`
  return (
    <Card hero labelledBy={`${id}-h`}>
      <h2 id={`${id}-h`} className="card__title">{k.name} <small className="muted">({t('plan.age', { age: k.age })})</small></h2>
      <p className={`kid__status kid__status--${k.status}`} role="status"><strong>{t(`fam.status.${k.status}` as StringKey)}</strong></p>
      <p>{k.status === 'inClub' ? t('fam.inClub', { place, time: shipTime(k.seen.at) }) : t('fam.lastSeen', { place, ago: duration(minutes) })} <span className="muted">({t(`fam.source.${k.seen.source}` as StringKey)})</span></p>
      {k.status === 'overdue' && (
        <Banner kind="danger" title={t('fam.overdue', { name: k.name.split(' ')[0], ago: duration(minutes) })}>
          <p>{t('fam.overdueBody')}</p>
          <div className="button-row">
            <a className="btn btn--danger" href={`tel:${GUEST_SERVICES_NUMBER}`}><Phone aria-hidden="true" /> {t('fam.callServices', { number: GUEST_SERVICES_NUMBER })}</a>
            <LinkButton to="/ship/emergency" variant="secondary">{t('route.emergency')}</LinkButton>
          </div>
          <p>{t('fam.meetAt', { place: placeName(v.reunion.placeId) })}</p>
        </Banner>
      )}
      {k.status === 'outOfZone' && <Banner kind="warning" title={t('fam.outOfZone', { place })}><p>{t('fam.outOfZoneBody')}</p></Banner>}

      <h3>{t('fam.club')}</h3>
      {k.club === null ? <p>{k.age < 3 ? t('fam.tooYoung') : t('fam.noClub')}</p> : (
        <>
          <p>{t('fam.clubHours', { name: k.club.name, opens: formatTime(k.club.opens), closes: formatTime(k.club.closes) })} {k.club.open ? t('fam.open') : t('fam.closed')}</p>
          {k.inClub ? (
            k.canCheckOut ? <Button variant="secondary" disabled={checkOut.busy || offline} onClick={() => void checkOut.run()}>{t('fam.checkOut', { name: k.name.split(' ')[0] })}</Button> : <p className="muted">{t('fam.notAllowed')}</p>
          ) : !locked && <Button disabled={checkIn.busy || !k.club.open} onClick={() => void checkIn.run()}>{t('fam.checkIn', { name: k.name.split(' ')[0], club: k.club.name })}</Button>}
          {!k.inClub && !k.club.open && <p className="muted">{t('fam.closedWhy')}</p>}
          <ExtraError error={checkIn.error ?? checkOut.error} />
        </>
      )}

      {!locked && (
        <>
          <fieldset className="plain-fieldset">
            <legend>{t('fam.zones')}</legend>
            <p className="field__hint">{t('fam.zonesHint')}</p>
            {KID_ZONES.map((z) => <label key={z} className="choice"><input type="checkbox" checked={zones.includes(z)} onChange={() => setZones(zones.includes(z) ? zones.filter((x) => x !== z) : [...zones, z])} /><span>{placeName(z)}</span></label>)}
          </fieldset>
          <ExtraError error={saveZones.error} />
          <Button variant="secondary" disabled={saveZones.busy} onClick={() => void saveZones.run()}>{t('fam.saveZones')}</Button>

          <fieldset className="plain-fieldset">
            <legend>{t('fam.auth')}</legend>
            {v.adults.map((a) => <label key={a.id} className="choice"><input type="checkbox" checked={pickup.includes(a.id)} onChange={() => setPickup(pickup.includes(a.id) ? pickup.filter((x) => x !== a.id) : [...pickup, a.id])} /><span>{t('fam.mayCollect', { name: a.name })}</span></label>)}
            {aloneOk && <label className="choice"><input type="checkbox" checked={alone} onChange={() => setAlone(!alone)} /><span>{t('fam.signAlone', { name: k.name.split(' ')[0] })}</span></label>}
            <label className="choice"><input type="checkbox" checked={photos} onChange={() => setPhotos(!photos)} /><span>{t('fam.photos')}</span></label>
          </fieldset>
          <ExtraError error={saveAuth.error} />
          <Button variant="secondary" disabled={saveAuth.busy} onClick={() => void saveAuth.run()}>{t('fam.saveAuth')}</Button>
        </>
      )}
    </Card>
  )
}

function Reunion({ plan, reload, locked }: { plan: ReunionPlan; reload: () => void; locked: boolean }) {
  const [placeId, setPlaceId] = useState(plan.placeId)
  const [backupId, setBackupId] = useState(plan.backupId)
  const [note, setNote] = useState(plan.note)
  const save = useAction(async () => { await api.family.setReunion({ placeId, backupId, note }); reload() })
  return (
    <section aria-labelledby="reunion-h">
      <h2 id="reunion-h">{t('fam.reunion')}</h2>
      <p>{t('fam.reunionBody')}</p>
      {locked ? (
        <p><strong>{t('fam.meetAt', { place: placeName(plan.placeId) })}</strong> {t('fam.backup', { place: placeName(plan.backupId) })}{plan.note && ` ${plan.note}`}</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void save.run() }}>
          <div className="field">
            <label htmlFor="re-place">{t('fam.firstPlace')}</label>
            <select id="re-place" className="field__input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>{MEETING_PLACES.map((p) => <option key={p} value={p}>{placeName(p)}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="re-backup">{t('fam.backupPlace')}</label>
            <select id="re-backup" className="field__input" value={backupId} onChange={(e) => setBackupId(e.target.value)}>{MEETING_PLACES.map((p) => <option key={p} value={p}>{placeName(p)}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="re-note">{t('fam.note')}</label>
            <input id="re-note" className="field__input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </div>
          <ExtraError error={save.error} />
          <Button type="submit" disabled={save.busy}>{t('fam.saveReunion')}</Button>
        </form>
      )}
      <p className="muted">{t('fam.rule')} <Link to="/ship/map">{t('route.deckMap')}</Link></p>
    </section>
  )
}
