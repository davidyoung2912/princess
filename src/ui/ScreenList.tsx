import { useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getContext, subscribeContext } from '../account/context'
import { t, th } from '../i18n'
import { openedFrom, type TabColour } from '../routes/screens'
import { listedScreens } from '../routes/stageNav'
import { SCREEN_ICONS } from './screenIcons'
import { CircleDot, Pin } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { MAX_PINS } from '../settings/settings'
import { orderForParty, togglePin } from '../domain/tileOrder'

/**
 * A list of screens from the registry, in the order given: the title as a link with what the guest can do there beneath. Each link says which
 * tab it was opened from, so the screen keeps that tab's colour. Screens that need an id the list cannot know (a particular sailing or port) are
 * reached from the list they open from, so they are left out here.
 */
export function ScreenList({ ids, colour, badges = {}, live = {}, heading, headingId }: { ids: readonly string[]; colour: TabColour; badges?: Record<string, ReactNode>; live?: Record<string, string>; heading?: string; headingId: string }) {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const [{ pins }, update] = useSettings()
  const items = listedScreens(orderForParty(ids, pins), { sailingId: context?.focusSailingId ?? context?.sailingId ?? null, tripNumber: context?.booking?.number ?? null })
  if (items.length === 0) return null
  return (
    <nav aria-labelledby={headingId}>
      <h2 id={headingId} className={heading ? undefined : 'visually-hidden'}>{heading ?? t('shell.nav')}</h2>
      <ul className="link-list screen-list">
        {items.map(({ screen, to }) => {
          const Icon = SCREEN_ICONS[screen.id] ?? CircleDot
          return (
            <li key={screen.id}>
              <button type="button" className="screen-list__pin" aria-pressed={pins.includes(screen.id)} aria-label={t('pin.label', { title: th(screen.titleKey) })} onClick={() => update({ pins: togglePin(pins, screen.id, MAX_PINS) })}><Pin size={16} aria-hidden="true" /></button>
              <Link to={to} state={openedFrom(colour)}><Icon className="screen-list__icon" size={20} aria-hidden="true" />{th(screen.titleKey)}{badges[screen.path]}</Link>
              <span className="screen-list__subtext">{live[screen.path] && <strong className="screen-list__live">{live[screen.path]} · </strong>}{t(screen.subtextKey)}</span>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
