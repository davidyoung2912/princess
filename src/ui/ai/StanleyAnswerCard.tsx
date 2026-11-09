import { Link } from 'react-router'
import { GUEST_SERVICES_NUMBER } from '../../domain/contacts'
import type { StanleyCard } from '../../ai/stanleyCard'
import { t, type StringKey } from '../../i18n'
import { LinkButton } from '../Button'

/** The time a card's data was read or published, as the guest would say it. Never the time of the reply. */
const dataTimeLabel = (at: number): string => new Date(at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** The "Based on" panel: who owns the data, the data's own time, how current it is, and the route to a person. Opens and closes with the keyboard like any disclosure. */
export function BasedOn({ card, onNavigate }: { card: StanleyCard; onNavigate?: () => void }) {
  const p = card.provenance
  return (
    <details className="stanley-card2__based">
      <summary>{t('stanley.card.based')}</summary>
      <dl className="stanley-card2__facts">
        {p.owner && <><dt>{t('stanley.card.owner')}</dt><dd>{p.owner}</dd></>}
        <dt>{t('stanley.card.dataTime')}</dt>
        <dd>{p.dataTime === null ? t('stanley.card.noTime') : <time dateTime={new Date(p.dataTime).toISOString()}>{dataTimeLabel(p.dataTime)}</time>}</dd>
        <dt>{t('stanley.card.freshness')}</dt>
        <dd>{t(`stanley.card.freshness.${p.freshness}` as StringKey)}</dd>
      </dl>
      {p.note && <p className="muted">{p.note}</p>}
      {p.checkWithPerson && (
        <p>
          <strong>{t('stanley.card.person')}</strong>{' '}
          {t('stanley.card.person.help', { phone: GUEST_SERVICES_NUMBER })}{' '}
          <Link to="/chat" onClick={onNavigate}>{t('route.chat')}</Link>
        </p>
      )}
    </details>
  )
}

/**
 * Stanley's structured answer: a title, plain lines, chips saying where it came from, and an expandable "Based on" panel. An answer that could not be confirmed says so in
 * words as well as colour, so it is never mistaken for a fact.
 */
export function StanleyAnswerCard({ card, onNavigate }: { card: StanleyCard; onNavigate?: () => void }) {
  return (
    <section className={`stanley-card2${card.abstained ? ' stanley-card2--abstained' : ''}`} aria-label={card.title}>
      <h3 className="stanley-card2__title">{card.title}</h3>
      {card.abstained && <p className="stanley-card2__flag"><strong>{t('stanley.card.abstained')}</strong></p>}
      {card.lines.map((l, i) => <p key={i} className="stanley-card2__line">{l}</p>)}
      {card.provenance.chips.length > 0 && (
        <ul className="stanley-card2__chips" aria-label={t('stanley.card.chips')}>
          {card.provenance.chips.map((c) => <li key={c} className={`stanley-card2__chip stanley-card2__chip--${c.toLowerCase().replace(/\s+/g, '-')}`}>{c}</li>)}
        </ul>
      )}
      <BasedOn card={card} onNavigate={onNavigate} />
      {card.links.length > 0 && (
        <p className="stanley__actions">{card.links.slice(0, 3).map((a) => <LinkButton key={a.path} variant="secondary" to={a.path} onClick={onNavigate}>{t('stanley.open', { name: a.label })}</LinkButton>)}</p>
      )}
    </section>
  )
}
