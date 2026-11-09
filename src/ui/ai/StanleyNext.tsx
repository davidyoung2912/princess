import stanley from '../../assets/stanley-small.png'
import { stanleyNext } from '../../ai/stanleyNext'
import { useNow } from '../../hooks/useDemo'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import type { JourneyStage } from '../../routes/hubs'
import { openedFrom } from '../../routes/screens'
import type { HomeFacts } from '../../routes/stageHome'
import { stanleyLevelFor } from '../../settings/settings'
import { LinkButton } from '../Button'
import { WhyThis } from './WhyThis'

/**
 * "What should I do next?" at the top of Home, at every stage: one rules-based sentence and a button, from the facts Home already has. No model is called.
 * Shown at Helpful and Chatty; the Next steps list below it stays for everyone.
 */
export function StanleyNext({ stage, facts }: { stage: JourneyStage; facts: HomeFacts }) {
  const [settings] = useSettings()
  const now = useNow()
  const level = stanleyLevelFor(settings)
  if (level === 'asked' || level === 'off') return null
  const a = stanleyNext(stage, facts, new Date(now).getHours())
  const step = a.stepKey ? t(a.stepKey as StringKey) : ''
  const text = t(a.key as StringKey, { step: step.charAt(0).toLowerCase() + step.slice(1) })
  return (
    <aside className="stanley-next no-print" aria-label={t('stanley.next.label')}>
      <img className="stanley-next__face" src={stanley} alt="" width="192" height="192" />
      <p className="tip__text">{text}</p>
      <WhyThis kind="tip" fact={t('stanley.why.fact.tip')} what={text} />
      {a.to && <LinkButton to={a.to} state={openedFrom('blue')} variant="secondary" aria-label={`${t('stanley.next.go')}: ${text}`}>{t('stanley.next.go')}</LinkButton>}
    </aside>
  )
}
