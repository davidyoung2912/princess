import { excursionById } from '../../domain/excursions'
import { formatDate, formatTime } from '../../domain/cruise'
import type { PlanDay } from '../../domain/plan'
import { boardDays, canJoin, withGuest } from '../../domain/groupBoard'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t, th } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { ActionError } from '../account/parts'
import { Guests } from '../delights/PlanPolish'
import { useTravellerColours } from '../delights/travellerColours'
import { firstName } from './people'

/** The shared week as a column for each day: who is doing each tour and dinner, who is on two things at once, and a Join button on tours (N-P1). */
export function GroupBoard({ days, reload }: { days: readonly PlanDay[]; reload: () => void }) {
  const me = usePersona()?.id ?? ''
  const colour = useTravellerColours(days)
  const view = useMine(() => api.plan.excursions.list())
  const join = useAction(async (bookingId: string, guests: string[]) => { await api.plan.excursions.changeGuests(bookingId, guests); view.retry(); reload() })
  if (view.status !== 'ready') return null
  const party = view.data.party.map((p) => p.id)
  if (party.length < 2) return null
  const hours = (id: string) => { const b = view.data.booked.find((x) => x.id === id); return b ? (excursionById(b.excursionId)?.hours ?? null) : null }
  const board = boardDays(days, hours).filter((d) => d.items.length > 0)
  const mayJoin = view.data.canBook
  return (
    <Card labelledBy="gboard-h">
      <h2 id="gboard-h" className="card__title">{th('gboard.title')}</h2>
      <p>{t('gboard.intro')}</p>
      {board.length === 0 ? <p>{t('gboard.none')}</p> : (
        <ol className="board-columns">
          {board.map((d) => (
            <li key={d.day} className="board-column">
              <h3>{t('plan.day', { n: d.day })} · {formatDate(d.date)}</h3>
              <p className="muted">{d.place || t('plan.atSea')}</p>
              <ul className="board-items">
                {d.items.map((i) => (
                  <li key={i.key}>
                    <strong>{formatTime(i.time)}</strong> {t(i.kind === 'tour' ? 'plan.entry.tour' : 'plan.entry.dinner', { name: i.name })}
                    <Guests guests={i.guests} colour={colour} />
                    {i.clashing.length > 0 && <p role="note"><strong>{t('gboard.clash', { names: i.clashing.map(firstName).join(', ') })}</strong></p>}
                    {mayJoin && canJoin(i, d, me, party) && <Button variant="secondary" disabled={join.busy} onClick={() => void join.run(i.bookingId, withGuest(i.guests, me))}>{t('gboard.join')}<span className="visually-hidden"> {i.name}</span></Button>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <ActionError error={join.error} />
    </Card>
  )
}
