import { th, t } from '../i18n'
import type { StringKey } from '../i18n'

/** The coloured bar at the top of every screen: the title (the page's one h1) and, under it, what the guest can do here (plan section 4). The colour is the shell's `data-area` (see `areaFor`). */
export function PageHeader({ titleKey, subtextKey }: { titleKey: StringKey; subtextKey: StringKey }) {
  return (
    <div className="page page--head">
      <header className="page-header">
        <h1 className="page-header__title">{th(titleKey)}</h1>
        <p className="page-header__subtext">{t(subtextKey)}</p>
      </header>
    </div>
  )
}
