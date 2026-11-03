import { t, type StringKey } from '../i18n'
import type { JourneyStage } from '../routes/hubs'
import type { NavTab } from '../routes/stageNav'

/** The words of a tab in the guest's language: the registry holds the English, the locale files hold the text shown. */
export function tabText(tab: NavTab, stage: JourneyStage): { label: string; subtext: string } {
  if (tab.kind === 'home') return { label: t('tab.home'), subtext: t(`stage.${stage}.home` as StringKey) }
  if (tab.kind === 'me') return { label: t('tab.me'), subtext: t(`stage.${stage}.me` as StringKey) }
  return { label: t(`tabname.${tab.key}` as StringKey), subtext: t(`tabsub.${tab.key}` as StringKey) }
}
