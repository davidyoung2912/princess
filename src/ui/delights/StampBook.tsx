import { useMemo } from 'react'
import { formatDate } from '../../domain/cruise'
import { itinerary, portById } from '../../domain/sailings'
import { shipOf } from '../../domain/shipCatalogue'
import { stampBook, stampBookCard, type Stamp } from '../../domain/stamps'
import { dayFor, entriesFor } from '../../domain/tripDiary'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useMemory } from '../../hooks/useMemory'
import { t, th, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { PrintCard } from './Cards'

const label = (s: Stamp): string => (s.kind === 'stage' ? t(`stamps.stage.${s.ref}` as StringKey) : portById(s.ref)?.name ?? s.ref)

/** The passport stamp book under Me: a stamp for each stage finished and each port reached, dated, with a card to print or save as an image. */
export function StampBook() {
  const sailing = useSailing()
  const now = useNow()
  const { state } = useMemory()
  const days = useMemo(() => itinerary(sailing), [sailing])
  const today = dayFor(days.map((d) => d.date), now)
  const book = stampBook(days, today, entriesFor(state.diary, sailing.id))
  const dates = days.length > 0 ? `${formatDate(days[0].date)} to ${formatDate(days[days.length - 1].date)}` : ''
  const dated = (s: Stamp): string => (s.date ? formatDate(s.date) : '')
  const lines = book.earned.map((s) => (dated(s) ? `${label(s)}, ${dated(s)}` : label(s)))
  return (
    <Card labelledBy="stamps-h">
      <h2 id="stamps-h" className="card__title no-print">{th('stamps.title')}</h2>
      <p className="no-print">{book.earned.length === 0 ? t('stamps.none') : t('stamps.count', { n: book.earned.length })}</p>
      <ul className="stamps no-print">
        {book.earned.map((s) => (
          <li key={s.id} className="stamp fun-only motion-land" data-kind={s.kind}>
            <strong>{label(s)}</strong>
            {dated(s) && <span className="stamp__date">{dated(s)}</span>}
          </li>
        ))}
        {book.waiting.map((s) => (
          <li key={s.id} className="stamp stamp--waiting" data-kind={s.kind}>
            <strong>{label(s)}</strong>
            <span className="stamp__date">{t('stamps.ahead')}</span>
          </li>
        ))}
      </ul>
      {book.earned.length > 0 && <PrintCard label={t('stamps.title')} card={stampBookCard({ title: t('stamps.cardTitle'), dates, lines, footer: shipOf(sailing.id).name })} />}
    </Card>
  )
}
