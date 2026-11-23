import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getContext, subscribeContext } from '../account/context'
import { t, th } from '../i18n'
import { openedFrom, screenForPath, type TabColour } from '../routes/screens'
import { listedScreens } from '../routes/stageNav'
import { SCREEN_ICONS } from './screenIcons'
import { CircleDot, Pin } from 'lucide-react'
import { usePins } from '../hooks/usePins'
import { orderForParty } from '../domain/tileOrder'
import type { TileLine } from '../domain/tileLive'
import { TileLiveLine } from './TileLiveLine'
import { useGuideView } from '../hooks/useGuideView'
import { startHerePath } from '../guide/tabs'

/**
 * A list of screens from the registry, in the order given: the title as a link with what the guest can do there beneath. Each link says which
 * tab it was opened from, so the screen keeps that tab's colour. Screens that need an id the list cannot know (a particular sailing or port) are
 * reached from the list they open from, so they are left out here.
 */
export function ScreenList({ ids, colour, badges = {}, live = {}, heading, headingId, tour }: { ids: readonly string[]; colour: TabColour; badges?: Record<string, ReactNode>; live?: Record<string, TileLine>; heading?: string; headingId: string; tour?: string }) {
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const { screens: pins, toggleScreen, ready } = usePins()
  const { data: guide } = useGuideView()
  const start = guide ? startHerePath(guide) : null
  const items = listedScreens(orderForParty(ids, pins), { sailingId: context?.focusSailingId ?? context?.sailingId ?? null, tripNumber: context?.booking?.number ?? null })
  if (items.length === 0) return null
  return (
    <nav aria-labelledby={headingId} data-tour={tour}>
      <h2 id={headingId} className={heading ? undefined : 'visually-hidden'}>{heading ?? t('shell.nav')}</h2>
      <ul className="link-list screen-list">
        {items.map(({ screen, to }) => {
          const Icon = SCREEN_ICONS[screen.id] ?? CircleDot
          return (
            <TileItem key={screen.id} id={screen.id} title={th(screen.titleKey)} text={t(screen.subtextKey)} live={live[screen.path]} icon={<Icon className="screen-list__icon" size={20} aria-hidden="true" />}>
              <button type="button" className="screen-list__pin" disabled={!ready} aria-pressed={pins.includes(screen.id)} aria-label={t('pin.label', { title: th(screen.titleKey) })} onClick={() => void toggleScreen(screen.id)}><Pin size={16} aria-hidden="true" /></button>
              <Link to={to} state={openedFrom(colour)}><Icon className="screen-list__icon" size={20} aria-hidden="true" />{th(screen.titleKey)}{badges[screen.path]}</Link>
              {screen.path === start && <span className="screen-list__start">{t('guide.startHere')}</span>}
            </TileItem>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * One tile. On a wide screen with a pointer it opens a preview card on hover or keyboard focus (L7): the icon, the live line and the description. The card sits under the
 * tile (never follows the pointer, so magnifier users can find it), stays while the pointer is on it, and Escape closes it (WCAG 1.4.13). Its words are hidden from screen
 * readers because the tile already carries them in the page.
 */
function TileItem({ id, title, text, live, icon, children }: { id: string; title: string; text: string; live: TileLine | undefined; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px) and (hover: hover)').matches
  const show = () => { if (wide) setOpen(true) }
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the card is an extra, opens on focus as well as hover, and closes on Escape; the tile's link and description stay in the page
    <li onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }} onKeyDown={(e) => { if (e.key === 'Escape' && open) { setOpen(false); e.stopPropagation() } }}>
      {children}
      <span className="screen-list__subtext">{live && <><TileLiveLine line={live} /> · </>}<span className="screen-list__more">{text}</span></span>
      {open && (
        <div className="tile-preview" aria-hidden="true" data-tile={id}>
          <span className="tile-preview__icon">{icon}</span>
          <strong>{title}</strong>
          {live && <TileLiveLine line={live} />}
          <span>{text}</span>
        </div>
      )}
    </li>
  )
}

/**
 * A list of links to known screens, given by path, for pages that mix in their own badges or conditions: each row looks like the main pages' tiles
 * (icon, title, what the guest can do there beneath, hover card on a wide screen). A path that is not a registered screen is left out.
 */
export function PathLinkList({ items, colour = 'blue' }: { items: readonly ({ path: string; query?: string; badge?: ReactNode } | null | false | undefined)[]; colour?: TabColour }) {
  return (
    <ul className="link-list screen-list">
      {items.map((item) => {
        if (!item) return null
        const screen = screenForPath(item.path)
        if (!screen) return null
        const Icon = SCREEN_ICONS[screen.id] ?? CircleDot
        const icon = <Icon className="screen-list__icon" size={20} aria-hidden="true" />
        return (
          <TileItem key={item.path} id={screen.id} title={th(screen.titleKey)} text={t(screen.subtextKey)} live={undefined} icon={icon}>
            <Link to={item.query ? `${item.path}?${item.query}` : item.path} state={openedFrom(colour)}>{icon}{th(screen.titleKey)}{item.badge}</Link>
          </TileItem>
        )
      })}
    </ul>
  )
}
