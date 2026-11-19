import { Pin } from 'lucide-react'
import type { ExplorerVenueInfo } from '../../api/explorerTypes'
import type { VenuePins } from '../../hooks/useVenuePins'
import { t } from '../../i18n'

/** The pin toggle of a venue: the same look and `aria-pressed` as a screen pin. */
export function PinButton({ venue, pins, tour }: { venue: ExplorerVenueInfo; pins: VenuePins; tour?: string }) {
  return (
    <button type="button" data-tour={tour} className="screen-list__pin exp-pin" disabled={!pins.ready} aria-pressed={pins.isPinned(venue)} aria-label={t('pin.label', { title: venue.title })} onClick={() => void pins.toggle(venue)}>
      <Pin size={16} aria-hidden="true" />
    </button>
  )
}
