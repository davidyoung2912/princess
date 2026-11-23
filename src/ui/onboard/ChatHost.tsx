import { Flag } from 'lucide-react'
import { useState } from 'react'
import type { ApiError } from '../../api/errors'
import type { ChatConversation, ChatMeetUp, HostFlagReason } from '../../api/chatTypes'
import { answerPressed, cleanMeetUpText, hasHost, hostProblem, mayAsk, mayIntroduce, MEET_ANSWERS, MEETUP_PLACE_MAX, MEETUP_TITLE_MAX, QUESTION_MAX } from '../../domain/chatHost'
import { chatChanged } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Dialog } from '../Dialog'
import { Field } from '../Field'
import { ActionError } from '../account/parts'

const REASONS: readonly HostFlagReason[] = ['spam', 'unsafe', 'rude', 'other']

/** Words for a host call that failed, or the general error when there is no sentence for it. */
function HostError({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = hostProblem(error.code, error.message)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`chost.problem.${why}` as StringKey)}</p>
}

/** Start a meet-up: a short title and an optional place. It is posted as the guest's own words, so the room's rules apply. */
function StartMeetUp({ id, onDone, onClose }: { id: string; onDone: () => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const cleanTitle = cleanMeetUpText(title, MEETUP_TITLE_MAX)
  const cleanPlace = place.trim() === '' ? undefined : cleanMeetUpText(place, MEETUP_PLACE_MAX)
  const ok = cleanTitle !== null && cleanPlace !== null
  const start = useAction(async () => {
    await api.chatRooms.startMeetUp(id, cleanTitle ?? '', cleanPlace ?? undefined)
    chatChanged()
    onDone()
  })
  return (
    <Dialog title={t('chost.start')} onClose={onClose}>
      <p className="muted">{t('chost.startBody')}</p>
      <Field label={t('chost.what')} value={title} maxLength={MEETUP_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
      <Field label={t('chost.where')} value={place} maxLength={MEETUP_PLACE_MAX} onChange={(e) => setPlace(e.target.value)} />
      {(title !== '' && cleanTitle === null) || cleanPlace === null ? <p role="alert" className="field__error">{t('chost.problem.contactInfo')}</p> : null}
      <HostError error={start.error} />
      <div className="button-row">
        <Button disabled={!ok || start.busy} onClick={() => void start.run().catch(() => undefined)}>{t('chost.startSend')}</Button>
        <Button variant="tertiary" onClick={onClose}>{t('chost.cancel')}</Button>
      </div>
    </Dialog>
  )
}

function MeetUpRow({ m, onChanged }: { m: ChatMeetUp; onChanged: () => void }) {
  const answer = useAction(async (a: (typeof MEET_ANSWERS)[number]) => { await api.chatRooms.answerMeetUp(m.id, a); onChanged() })
  return (
    <li className="recap-part">
      <p><strong>{m.title}</strong>{m.place ? <span className="muted"> · {m.place}</span> : null}</p>
      <p className="muted">{t('chost.counts', { in: m.in, maybe: m.maybe })}</p>
      <div className="button-row" role="group" aria-label={t('chost.answerFor', { title: m.title })}>
        {MEET_ANSWERS.map((a) => (
          <Button key={a} variant={answerPressed(m, a) ? 'primary' : 'secondary'} aria-pressed={answerPressed(m, a)} disabled={answer.busy} onClick={() => void answer.run(a).catch(() => undefined)}>{t(`chost.answer.${a}` as StringKey)}</Button>
        ))}
      </div>
      <HostError error={answer.error} />
    </li>
  )
}

/** Meet-ups of a room or made group, with "Start a meet-up". Answers are private: only the counts of in and maybe are shown, never who said no. */
export function MeetUps({ id }: { id: string }) {
  const [version, setVersion] = useState(0)
  const [starting, setStarting] = useState(false)
  const list = useMine(() => api.chatRooms.meetUps(id), [id, version])
  const reload = () => setVersion((v) => v + 1)
  return (
    <section aria-labelledby={`chost-m-${id}`}>
      <h4 id={`chost-m-${id}`}>{t('chost.meetUps')}</h4>
      <p className="muted">{t('chost.meetUpsBody')}</p>
      {list.data && list.data.length === 0 && <p>{t('chost.none')}</p>}
      {list.data && list.data.length > 0 && <ul className="plain-list">{list.data.map((m) => <MeetUpRow key={m.id} m={m} onChanged={reload} />)}</ul>}
      {list.status === 'error' && <p role="alert" className="field__error">{t('chost.problem.off')}</p>}
      <div className="button-row"><Button variant="secondary" onClick={() => setStarting(true)}>{t('chost.start')}</Button></div>
      {starting && <StartMeetUp id={id} onDone={() => { setStarting(false); reload() }} onClose={() => setStarting(false)} />}
    </section>
  )
}

/** "Introduce me": says plainly what is shared (first name, last initial and the one interest chosen) and that both people must ask. */
function Introduce({ id }: { id: string }) {
  const [version, setVersion] = useState(0)
  const status = useMine(() => api.chatRooms.introStatus(id), [id, version])
  const [interest, setInterest] = useState('')
  const [result, setResult] = useState<{ state: string; name?: string } | null>(null)
  const ask = useAction(async () => { setResult(await api.chatRooms.introOptIn(id, interest)); setVersion((v) => v + 1) })
  const withdraw = useAction(async () => { await api.chatRooms.introWithdraw(); setResult(null); setVersion((v) => v + 1) })
  const data = status.data
  if (!data) return null
  const introduced = result?.state === 'introduced' ? result.name : undefined
  return (
    <section aria-labelledby={`chost-i-${id}`}>
      <h4 id={`chost-i-${id}`}>{t('chost.intro')}</h4>
      <p className="muted">{t('chost.introBody')}</p>
      {introduced ? <p role="status">{t('chost.introduced', { name: introduced })}</p> : data.state === 'waiting' ? (
        <>
          <p role="status">{t('chost.introWaiting', { interest: t(`chost.interest.${data.interest ?? ''}` as StringKey) })}</p>
          <div className="button-row"><Button variant="secondary" disabled={withdraw.busy} onClick={() => void withdraw.run().catch(() => undefined)}>{t('chost.introWithdraw')}</Button></div>
        </>
      ) : (
        <>
          <fieldset>
            <legend>{t('chost.introPick')}</legend>
            <div className="chip-row">
              {data.interests.map((i) => (
                <label key={i}><input type="radio" name={`chost-int-${id}`} checked={interest === i} onChange={() => setInterest(i)} /> {t(`chost.interest.${i}` as StringKey)}</label>
              ))}
            </div>
          </fieldset>
          <div className="button-row"><Button variant="secondary" disabled={interest === '' || ask.busy} onClick={() => void ask.run().catch(() => undefined)}>{t('chost.introAsk')}</Button></div>
        </>
      )}
      <HostError error={ask.error ?? withdraw.error} />
    </section>
  )
}

/** A question Stanley can answer in a room, from his short list only. Anything else is sent to Guest Services in words shown only to the asker. */
function AskRoom({ id, topics }: { id: string; topics: string[] }) {
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<{ answered: boolean; text: string } | null>(null)
  const ask = useAction(async () => { setAnswer(await api.chatRooms.askRoom(id, text.trim())); setText(''); chatChanged() })
  return (
    <section aria-labelledby={`chost-a-${id}`}>
      <h4 id={`chost-a-${id}`}>{t('chost.ask')}</h4>
      <p className="muted">{t('chost.askBody', { topics: topics.map((x) => t(`chost.topic.${x}` as StringKey)).join(', ') })}</p>
      <Field label={t('chost.askLabel')} value={text} maxLength={QUESTION_MAX} onChange={(e) => setText(e.target.value)} />
      <div className="button-row"><Button variant="secondary" disabled={!mayAsk(text) || ask.busy} onClick={() => void ask.run().catch(() => undefined)}>{t('chost.askSend')}</Button></div>
      {answer && <p role="status">{answer.text}</p>}
      <HostError error={ask.error} />
    </section>
  )
}

/** Everything Stanley offers as host in a room or made group: the welcome and what he can answer (room), meet-ups, and "introduce me" (room). Shown in the room's details and a group's options. */
export function HostPanel({ conversation }: { conversation: ChatConversation }) {
  const welcome = useMine(() => (conversation.kind === 'room' ? api.chatRooms.welcome(conversation.id) : Promise.resolve(null)), [conversation.id, conversation.kind])
  if (!hasHost(conversation)) return null
  const w = welcome.data
  return (
    <>
      {w?.line && <p className="chost-welcome">{w.line}</p>}
      {w?.line && w.topics.length > 0 && <AskRoom id={conversation.id} topics={w.topics} />}
      <MeetUps id={conversation.id} />
      {mayIntroduce(conversation) && <Introduce id={conversation.id} />}
    </>
  )
}

/** "Flag to staff" under another person's post in a room or group. A reason from a short list; nothing happens to the post or the person until staff decide. */
export function FlagToStaff({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<HostFlagReason | ''>('')
  const [done, setDone] = useState(false)
  const flag = useAction(async () => { await api.chatRooms.flag(messageId, reason as HostFlagReason); setDone(true) })
  return (
    <>
      {done ? <p className="muted" role="status">{t('chost.flagged')}</p> : <button type="button" className="chat-act chat-act--icon" aria-label={t('chost.flag')} title={t('chost.flag')} onClick={() => setOpen(true)}><Flag aria-hidden="true" /></button>}
      {open && !done && (
        <Dialog title={t('chost.flagTitle')} onClose={() => setOpen(false)}>
          <p className="muted">{t('chost.flagBody')}</p>
          <fieldset>
            <legend>{t('chost.flagWhy')}</legend>
            {REASONS.map((r) => <label key={r}><input type="radio" name={`chost-flag-${messageId}`} checked={reason === r} onChange={() => setReason(r)} /> {t(`chost.reason.${r}` as StringKey)}</label>)}
          </fieldset>
          <HostError error={flag.error} />
          <div className="button-row">
            <Button disabled={reason === '' || flag.busy} onClick={() => void flag.run().then(() => setOpen(false)).catch(() => undefined)}>{t('chost.flagSend')}</Button>
            <Button variant="tertiary" onClick={() => setOpen(false)}>{t('chost.cancel')}</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
