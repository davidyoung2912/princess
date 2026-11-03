import { th, t } from '../i18n'
import type { StringKey } from '../i18n'

type Words = { titleKey: StringKey; subtextKey: StringKey } | { title: string; subtext?: string }

/** The coloured bar at the top of every screen: the title (the page's one h1) and, under it, what the guest can do here (plan section 4). The colour is the shell's `data-area` (see `areaFor`). A tab landing page gives its words as text. */
export function PageHeader(words: Words) {
  const title = 'titleKey' in words ? th(words.titleKey) : words.title
  const subtext = 'subtextKey' in words ? t(words.subtextKey) : words.subtext ?? ''
  return (
    <div className="page page--head">
      <header className="page-header">
        <h1 className="page-header__title">{title}</h1>
        {subtext && <p className="page-header__subtext">{subtext}</p>}
      </header>
    </div>
  )
}
