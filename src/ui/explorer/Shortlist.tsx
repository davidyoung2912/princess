import { useState } from 'react'
import { Link } from 'react-router'
import { addCustom } from '../../data/customReminders'
import { formatDayMonth } from '../../domain/cruise'
import { actionGate } from '../../domain/explorer/actionGate'
import { reminderAt, reminderId, reminderText, savedKeys, shortlistItems, type SavedItem } from '../../domain/explorer/shortlist'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { useMine } from '../../hooks/useMine'
import { usePins } from '../../hooks/usePins'
import { useShip } from '../../hooks/useShipCatalogue'
import { t } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { useDiningView } from './dining/diningView'
import { useSpaView } from './spa/spaView'

/** The reminder offer for one saved place: only when the server says its window opens on a date, and it says so plainly. */
function RemindMe({ item, opensOn }: { item: SavedItem; opensOn: string }) {
  const [set, setSet] = useState(false)
  const at = reminderAt(opensOn)
  if (at === null) return null
  if (set) return <p className="muted" role="status">{t('short.remindSet', { date: formatDayMonth(opensOn) })}</p>
  return (
    <Button variant="secondary" onClick={() => { addCustom({ id: reminderId(item.key), at, text: reminderText(item.title) }); setSet(true) }}>
      {t('short.remind')}<span className="visually-hidden"> {item.title}</span>
    </Button>
  )
}

/**
 * What the guest saved (places, treatments and tours), in the order saved, each with a Book link that opens its Explorer on that item and,
 * for a dining place whose booking window has not opened, a reminder for the day it does. Saving books nothing.
 */
export function Shortlist() {
  const { stage } = useJourneyPosition()
  const pins = usePins()
  const ship = useShip()
  const booked = !['dream', 'discover', 'book'].includes(stage)
  const dining = useDiningView().data
  const spa = useSpaView().data
  const tours = useMine(() => api.plan.excursions.list()).data
  const diningDay = useMine(() => api.onboard.explorerDay('dining', 1)).data
  const spaDay = useMine(() => api.onboard.explorerDay('spa', 1)).data
  const keys = savedKeys(pins.keys)
  if (!booked || keys.length === 0) return null
  const venues = [...(diningDay?.venues ?? []), ...(spaDay?.venues ?? [])].map((v) => v.venue)
  const items = shortlistItems(keys, {
    shipId: venues[0]?.shipId ?? ship.id, venues, treatments: spa?.treatments ?? [], tours: (tours?.offers ?? []).map((o) => ({ id: o.item.id, name: o.item.name })),
  })
  const gate = actionGate('dining', { hasBooking: true, finished: stage === 'remember', canBook: dining?.canBook ?? null, window: dining ? { open: dining.window.open, opensOn: dining.window.opensOn } : null })
  return (
    <section aria-labelledby="short-h">
      <h2 id="short-h">{t('short.heading')}</h2>
      <p className="muted">{t('short.intro')}</p>
      {items.length === 0 ? <p>{t('short.empty')}</p> : (
        <ul className="card-grid">
          {items.map((i) => (
            <li key={i.key} className="card">
              <h3 className="card__title"><Link to={i.bookTo}>{i.title}</Link></h3>
              <p className="muted">{t(`short.kind.${i.kind}`)}</p>
              {gate.status === 'opensOn' && gate.opensOn && i.explorer === 'dining' && (
                <>
                  <p>{t('short.opens', { date: formatDayMonth(gate.opensOn) })}</p>
                  <RemindMe item={i} opensOn={gate.opensOn} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
