import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatBundle, ChatMessage, ChatTally } from '../../../shared/api/chatTypes'
import { BUNDLE_TYPES, bundleIcon, bundleLink, forwardInput, bundleSummary, gameOfBundle, isKnownBundle } from '../../chat/domain/chatBundles'
import { holdIncoming } from '../../games/domain/incoming'
import { challengePrefs } from '../../games/domain/shareChallenge'
import { writePref } from '../../../shared/settings/gamePrefs'
import { decodeGame, isChallengeShare, startOnly, type ShareMode } from '../../games/domain/share'
import { gameThumbnail, type Thumbnail } from '../../games/domain/thumbnail'
import { clock12 } from '../../../domain/planCard'
import { t } from '../../../shared/i18n'
import { useAction } from '../../../shared/hooks/useAction'
import { sendWithin } from '../../../shared/hooks/useOutbox'
import { api } from '../../../app/runtime'
import { Button, LinkButton } from '../../../shared/ui/Button'
import { ExplorerIcon } from '../../explorer/ui/ExplorerIcon'
import { Anchor, ClipboardList, Compass, Games, MapPin } from '../../../shared/ui/icons'
import { SendDialog } from './SendDialog'

const clock = (time: string): string => clock12(time)

/**
 * A bundle in a thread (docs/chat-bundles-plan.md, 5.1): drawn from the registry for a type this app knows, and from its plain fields (title, subtitle, when, where) for one it does not, with "Update the app to open
 * this". It opens the screen it came from; a path the app does not know says it is no longer available.
 */
/** Phase B11: the same icon the explorer shows for this kind of thing. Decoration only (the type word beside it says it), so hidden from a screen reader. */
function BundleGlyph({ bundle }: { bundle: ChatBundle }) {
  const id = bundleIcon(bundle)
  const props = { className: 'explorer-icon', 'aria-hidden': true, focusable: false } as const
  const icon = !id ? null
    : id === 'excursions' ? <Compass {...props} /> : id === 'games' ? <Games {...props} /> : id === 'port' ? <Anchor {...props} />
    : id === 'place' ? <MapPin {...props} /> : id === 'menu' ? <ClipboardList {...props} /> : <ExplorerIcon kind={id} />
  return icon && <span className="chat-card__glyph">{icon}</span>
}

/** Phase B11: the board's shape and where its clues are, as a small picture. Decoration only (the words say what the game is), so it is hidden from a screen reader. */
function GameThumb({ thumb }: { thumb: Thumbnail }) {
  const side = 48
  const cell = side / Math.max(thumb.rows, thumb.cols)
  return (
    <svg className="chat-card__thumb" width={side} height={(side * thumb.rows) / Math.max(thumb.rows, thumb.cols)} viewBox={`0 0 ${thumb.cols * cell} ${thumb.rows * cell}`} aria-hidden="true" focusable="false">
      {thumb.filled.map((on, i) => <rect key={i} x={(i % thumb.cols) * cell} y={Math.floor(i / thumb.cols) * cell} width={cell} height={cell} className={on ? 'chat-card__thumb-on' : 'chat-card__thumb-off'} />)}
    </svg>
  )
}

/** Phase B10: "I did it" on a game in a thread, counted for everyone and named only for people who said so. */
function Outcome({ conversationId, message, canAct }: { conversationId: string; message: ChatMessage; canAct: boolean }) {
  const [tally, setTally] = useState<ChatTally | undefined>(message.tally)
  const seen = useRef(message.tally)
  useEffect(() => { if (message.tally !== seen.current) { seen.current = message.tally; setTally(message.tally) } }, [message.tally])
  const done = tally?.mine === 1
  const count = tally?.counts[0] ?? 0
  const toggle = useAction(async () => { setTally(await sendWithin(api.chatConversations.bundleOutcome(conversationId, message.id, !done))) })
  return (
    <div className="button-row">
      <Button variant={done ? 'primary' : 'secondary'} aria-pressed={done} disabled={!canAct || toggle.busy} onClick={() => void toggle.run()}>{t('bundle.done')}</Button>
      <p className={count > 0 ? 'muted' : 'visually-hidden'} role="status">{count > 0 ? (done || !tally?.going?.length ? t('bundle.done.count', { count }) : t('bundle.done.names', { names: tally.going.join(', ') })) : ''}</p>
      {toggle.error && <p role="alert" className="field__error">{t('bundle.done.failed')}</p>}
    </div>
  )
}

