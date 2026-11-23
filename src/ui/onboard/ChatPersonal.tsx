import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Trash2 } from '../icons'
import type { ChatPerson } from '../../api/chatTypes'
import type { ApiError } from '../../api/errors'
import { cleanQuery, personAction, requestProblem } from '../../domain/chatConnections'
import { chatChanged } from '../../hooks/useChatSummary'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t, type StringKey, headingCase } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Dialog } from '../Dialog'
import { DialogHeader } from '../DialogHeader'
import { Field } from '../Field'
import { ActionError, Load } from '../account/parts'
import { ChatAvatar } from './ChatLooks'

/**
 * The New Personal Chat page: a chat between the guest and one other person. Pick someone already connected to open their chat, or find someone new by chat name
 * and ask them to chat. A personal chat has no name of its own, it is called by the other person's name like Stanley's, and it stays on both lists until
 * either person leaves it, which removes it for both.
 */
export function NewPersonalChatPage() {
  const connections = useMine(() => api.chatConnections.list())
  const nav = useNavigate()
  const [picked, setPicked] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatPerson[]>([])
  const [nobody, setNobody] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [sent, setSent] = useState<string[]>([])
  const open = (conversationId: string) => { void nav(`/chat/c/${conversationId}`) }
  const search = useAction(async () => {
    const clean = cleanQuery(query)
    if (!clean) { setSearchError(t('people.searchHint')); return }
    setSearchError('')
    const got = await api.chatConnections.search(clean)
    setNobody(got.length === 0)
    setResults(got)
  })
  const ask = useAction(async (p: ChatPerson) => {
    await api.chatConnections.request(p.id)
    setSent((s) => [...s, p.id])
    connections.retry()
    chatChanged()
  })
  const problem = ask.error ? requestProblem((ask.error as ApiError).code, (ask.error as ApiError).message) : null
  return (
    <section aria-labelledby="new-personal-h" data-tour="chat-personal">
      <h2 id="new-personal-h" className="visually-hidden">{t('cpersonal.new')}</h2>
      <Load state={connections}>
        {(c) => {
          const people = c.connected.filter((p) => p.conversationId)
          const chosen = people.find((p) => p.personId === picked)
          const conversationOf = (personId: string) => people.find((p) => p.personId === personId)?.conversationId ?? null
          return (
            <>
              <form onSubmit={(e) => { e.preventDefault(); if (chosen?.conversationId) open(chosen.conversationId) }}>
                <Card labelledBy="new-personal-people-h">
                  <h3 id="new-personal-people-h">{headingCase(t('cpersonal.pick'))}</h3>
                  {people.length === 0 ? <p className="muted">{t('cpersonal.nobody')}</p> : (
                    <fieldset className="plain-fieldset">
                      <legend>{t('cpersonal.legend')}</legend>
                      {people.map((p) => (
                        <label key={p.personId} className="choice">
                          <input type="radio" name="personal-chat-with" checked={picked === p.personId} onChange={() => setPicked(p.personId)} />
                          <span className="person-line"><ChatAvatar avatar={p.avatar} name={p.name} small /><span>{p.name}</span></span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {people.length > 0 && <Button type="submit" disabled={!chosen}>{chosen ? t('cpersonal.go', { name: chosen.name }) : t('cpersonal.goNone')}</Button>}
                </Card>
              </form>
              <Card labelledBy="new-personal-find-h">
                <h3 id="new-personal-find-h">{headingCase(t('cpersonal.findTitle'))}</h3>
                <p className="muted">{t('cpersonal.findBody')}</p>
                <Field label={t('people.search')} value={query} maxLength={254} autoComplete="off" error={searchError || undefined} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search.run() } }} />
                <Button type="button" disabled={search.busy} onClick={() => void search.run()}>{t('cgroup.findGo')}</Button>
                <ActionError error={search.error} />
                {nobody && <p className="muted">{t('cgroup.findNone')}</p>}
                {results.length > 0 && (
                  <ul className="plain-list">
                    {results.map((p) => {
                      const action = personAction(p.relation)
                      const conversation = conversationOf(p.id)
                      const done = sent.includes(p.id)
                      return (
                        <li key={p.id}>
                          <span className="person-line"><ChatAvatar avatar={p.avatar} name={p.name} small /><strong>{p.name}</strong></span>
                          {done ? <span className="muted" role="status">{t('cpersonal.sent')}</span>
                            : action === 'ask' ? <Button type="button" variant="secondary" disabled={ask.busy} onClick={() => void ask.run(p).catch(() => undefined)}>{t('cpersonal.ask')}<span className="visually-hidden"> {p.name}</span></Button>
                            : action === 'open' && conversation ? <Button type="button" variant="secondary" onClick={() => open(conversation)}>{t('cpersonal.open')}<span className="visually-hidden"> {p.name}</span></Button>
                            : <span className="muted">{t(`cpersonal.rel.${p.relation}` as StringKey)}</span>}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {problem && (problem === 'other' ? <ActionError error={ask.error} /> : <p role="alert" className="field__error">{t(`cpersonal.problem.${problem}` as StringKey)}</p>)}
                <p className="muted personal-note">{t('cpersonal.askNote')}</p>
              </Card>
            </>
          )
        }}
      </Load>
    </section>
  )
}

/**
 * Leaving a personal chat. Either person can: the chat is deleted for both, the other is told at once and it leaves both lists.
 * Needs the connection the chat belongs to, found from the guest's connections by the conversation.
 */
export function LeavePersonalChat({ conversationId, name, onLeft }: { conversationId: string; name: string; onLeft: () => void }) {
  const [asking, setAsking] = useState(false)
  const connections = useMine(() => api.chatConnections.list())
  const connection = connections.data?.connected.find((c) => c.conversationId === conversationId)
  const leave = useAction(async () => {
    if (!connection) return
    await api.chatConnections.end(connection.id)
    chatChanged()
    onLeft()
  })
  if (!connection) return null
  const close = () => setAsking(false)
  return (
    <>
      <Button variant="tertiary" icon={Trash2} onClick={() => setAsking(true)}>{t('cpersonal.leave')}</Button>
      {asking && (
        <Dialog title={t('cpersonal.leave.title')} onClose={close} header={(titleId) => <DialogHeader titleId={titleId} title={t('cpersonal.leave.title')} subtext={name} icon={Trash2} onClose={close} />}>
          <p>{t('cpersonal.leave.body', { name })}</p>
          {leave.error && <p role="alert" className="field__error">{t('cpersonal.leave.failed')}</p>}
          <div className="button-row">
            <Button disabled={leave.busy} onClick={() => void leave.run().catch(() => undefined)}>{t('cpersonal.leave.yes')}</Button>
            <Button variant="secondary" onClick={close}>{t('cpersonal.leave.no')}</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
