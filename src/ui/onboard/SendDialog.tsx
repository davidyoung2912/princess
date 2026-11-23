import { useEffect, useId, useState } from 'react'
import type { ChatConversation } from '../../api/chatTypes'
import { BUNDLE_NOTE_MAX, matchConversations, SEARCH_FROM, sendToMany, type SendOutcome } from '../../domain/chatBundles'
import { cleanNote } from '../../domain/chatCards'
import { newClientId } from '../../domain/chatThread'
import { api } from '../../runtime'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { qrKindOf } from '../../domain/shareCodes'
import { shareError } from './ChatCards'
import { ShowCode } from './ShowCode'

export interface SendItem {
  /** Names the thing in the dialog and for a screen reader. */
  title: string
  subtitle?: string
  /** How it goes: the `kind` and `shareRef` the server rebuilds the card from. The note is added here when the kind takes one. */
  input: (note: string) => Parameters<typeof api.chatConversations.sendTyped>[1]
  /** Phase B2: how it goes when the guest chooses to ask who is going (a plan for the same thing). Only a thing with a day and a time has it. */
  ask?: (note: string) => Parameters<typeof api.chatConversations.sendTyped>[1]
  /** The ref the server rebuilds it from; when it names a type that has a code, the dialog offers Show QR code. */
  shareRef?: string
  /** Whether the kind carries a note (a bundle or a plan does; an older card does not). */
  takesNote: boolean
}

/**
 * The send dialog (docs/chat-bundles-plan.md, 5.4): pick one or more open conversations, see exactly what will go, add a short note and send. One message goes to each chat with its own client id, so a retry
 * never doubles, and the result says which chats got it and which did not. A card has to be true when it is sent, so nothing here waits for signal.
 */
export function SendDialog({ item, onClose }: { item: SendItem; onClose: () => void }) {
  const [rows, setRows] = useState<ChatConversation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcomes, setOutcomes] = useState<SendOutcome[]>([])
  const [needPick, setNeedPick] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [how, setHow] = useState<'send' | 'ask'>('send')
  const ids = useId()
  useEffect(() => {
    let live = true
    api.chatConversations.list().then((l) => { if (live) setRows(l.filter((c) => c.kind !== 'stanley' && !c.closed && !c.permanent)) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  const sentIds = outcomes.filter((o) => o.ok).map((o) => o.id)
  const open = (rows ?? []).filter((c) => !sentIds.includes(c.id))
  const shown = matchConversations(open, query)
  const toggle = (id: string) => { setNeedPick(false); setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])) }
  const run = async () => {
    const targets = open.filter((c) => picked.includes(c.id))
    if (targets.length === 0) { setNeedPick(true); return }
    setBusy(true)
    const clean = item.takesNote ? cleanNote(note) : ''
    const done = await sendToMany(targets, (c) => api.chatConversations.sendTyped(c.id, (how === 'ask' && item.ask ? item.ask(clean) : item.input(clean)), newClientId()))
    setBusy(false)
    setOutcomes((cur) => [...cur.filter((o) => !done.some((d) => d.id === o.id)), ...done])
    setPicked(done.filter((d) => !d.ok).map((d) => d.id))
  }
  const good = outcomes.filter((o) => o.ok)
  const bad = outcomes.filter((o) => !o.ok)
  const status = good.length === 0 ? '' : bad.length === 0 ? t('senddlg.sentAll', { names: good.map((o) => o.name).join(', ') }) : t('senddlg.sentSome', { names: good.map((o) => o.name).join(', '), failed: bad.map((o) => o.name).join(', ') })
  const allDone = rows !== null && good.length > 0 && bad.length === 0
  const hasCode = item.shareRef !== undefined && qrKindOf(item.shareRef) !== null
  if (showCode && item.shareRef) return <Dialog title={t('qrshow.title')} onClose={onClose}><ShowCode shareRef={item.shareRef} title={item.title} onBack={() => setShowCode(false)} /></Dialog>
  return (
    <Dialog title={t('sendchat.title')} onClose={onClose}>
      <div className="send-dialog">
        <section aria-labelledby={`${ids}-what`} className="send-dialog__what">
          <h3 id={`${ids}-what`} className="send-dialog__label">{t('senddlg.sending')}</h3>
          <div className="chat-card" role="group" aria-label={item.title}>
            <p className="chat-card__title">{item.title}</p>
            {item.subtitle && <p className="muted">{item.subtitle}</p>}
          </div>
        </section>
        <p role="status" className={status ? undefined : 'visually-hidden'}>{status}</p>
        {bad.map((o) => <p key={o.id} role="alert" className="field__error">{t('senddlg.failedOne', { name: o.name, reason: t(shareError(!o.ok ? o.error : null)) })}</p>)}
        {rows === null && !failed && <p role="status" className="muted">{t('conv.share.loading')}</p>}
        {failed && <p role="alert" className="field__error">{t('conv.share.failed')}</p>}
        {rows !== null && rows.length === 0 && <p className="muted">{t('sendchat.none')}</p>}
        {!allDone && open.length > 0 && (
          <>
            {rows !== null && rows.length > SEARCH_FROM && (
              <div className="field">
                <label htmlFor={`${ids}-find`}>{t('senddlg.find')}</label>
                <input id={`${ids}-find`} type="search" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
              </div>
            )}
            <fieldset className="send-dialog__chats" aria-describedby={needPick ? `${ids}-pick` : undefined}>
              <legend>{t('senddlg.to')}</legend>
              {shown.length === 0 && <p className="muted">{t('senddlg.noMatch')}</p>}
              <ul className="chat-share__list">
                {shown.map((c) => (
                  <li key={c.id}>
                    <label className="send-dialog__row">
                      <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                      <span>{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            {needPick && <p id={`${ids}-pick`} role="alert" className="field__error">{t('senddlg.pickOne')}</p>}
            {item.ask && (
              <fieldset className="send-dialog__how">
                <legend>{t('senddlg.how')}</legend>
                <label className="send-dialog__row"><input type="radio" name={`${ids}-how`} checked={how === 'send'} onChange={() => setHow('send')} /><span>{t('senddlg.how.send')}</span></label>
                <label className="send-dialog__row"><input type="radio" name={`${ids}-how`} checked={how === 'ask'} aria-describedby={`${ids}-how-hint`} onChange={() => setHow('ask')} /><span>{t('senddlg.how.ask')}</span></label>
                <p id={`${ids}-how-hint`} className="muted">{t('senddlg.how.askHint')}</p>
              </fieldset>
            )}
            {item.takesNote && (
              <div className="field">
                <label htmlFor={`${ids}-note`}>{t('senddlg.note')}</label>
                <input id={`${ids}-note`} type="text" value={note} maxLength={BUNDLE_NOTE_MAX} autoComplete="off" aria-describedby={`${ids}-note-hint`} onChange={(e) => setNote(e.target.value)} />
                <p id={`${ids}-note-hint`} className="muted">{t('senddlg.noteHint')}</p>
              </div>
            )}
            <Button disabled={busy} onClick={() => void run()}>{picked.length > 1 ? t('senddlg.sendMany', { count: picked.length }) : t('senddlg.send')}</Button>
          </>
        )}
        {allDone && <Button onClick={onClose}>{t('senddlg.done')}</Button>}
        {hasCode && <Button variant="secondary" onClick={() => setShowCode(true)}>{t('share.show')}</Button>}
      </div>
    </Dialog>
  )
}
