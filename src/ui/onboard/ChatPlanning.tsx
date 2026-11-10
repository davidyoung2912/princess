import { useEffect, useRef, useState } from 'react'
import type { ChatConversation, ChatMessage, ChatPlannable, ChatRsvp, ChatTally } from '../../api/chatTypes'
import { isApiError } from '../../api/errors'
import { newClientId } from '../../domain/chatThread'
import {
  OPTION_MAX, QUESTION_MAX, RSVP_CHOICES, answerJob, applyRsvp, applyVote, canAddOption, cleanPollDraft, eventsOnDay, isPollClosed, leaders, percentOf, planDays, pollResultText, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, rsvpOf, totalVotes, withHeld,
} from '../../domain/chatPlanning'
import { cleanNote, NOTE_MAX } from '../../domain/chatCards'
import { clock12 } from '../../domain/planCard'
import { useAction } from '../../hooks/useAction'
import { sendWithin, worthRetrying } from '../../hooks/useOutbox'
import { useNow } from '../../hooks/useDemo'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { useShipTime } from './shipTime'

const votes = (n: number): string => t('cpoll.votes', { count: n })

const RSVP_KEY: Record<ChatRsvp, StringKey> = { going: 'cplan.going', maybe: 'cplan.maybe', no: 'cplan.no' }

/** The tally on the message, kept in step with the thread: a fresh copy from the server replaces ours, and our own tap shows at once. */
function useTally(initial: ChatTally | undefined): [ChatTally | undefined, (next: ChatTally | undefined) => void] {
  const [tally, setTally] = useState(initial)
  const seen = useRef(initial)
  useEffect(() => {
    if (initial !== seen.current) { seen.current = initial; setTally(initial) }
  }, [initial])
  return [tally, setTally]
}

/**
 * A poll (phase 4): the question and each option as a radio button with its votes and share. A vote can be changed until the poll closes; the counts are announced to a screen reader as one sentence, and the answers are
 * counted, never named. The person who asked it, or an admin, can close it early. It stops taking votes by itself 24 hours after it was sent.
 */
export function PollMessage({ conversationId, message, canAct, onChanged, held, onHold }: { conversationId: string; message: ChatMessage; canAct: boolean; onChanged: () => void; held?: string; onHold?: (job: Record<string, string>) => boolean }) {
  const poll = message.poll!
  const now = useNow()
  const shipTime = useShipTime()
  const [base, setTally] = useTally(message.tally)
  const tally = withHeld(base, held === undefined ? undefined : { kind: 'vote', value: held })
  const [announce, setAnnounce] = useState('')
  const words = { votes, yours: (option: string) => t('cpoll.yours', { option }), closed: t('cpoll.closed'), open: t('cpoll.open') }
  const vote = useAction(async (option: number) => {
    const before = base
    if (before) setTally(applyVote(before, option))
    try {
      const next = await sendWithin(api.chatConversations.vote(conversationId, message.id, option))
      setTally(next)
      setAnnounce(t('cpoll.announce', { result: pollResultText(poll, next, words) }))
    } catch (e) {
      setTally(before)
      // Without signal the vote is kept and sent when the phone is back; the server still decides whether the poll is open then.
      if (worthRetrying(e) && onHold?.(answerJob(conversationId, message.id, 'vote', String(option)))) { setAnnounce(t('cpoll.queued')); return }
      if (isApiError(e) && e.message === 'pollClosed') onChanged()
      throw e
    }
  })
  const close = useAction(async () => { setTally(await api.chatConversations.closePoll(conversationId, message.id)); onChanged() })
  if (!tally) return <p>{poll.question}</p>
  const closed = isPollClosed(tally, now)
  const total = totalVotes(tally.counts)
  const winners = closed ? leaders(tally.counts) : []
  const name = `poll-${message.id}`
  return (
    <fieldset className="chat-poll" disabled={!canAct || closed || vote.busy}>
      <legend><span className="chat-card__type"><strong>{t('cpoll.type')}</strong></span> {poll.question}</legend>
      <ul className="chat-poll__options">
        {poll.options.map((option, i) => {
          const count = tally.counts[i] ?? 0
          const share = percentOf(count, total)
          return (
            <li key={option} className={winners.includes(i) ? 'chat-poll__option chat-poll__option--won' : 'chat-poll__option'}>
              <label>
                <input type="radio" name={name} checked={tally.mine === i} onChange={() => void vote.run(i)} />
                <span className="chat-poll__text">{option}</span>
                <span className="muted chat-poll__count">{votes(count)} · {share}%</span>
              </label>
              <span className="chat-poll__bar" aria-hidden="true"><span style={{ inlineSize: `${share}%` }} /></span>
            </li>
          )
        })}
      </ul>
      <p className="muted">
        {closed ? t('cpoll.closed') : tally.closesAt !== undefined ? t('cpoll.closesAt', { time: shipTime(tally.closesAt) }) : t('cpoll.open')}
        {closed && <> · {winners.length === 0 ? t('cpoll.noVotes') : t('cpoll.winner', { options: winners.map((i) => poll.options[i]).join(', ') })}</>}
      </p>
      <p role="status" className="visually-hidden">{announce}</p>
      {tally.mayClose && !closed && (
        <Button variant="secondary" disabled={close.busy} aria-label={t('cpoll.close.label', { question: poll.question })} onClick={() => void close.run()}>{t('cpoll.close')}</Button>
      )}
      {vote.error && <p role="alert" className="field__error">{t(vote.error.message === 'pollClosed' ? 'cpoll.isClosed' : 'cpoll.failed')}</p>}
      {close.error && <p role="alert" className="field__error">{t('cpoll.closeFailed')}</p>}
    </fieldset>
  )
}

