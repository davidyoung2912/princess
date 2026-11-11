import { createContext, useContext, useState } from 'react'
import type { ApiError } from '../../api/errors'
import type { ChatCatchUp, ChatMessage, ChatPlanPreview, ChatStanleyTap, ChatTerm } from '../../api/chatTypes'
import { newClientId } from '../../domain/chatThread'
import { canDraft, catchUpAnnouncement, isAskStanley, cleanMinutes, hasHighlights, LATE_MAX, LATE_MIN, mayHelpWith, PLACE_MAX, stanleyProblem, TIME_MAX } from '../../domain/chatStanley'
import { useAction } from '../../hooks/useAction'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { ActionError } from '../account/parts'
import { useShipTime } from './shipTime'

/** Whether Stanley's help is on in the open conversation. The thread asks the server once and every message reads it from here. */
const TapContext = createContext<ChatStanleyTap | undefined>(undefined)
export const StanleyTapProvider = TapContext.Provider

/** The sentence for a refusal or failure, or the general error when there is no sentence for it. */
function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = stanleyProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`cst.problem.${why}` as StringKey)}</p>
}

/** A short list of quotes under a heading; nothing is drawn when there are none. */
function Quotes({ title, lines }: { title: string; lines: readonly string[] }) {
  if (lines.length === 0) return null
  return (
    <>
      <h3>{title}</h3>
      <ul className="cst-list">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </>
  )
}

/**
 * "Catch me up", shown in a busy thread. The summary opens in a dialog and is private to the person who asked: it is never posted. It says what looks decided, what looks open and the latest lines, as short quotes.
 */
export function CatchUpButton({ conversationId }: { conversationId: string }) {
  const shipTime = useShipTime()
  const [result, setResult] = useState<ChatCatchUp | null>(null)
  const ask = useAction(async () => { setResult(await api.chatConversations.catchUp(conversationId)) })
  return (
    <>
      <Button variant="secondary" disabled={ask.busy} onClick={() => void ask.run()}>{t('cst.catchUp')}</Button>
      <Problem error={ask.error} />
      {result && (
        <Dialog title={t('cst.catchUp')} onClose={() => setResult(null)}>
          <p role="status" className="visually-hidden">{catchUpAnnouncement(result)}</p>
          <p><strong>{result.label}</strong></p>
          <p className="muted">{t('cst.private')} {t('cst.read', { count: result.messages, time: shipTime(result.since) })}</p>
          {!hasHighlights(result) && <p>{t('cst.nothing')}</p>}
          <Quotes title={t('cst.decided')} lines={result.decided} />
          <Quotes title={t('cst.open')} lines={result.open} />
          <Quotes title={t('cst.latest')} lines={result.latest} />
        </Dialog>
      )}
    </>
  )
}

/** The standing notice that anyone here can ask Stanley for a summary, and the creator's switch for it. Nothing is drawn where his help is not offered for a reason the guest cannot change. */
export function StanleyTapNote({ conversationId, tap, onChanged }: { conversationId: string; tap: ChatStanleyTap | undefined; onChanged: (next: ChatStanleyTap) => void }) {
  const flip = useAction(async (off: boolean) => { onChanged(await api.chatConversations.setStanleyOff(conversationId, off)) })
  const hide = useAction(async (muted: boolean) => { onChanged(await api.chatConversations.setStanleyMuted(conversationId, muted)) })
  if (!tap || tap.reason === 'kind') return null
  return (
    <>
      <p className="muted" role="note">{tap.available ? t('cst.notice') : t(tap.reason === 'child' ? 'cst.childNote' : 'cst.offNote')}</p>
      {tap.available && <p className="muted" role="note">{t('cst.askNote')}</p>}
      {tap.available && (
        <>
          <div className="button-row"><Button variant="secondary" disabled={hide.busy} onClick={() => void hide.run(tap.muted !== true)}>{t(tap.muted ? 'cst.unmute' : 'cst.mute')}</Button></div>
          <p className="muted">{t('cst.muteBody')}</p>
          <ActionError error={hide.error} />
        </>
      )}
      {tap.canSwitch && (
        <>
          <div className="button-row"><Button variant="secondary" disabled={flip.busy} onClick={() => void flip.run(!tap.off)}>{t(tap.off ? 'cst.switchOn' : 'cst.switchOff')}</Button></div>
          <p className="muted">{t('cst.switchBody')}</p>
          <ActionError error={flip.error} />
        </>
      )}
    </>
  )
}

/** The poll Stanley made from one message. It is posted only when the guest chooses, through the ordinary poll route. */
function PlanDialog({ conversationId, preview, onPosted, onClose }: { conversationId: string; preview: ChatPlanPreview; onPosted: () => void; onClose: () => void }) {
  const post = useAction(async () => {
    await api.chatConversations.sendTyped(conversationId, { kind: 'poll', question: preview.question, options: preview.options }, newClientId())
    onPosted()
    onClose()
  })
  return (
    <Dialog title={t('cst.plan')} onClose={onClose}>
      <p>{t('cst.planBody')}</p>
      <p><strong>{preview.question}</strong></p>
      <ul className="cst-list">{preview.options.map((o) => <li key={o}>{o}</li>)}</ul>
      <div className="button-row">
        <Button disabled={post.busy} onClick={() => void post.run()}>{t('cst.planPost')}</Button>
        <Button variant="secondary" onClick={onClose}>{t('cst.notNow')}</Button>
      </div>
      {post.error && <p role="alert" className="field__error">{t(post.error.message === 'blocked' ? 'conv.blocked' : 'conv.failed')}</p>}
    </Dialog>
  )
}

