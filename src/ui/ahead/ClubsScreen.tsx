import { useState } from 'react'
import { CLUBS, MAX_PICKUPS, blankRegistration, clubProblem, type ClubRegistration, type Pickup } from '../../domain/ahead'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { AheadError, Back, ChildNote } from './common'
import type { ClubChild } from '../../api/aheadTypes'

const blankPickup = (): Pickup => ({ name: '', relation: '', phone: '' })

function Registration({ child, canEdit, reload }: { child: ClubChild; canEdit: boolean; reload: () => void }) {
  const [reg, setReg] = useState<ClubRegistration>(child.registration ?? blankRegistration(child.id))
  const [open, setOpen] = useState(!child.registered)
  const save = useAction(async () => { await api.ahead.clubs.save(reg); setOpen(false); reload() })
  const withdraw = useAction(async () => { await api.ahead.clubs.withdraw(child.id); setReg(blankRegistration(child.id)); setOpen(true); reload() })
  const club = CLUBS.find((c) => c.id === child.club)
  const teen = child.age >= 13
  const set = (patch: Partial<ClubRegistration>) => setReg({ ...reg, ...patch })
  const setPickup = (i: number, patch: Partial<Pickup>) => set({ pickups: reg.pickups.map((p, n) => (n === i ? { ...p, ...patch } : p)) })
  const problem = clubProblem(reg, child.age)
  return (
    <Card>
      <h3 className="card__title">{child.name} · {t('club.age', { age: child.age })}</h3>
      {!club ? <p>{t('club.noClub')}</p> : (
        <>
          <p>{t('club.goes', { club: club.name, deck: club.deck })}</p>
          {child.registered && <p><StatusBadge kind="booked" label={t('club.registered')} /></p>}
          {child.registered && !open && canEdit && (
            <div className="button-row">
              <Button variant="secondary" onClick={() => setOpen(true)}>{t('club.edit')}<span className="visually-hidden"> {child.name}</span></Button>
              <Button variant="tertiary" disabled={withdraw.busy} onClick={() => void withdraw.run()}>{t('club.withdraw')}<span className="visually-hidden"> {child.name}</span></Button>
            </div>
          )}
          {open && canEdit && (
            <form onSubmit={(e) => { e.preventDefault(); void save.run() }}>
              <TextArea label={t('club.allergies')} value={reg.allergies} maxLength={300} onChange={(e) => set({ allergies: e.target.value })} />
              <TextArea label={t('club.medical')} value={reg.medical} maxLength={300} onChange={(e) => set({ medical: e.target.value })} />
              <TextArea label={t('club.medication')} hint={t('club.medicationHint')} value={reg.medication} maxLength={300} onChange={(e) => set({ medication: e.target.value })} />
              <Field label={t('club.emergency')} type="tel" autoComplete="tel" value={reg.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value })} />
              <fieldset>
                <legend>{t('club.pickups')}</legend>
                <p className="muted">{t('club.pickupsHint', { max: MAX_PICKUPS })}</p>
                {reg.pickups.map((p, i) => (
                  <div key={i} className="ab-controls">
                    <Field label={t('club.pickupName', { n: i + 1 })} value={p.name} onChange={(e) => setPickup(i, { name: e.target.value })} />
                    <Field label={t('club.pickupRelation', { n: i + 1 })} value={p.relation} onChange={(e) => setPickup(i, { relation: e.target.value })} />
                    <Field label={t('club.pickupPhone', { n: i + 1 })} type="tel" value={p.phone} onChange={(e) => setPickup(i, { phone: e.target.value })} />
                    <Button variant="tertiary" onClick={() => set({ pickups: reg.pickups.filter((_, n) => n !== i) })}>{t('club.removePickup', { n: i + 1 })}</Button>
                  </div>
                ))}
                {reg.pickups.length < MAX_PICKUPS && <Button variant="secondary" onClick={() => set({ pickups: [...reg.pickups, blankPickup()] })}>{t('club.addPickup')}</Button>}
              </fieldset>
              {teen && (
                <label className="choice choice--top">
                  <input type="checkbox" checked={reg.selfSignOut} onChange={(e) => set({ selfSignOut: e.target.checked })} />
                  <span>{t('club.selfSignOut')}<small>{t('club.selfSignOutBody')}</small></span>
                </label>
              )}
              <label className="choice choice--top">
                <input type="checkbox" checked={reg.photoConsent} onChange={(e) => set({ photoConsent: e.target.checked })} />
                <span>{t('club.photos')}<small>{t('club.photosBody')}</small></span>
              </label>
              <label className="choice choice--top">
                <input type="checkbox" checked={reg.confirmed} onChange={(e) => set({ confirmed: e.target.checked })} />
                <span>{t('club.confirm')}</span>
              </label>
              <AheadError error={save.error ?? withdraw.error} />
              {problem && !save.error && <p className="muted" role="status">{t(`ah.err.${problem}` as StringKey)}</p>}
              <Button type="submit" disabled={save.busy}>{t('club.save')}</Button>
            </form>
          )}
        </>
      )}
    </Card>
  )
}

/** Register children and teens for the clubs before sailing, with health, allergy and pick-up details (PRE-08). Health details are visible only to the booker and the club staff. */
export function ClubsScreen() {
  const view = useMine(() => api.ahead.clubs.view())
  return (
    <div className="page">
      <h1>{t('route.clubs')}</h1>
      <p>{t('club.intro')}</p>
      <ChildNote />
      <Banner kind="info" title={t('club.privacy')}><p>{t('club.privacyBody')}</p></Banner>
      <Load state={view}>
        {(v) => v.children.length === 0 ? <p>{t('club.noChildren')}</p> : (
          <ul className="card-grid">
            {v.children.map((c) => <li key={c.id}><Registration child={c} canEdit={v.canEdit && v.open} reload={view.retry} /></li>)}
          </ul>
        )}
      </Load>
      <ul className="plain-bullets">{CLUBS.map((c) => <li key={c.id}>{c.name}: {t('club.ages', { min: c.minAge, max: c.maxAge })}, {c.deck}</li>)}</ul>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}
