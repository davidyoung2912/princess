import { getStanleyThread, setStanleyThread, type StanleyMessage } from '../../ai/stanley'
import type { StanleyAction } from '../../ai/stanleyAction'
import { cardSpeech } from '../../ai/stanleyVoice'
import { asSaved } from '../../feeds/stanleyFacts'
import { countUnderstood } from '../../diagnostics/stanleyUnderstood'
import { t, type StringKey } from '../../i18n'
import { LinkButton } from '../Button'
import { StanleyActionCard } from './StanleyActionCard'
import { StanleyAnswerCard } from './StanleyAnswerCard'
import { ReadAloud } from './StanleyVoice'

/** The screens Stanley suggests under a reply: real links in a labelled group, so keyboard and screen reader reach them in reading order. A tap is counted on this device (never the words). */
export function StanleyPills({ actions, onNavigate }: { actions: readonly { label: string; path: string; id?: string }[]; onNavigate?: () => void }) {
  if (actions.length === 0) return null
  return (
    <ul className="stanley__actions stanley__pills" aria-label={t('understand.pills')}>
      {actions.map((a) => <li key={a.path}><LinkButton variant="secondary" to={a.path} onClick={() => { if (a.id) countUnderstood([`pill:${a.id}`]); onNavigate?.() }}>{a.label}</LinkButton></li>)}
    </ul>
  )
}

/** Changes one message in the thread the guest is looking at (a prepared change moving from preview to done). */
const updateAction = (id: string, next: StanleyAction) => setStanleyThread(getStanleyThread().map((m) => (m.id === id ? { ...m, action: next } : m)))

/**
 * Everything one of Stanley's replies can carry, drawn the same way in his dialog and in his chat: the structured card or the words, read aloud, what was saved for no signal, where it came from, the suggested screens, and a prepared change
 * to confirm. `text` is the words as they are being revealed, when they are arriving a few at a time.
 */
export function StanleyReply({ m, text, onNavigate }: { m: StanleyMessage; text?: string; onNavigate?: () => void }) {
  return (
    <>
      {m.card ? <StanleyAnswerCard card={m.card} onNavigate={onNavigate} /> : <p className="ai-msg__text">{text ?? m.text}</p>}
      {(m.card || m.text) && <p className="stanley__actions"><ReadAloud text={m.card ? cardSpeech(m.card, { abstained: t('stanley.read.abstained'), cached: t('stanley.read.cached') }) : m.text} /></p>}
      {m.saved?.map((c) => <StanleyAnswerCard key={c.id} card={asSaved(c, t('stanley.offline.note'))} onNavigate={onNavigate} />)}
      {m.source && !m.card && <p className="ai-msg__cites muted">{t(`stanley.source.${m.source}` as StringKey, { time: new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p>}
      <StanleyPills actions={m.actions ?? []} onNavigate={onNavigate} />
      {m.action && <StanleyActionCard action={m.action} onChange={(next) => updateAction(m.id, next)} onNavigate={onNavigate} />}
    </>
  )
}
