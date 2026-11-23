import type { ChatBundle } from '../../api/chatTypes'
import { BUNDLE_TYPES, bundleLink, bundleSummary, isKnownBundle } from '../../domain/chatBundles'
import { clock12 } from '../../domain/planCard'
import { t } from '../../i18n'
import { LinkButton } from '../Button'

const clock = (time: string): string => clock12(time)

/**
 * A bundle in a thread (docs/chat-bundles-plan.md, 5.1): drawn from the registry for a type this app knows, and from its plain fields (title, subtitle, when, where) for one it does not, with "Update the app to open
 * this". It opens the screen it came from; a path the app does not know says it is no longer available.
 */
export function BundleCard({ bundle }: { bundle: ChatBundle }) {
  const known = isKnownBundle(bundle)
  const type = known ? BUNDLE_TYPES[bundle.type] : undefined
  const link = bundleLink(bundle)
  const label = type ? t(type.label) : ''
  const when = [bundle.day !== undefined ? t('card.day', { day: bundle.day }) : '', bundle.time ? clock(bundle.time) : ''].filter(Boolean).join(', ')
  return (
    <div className={['chat-card', 'chat-card--bundle', `chat-card--${bundle.type.replace(/\W/g, '-')}`].join(' ')} role="group" aria-label={[label, bundleSummary(bundle, clock)].filter(Boolean).join(': ')}>
      {label && <p className="chat-card__type"><strong>{label}</strong></p>}
      <p className="chat-card__title">{bundle.title}</p>
      {bundle.subtitle && <p className="muted">{bundle.subtitle}</p>}
      {when && <p>{when}</p>}
      {bundle.place && bundle.place !== bundle.title && <p>{bundle.place}</p>}
      {bundle.note && <p>{bundle.note}</p>}
      {!known ? <p className="muted">{t('bundle.update')}</p>
        : link ? <LinkButton to={link} variant="secondary" aria-label={t('card.open.label', { title: bundle.title })}>{t('card.open')}</LinkButton>
        : <p className="muted">{t('card.gone')}</p>}
    </div>
  )
}
