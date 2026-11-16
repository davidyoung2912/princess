import { Link } from 'react-router'
import { formatTime } from '../../domain/cruise'
import type { Bundle } from '../../domain/explorer/evening'
import { EXPLORER_PATHS } from '../../domain/explorer/planItems'
import type { RecommendWhy } from '../../domain/explorer/recommend'
import { t, type StringKey, headingCase } from '../../i18n'
import { Button } from '../Button'
import { ExplorerIcon } from '../explorer/ExplorerIcon'
import { Clock } from '../icons'

const WHY: Record<RecommendWhy, StringKey> = { liked: 'exp.foryou.why.liked', similarSaved: 'exp.foryou.why.saved', pinnedVenue: 'exp.foryou.why.pinned', sameKind: 'exp.foryou.why.kind' }
const TITLE: Record<Bundle['kind'], StringKey> = { morning: 'plan.bundle.morning', afternoon: 'plan.bundle.afternoon', evening: 'plan.bundle.evening', return: 'plan.bundle.return' }
const PILL: Record<Bundle['kind'], StringKey> = { morning: 'plan.bundle.pill.morning', afternoon: 'plan.bundle.pill.afternoon', evening: 'plan.bundle.pill.evening', return: 'plan.bundle.return' }
const NOTE: Record<Exclude<Bundle['kind'], 'return'>, StringKey> = { morning: 'plan.bundle.morningWhy', afternoon: 'plan.bundle.afternoonWhy', evening: 'plan.bundle.eveningWhy' }

/** "Plan my morning", "afternoon" and "evening", and the hours after a shore tour: a few things that fit the plan, each as a card with its reason, added one at a time or all together. */
export function DayBundles({ bundles, day, clockAt, busy, onAdd }: {
  bundles: Bundle[]; day: number; clockAt: (epoch: number) => string; busy: boolean; onAdd: (events: { id: string; title: string }[]) => void
}) {
  if (bundles.length === 0) return null
  return (
    <>
      <nav aria-label={t('plan.bundle.jump')}>
        <ul className="naut-jump">
          {[...bundles.map((b) => [`tp-bundle-${b.kind}`, t(PILL[b.kind])] as const), ['tp-add', t('plan.bundle.pill.explorers')] as const].map(([id, label]) => (
            <li key={id}><a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: 'start' }); document.getElementById(id)?.focus() }}>{label}</a></li>
          ))}
        </ul>
      </nav>
      {bundles.map((b) => (
        <section key={b.kind} aria-labelledby={`tp-bundle-${b.kind}`}>
          <h2 id={`tp-bundle-${b.kind}`} tabIndex={-1}>{headingCase(t(TITLE[b.kind]))}</h2>
          <p className="muted">{b.kind === 'return' ? t('plan.bundle.returnWhy', { time: b.tourEndsAt !== undefined ? clockAt(b.tourEndsAt) : '' }) : t(NOTE[b.kind])}</p>
          <ul className="event-list">
            {b.steps.map((s) => (
              <li key={s.event.id} className="event">
                <h3 className="event__title event__title--icon"><ExplorerIcon kind={s.explorer} /><Link to={`${EXPLORER_PATHS[s.explorer]}/${s.venueId}?day=${day}`}>{s.event.title}</Link></h3>
                <ul className="event__times">
                  <li><Clock aria-hidden="true" focusable="false" /><time>{formatTime(s.event.start)}</time>&nbsp;{t('plan.today.until', { time: clockAt(s.event.endAt) })}</li>
                </ul>
                {s.event.detail && <p className="event__detail">{s.event.detail}</p>}
                <p className="event__where">{s.venueTitle}</p>
                {s.why && s.about && <p className="muted">{t(WHY[s.why], { about: s.why === 'liked' || s.why === 'similarSaved' ? t(`exp.interest.${s.about}` as StringKey) : s.about })}</p>}
                <div className="plan-add"><Button variant="secondary" disabled={busy} aria-label={t('plan.bundle.addLabel', { title: s.event.title })} onClick={() => onAdd([{ id: s.event.id, title: s.event.title }])}>{t('plan.bundle.add')}</Button></div>
              </li>
            ))}
          </ul>
          <Button variant="secondary" disabled={busy} onClick={() => onAdd(b.steps.map((s) => ({ id: s.event.id, title: s.event.title })))}>{t('plan.bundle.addAll')}</Button>
        </section>
      ))}
    </>
  )
}
