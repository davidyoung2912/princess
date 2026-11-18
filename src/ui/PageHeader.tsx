import { useRef, useState, type ComponentType, Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { canGoBack } from '../routes/trail'
import { th, t } from '../i18n'
import { ArrowLeft } from './icons'
import type { StringKey } from '../i18n'
import type { PageArt } from './pageArt'
import { StanleyPose } from './StanleyPose'

type Words = ({ titleKey: StringKey; subtextKey: StringKey } | { title: string; subtext?: string }) & {
  /** Show the Back button (every screen except the tab landing pages). */
  back?: boolean
  /** The icon shown before the title: the icon of the tab the screen belongs to. */
  icon?: ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false'; className?: string }>
  /** A picture of Stanley at the end of the bar, for screens that have one (see `pageArt`). */
  art?: PageArt
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
        className={`page-header${words.art ? ' page-header--art' : ''}${wiggling ? ' page-header--wiggle' : ''}`}
        onMouseEnter={() => { if (wiggled.current !== key) { wiggled.current = key; setWiggling(true) } }}
        onAnimationEnd={() => setWiggling(false)}
      >
        <div className="page-header__row">
          {words.icon && <words.icon key={key} aria-hidden="true" className="page-header__icon" />}
          <h1 className="page-header__title">{title}</h1>
          {words.art && <span className="page-header__art calm-hide"><StanleyPose pose={words.art.pose} head={words.art.head} size={76} /></span>}
        </div>
        {subtext && <p className="page-header__subtext">{subtext.split('\n').map((line, i) => (i === 0 ? line : <Fragment key={i}><br />{line}</Fragment>))}</p>}
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
