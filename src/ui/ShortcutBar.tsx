import { useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { CircleDot } from 'lucide-react'
import { getContext, subscribeContext } from '../account/context'
import { useSettings } from '../hooks/useSettings'
import { th, t } from '../i18n'
import { listedScreens } from '../routes/stageNav'
import { SCREEN_ICONS } from './screenIcons'
import { EditFavourites } from './EditFavourites'

/** The screens the guest pinned, as a row of chips at the top of Home. Shows nothing until something is pinned. */
export function ShortcutBar() {
  const [{ pins }] = useSettings()
  const context = useSyncExternalStore(subscribeContext, getContext, getContext)
  const items = listedScreens(pins, { sailingId: context?.focusSailingId ?? context?.sailingId ?? null, tripNumber: context?.booking?.number ?? null })
  if (items.length === 0) return null
  return (
    <nav aria-label={t('shortcuts.label')}>
      <ul className="chip-row shortcut-bar">
        {items.map(({ screen, to }) => {
          const Icon = SCREEN_ICONS[screen.id] ?? CircleDot
          return <li key={screen.id}><Link to={to} className="chip shortcut-bar__chip"><Icon size={16} aria-hidden="true" />{th(screen.titleKey)}</Link></li>
        })}
      </ul>
      <EditFavourites />
    </nav>
  )
}
