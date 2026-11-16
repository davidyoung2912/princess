import { useState } from 'react'
import { Link } from 'react-router'
import type { ExplorerDay } from '../../api/explorerTypes'
import { formatTime } from '../../domain/cruise'
import { interestsOf, venueHideId, type EventPick, type RecommendWhy, type VenuePick } from '../../domain/explorer/recommend'
import { useAddToPlan } from '../../hooks/useAddToPlan'
import { useTaste } from '../../hooks/useTaste'
import { t, type StringKey, headingCase } from '../../i18n'
import { Card } from '../Card'
import { Chip } from '../Chip'

const WHY: Record<RecommendWhy, StringKey> = { liked: 'exp.foryou.why.liked', similarSaved: 'exp.foryou.why.saved', pinnedVenue: 'exp.foryou.why.pinned', sameKind: 'exp.foryou.why.kind' }
const interestLabel = (i: string): string => t(`exp.interest.${i}` as StringKey)

/** "Because you like Music", "Like something on your plan"... Names the signal so the guest can see why and change it. */
const whyText = (why: RecommendWhy, about: string): string => t(WHY[why], { about: why === 'liked' || why === 'similarSaved' ? interestLabel(about) : about })

/**
 * The "For you" card of an Explorer: a few suggestions with the reason for each, a Not for me button on every one, and the interest themes the guest can change at any time.
 * Hidden suggestions can be brought back. With no interest chosen and nothing to go by, the card only offers the themes.
 */
export function ForYou({ data, events, venues, venueTitles, basePath, onChanged }: { data: ExplorerDay; events: EventPick[]; venues: VenuePick[]; venueTitles: Record<string, string>; basePath: string; onChanged: () => void }) {
  const plan = useAddToPlan(data.day, onChanged)
  const { profile: taste, ready, hide, toggleLike, restoreHidden } = useTaste()
  const [message, setMessage] = useState('')
  const themes = interestsOf(data)
  if (themes.length === 0 || !ready) return null
  const dismiss = async (id: string, title: string) => {
    setMessage((await hide(id)) ? t('exp.foryou.hidden', { title }) : t('exp.foryou.failed'))
  }
  return (
    <Card labelledBy="exp-foryou-h">
      <h2 id="exp-foryou-h" className="card__title">{headingCase(t('exp.foryou.title'))}</h2>
      {events.length + venues.length === 0 && <p className="muted">{taste.likes.length === 0 ? t('exp.foryou.choose') : t('exp.foryou.none')}</p>}
      {events.length > 0 && (
        <ul className="plain-bullets">
          {events.map((p) => (
            <li key={p.event.id}>
              <Link to={`${basePath}/${p.venueId}?day=${data.day}`}>{t('exp.foryou.event', { title: p.event.title, time: formatTime(p.event.start), venue: p.venueTitle })}</Link>{' '}
              <span className="muted">{whyText(p.why, p.about)}</span>{' '}
              <button type="button" className="link-button" disabled={plan.busy} aria-label={t('exp.add.label', { title: p.event.title })} onClick={() => { void plan.add([{ id: p.event.id, title: p.event.title }]) }}>{t('exp.add.button')}</button>{' '}
              <button type="button" className="link-button" onClick={() => { void dismiss(p.event.id, p.event.title) }}>{t('exp.foryou.dismiss')}</button>
            </li>
          ))}
        </ul>
      )}
      {venues.length > 0 && (
        <ul className="plain-bullets">
          {venues.map((p) => (
            <li key={p.venueId}>
              <Link to={`${basePath}/${p.venueId}?day=${data.day}`}>{venueTitles[p.venueId] ?? p.venueId}</Link>{' '}
              <span className="muted">{whyText(p.why, p.about)}</span>{' '}
              <button type="button" className="link-button" onClick={() => { void dismiss(venueHideId(p.venueId), venueTitles[p.venueId] ?? p.venueId) }}>{t('exp.foryou.dismiss')}</button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="visually-hidden">{message || plan.message}</p>
      <details>
        <summary>{t('exp.foryou.tune')}</summary>
        <div className="chip-row" role="group" aria-label={t('exp.foryou.themes')}>
          {themes.map((i) => <Chip key={i} pressed={taste.likes.includes(i)} onToggle={() => { void toggleLike(i).then((ok) => { if (!ok) setMessage(t('exp.foryou.failed')) }) }}>{interestLabel(i)}</Chip>)}
        </div>
        {taste.hidden.length > 0 && <button type="button" className="link-button" onClick={() => { void restoreHidden().then((ok) => setMessage(ok ? t('exp.foryou.restored') : t('exp.foryou.failed'))) }}>{t('exp.foryou.restore')}</button>}
      </details>
    </Card>
  )
}
