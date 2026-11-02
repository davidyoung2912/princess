import { useState } from 'react'
import { MEET_KINDS, MEET_NOTE_MAX, MEET_PHONE_MAX, isMeetKind, meetCard, meetProblem, meetText, type MeetInput } from '../../domain/meetingPoint'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'

/**
 * The meeting-point card (N6.4): a short written card for whoever drops the guest at the terminal or collects them. It is built on this device
 * from the address the app already has; nothing is saved or sent from here. The guest copies it, sends it from their own messages, or prints it.
 */
export function MeetingPointScreen() {
  const [input, setInput] = useState<MeetInput>({ kind: 'dropoff', time: '11:00', phone: '', note: '' })
  const [note, setNote] = useState('')
  const problem = meetProblem(input)
  const card = meetCard(input)
  const set = (patch: Partial<MeetInput>) => { setNote(''); setInput({ ...input, ...patch }) }
  const copy = async () => {
    if (!card) return
    try { await navigator.clipboard.writeText(meetText(card)); setNote(t('mp.copied')) } catch { setNote(t('mp.copyFailed')) }
  }
  const share = async () => {
    if (!card) return
    try { await navigator.share({ title: card.heading, text: meetText(card) }) } catch { /* the guest closed the sheet: nothing to report */ }
  }
  return (
    <div className="page">
      <h1>{t('mp.title')}</h1>
      <p>{t('mp.intro')}</p>

      <Card labelledBy="meet-form-h">
        <h2 id="meet-form-h" className="card__title">{t('mp.kind')}</h2>
        <fieldset className="plain-fieldset">
          <legend className="visually-hidden">{t('mp.kind')}</legend>
          {MEET_KINDS.map((k) => (
            <label key={k} className="choice"><input type="radio" name="meet-kind" checked={input.kind === k} onChange={() => isMeetKind(k) && set({ kind: k })} /><span>{t(`mp.kind.${k}` as StringKey)}</span></label>
          ))}
        </fieldset>
        <Field label={t('mp.time')} hint={t('mp.timeHint')} type="time" value={input.time} onChange={(e) => set({ time: e.target.value })} error={problem === 'time' ? t('mp.checkTime') : undefined} />
        <Field label={t('mp.phone')} hint={t('mp.phoneHint')} type="tel" inputMode="tel" autoComplete="off" maxLength={MEET_PHONE_MAX} value={input.phone} onChange={(e) => set({ phone: e.target.value })} error={problem === 'phone' ? t('mp.phoneHint') : undefined} />
        <div className="field">
          <label htmlFor="meet-note">{t('mp.note')}</label>
          <p className="field__hint">{t('mp.noteHint', { count: MEET_NOTE_MAX })}</p>
          <textarea id="meet-note" className="field__input" rows={3} maxLength={MEET_NOTE_MAX} value={input.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
      </Card>

      {card && (
        <Card labelledBy="meet-card-h">
          <h2 id="meet-card-h" className="card__title">{t('mp.card')}</h2>
          <article className="print-sheet" aria-label={card.heading}>
            <h3>{card.heading}</h3>
            <ul className="plain-list">{card.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </article>
          <div className="button-row">
            <Button onClick={() => void copy()}>{t('mp.copy')}</Button>
            {typeof navigator !== 'undefined' && 'share' in navigator && <Button variant="secondary" onClick={() => void share()}>{t('mp.share')}</Button>}
            <Button variant="secondary" onClick={() => window.print()}>{t('mp.print')}</Button>
          </div>
          <p role="status">{note}</p>
          <p className="muted">{t('mp.noShare')}</p>
        </Card>
      )}
    </div>
  )
}
