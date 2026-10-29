import { t } from '../i18n'

/** The standing notice that this is an independent concept; shown on the splash, Home, Me and About. */
export function ConceptNotice() {
  return <p className="concept-notice">{t('app.conceptNotice')}</p>
}
