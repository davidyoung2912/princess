import { useState } from 'react'
import { useJourneyPosition } from '../hooks/useJourneyPosition'
import { t } from '../i18n'
import { navTabs, newTabLabels } from '../routes/stageNav'
import { loadSeenTabs, saveSeenTabs } from '../settings/seenTabs'
import { Banner } from './Banner'
import { Button } from './Button'

/**
 * A one-line note on Home the first time a new tab appears ("We've added Ship."). A device that has never recorded the tabs it showed starts
 * from the tabs of the current stage, so a fresh install announces nothing.
 */
export function NewTabsNote() {
  const { stage } = useJourneyPosition()
  const [seen, setSeen] = useState<string[] | null>(loadSeenTabs)
  const current = navTabs(stage).filter((x) => x.kind === 'stage').map((x) => x.key)
  if (seen === null) { saveSeenTabs(current); setSeen(current); return null }
  const added = newTabLabels(stage, seen)
  if (added.length === 0) return null
  const dismiss = () => { const next = [...seen, ...current]; saveSeenTabs(next); setSeen(next) }
  return (
    <Banner kind="info" title={t('tabs.new.title')} action={<Button variant="secondary" onClick={dismiss}>{t('tabs.new.dismiss')}</Button>}>
      <p>{t('tabs.new.body', { tabs: added.join(', ') })}</p>
    </Banner>
  )
}
