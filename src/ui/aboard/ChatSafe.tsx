import { useState, type ChangeEvent } from 'react'
import { MAX_PHOTO_BYTES, PHOTO_MIN_AGE, PHOTO_TYPES, REPORT_REASONS, type ChatReportReason } from '../../domain/services'
import { personaById, type PersonaId } from '../../domain/personas'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { AboardError } from './common'

/** Report or hide someone's messages (MSG-05). Reporting sends the message to the ship's moderators; blocking only hides it from you. */
export function MessageSafety({ messageId, from, onBlocked }: { messageId: string; from: PersonaId; onBlocked: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ChatReportReason>('rude')
  const [sent, setSent] = useState(false)
  const report = useAction(async () => { await api.aboard.chat.report(messageId, reason); setSent(true) })
  const block = useAction(async () => { await api.aboard.chat.block(from, true); onBlocked() })
  return (
    <div className="chat-safety">
      <Button variant="tertiary" aria-expanded={open} onClick={() => setOpen(!open)}>{t('safe.more')}<span className="visually-hidden"> {personaById(from)?.firstName}</span></Button>
      {open && (
        <div>
          {sent ? <p role="status">{t('safe.reported')}</p> : (
            <div className="field">
              <label htmlFor={`rsn-${messageId}`}>{t('safe.reason')}</label>
              <select id={`rsn-${messageId}`} className="field__input" value={reason} onChange={(e) => setReason(e.target.value as ChatReportReason)}>
                {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`safe.r.${r}` as StringKey)}</option>)}
              </select>
              <Button variant="secondary" disabled={report.busy} onClick={() => void report.run()}>{t('safe.report')}</Button>
            </div>
          )}
          <Button variant="secondary" disabled={block.busy} onClick={() => void block.run()}>{t('safe.block', { name: personaById(from)?.firstName ?? '' })}</Button>
          <AboardError error={report.error ?? block.error} />
        </div>
      )}
    </div>
  )
}

/** People hidden from your chat, with a way to bring them back. */
export function BlockedList({ reload, version }: { reload: () => void; version: number }) {
  const blocked = useMine(() => api.aboard.chat.blocked(), [version])
  const unblock = useAction(async (id: PersonaId) => { await api.aboard.chat.block(id, false); blocked.retry(); reload() })
  if (!blocked.data || blocked.data.length === 0) return null
  return (
    <div>
      <p>{t('safe.hidden')}</p>
      <ul className="plain-bullets">
        {blocked.data.map((id) => <li key={id}>{personaById(id)?.firstName} <Button variant="tertiary" disabled={unblock.busy} onClick={() => void unblock.run(id)}>{t('safe.unblock')}</Button></li>)}
      </ul>
    </div>
  )
}

const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read')))
  reader.onerror = () => reject(new Error('read'))
  reader.readAsDataURL(file)
})

/** Send a photo to the party (MSG-01): JPEG, PNG or WebP under 1 MB, adults only. */
export function PhotoSender({ onSent }: { onSent: () => void }) {
  const me = usePersona()
  const [caption, setCaption] = useState('')
  const [bad, setBad] = useState<'type' | 'size' | null>(null)
  const send = useAction(async (file: File) => {
    const dataUrl = await readAsDataUrl(file)
    await api.aboard.chat.sendPhoto({ type: file.type, bytes: file.size, dataUrl, caption })
    setCaption('')
    onSent()
  })
  if (!me || me.age < PHOTO_MIN_AGE) return <p className="muted">{t('safe.photoAdults', { age: PHOTO_MIN_AGE })}</p>
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setBad(null)
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) { setBad('type'); return }
    if (file.size > MAX_PHOTO_BYTES) { setBad('size'); return }
    void send.run(file)
  }
  return (
    <div className="field">
      <label htmlFor="chat-photo">{t('safe.photo')}</label>
      <p className="field__hint">{t('safe.photoHint', { mb: MAX_PHOTO_BYTES / 1_000_000 })}</p>
      <input id="chat-photo" type="file" accept={PHOTO_TYPES.join(',')} onChange={pick} disabled={send.busy} />
      {bad && <p role="alert" className="field__error">{t(bad === 'type' ? 'safe.badType' : 'safe.badSize', { mb: MAX_PHOTO_BYTES / 1_000_000 })}</p>}
      <AboardError error={send.error} />
    </div>
  )
}