/**
 * A plan (phase 4): an event, the day and time, and who is going. Going, Maybe and Can't go are toggle buttons; Going puts the event on your own plan for that day when your trip runs it, and a later answer takes it off again
 * if the plan put it there. The counts and the names of those going are read as a sentence.
 */
export function PlanMessage({ conversationId, message, canAct, held, onHold }: { conversationId: string; message: ChatMessage; canAct: boolean; held?: string; onHold?: (job: Record<string, string>) => boolean }) {
  const card = message.card!
  const [base, setTally] = useTally(message.tally)
  const tally = withHeld(base, held === undefined ? undefined : { kind: 'rsvp', value: held })
  const [announce, setAnnounce] = useState('')
  const answer = useAction(async (choice: ChatRsvp) => {
    const before = base
    if (before) setTally(applyRsvp(before, choice))
    try {
      const next = await sendWithin(api.chatConversations.rsvp(conversationId, message.id, choice))
      setTally(next)
      setAnnounce(t('cplan.announce', { answer: t(RSVP_KEY[choice]) }))
    } catch (e) {
      setTally(before)
      if (worthRetrying(e) && onHold?.(answerJob(conversationId, message.id, 'rsvp', choice))) { setAnnounce(t('cplan.queued')); return }
      throw e
    }
  })
  const when = [card.day !== undefined ? t('card.day', { day: card.day }) : '', card.time ? clock12(card.time) : ''].filter(Boolean).join(', ')
  const mine = rsvpOf(tally?.mine)
  return (
    <div className="chat-card chat-card--plan" role="group" aria-label={`${t('card.type.plan')}: ${card.title}`}>
      <p className="chat-card__type"><strong>{t('card.type.plan')}</strong></p>
      <p className="chat-card__title">{card.title}</p>
      {when && <p>{when}</p>}
      {card.place && <p>{card.place}</p>}
      {card.note && <p>{card.note}</p>}
      {tally && (
        <>
          <div role="group" aria-label={t('cplan.answer')} className="chat-rsvp">
            {RSVP_CHOICES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={mine === c} disabled={!canAct || answer.busy} onClick={() => { if (mine !== c) void answer.run(c) }}>{t(RSVP_KEY[c])}</button>
            ))}
          </div>
          <p className="muted">{t('cplan.counts', { going: tally.counts[0] ?? 0, maybe: tally.counts[1] ?? 0, no: tally.counts[2] ?? 0 })}</p>
          {tally.going && tally.going.length > 0 && <p className="muted">{t('cplan.goingNames', { names: tally.going.join(', ') })}</p>}
          {tally.addedToPlan && mine === 'going' && <p role="status">{t('cplan.added')}</p>}
        </>
      )}
      <p role="status" className="visually-hidden">{announce}</p>
      {answer.error && <p role="alert" className="field__error">{t('cplan.failed')}</p>}
    </div>
  )
}

/** The words for a poll or plan that could not be sent. */
function planningError(e: unknown): StringKey {
  if (!isApiError(e)) return 'conv.share.failed'
  if (e.message === 'shareRef') return 'cplan.stale'
  if (e.message === 'blocked') return 'conv.blocked'
  if (e.message === 'contactInfo') return 'conv.contact'
  if (e.message === 'announcementOnly') return 'announce.only'
  if (e.code === 'conflict') return 'conv.closed'
  return 'conv.share.failed'
}

