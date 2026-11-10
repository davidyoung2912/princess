import { useState } from 'react'
import type { ChatMessage } from '../../api/chatTypes'
import { MOMENT_TOPICS, toggleTopic, topicOn } from '../../domain/chatMoments'
import { useAction } from '../../hooks/useAction'
import { chatChanged } from '../../hooks/useChatSummary'
import { useMine } from '../../hooks/useMine'
import { t, type StringKey } from '../../i18n'
import { api } from '../../runtime'
import { ActionError } from '../account/parts'
import { Button } from '../Button'
import { Chip } from '../Chip'

/**
 * The two ways to put a Stanley suggestion card away (docs/chat-features-research.md, 7.3): Not now (it may come back tomorrow) and Don't show this again (until what it is about changes). The
 * card's one primary action is the link the notice row already shows. Neither button decides anything about the trip.
 */
export function MomentButtons({ m, conversationId, onChanged }: { m: ChatMessage; conversationId: string; onChanged: () => void }) {
  const [done, setDone] = useState<'snooze' | 'dismiss' | null>(null)
  const put = useAction(async (action: 'snooze' | 'dismiss') => {
    await api.chatConversations.momentAction(conversationId, m.id, action)
    setDone(action)
    chatChanged()
    onChanged()
  }, { quiet: true })
  return (
    <div className="chat-notice-offers">
      <div className="chip-row" role="group" aria-label={t('stanley.moment.group')}>
        <Button variant="secondary" disabled={put.busy || done !== null} onClick={() => void put.run('snooze')}>{t('stanley.moment.notNow')}</Button>
        <Button variant="secondary" disabled={put.busy || done !== null} onClick={() => void put.run('dismiss')}>{t('stanley.moment.dontShow')}</Button>
      </div>
      {done && <p role="status" className="muted">{t(done === 'snooze' ? 'stanley.moment.snoozed' : 'stanley.moment.dismissed')}</p>}
      {put.error && <ActionError error={put.error} />}
    </div>
  )
}

/** The topics Stanley may suggest, one switch each, and what the guest's Stanley level allows. Saved at once; the switch goes back if saving fails. */
export function StanleySuggestions() {
  const prefs = useMine(() => api.chatConnections.stanleyPrefs())
  const [off, setOff] = useState<string[] | null>(null)
  const current = off ?? prefs.data?.topicsOff ?? []
  const save = useAction(async (next: string[]) => {
    setOff(next)
    try { setOff((await api.chatConnections.saveStanleyPrefs(next)).topicsOff) } catch (e) { setOff(null); throw e }
  })
  if (!prefs.data) return null
  return (
    <section aria-labelledby="stanley-sugg-h">
      <h4 id="stanley-sugg-h">{t('stanley.moment.settingsTitle')}</h4>
      <p className="muted">{t(`stanley.moment.mode.${prefs.data.mode}` as StringKey)}</p>
      <div className="chip-row">
        {MOMENT_TOPICS.map((topic) => (
          <Chip key={topic} pressed={topicOn(current, topic)} onToggle={() => void save.run(toggleTopic(current, topic, !topicOn(current, topic))).catch(() => undefined)}>{t(`stanley.moment.topic.${topic}` as StringKey)}</Chip>
        ))}
      </div>
      <p className="muted">{t('stanley.moment.settingsBody')}</p>
      {save.error && <ActionError error={save.error} />}
    </section>
  )
}