export function BundleCard({ bundle, onOpen, outcome }: { bundle: ChatBundle; onOpen?: () => void; outcome?: { conversationId: string; message: ChatMessage; canAct: boolean } }) {
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
  const thumb = useMemo(() => (game ? gameThumbnail(game.shared) : null), [game])
  /** Accepting a challenge sets the opponent and choices the game's setup page remembers, then opens the game. */
  const accept = () => { if (game && isChallengeShare(game.shared)) for (const [name, value] of challengePrefs(game.shared.puzzle)) writePref(game.game, name, value); onOpen?.() }
  const play = (mode: ShareMode) => { if (game) holdIncoming(game.game, game.shared, mode); onOpen?.() }
  const beat = () => { if (game) holdIncoming(game.game, startOnly(game.shared), 'start', Date.now(), game.seconds); onOpen?.() }
  const [forwarding, setForwarding] = useState(false)
  const source = outcome ? { conversationId: outcome.conversationId, messageId: outcome.message.id } : undefined
  const forward = known && outcome?.canAct ? forwardInput(bundle) : null
  const when = [bundle.day !== undefined ? t('card.day', { day: bundle.day }) : '', bundle.time ? clock(bundle.time) : ''].filter(Boolean).join(', ')
  return (
    <div className={['chat-card', 'chat-card--bundle', `chat-card--${bundle.type.replace(/\W/g, '-')}`].join(' ')} role="group" aria-label={[label, bundleSummary(bundle, clock)].filter(Boolean).join(': ')}>
      {label && <p className="chat-card__type">{known && <BundleGlyph bundle={bundle} />}<strong>{label}</strong></p>}
      {thumb && <GameThumb thumb={thumb} />}
      <p className="chat-card__title">{bundle.title}</p>
      {bundle.subtitle && <p className="muted">{bundle.subtitle}</p>}
      {when && <p>{when}</p>}
      {bundle.place && bundle.place !== bundle.title && <p>{bundle.place}</p>}
      {bundle.note && <p>{bundle.note}</p>}
      {bundle.from && <p className="muted">{t('bundle.from', { name: bundle.from })}</p>}
      {!known ? <p className="muted">{t('bundle.update')}</p>
        : bundle.type.startsWith('game.') ? (game && link ? game.mode === 'challenge' ? (
          <div className="button-row"><LinkButton to={link} variant="secondary" onClick={accept} aria-label={`${t('game.open.accept')}: ${bundle.title}`}>{t('game.open.accept')}</LinkButton></div>
        ) : game.mode === 'result' ? (
          <div className="button-row"><LinkButton to={link} variant="secondary" onClick={beat} aria-label={`${t('game.open.beat')}: ${bundle.title}`}>{t('game.open.beat')}</LinkButton></div>
        ) : (
          <div className="button-row">
            <LinkButton to={link} variant="secondary" onClick={() => play(game.mode as ShareMode)} aria-label={`${t(game.mode === 'start' ? 'game.open.play' : 'game.open.current')}: ${bundle.title}`}>{t(game.mode === 'start' ? 'game.open.play' : 'game.open.current')}</LinkButton>
            {game.mode === 'current' && <LinkButton to={link} variant="secondary" onClick={() => play('start')} aria-label={`${t('game.open.start')}: ${bundle.title}`}>{t('game.open.start')}</LinkButton>}
          </div>
        ) : <p className="muted">{t('game.open.bad')}</p>)
        : link ? <LinkButton to={link} variant="secondary" onClick={onOpen} aria-label={t('card.open.label', { title: bundle.title })}>{t('card.open')}</LinkButton>
        : <p className="muted">{t('card.gone')}</p>}
      {forward && <div className="button-row"><Button variant="secondary" onClick={() => setForwarding(true)} aria-label={`${t('bundle.forward')}: ${bundle.title}`}>{t('bundle.forward')}</Button></div>}
      {forwarding && forward && <SendDialog item={{ title: bundle.title, shareRef: forward.shareRef, takesNote: true, input: (note) => forwardInput(bundle, note, source) ?? forward }} onClose={() => setForwarding(false)} />}
      {outcome && known && bundle.type.startsWith('game.') && game && <Outcome {...outcome} />}
    </div>
  )
}
