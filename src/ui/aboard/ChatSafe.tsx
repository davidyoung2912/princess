import { useState, type ChangeEvent } from 'react'
import { FieldLabel } from '../Field'
import { MAX_PHOTO_BYTES, PHOTO_MIN_AGE, PHOTO_TYPES, REPORT_REASONS, type ChatReportReason } from '../../domain/services'
import type { PersonaId } from '../../domain/people'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { usePersona } from '../../hooks/useDemo'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { AboardError } from './common'
import { personFirstName } from '../../account/context'
import { shrinkPicture } from '../../media/shrink'
import { MAX_PHOTOS_PER_MESSAGE, planPicks } from '../../domain/chatPhotos'

/** Report or hide someone's messages (MSG-05). Reporting sends the message to the ship's moderators; blocking only hides it from you. */
export function MessageSafety({ messageId, from, name, onBlocked }: { messageId: string; from: PersonaId; /** Their first name and last initial, when the screen knows it. */ name?: string; onBlocked: () => void }) {
  const who = name || personFirstName(from)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ChatReportReason>('rude')
  const [sent, setSent] = useState(false)
  const report = useAction(async () => { await api.aboard.chat.report(messageId, reason); setSent(true) })
  const block = useAction(async () => { await api.aboard.chat.block(from, true); onBlocked() })
  return (
    <div className="chat-safety">
      <Button variant="tertiary" aria-expanded={open} onClick={() => setOpen(!open)}>{t('safe.more')}<span className="visually-hidden"> {who}</span></Button>
      {open && (
        <div>
          {sent ? <p role="status">{t('safe.reported')}</p> : (
            <div className="field">
              <FieldLabel htmlFor={`rsn-${messageId}`} help={t('helptip.reportReason')}>{t('safe.reason')}</FieldLabel>
              <select id={`rsn-${messageId}`} className="field__input" value={reason} onChange={(e) => setReason(e.target.value as ChatReportReason)}>
                {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`safe.r.${r}` as StringKey)}</option>)}
              </select>
              <Button variant="secondary" disabled={report.busy} onClick={() => void report.run()}>{t('safe.report')}</Button>
            </div>
          )}
          <Button variant="secondary" disabled={block.busy} onClick={() => void block.run()}>{t('safe.block', { name: who })}</Button>
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
        {blocked.data.map((id) => <li key={id}>{personFirstName(id)} <Button variant="tertiary" disabled={unblock.busy} onClick={() => void unblock.run(id)}>{t('safe.unblock')}</Button></li>)}
      </ul>
    </div>
  )
}

const readAsDataUrl = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read')))
  reader.onerror = () => reject(new Error('read'))
  reader.readAsDataURL(file)
})

/**
 * Send photos into one conversation (MSG-01, phase 9b): up to ten at once, each shrunk on the device first, JPEG, PNG or WebP, adults only.
 * The words go with the message; a photo still over the limit after shrinking is left out and the guest is told.
 */
export function PhotoSender({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const me = usePersona()
  const [caption, setCaption] = useState('')
  const [note, setNote] = useState<{ badType: number; over: number; big: number } | null>(null)
  const send = useAction(async (files: File[]) => {
    const ready: { type: string; bytes: number; dataUrl: string }[] = []
    let big = 0
    for (const file of files) {
      const shrunk = await shrinkPicture(file)
      if (shrunk.size > MAX_PHOTO_BYTES) { big++; continue }
      ready.push({ type: shrunk.type || file.type, bytes: shrunk.size, dataUrl: await readAsDataUrl(shrunk) })
    }
    setNote((n) => (n ? { ...n, big } : n))
    const [first, ...more] = ready
    if (!first) return
    await api.chatConversations.sendPhoto(conversationId, { ...first, caption, ...(more.length > 0 ? { more } : {}) })
    setCaption('')
    onSent()
  })
  if (!me || me.age < PHOTO_MIN_AGE) return <p className="muted">{t('safe.photoAdults', { age: PHOTO_MIN_AGE })}</p>
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    setNote(null)
    if (files.length === 0) return
    const plan = planPicks(files.map((f) => ({ type: f.type, size: f.size })), PHOTO_TYPES)
    setNote({ badType: plan.badType, over: plan.over, big: 0 })
    if (plan.keep.length > 0) void send.run(plan.keep.map((i) => files[i]))
  }
  return (
    <div className="field">
      <label htmlFor="chat-photo">{t('safe.photo')}</label>
      <p className="field__hint">{t('safe.photoHint', { mb: MAX_PHOTO_BYTES / 1_000_000, max: MAX_PHOTOS_PER_MESSAGE })}</p>
      <input id="chat-photo" type="file" multiple accept={PHOTO_TYPES.join(',')} onChange={pick} disabled={send.busy} />
      {send.busy && <p role="status" className="muted">{t('cphoto.preparing')}</p>}
      {note && note.badType > 0 && <p role="alert" className="field__error">{t('safe.badType')}</p>}
      {note && note.over > 0 && <p role="alert" className="field__error">{t('cphoto.tooMany', { max: MAX_PHOTOS_PER_MESSAGE })}</p>}
      {note && note.big > 0 && <p role="alert" className="field__error">{t('safe.badSize', { mb: MAX_PHOTO_BYTES / 1_000_000 })}</p>}
      <AboardError error={send.error} />
    </div>
  )
}
