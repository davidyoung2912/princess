import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { t } from '../../i18n'
import { Banner } from '../Banner'

/** Said at the top of a screen that opens once the guest has left the ship. */
export function NotYetOff({ open, children }: { open: boolean; children?: ReactNode }) {
  if (open) return null
  return <Banner kind="info" title={t('fin.notYet.title')}><p>{t('fin.notYet.body')}</p>{children}</Banner>
}

/** A "Talk to a person" route, shown wherever something can go wrong or wait. */
export function Human() {
  return <p className="muted">{t('fin.human')} <Link to="/me/contact">{t('route.contact')}</Link></p>
}
