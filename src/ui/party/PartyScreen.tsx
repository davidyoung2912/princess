import { SharingNote } from '../SharingNote'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { MAX_NOTE_LENGTH, partyCheckin } from '../../domain/party'
import { api } from '../../runtime'
import { useParty } from '../../hooks/useParty'
import { useMine } from '../../hooks/useMine'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'
import { Load } from '../account/parts'
import { firstName } from '../plan/people'

const when = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** Travel party coordination (MNG-16): who has finished check-in, who is invited, and notes the party shares. */
export function PartyScreen() {
  const { state, me, invite, uninvite, note, unnote } = useParty()
  const checkin = useMine(() => api.checkin.view())
  const [email, setEmail] = useState('')
  const [text, setText] = useState('')
  const [emailError, setEmailError] = useState('')
  const [noteError, setNoteError] = useState('')
  const child = me?.child ?? false

  const addInvite = (e: FormEvent) => {
    e.preventDefault()
    const problem = invite(email)
    setEmailError(problem ? t(`party.invite.error.${problem}` as StringKey) : '')
    if (!problem) setEmail('')
  }
  const addNote = (e: FormEvent) => {
    e.preventDefault()
    const problem = note(text)
    setNoteError(problem ? t(`party.note.error.${problem}` as StringKey) : '')
    if (!problem) setText('')
  }

  return (
    <div className="page">
      <h1>{th('route.party')}</h1>
      <p>{t('party.shared.intro')}</p>
      <SharingNote field="plans" />
      {child && <p className="muted">{t('party.child')}</p>}

      <section aria-labelledby="party-check-h">
        <h2 id="party-check-h">{th('party.checkin')}</h2>
        <Load state={checkin}>
          {(view) => {
            const c = partyCheckin(view.guests)
            return (
              <Card>
                <p role="status">{c.waiting.length === 0 ? t('party.checkin.all') : t('party.checkin.count', { done: c.done, total: c.total })}</p>
                {c.waiting.length > 0 && <p>{t('party.checkin.waiting', { names: c.waiting.join(', ') })}</p>}
                <Link to="/home/check-in">{t('party.checkin.open')}</Link>
              </Card>
            )
          }}
        </Load>
      </section>

      <section aria-labelledby="party-inv-h">
        <h2 id="party-inv-h">{th('party.invites')}</h2>
        {!child && (
          <form onSubmit={addInvite} noValidate>
            <Field label={t('party.invite.email')} hint={t('party.invites.hint')} type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} error={emailError || undefined} />
            <Button type="submit">{t('party.invite.add')}</Button>
          </form>
        )}
        {state.invites.length === 0 ? <p className="muted">{t('party.invite.none')}</p> : (
          <ul className="order-list">
            {state.invites.map((i) => (
              <li key={i.id}>
                {i.email} <span className="muted">{when(i.at)}</span>
                {!child && <> <Button variant="tertiary" onClick={() => uninvite(i.id)}>{t('party.invite.remove')}<span className="visually-hidden"> {i.email}</span></Button></>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="party-notes-h">
        <h2 id="party-notes-h">{th('party.notes')}</h2>
        {!child && (
          <form onSubmit={addNote} noValidate>
            <TextArea label={t('party.note.label')} value={text} maxLength={MAX_NOTE_LENGTH} onChange={(e) => setText(e.target.value)} />
            {noteError && <p role="alert" className="field__error">{noteError}</p>}
            <Button type="submit">{t('party.note.add')}</Button>
          </form>
        )}
        {state.notes.length === 0 ? <p className="muted">{t('party.note.none')}</p> : (
          <ul className="order-list">
            {[...state.notes].reverse().map((n) => (
              <li key={n.id}>
                <strong>{firstName(n.by as never)}</strong> <span className="muted">{when(n.at)}</span>
                <p>{n.text}</p>
                {n.by === me?.id && <Button variant="tertiary" onClick={() => unnote(n.id)}>{t('party.note.remove')}<span className="visually-hidden"> {n.text.slice(0, 30)}</span></Button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
