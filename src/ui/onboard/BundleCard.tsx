import { useMemo } from 'react'
import type { ChatBundle } from '../../api/chatTypes'
import { BUNDLE_TYPES, bundleLink, bundleSummary, gameOfBundle, isKnownBundle } from '../../domain/chatBundles'
import { holdIncoming } from '../../domain/games/incoming'
import { decodeGame, type ShareMode } from '../../domain/games/share'
import { clock12 } from '../../domain/planCard'
import { t } from '../../i18n'
import { LinkButton } from '../Button'

const clock = (time: string): string => clock12(time)

/**
 * A bundle in a thread (docs/chat-bundles-plan.md, 5.1): drawn from the registry for a type this app knows, and from its plain fields (title, subtitle, when, where) for one it does not, with "Update the app to open
 * this". It opens the screen it came from; a path the app does not know says it is no longer available.
 */
export function BundleCard({ bundle, onOpen }: { bundle: ChatBundle; onOpen?: () => void }) {
  const known = isKnownBundle(bundle)
  const type = known ? BUNDLE_TYPES[bundle.type] : undefined
  const link = bundleLink(bundle)
  const label = type ? t(type.label) : ''
  // Phase B8: a game opens the puzzle in its own screen. The text is decoded here (it can be anything a sender wrote), and the puzzle waits in memory for the screen, never in the address.
  const game = useMemo(() => {
    const g = known ? gameOfBundle(bundle) : null
    const shared = g ? decodeGame(g.game, g.data) : null
    return g && shared ? { ...g, shared } : null
  }, [bundle, known])
  const play = (mode: ShareMode) => { if (game) holdIncoming(game.game, game.shared, mode); onOpen?.() }
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
        : bundle.type.startsWith('game.') ? (game && link ? (
          <div className="button-row">
            <LinkButton to={link} variant="secondary" onClick={() => play(game.mode)} aria-label={`${t(game.mode === 'start' ? 'game.open.play' : 'game.open.current')}: ${bundle.title}`}>{t(game.mode === 'start' ? 'game.open.play' : 'game.open.current')}</LinkButton>
            {game.mode === 'current' && <LinkButton to={link} variant="secondary" onClick={() => play('start')} aria-label={`${t('game.open.start')}: ${bundle.title}`}>{t('game.open.start')}</LinkButton>}
          </div>
        ) : <p className="muted">{t('game.open.bad')}</p>)
        : link ? <LinkButton to={link} variant="secondary" onClick={onOpen} aria-label={t('card.open.label', { title: bundle.title })}>{t('card.open')}</LinkButton>
        : <p className="muted">{t('card.gone')}</p>}
    </div>
  )
}
