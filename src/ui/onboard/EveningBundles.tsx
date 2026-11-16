import { Link } from 'react-router'
import { formatTime } from '../../domain/cruise'
import type { Bundle } from '../../domain/explorer/evening'
import { EXPLORER_PATHS } from '../../domain/explorer/planItems'
import type { RecommendWhy } from '../../domain/explorer/recommend'
import { t, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'

const WHY: Record<RecommendWhy, StringKey> = { liked: 'exp.foryou.why.liked', similarSaved: 'exp.foryou.why.saved', pinnedVenue: 'exp.foryou.why.pinned', sameKind: 'exp.foryou.why.kind' }

/** "Plan my evening" and the hours after a shore tour: a few things that fit the plan, each with its reason, added one at a time or all together. */
export function EveningBundles({ bundles, day, clockAt, busy, onAdd }: {
  bundles: Bundle[]; day: number; clockAt: (epoch: number) => string; busy: boolean; onAdd: (events: { id: string; title: string }[]) => void
}) {
  if (bundles.length === 0) return null
  return (
    <>
      {bundles.map((b) => (
        <Card key={b.kind} labelledBy={`tp-bundle-${b.kind}`}>
          <h2 id={`tp-bundle-${b.kind}`} className="card__title">{t(b.kind === 'return' ? 'plan.bundle.return' : 'plan.bundle.evening')}</h2>
          <p className="muted">{b.kind === 'return' && b.tourEndsAt !== undefined ? t('plan.bundle.returnWhy', { time: clockAt(b.tourEndsAt) }) : t('plan.bundle.eveningWhy')}</p>
          <ul className="plain-bullets">
            {b.steps.map((s) => (
              <li key={s.event.id}>
                <Link to={`${EXPLORER_PATHS[s.explorer]}/${s.venueId}?day=${day}`}>{t('plan.bundle.step', { title: s.event.title, time: formatTime(s.event.start), venue: s.venueTitle })}</Link>{' '}
                {s.why && s.about && <span className="muted">{t(WHY[s.why], { about: s.why === 'liked' || s.why === 'similarSaved' ? t(`exp.interest.${s.about}` as StringKey) : s.about })}</span>}{' '}
                <button type="button" className="link-button" disabled={busy} aria-label={t('plan.bundle.addLabel', { title: s.event.title })} onClick={() => onAdd([{ id: s.event.id, title: s.event.title }])}>{t('plan.bundle.add')}</button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" disabled={busy} onClick={() => onAdd(b.steps.map((s) => ({ id: s.event.id, title: s.event.title })))}>{t('plan.bundle.addAll')}</Button>
        </Card>
      ))}
    </>
  )
}
