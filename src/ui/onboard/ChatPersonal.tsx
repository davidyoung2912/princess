import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMine } from '../../hooks/useMine'
import { api } from '../../runtime'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { ChatAvatar } from './ChatLooks'

/**
 * The New Personal Chat page: pick one person the guest already chats with and open the chat between the two of them. There is no name to give it: a
 * personal chat is called by the other person's name, like Stanley's. To chat with someone new, the guest first connects with them on the People page.
 */
export function NewPersonalChatPage() {
  const connections = useMine(() => api.chatConnections.list())
  const nav = useNavigate()
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <section aria-labelledby="new-personal-h" data-tour="chat-personal">
      <h2 id="new-personal-h" className="visually-hidden">{t('cpersonal.new')}</h2>
      <Load state={connections}>
        {(c) => {
          const people = c.connected.filter((p) => p.conversationId)
          const chosen = people.find((p) => p.personId === picked)
          return (
            <form onSubmit={(e) => { e.preventDefault(); if (chosen?.conversationId) void nav(`/chat/c/${chosen.conversationId}`) }}>
              <Card labelledBy="new-personal-people-h">
                <h3 id="new-personal-people-h">{t('cpersonal.pick')}</h3>
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
                <p className="muted">{t('cpersonal.findNew')} <Link to="/chat/people">{t('cpersonal.findLink')}</Link></p>
              </Card>
              <Button type="submit" disabled={!chosen}>{chosen ? t('cpersonal.go', { name: chosen.name }) : t('cpersonal.goNone')}</Button>
            </form>
          )
        }}
      </Load>
    </section>
  )
}
