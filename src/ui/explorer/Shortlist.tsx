import { useState } from 'react'
import { Link } from 'react-router'
import { addCustom } from '../../data/customReminders'
import { formatDayMonth } from '../../domain/cruise'
import { actionGate, type ActionGate } from '../../domain/explorer/actionGate'
import { reminderAt, reminderId, reminderText, savedKeys, shortlistFrom, type SavedItem } from '../../domain/explorer/shortlist'
import { useJourneyPosition } from '../../hooks/useJourneyPosition'
import { useMine } from '../../hooks/useMine'
import { usePins } from '../../hooks/usePins'
import { useShip } from '../../hooks/useShipCatalogue'
import { t } from '../../i18n'
import { api } from '../../runtime'
import { Button } from '../Button'
import { useDiningView } from './dining/diningView'

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

const PRE_BOOKING = ['dream', 'discover', 'book']

/**
 * What the guest saved (places, treatments, shows and events, and tours), in the order saved. The names come from one server read that needs an account but no booking,
 * so the shortlist works while the guest is still researching. Each opens its Explorer on that item; for a dining place whose booking window has not opened,
 * a reminder for the day it does. Saving books nothing, and a show or event is only ever saved to see.
 */
function ShortlistList({ gate }: { gate: ActionGate | null }) {
  const { stage } = useJourneyPosition()
  const pins = usePins()
  const ship = useShip()
  const keys = savedKeys(pins.keys)
  const served = useMine(() => api.discover.shortlist(), [keys.join('|')]).data
  if (keys.length === 0 || !served) return null
  const items = shortlistFrom(served, ship.id)
  const over = stage === 'remember'
  return (
    <section aria-labelledby="short-h">
      <h2 id="short-h">{over ? t('short.nextTime') : t('short.heading')}</h2>
      <p className="muted">{over ? t('short.nextTimeIntro') : t('short.intro')}</p>
      {items.length === 0 ? <p>{t('short.empty')}</p> : (
        <ul className="card-grid">
          {items.map((i) => (
            <li key={i.key} className="card">
              <h3 className="card__title">{over ? i.title : <Link to={i.to}>{i.title}</Link>}</h3>
              <p className="muted">{t(`short.kind.${i.kind}`)}</p>
              {gate && gate.status === 'opensOn' && gate.opensOn && i.explorer === 'dining' && i.bookable && (
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

/** Once there is a booking the dining view says when the window opens, so a saved restaurant can offer a reminder. */
function BookedShortlist({ stage }: { stage: string }) {
  const dining = useDiningView().data
  const gate = actionGate('dining', { hasBooking: true, finished: stage === 'remember', canBook: dining?.canBook ?? null, window: dining ? { open: dining.window.open, opensOn: dining.window.opensOn } : null })
  return <ShortlistList gate={gate} />
}

export function Shortlist() {
  const { stage } = useJourneyPosition()
  return PRE_BOOKING.includes(stage) ? <ShortlistList gate={null} /> : <BookedShortlist stage={stage} />
}
