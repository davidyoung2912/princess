import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatPlannable, ChatTally } from '../../../shared/api/chatTypes'
import { isApiError } from '../../../shared/api/errors'
import { newClientId } from '../domain/chatThread'
import { BOARD_MAX_ITEMS, applyBoardToggle, boardAdds, boardIn, boardItemWords, cleanBoardDraft } from '../domain/chatBoards'
import { bundleLink } from '../domain/chatBundles'
import { eventsOnDay, planDays } from '../domain/chatPlanning'
import { clock12 } from '../../../domain/planCard'
import { useAction } from '../../../shared/hooks/useAction'
import { sendWithin } from '../../../shared/hooks/useOutbox'
import { api } from '../../../app/runtime'
import { t, headingCase, type StringKey } from '../../../shared/i18n'
import { Button, LinkButton } from '../../../shared/ui/Button'

const inCount = (n: number): string => t('cboard.in', { count: n })

/**
 * Phase B6: a day board. One day, up to eight things from the app, each with an "I'm in" toggle and how many are in. Clashes with your own plans are marked for you alone. Add to my day puts the programme events
 * (all of them, or just the ones you are in for) on your own day; a tour or a dinner is opened to book on its own screen, and nothing here books, pays or changes anyone else's day.
 */
export function BoardMessage({ conversationId, message, canAct, onChanged }: { conversationId: string; message: ChatMessage; canAct: boolean; onChanged: () => void }) {
  const board = message.board!
  const [tally, setTally] = useState<ChatTally | undefined>(message.tally)
  const seen = useRef(message.tally)
  useEffect(() => { if (message.tally !== seen.current) { seen.current = message.tally; setTally(message.tally) } }, [message.tally])
  const [announce, setAnnounce] = useState('')
  const toggle = useAction(async (item: number, on: boolean) => {
    const before = tally
    if (before) setTally(applyBoardToggle(before, item, on))
    try {
      setTally(await sendWithin(api.chatConversations.boardIn(conversationId, message.id, item, on)))
      setAnnounce(t(on ? 'cboard.announce.in' : 'cboard.announce.out', { title: board.items[item]?.title ?? '' }))
    } catch (e) {
      setTally(before)
      if (isApiError(e) && e.code === 'conflict') onChanged()
      throw e
    }
  })
  const added = useAction(async (onlyIn: boolean) => {
    const adds = boardAdds(board.items, tally, onlyIn)
    for (const a of adds) await api.onboard.togglePlanOn(a.eventId, a.day, true)
    setAnnounce(t('cboard.added', { count: adds.length }))
  })
  const mayAddAll = boardAdds(board.items, tally, false).length > 0
  const mayAddMine = boardAdds(board.items, tally, true).length > 0
  return (
    <div className="chat-board" role="group" aria-label={t('cboard.label', { day: board.day })}>
      <p><strong>{t('cboard.heading', { day: board.day })}</strong></p>
      <ul className="chat-board__items">
        {board.items.map((b, i) => {
          if (!b) return <li key={i} className="muted">{t('cpoll.gone')}</li>
          const mine = boardIn(tally, i)
          const link = bundleLink(b)
          const when = [b.time ? clock12(b.time) : '', b.place && b.place !== b.title ? b.place : ''].filter(Boolean).join(' · ')
          return (
            <li key={i} className="chat-board__item">
              <span><strong>{b.title}</strong>{when && <span className="muted"> · {when}</span>}</span>
              {board.clashes?.includes(i) && <span className="chat-poll__clash"> ({t('cpoll.clash')})</span>}
              <span className="chat-board__row">
                <Button variant={mine ? 'primary' : 'secondary'} aria-pressed={mine} disabled={!canAct || toggle.busy} aria-label={t('cboard.toggle', { title: b.title })} onClick={() => void toggle.run(i, !mine)}>{t('cboard.imIn')}</Button>
                <span className="muted" aria-label={boardItemWords(tally?.counts[i] ?? 0, mine, { count: inCount, yours: t('cboard.yours') })}>{inCount(tally?.counts[i] ?? 0)}</span>
                {link && <LinkButton to={link} variant="tertiary" aria-label={t('cpoll.open.label', { title: b.title })}>{t('card.open')}</LinkButton>}
              </span>
            </li>
          )
        })}
      </ul>
      {(mayAddAll || mayAddMine) && (
        <p className="chat-poll__decision-actions">
          {mayAddMine && <Button variant="secondary" disabled={added.busy} onClick={() => void added.run(true)}>{t('cboard.addMine')}</Button>}
          {mayAddAll && <Button variant="secondary" disabled={added.busy} onClick={() => void added.run(false)}>{t('cboard.addAll')}</Button>}
        </p>
      )}
      <p role="status" className="visually-hidden">{announce}</p>
      {(toggle.error || added.error) && <p role="alert" className="field__error">{t(toggle.error ? 'cboard.failed' : 'cpoll.decide.dayFailed')}</p>}
    </div>
  )
}

function boardError(e: unknown): StringKey {
  if (isApiError(e) && e.message === 'board') return 'cplan.stale'
  if (isApiError(e) && e.message === 'announcementOnly') return 'announce.only'
  if (isApiError(e) && e.code === 'conflict') return 'conv.closed'
  return 'conv.share.failed'
}

/** The form for a day board: a day of the trip and the programme events that run that day on your own sailing (up to eight). */
export function BoardForm({ conversationId, events, onSent }: { conversationId: string; events: readonly ChatPlannable[]; onSent: (sent: ChatMessage) => void }) {
  const days = planDays(events)
  const [day, setDay] = useState<number>(days[0] ?? 1)
  const [picked, setPicked] = useState<string[]>([])
  const [announce, setAnnounce] = useState('')
  const onDay = eventsOnDay(events, day)
  const draft = cleanBoardDraft(day, picked)
  const send = useAction(async () => {
    if (!draft) return
    const sent = await api.chatConversations.sendTyped(conversationId, { kind: 'board', day: draft.day, optionRefs: draft.refs.map((r) => `event:${r}`) }, newClientId())
    setPicked([])
    setAnnounce(t('cboard.sent'))
    onSent(sent)
  })
  if (events.length === 0) return null
  return (
    <form onSubmit={(e) => { e.preventDefault(); void send.run() }}>
      <h3>{headingCase(t('cboard.form.heading'))}</h3>
      <p className="muted">{t('cboard.form.hint', { max: BOARD_MAX_ITEMS })}</p>
      <p role="status" className="visually-hidden">{announce}</p>
      <div className="field">
        <label htmlFor="board-day">{t('cplan.day')}</label>
        <select id="board-day" value={day} onChange={(e) => { setDay(Number(e.target.value)); setPicked([]) }}>
          {days.map((d) => <option key={d} value={d}>{t('card.day', { day: d })}</option>)}
        </select>
      </div>
      <fieldset>
        <legend>{t('cboard.form.things')}</legend>
        {onDay.map((e) => {
          const on = picked.includes(e.ref)
          return (
            <label key={e.ref} className="chat-board__pick">
              <input type="checkbox" checked={on} disabled={!on && picked.length >= BOARD_MAX_ITEMS} onChange={() => setPicked((cur) => (on ? cur.filter((r) => r !== e.ref) : [...cur, e.ref]))} />
              {' '}{clock12(e.time)} {e.title}{e.place ? ` (${e.place})` : ''}
            </label>
          )
        })}
      </fieldset>
      <Button type="submit" disabled={send.busy || !draft}>{t('cboard.form.send')}</Button>
      {send.error && <p role="alert" className="field__error">{t(boardError(send.error))}</p>}
    </form>
  )
}
