import { useState, type FormEvent } from 'react'
import { addContact, addPostcard, daysLeft, DEFAULT_LINK_DAYS, flushPostcards, issueLink, isLive, LINK_DAY_CHOICES, linkToken, liveLinkFor, MAX_POSTCARD_NOTE, POSTCARD_KINDS, POSTCARD_TEXT, queuedPostcards, removeContact, revokeAll, revokeLink, type ContactProblem, type PostcardKind } from '../../domain/homeLink'
import { useDemo, useNow } from '../../hooks/useDemo'
import { newHubId, useHub } from '../../hooks/useHub'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'

const newSecret = (): string => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('')

/** Family at home (S3-08, S6-24, XD-07, S4A-08): name the people who may follow the trip, send "we're OK" postcards, and stop any link at any time. */
export function FamilyLinkScreen() {
  const { state, update, me } = useHub()
  const demo = useDemo()
  const now = useNow()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [problem, setProblem] = useState<ContactProblem | null>(null)
  const [days, setDays] = useState<number>(DEFAULT_LINK_DAYS)
  const [note, setNote] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  const home = state.home
  const child = me?.child ?? false
  const offline = demo.network.offline
  const owner = me?.id ?? ''
  const queued = queuedPostcards(home)
  const liveCount = home.links.filter((l) => isLive(l, now)).length

  const add = (e: FormEvent) => {
    e.preventDefault()
    const result = addContact(home, name, email, newHubId())
    setProblem(result.problem)
    if (!result.problem) { update((s) => ({ ...s, home: result.state })); setName(''); setEmail('') }
  }
  const share = (contactId: string) => {
    const result = issueLink(home, contactId, now, newHubId(), home.secret || newSecret(), days)
    if (!result.link) return
    update((s) => ({ ...s, home: result.state }))
    setShown(`${window.location.origin}/at-sea/${linkToken(result.state, owner, result.link)}`)
  }
  const send = (kind: PostcardKind) => { update((s) => ({ ...s, home: addPostcard(s.home, kind, note, now, newHubId(), !offline) })); setNote('') }

  return (
    <div className="page">
      <h1>{t('route.familyLink')}</h1>
      <p>{t('home.intro')}</p>
      <Card info>
        <h2 className="card__title">{t('home.sees')}</h2>
        <ul>{(['home.sees1', 'home.sees2', 'home.sees3', 'home.sees4'] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul>
        <h2 className="card__title">{t('home.neverSees')}</h2>
        <p>{t('home.neverSees.body')}</p>
        <p className="muted">{t('home.sim')}</p>
      </Card>

      <section aria-labelledby="home-people-h">
        <h2 id="home-people-h">{t('home.people')}</h2>
        {home.contacts.length === 0 && <p>{t('home.people.none')}</p>}
        {home.contacts.length > 0 && (
          <fieldset>
            <legend>{t('home.days')}</legend>
            {LINK_DAY_CHOICES.map((d) => <label key={d} className="choice"><input type="radio" name="link-days" checked={days === d} onChange={() => setDays(d)} /><span>{t('home.days.n', { count: d })}</span></label>)}
          </fieldset>
        )}
        <ul className="plain-list">
          {home.contacts.map((c) => {
            const live = liveLinkFor(home, c.id, now)
            return (
              <li key={c.id}>
                <span>{c.name}<small className="muted"> · {c.email} · {live ? t('home.link.live', { count: daysLeft(live, now) }) : t('home.link.none')}</small></span>
                <span className="button-row">
                  <Button variant="secondary" disabled={child} onClick={() => share(c.id)}>{live ? t('home.link.new') : t('home.link.make')}</Button>
                  {live && <Button variant="secondary" onClick={() => update((s) => ({ ...s, home: revokeLink(s.home, live.id) }))}>{t('home.link.stop')}</Button>}
                  <Button variant="tertiary" onClick={() => update((s) => ({ ...s, home: removeContact(s.home, c.id) }))}>{t('home.person.remove')}</Button>
                </span>
              </li>
            )
          })}
        </ul>
        {shown && (
          <Card info>
            <p role="status">{t('home.link.made')}</p>
            <p><code>{shown}</code></p>
            <p className="muted">{t('home.link.once')}</p>
          </Card>
        )}
        {liveCount > 1 && <Button variant="secondary" onClick={() => { update((s) => ({ ...s, home: revokeAll(s.home) })); setShown(null) }}>{t('home.link.stopAll')}</Button>}
        {!child && (
          <form onSubmit={add} noValidate>
            <Field label={t('home.person.name')} value={name} onChange={(e) => setName(e.target.value)} error={problem === 'name' ? t('home.error.name') : undefined} />
            <Field label={t('home.person.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={problem && problem !== 'name' ? t(`home.error.${problem}` as StringKey) : undefined} />
            <Button type="submit" variant="secondary">{t('home.person.add')}</Button>
          </form>
        )}
      </section>

      <section aria-labelledby="home-cards-h">
        <h2 id="home-cards-h">{t('home.cards')}</h2>
        <p>{t('home.cards.intro')}</p>
        <Field label={t('home.cards.note')} value={note} maxLength={MAX_POSTCARD_NOTE} onChange={(e) => setNote(e.target.value)} />
        <div className="button-row" role="group" aria-label={t('home.cards')}>
          {POSTCARD_KINDS.map((k) => <Button key={k} variant="secondary" disabled={child || home.contacts.length === 0} onClick={() => send(k)}>{t(POSTCARD_TEXT[k])}</Button>)}
        </div>
        {home.contacts.length === 0 && <p className="muted">{t('home.cards.needPeople')}</p>}
        {queued > 0 && (
          <p role="status">{offline ? t('home.cards.queued', { count: queued }) : t('home.cards.ready', { count: queued })}{' '}
            {!offline && <Button variant="secondary" onClick={() => update((s) => ({ ...s, home: flushPostcards(s.home, now) }))}>{t('home.cards.send')}</Button>}
          </p>
        )}
        <ul className="plain-list">
          {[...home.postcards].reverse().map((p) => <li key={p.id}><span>{t(POSTCARD_TEXT[p.kind])}{p.note && <small className="muted"> · {p.note}</small>}</span><span className="muted">{p.sent ? t('home.cards.sent') : t('home.cards.waiting')}</span></li>)}
        </ul>
      </section>
      <BackLink to="/plan" label={t('route.plan')} />
    </div>
  )
}
