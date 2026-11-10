import { useRef, useState } from 'react'
import type { ApiError } from '../../api/errors'
import type { ChatSearchHit } from '../../api/chatTypes'
import { appendHits, cleanSearch, exportFileName, exportText, groupHits, highlight, MAX_QUERY, searchProblem } from '../../domain/chatSearch'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { ActionError } from '../account/parts'
import { downloadText } from '../delights/cardTools'
import { useShipTime } from './shipTime'

/** The sentence for a search that failed, or the general error when there is no sentence for it. */
function Problem({ error }: { error: ApiError | null }) {
  if (!error) return null
  const why = searchProblem(error.code === 'network' ? 'offline' : error.code, undefined)
  return why === 'other' ? <ActionError error={error} /> : <p role="alert" className="field__error">{t(`csearch.problem.${why}` as StringKey)}</p>
}

/** A snippet with the matched words marked. The marks are drawn from plain runs of text, never from markup in the message. */
function Snippet({ text, query }: { text: string; query: string }) {
  return <>{highlight(text, query).map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>
}

/**
 * Search in the words of the guest's own chats: all of them, or (with `conversationId`) one. Only what they could already read comes back, the server decides that. A result opens its chat
 * (`onPick`). Nothing here searches Stanley's chat, channels or rooms.
 */
export function ChatSearch({ conversationId, onPick }: { conversationId?: string; onPick: (hit: ChatSearchHit) => void }) {
  const shipTime = useShipTime()
  const chats = useMine(() => (conversationId ? Promise.resolve([]) : api.chatConversations.list()), [conversationId])
  const [raw, setRaw] = useState('')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ChatSearchHit[] | null>(null)
  const [more, setMore] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const names = new Map((chats.data ?? []).map((c) => [c.id, c.name]))
  const clean = cleanSearch(raw)
  const run = useAction(async (before?: string) => {
    if (!clean) return
    const r = await api.chatConversations.search(clean, conversationId, before)
    setQuery(clean)
    setHits((cur) => (before && cur ? appendHits(cur, r.hits) : r.hits))
    setMore(r.hasMore && r.before ? r.before : null)
  })
  const inputId = `chat-search-${conversationId ?? 'all'}`
  const grouped = conversationId ? null : groupHits(hits ?? [])
  return (
    <section aria-labelledby={`${inputId}-h`}>
      <h2 id={`${inputId}-h`} className={conversationId ? 'visually-hidden' : undefined}>{conversationId ? t('csearch.inChat') : t('csearch.title')}</h2>
      {!conversationId && <p className="muted">{t('csearch.intro')}</p>}
      <form role="search" onSubmit={(e) => { e.preventDefault(); setMore(null); void run.run() }}>
        <div className="field">
          <label htmlFor={inputId}>{t('csearch.label')}</label>
          <input id={inputId} ref={input} className="field__input" type="search" enterKeyHint="search" autoComplete="off" maxLength={MAX_QUERY} value={raw} onChange={(e) => setRaw(e.target.value)} aria-describedby={`${inputId}-hint`} />
          <p id={`${inputId}-hint`} className="field__hint">{t('csearch.hint')}</p>
        </div>
        <Button type="submit" disabled={run.busy || !clean}>{t('csearch.go')}</Button>
      </form>
      <Problem error={run.error} />
      <p role="status" className="visually-hidden">{hits ? t('csearch.count', { count: hits.length }) : ''}</p>
      {hits && hits.length === 0 && !run.busy && <p>{t('csearch.none', { query })}</p>}
      {hits && hits.length > 0 && (grouped ? (
        grouped.map((g) => (
          <section key={g.conversationId} aria-label={names.get(g.conversationId) ?? t('csearch.aChat')}>
            <h3>{names.get(g.conversationId) ?? t('csearch.aChat')}</h3>
            <HitList hits={g.hits} query={query} shipTime={shipTime} onPick={onPick} />
          </section>
        ))
      ) : <HitList hits={hits} query={query} shipTime={shipTime} onPick={onPick} />)}
      {more && <Button variant="secondary" disabled={run.busy} onClick={() => void run.run(more)}>{t('csearch.more')}</Button>}
    </section>
  )
}

function HitList({ hits, query, shipTime, onPick }: { hits: ChatSearchHit[]; query: string; shipTime: (at: number) => string; onPick: (hit: ChatSearchHit) => void }) {
  return (
    <ul className="plain-list search-hits">
      {hits.map((h) => (
        <li key={h.messageId}>
          {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the label is the sender, time and snippet drawn inside */}
          <button type="button" className="conv search-hit" onClick={() => onPick(h)}>
            <span className="conv__body">
              <span className="conv__top"><strong>{h.mine ? t('chat.you') : h.fromName || t('csearch.someone')}</strong><span className="muted conv__time">{shipTime(h.at)}</span></span>
              <span className="conv__last"><Snippet text={h.text} query={query} /></span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Saves the chat the guest is reading as a plain text file on their device (their own chats only; a photo is named, never included). */
export function SaveChat({ conversationId }: { conversationId: string }) {
  const save = useAction(async () => {
    const chat = await api.chatConversations.exportChat(conversationId)
    downloadText(exportFileName(chat.name, chat.at), 'text/plain;charset=utf-8', exportText(chat))
    return chat.truncated
  })
  return (
    <>
      <div className="button-row"><Button variant="secondary" disabled={save.busy} onClick={() => void save.run()}>{t('csearch.save')}</Button></div>
      <p className="muted">{t('csearch.saveBody')}</p>
      <ActionError error={save.error} />
    </>
  )
}