/** The form for a poll: a question and two to five options, one row each. An empty row is left out; the Ask button stays off until the poll could be sent. */
function PollForm({ conversationId, onSent }: { conversationId: string; onSent: (sent: ChatMessage) => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [announce, setAnnounce] = useState('')
  const draft = cleanPollDraft(question, options)
  const ask = useAction(async () => {
    if (!draft) return
    const sent = await api.chatConversations.sendTyped(conversationId, { kind: 'poll', question: draft.question, options: draft.options }, newClientId())
    setQuestion('')
    setOptions(['', ''])
    setAnnounce(t('cpoll.sent'))
    onSent(sent)
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); void ask.run() }}>
      <h3>{t('cpoll.heading')}</h3>
      <p className="muted">{t('cpoll.hint')}</p>
      <p role="status" className="visually-hidden">{announce}</p>
      <div className="field">
        <label htmlFor="poll-question">{t('cpoll.question')}</label>
        <input id="poll-question" type="text" value={question} maxLength={QUESTION_MAX} autoComplete="off" onChange={(e) => setQuestion(e.target.value)} />
      </div>
      {options.map((value, i) => (
        <div key={i} className="field chat-poll__row">
          <label htmlFor={`poll-option-${i}`}>{t('cpoll.option', { n: i + 1 })}</label>
          <input id={`poll-option-${i}`} type="text" value={value} maxLength={OPTION_MAX} autoComplete="off" onChange={(e) => setOptions((cur) => cur.map((o, j) => (j === i ? e.target.value : o)))} />
          {options.length > POLL_MIN_OPTIONS && <button type="button" className="chat-act" aria-label={t('cpoll.removeOption', { n: i + 1 })} onClick={() => setOptions((cur) => cur.filter((_, j) => j !== i))}>{t('cgroup.remove')}</button>}
        </div>
      ))}
      {canAddOption(options.length) && options.length < POLL_MAX_OPTIONS && <Button type="button" variant="tertiary" onClick={() => setOptions((cur) => [...cur, ''])}>{t('cpoll.addOption')}</Button>}
      <Button type="submit" disabled={ask.busy || !draft}>{t('cpoll.ask')}</Button>
      {ask.error && <p role="alert" className="field__error">{t(planningError(ask.error))}</p>}
    </form>
  )
}

/** The form for a plan: a day of the trip, an event that runs that day on your own sailing, and a short note. */
function PlanForm({ conversationId, events, onSent }: { conversationId: string; events: readonly ChatPlannable[]; onSent: (sent: ChatMessage) => void }) {
  const days = planDays(events)
  const [day, setDay] = useState<number>(days[0] ?? 1)
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [announce, setAnnounce] = useState('')
  const onDay = eventsOnDay(events, day)
  const send = useAction(async () => {
    if (!ref) return
    const sent = await api.chatConversations.sendTyped(conversationId, { kind: 'plan', shareRef: ref, ...(cleanNote(note) ? { note: cleanNote(note) } : {}) }, newClientId())
    setRef('')
    setNote('')
    setAnnounce(t('cplan.sent'))
    onSent(sent)
  })
  if (events.length === 0) return <p className="muted">{t('cplan.none')}</p>
  return (
    <form onSubmit={(e) => { e.preventDefault(); void send.run() }}>
      <h3>{t('cplan.heading')}</h3>
      <p role="status" className="visually-hidden">{announce}</p>
      <div className="field">
        <label htmlFor="plan-day">{t('cplan.day')}</label>
        <select id="plan-day" value={day} onChange={(e) => { setDay(Number(e.target.value)); setRef('') }}>
          {days.map((d) => <option key={d} value={d}>{t('card.day', { day: d })}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="plan-event">{t('cplan.event')}</label>
        <select id="plan-event" value={ref} onChange={(e) => setRef(e.target.value)}>
          <option value="">{t('cplan.event.choose')}</option>
          {onDay.map((e) => <option key={e.ref} value={e.ref}>{clock12(e.time)} {e.title}{e.place ? ` (${e.place})` : ''}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="plan-note">{t('cplan.note')}</label>
        <input id="plan-note" type="text" value={note} maxLength={NOTE_MAX} autoComplete="off" onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" disabled={send.busy || !ref}>{t('cplan.send')}</Button>
      {send.error && <p role="alert" className="field__error">{t(planningError(send.error))}</p>}
    </form>
  )
}

/**
 * "Plan with the group" under the composer: a poll form and a plan form in one place. The plan form asks the server which programme events the guest's own trip runs the first time it is opened; a poll needs nothing from the server.
 * Hidden in a group where only admins post and the guest is not one.
 */
export function PlanTools({ conversation, onSent }: { conversation: ChatConversation; onSent: (sent: ChatMessage) => void }) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<ChatPlannable[] | null>(null)
  const [failed, setFailed] = useState(false)
  const asked = useRef(false)
  useEffect(() => {
    if (!open || asked.current) return
    asked.current = true
    api.chatConversations.shareable().then((d) => setEvents(d.events ?? []), () => { asked.current = false; setFailed(true) })
  }, [open])
  return (
    <details className="chat-share chat-plan-tools" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('cplan.tools')}</summary>
      <p className="muted">{t('cplan.tools.hint')}</p>
      <PollForm conversationId={conversation.id} onSent={onSent} />
      {open && !events && !failed && <p role="status" className="muted">{t('conv.share.loading')}</p>}
      {failed && <p role="alert" className="field__error">{t('conv.share.failed')}</p>}
      {events && <PlanForm conversationId={conversation.id} events={events} onSent={onSent} />}
    </details>
  )
}
