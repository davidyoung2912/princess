import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Camera, ShieldAlert, X } from 'lucide-react'
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
    <>
      <button type="button" className="chat-act chat-act--icon" aria-expanded={open} aria-label={`${t('safe.more')} ${who}`} title={t('safe.more')} onClick={() => setOpen(!open)}><ShieldAlert aria-hidden="true" /></button>
      {open && (
        <div className="chat-safety">
          {sent ? <p role="status">{t('safe.reported')}</p> : (
            <div className="field">
              <FieldLabel htmlFor={`rsn-${messageId}`} help={t('helptip.reportReason')}>{t('safe.reason')}</FieldLabel>
              <select id={`rsn-${messageId}`} className="field__input" value={reason} onChange={(e) => setReason(e.target.value as ChatReportReason)}>
                {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`safe.r.${r}` as StringKey)}</option>)}
              </select>
            </div>
          )}
          <div className="button-row">
            {!sent && <Button variant="secondary" disabled={report.busy} onClick={() => void report.run()}>{t('safe.report')}</Button>}
            <Button variant="secondary" disabled={block.busy} onClick={() => void block.run()}>{t('safe.block', { name: who })}</Button>
          </div>
          <AboardError error={report.error ?? block.error} />
        </div>
      )}
    </>
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

/** A photo chosen for the message being written: shrunk on the device and ready to send. Nothing is sent until the guest presses Send. */
export interface StagedPhoto { type: string; bytes: number; dataUrl: string }

/**
 * Attach photos to a chat message being written (MSG-01, phase 9b): a button beside Send that can be used again and again, up to ten in all.
 * Each photo is shrunk on the device and added to the draft; nothing is sent here. JPEG, PNG or WebP, adults only.
 */
export function PhotoAttach({ photos, onChange, children }: { photos: readonly StagedPhoto[]; onChange: (next: StagedPhoto[]) => void; /** The Send button: it sits with this one, side by side or stacked on a phone, so the message box keeps the width. */ children: ReactNode }) {
  const me = usePersona()
  const input = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<{ badType: number; over: number; big: number } | null>(null)
  const prepare = useAction(async (files: File[]) => {
    const ready: StagedPhoto[] = []
    let big = 0
    for (const file of files) {
      const shrunk = await shrinkPicture(file)
      if (shrunk.size > MAX_PHOTO_BYTES) { big++; continue }
      ready.push({ type: shrunk.type || file.type, bytes: shrunk.size, dataUrl: await readAsDataUrl(shrunk) })
    }
    setNote((n) => (n ? { ...n, big } : n))
    if (ready.length > 0) onChange([...photos, ...ready].slice(0, MAX_PHOTOS_PER_MESSAGE))
  })
  if (!me || me.age < PHOTO_MIN_AGE) return <div className="composer__actions">{children}</div>
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    setNote(null)
    if (files.length === 0) return
    const plan = planPicks(files.map((f) => ({ type: f.type, size: f.size })), PHOTO_TYPES, photos.length)
    setNote({ badType: plan.badType, over: plan.over, big: 0 })
    if (plan.keep.length > 0) void prepare.run(plan.keep.map((i) => files[i]))
  }
  return (
    <>
      <input ref={input} type="file" multiple hidden tabIndex={-1} accept={PHOTO_TYPES.join(',')} onChange={pick} />
      <div className="composer__actions">
        <Button variant="secondary" className="chat-attach" icon={Camera} title={t('safe.photoHint', { mb: MAX_PHOTO_BYTES / 1_000_000, max: MAX_PHOTOS_PER_MESSAGE })} disabled={prepare.busy || photos.length >= MAX_PHOTOS_PER_MESSAGE} onClick={() => input.current?.click()}>{t('cphoto.add')}</Button>
        {children}
      </div>
      {prepare.busy && <p role="status" className="muted">{t('cphoto.preparing')}</p>}
      {note && note.badType > 0 && <p role="alert" className="field__error">{t('safe.badType')}</p>}
      {note && note.over > 0 && <p role="alert" className="field__error">{t('cphoto.tooMany', { max: MAX_PHOTOS_PER_MESSAGE })}</p>}
      {note && note.big > 0 && <p role="alert" className="field__error">{t('safe.badSize', { mb: MAX_PHOTO_BYTES / 1_000_000 })}</p>}
      <AboardError error={prepare.error} />
    </>
  )
}

/** The photos attached to the draft, each with a Remove button, so the guest can review them before sending. */
export function DraftPhotos({ photos, onChange }: { photos: readonly StagedPhoto[]; onChange: (next: StagedPhoto[]) => void }) {
  if (photos.length === 0) return null
  return (
    <div className="chat-draft-photos" role="group" aria-label={t('cphoto.draft', { count: photos.length })}>
      <p className="muted" role="status">{t('cphoto.draft', { count: photos.length })}</p>
      <ul className="chat-draft-photos__list plain-bullets">
        {photos.map((p, i) => (
          <li key={`${i}:${p.bytes}`} className="chat-draft-photos__item">
            <img src={p.dataUrl} alt={t('cphoto.draftAlt', { n: i + 1, count: photos.length })} />
            <button type="button" className="chat-draft-photos__remove" aria-label={t('cphoto.remove', { n: i + 1 })} onClick={() => onChange(photos.filter((_, j) => j !== i))}><X aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}
