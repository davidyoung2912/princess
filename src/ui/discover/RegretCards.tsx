import { type RegretCard } from '../../domain/regret'
import { t } from '../../i18n'

/** "What you might regret" (N6.2): one plain line each, with the fact it comes from. Shows nothing when there is nothing to say. */
export function RegretCards({ cards, heading, headingId }: { cards: readonly RegretCard[]; heading: string; headingId: string }) {
  if (cards.length === 0) return null
  return (
    <section aria-labelledby={headingId}>
      <h4 id={headingId}>{heading}</h4>
      <ul className="plain-bullets">
        {cards.map((c) => <li key={c.id}>{c.line} <span className="muted">{t('regret.evidence', { text: c.evidence })}</span></li>)}
      </ul>
    </section>
  )
}
