import { Link } from 'react-router'
import { useTileLive } from '../hooks/useTileLive'
import { SCREEN_LIST } from '../routes/screens'
import { th } from '../i18n'
import { TileLiveLine } from './TileLiveLine'

/** The tiles worth a glance today. */
const TODAY_PATHS = ['/plan/dining', '/ship/venues', '/ship/port', '/me/bill', '/ship/order'] as const

/** "Today so far": a swipeable strip of small cards, one per thing with something to say right now (dinner, what is open, all-aboard, the bill). Cards with nothing to say are left out. */
export function TodayStrip() {
  const live = useTileLive(TODAY_PATHS, true)
  const items = TODAY_PATHS.map((path) => ({ path, line: live[path], screen: SCREEN_LIST.find((s) => s.path === path) })).filter((x) => x.line && x.screen)
  if (items.length === 0) return null
  return (
    <section aria-labelledby="today-strip-h" className="today-strip">
      <h2 id="today-strip-h">{th('today.title')}</h2>
      <ul className="today-strip__list">
        {items.map(({ path, line, screen }) => (
          <li key={path} className="today-strip__card">
            <Link to={path} className="today-strip__link">
              <span className="today-strip__name">{th(screen!.titleKey)}</span>
              <TileLiveLine line={line!} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
