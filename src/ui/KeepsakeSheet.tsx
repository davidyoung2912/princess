import { useSailing } from '../hooks/useDemo'
import { formatDate } from '../domain/cruise'
import { shipOf } from '../domain/shipCatalogue'
import { t } from '../i18n'
import { Button } from './Button'
import { Printer } from './icons'

/**
 * Keepsake printing (L7): a Print button on the screen, and a heading that shows only on paper (ship, voyage dates, the screen's title, a brass rule), so a printed itinerary,
 * packing list or boarding pass looks like something to keep. The rest of the print styling is in print.css.
 */
export function KeepsakeSheet({ title, withButton = true }: { title: string; withButton?: boolean }) {
  const sailing = useSailing()
  return (
    <>
      <header className="keepsake-head" aria-hidden="true">
        <p className="keepsake-head__ship">{shipOf(sailing.id).name} · {formatDate(sailing.departure)}</p>
        <p className="keepsake-head__title">{title}</p>
      </header>
      {withButton && <p className="no-print"><Button variant="secondary" onClick={() => window.print()}><Printer aria-hidden="true" /> {t('l7.print')}</Button></p>}
    </>
  )
}
