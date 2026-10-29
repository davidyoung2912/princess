import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import type { ProfileView } from '../../api/types'
import { BEDDING, DIETARY, NEEDS, nameChange, validateProfile, type Bedding, type DietaryId, type NeedId, type Profile, type ProfileErrors, type ProfileField } from '../../domain/account'
import { isPersonaId, personaById, type PersonaId } from '../../domain/personas'
import { dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useNow, usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button, LinkButton } from '../Button'
import { Card } from '../Card'
import { ErrorSummary, Field, TextArea } from '../Field'
import { ActionError, Load, SupervisedNote } from './parts'

const toggle = <T,>(list: readonly T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

/** Profile and the travelling party (ACT-03, MNG-04): details, preferences, emergency contact, and a way to edit each guest on the booking. */
export function ProfileScreen() {
  const me = usePersona()
  const { id: param } = useParams()
  const id: PersonaId | null = param === undefined ? (me?.id ?? null) : isPersonaId(param) ? param : null
  const party = useMine(() => api.account.party())
  const view = useMine(() => (id ? api.account.profile(id) : Promise.reject(new Error('unknown'))), [id])
  const now = useNow()

  if (id === null) {
    return (
      <div className="page">
        <h1>{t('route.profile')}</h1>
        <Banner kind="warning" title={t('profile.notFound')} action={<LinkButton to="/me/profile" variant="secondary">{t('route.profile')}</LinkButton>} />
      </div>
    )
  }
  const isSelf = id === me?.id
  const person = personaById(id)!
  return (
    <div className="page">
      <h1>{isSelf ? t('route.profile') : t('profile.titleFor', { name: person.name })}</h1>
      {!isSelf && <p><Link to="/me/profile">{t('profile.backToMine')}</Link></p>}
      <Load state={view}>
        {(v) => (
          <>
            {!v.canEdit && me && <SupervisedNote booker={personaById(me.booker)!.firstName} />}
            <ProfileForm key={v.id} view={v} onSaved={view.retry} child={person.child} now={now} />
          </>
        )}
      </Load>

      <Load state={party}>
        {(list) => list.length > 1 && (
          <section aria-labelledby="party-h">
            <h2 id="party-h">{t('profile.party')}</h2>
            <p className="muted">{t('profile.partyIntro')}</p>
            <ul className="plain-list">
              {list.map((p) => (
                <li key={p.id}>
                  <span>{p.id === id ? <strong>{p.name}</strong> : <Link to={p.id === me?.id ? '/me/profile' : `/me/profile/${p.id}`}>{p.name}</Link>} <span className="muted">· {p.child ? t('profile.child', { age: p.age }) : t('profile.adult')}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Load>
    </div>
  )
}

function ProfileForm({ view, onSaved, child, now }: { view: ProfileView; onSaved: () => void; child: boolean; now: number }) {
  const [p, setP] = useState<Profile>(view.profile)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [nameBlocked, setNameBlocked] = useState<'late' | 'large' | null>(null)
  const [saved, setSaved] = useState(false)
  const save = useAction((next: Profile) => api.account.saveProfile(view.id, next))
  const set = (patch: Partial<Profile>) => { setP({ ...p, ...patch }); setSaved(false) }
  const err = (field: ProfileField) => (errors[field] ? t(`profile.err.${errors[field]}` as StringKey) : undefined)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    const found = validateProfile(p, dateIn(now, 'America/New_York'), child)
    setErrors(found)
    const rule = nameChange(`${view.profile.firstName} ${view.profile.lastName}`, `${p.firstName} ${p.lastName}`, view.daysToDeparture)
    setNameBlocked(rule.allowed ? null : rule.reason)
    if (Object.keys(found).length > 0 || !rule.allowed) return
    if (await save.run(p)) { setSaved(true); onSaved() }
  }
  const summary = (Object.keys(errors) as ProfileField[]).map((f) => `${t(`profile.field.${f}` as StringKey)}: ${err(f)}`)

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <fieldset disabled={!view.canEdit || save.busy} className="plain-fieldset">
        <ErrorSummary title={t('profile.fix')} errors={summary} />
        {nameBlocked && (
          <Banner kind="warning" title={t(`profile.name.${nameBlocked}` as StringKey, { days: 14 })} action={<LinkButton to="/me/contact" variant="secondary">{t('account.err.contact')}</LinkButton>}>
            <p>{t('profile.name.body')}</p>
          </Banner>
        )}
        <h2>{t('profile.details')}</h2>
        <Field label={t('profile.field.firstName')} value={p.firstName} onChange={(e) => set({ firstName: e.target.value })} error={err('firstName')} autoComplete="given-name" />
        <Field label={t('profile.field.lastName')} value={p.lastName} onChange={(e) => set({ lastName: e.target.value })} error={err('lastName')} hint={t('profile.nameHint')} autoComplete="family-name" />
        <Field label={t('profile.field.dob')} type="date" value={p.dob} onChange={(e) => set({ dob: e.target.value })} error={err('dob')} autoComplete="bday" />
        <Field label={t('profile.field.email')} type="email" value={p.email} onChange={(e) => set({ email: e.target.value })} error={err('email')} autoComplete="email" hint={child ? t('profile.optionalChild') : undefined} />
        <Field label={t('profile.field.phone')} type="tel" value={p.phone} onChange={(e) => set({ phone: e.target.value })} error={err('phone')} autoComplete="tel" />
        <fieldset>
          <legend>{t('profile.citizenship')}</legend>
          {(['us', 'other'] as const).map((c) => (
            <label key={c} className="choice"><input type="radio" name="citizenship" checked={p.citizenship === c} onChange={() => set({ citizenship: c })} /><span>{t(`profile.citizenship.${c}` as StringKey)}</span></label>
          ))}
          <p className="field__hint">{t('profile.citizenshipHint')}</p>
        </fieldset>

        <h2>{t('profile.preferences')}</h2>
        <fieldset>
          <legend>{t('profile.dietary')}</legend>
          {DIETARY.map((d: DietaryId) => <label key={d} className="choice"><input type="checkbox" checked={p.dietary.includes(d)} onChange={() => set({ dietary: toggle(p.dietary, d) })} /><span>{t(`profile.dietary.${d}` as StringKey)}</span></label>)}
        </fieldset>
        <fieldset>
          <legend>{t('profile.needs')}</legend>
          {NEEDS.map((n: NeedId) => <label key={n} className="choice"><input type="checkbox" checked={p.needs.includes(n)} onChange={() => set({ needs: toggle(p.needs, n) })} /><span>{t(`profile.needs.${n}` as StringKey)}</span></label>)}
          <p className="field__hint">{t('profile.needsHint')}</p>
        </fieldset>
        <div className="field">
          <label htmlFor="bedding">{t('profile.bedding')}</label>
          <select id="bedding" value={p.bedding} onChange={(e) => set({ bedding: e.target.value as Bedding })}>
            {BEDDING.map((b) => <option key={b} value={b}>{t(`profile.bedding.${b}` as StringKey)}</option>)}
          </select>
        </div>
        <TextArea label={t('profile.requests')} hint={t('profile.requestsHint')} value={p.specialRequests} maxLength={500} onChange={(e) => set({ specialRequests: e.target.value })} />

        <h2>{t('profile.emergency')}</h2>
        <p className="muted">{t('profile.emergencyHint')}</p>
        <Field label={t('profile.field.emergencyName')} value={p.emergency.name} onChange={(e) => set({ emergency: { ...p.emergency, name: e.target.value } })} error={err('emergencyName')} />
        <Field label={t('profile.field.emergencyPhone')} type="tel" value={p.emergency.phone} onChange={(e) => set({ emergency: { ...p.emergency, phone: e.target.value } })} error={err('emergencyPhone')} />
        <Field label={t('profile.emergencyRelationship')} value={p.emergency.relationship} onChange={(e) => set({ emergency: { ...p.emergency, relationship: e.target.value } })} />
      </fieldset>
      <ActionError error={save.error} forbidden="profile.err.forbidden" />
      {save.error?.code === 'conflict' && <Banner kind="warning" title={t('profile.name.large', { days: 14 })} action={<LinkButton to="/me/contact" variant="secondary">{t('account.err.contact')}</LinkButton>} />}
      <div className="button-row">
        <Button type="submit" disabled={!view.canEdit || save.busy}>{save.busy ? t('account.saving') : t('account.save')}</Button>
      </div>
      <p role="status" className="muted">{saved ? t('profile.saved') : ''}</p>
      {!view.canEdit && <Card info><p>{t('profile.readOnly')}</p></Card>}
    </form>
  )
}
