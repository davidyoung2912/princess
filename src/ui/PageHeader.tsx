import { useRef, useState, type ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { canGoBack } from '../routes/trail'
import { th, t } from '../i18n'
import { ArrowLeft } from './icons'
import type { StringKey } from '../i18n'

type Words = ({ titleKey: StringKey; subtextKey: StringKey } | { title: string; subtext?: string }) & {
  /** Show the Back button (every screen except the tab landing pages). */
  back?: boolean
  /** The icon shown before the title: the icon of the tab the screen belongs to. */
  icon?: ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false'; className?: string }>
}

/** The coloured bar at the top of every screen: the title (the page's one h1) and, under it, what the guest can do here (plan section 4). The colour is the shell's `data-area` (see `areaFor`). A tab landing page gives its words as text. */
export function PageHeader(words: Words) {
  const title = 'titleKey' in words ? th(words.titleKey) : words.title
  const subtext = 'subtextKey' in words ? t(words.subtextKey) : words.subtext ?? ''
  const navigate = useNavigate()
  // The wiggle plays once per visit to a screen: the first time the pointer enters the header after arriving.
  const { key } = useLocation()
  const wiggled = useRef<string | null>(null)
  const [wiggling, setWiggling] = useState(false)
  return (
    <div className="page page--head">
      <header
        className={wiggling ? 'page-header page-header--wiggle' : 'page-header'}
        onMouseEnter={() => { if (wiggled.current !== key) { wiggled.current = key; setWiggling(true) } }}
        onAnimationEnd={() => setWiggling(false)}
      >
        <div className="page-header__row">
          {words.icon && <words.icon aria-hidden="true" className="page-header__icon" />}
          <h1 className="page-header__title">{title}</h1>
        </div>
        {subtext && <p className="page-header__subtext">{subtext}</p>}
        {words.back && (
          <button type="button" className="page-header__back no-print" onClick={() => (canGoBack() ? navigate(-1) : navigate('/'))}>
            <ArrowLeft aria-hidden="true" />
            <span>{t('shell.back')}</span>
          </button>
        )}
      </header>
    </div>
  )
}