/** The cruise words in one message, in plain words. */
function WordsDialog({ terms, onClose }: { terms: readonly ChatTerm[]; onClose: () => void }) {
  return (
    <Dialog title={t('cst.wordsTitle')} onClose={onClose}>
      {terms.length === 0 ? <p>{t('cst.wordsNone')}</p> : (
        <dl>{terms.map((x) => <div key={x.word}><dt><strong>{x.word}</strong></dt><dd>{x.meaning}</dd></div>)}</dl>
      )}
    </Dialog>
  )
}

/**
 * "Make this a plan" and "What does this mean?" under a plain message. Both are private until the guest posts the poll. Nothing is drawn when Stanley's help is off in this conversation or the message is not plain text.
 */
export function StanleyMessageActions({ conversationId, message, onPosted }: { conversationId: string; message: ChatMessage; onPosted: () => void }) {
  const tap = useContext(TapContext)
  const [preview, setPreview] = useState<ChatPlanPreview | null>(null)
  const [terms, setTerms] = useState<ChatTerm[] | null>(null)
  const plan = useAction(async () => { setPreview(await api.chatConversations.makePlan(conversationId, message.id)) })
  const words = useAction(async () => { setTerms(await api.chatConversations.explainWords(conversationId, message.id)) })
  if (!mayHelpWith(tap, message)) return null
  return (
    <>
      <button type="button" className="chat-act" disabled={plan.busy} onClick={() => void plan.run()}>{t('cst.plan')}</button>
      <button type="button" className="chat-act" disabled={words.busy} onClick={() => void words.run()}>{t('cst.words')}</button>
      {(plan.error || words.error) && <span className="chat-act__problem"><Problem error={plan.error ?? words.error} /></span>}
      {preview && <PlanDialog conversationId={conversationId} preview={preview} onPosted={onPosted} onClose={() => setPreview(null)} />}
      {terms && <WordsDialog terms={terms} onClose={() => setTerms(null)} />}
    </>
  )
}

/**
 * "Help me write": the guest says what they need (running late, or asking to meet) and Stanley puts a short draft in the message box. Nothing is sent: the guest changes it and sends it themselves.
 */
export function HelpMeWrite({ onUse }: { onUse: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'late' | 'meet'>('late')
  const [minutes, setMinutes] = useState('')
  const [place, setPlace] = useState('')
  const [time, setTime] = useState('')
  const [added, setAdded] = useState(false)
  const write = useAction(async () => {
    const text = await api.chatConversations.draftMessage({
      kind,
      ...(kind === 'late' && cleanMinutes(minutes) !== undefined ? { minutes: cleanMinutes(minutes) } : {}),
      ...(place.trim() ? { place: place.trim() } : {}),
      ...(kind === 'meet' && time.trim() ? { time: time.trim() } : {}),
    })
    onUse(text)
    setAdded(true)
    setOpen(false)
  })
  return (
    <>
      <Button type="button" variant="tertiary" onClick={() => { setAdded(false); setOpen(true) }}>{t('cst.draft')}</Button>
      <p role="status" className="visually-hidden">{added ? t('cst.draftAdded') : ''}</p>
      {open && (
        <Dialog title={t('cst.draft')} onClose={() => setOpen(false)}>
          <p>{t('cst.draftBody')}</p>
          <fieldset>
            <legend>{t('cst.draftKind')}</legend>
            <label><input type="radio" name="cst-kind" checked={kind === 'late'} onChange={() => setKind('late')} /> {t('cst.draftLate')}</label>
            <label><input type="radio" name="cst-kind" checked={kind === 'meet'} onChange={() => setKind('meet')} /> {t('cst.draftMeet')}</label>
          </fieldset>
          {kind === 'late' && <Field label={t('cst.draftMinutes', { min: LATE_MIN, max: LATE_MAX })} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} maxLength={3} />}
          <Field label={t(kind === 'meet' ? 'cst.draftPlaceMeet' : 'cst.draftPlace')} value={place} onChange={(e) => setPlace(e.target.value)} maxLength={PLACE_MAX} autoComplete="off" />
          {kind === 'meet' && <Field label={t('cst.draftTime')} hint={t('cst.draftTimeHint')} value={time} onChange={(e) => setTime(e.target.value)} maxLength={TIME_MAX} autoComplete="off" />}
          <div className="button-row">
            <Button disabled={write.busy || !canDraft(kind, minutes, place)} onClick={() => void write.run()}>{t('cst.draftGo')}</Button>
          </div>
          <Problem error={write.error} />
        </Dialog>
      )}
    </>
  )
}

/**
 * "Ask Stanley" beside the message box: puts his name at the front of the message so the guest sees exactly what will go to him. Nothing is sent by it. When the message already starts with his name, a note says what will happen:
 * everyone in the chat sees his answer, and he sees the question and the last few messages.
 */
export function AskStanleyButton({ onAsk }: { onAsk: () => void }) {
  const tap = useContext(TapContext)
  if (tap?.available !== true) return null
  return <Button type="button" variant="tertiary" onClick={onAsk}>{t('cst.ask')}</Button>
}

export function AskStanleyNote({ text }: { text: string }) {
  const tap = useContext(TapContext)
  if (tap?.available !== true || !isAskStanley(text)) return null
  return <p className="muted" role="note">{t('cst.askWill')}</p>
}
