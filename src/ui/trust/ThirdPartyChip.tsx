import { t } from '../../i18n'

/** Marks anything an outside source supplied, with its credit. App data that the ship or Princess owns never carries it. */
export function ThirdPartyChip({ credit }: { credit: string }) {
  return <span className="third-party-chip">{t('trust.thirdParty', { credit })}</span>
}
