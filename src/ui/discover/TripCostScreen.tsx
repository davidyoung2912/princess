import { useState } from 'react'
import { Link } from 'react-router'
import { EXCURSIONS } from '../../domain/excursions'
import { useCatalogue } from '../../hooks/useCatalogue'
import { parseMoney } from '../../domain/money'
import { MAX_GUESTS } from '../../domain/priceShapes'
import { formatMoney } from '../../domain/money'
import { fareName, MAX_DINNERS, tripCost, type CostKey } from '../../domain/tripCost'
import type { CategoryId } from '../../domain/ship'
import { sailingFor } from '../../domain/shipCatalogue'
import { zonedToEpoch } from '../../domain/timezones'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useDaysOf, usePricedSailings, useRoomChoices, useSailingRooms } from '../../hooks/useShipCatalogue'
import { t, th, type StringKey } from '../../i18n'
import { Card } from '../Card'
import { Field } from '../Field'
import { budgetNote } from '../../domain/planning'
import { useMemory } from '../../hooks/useMemory'
import { Banner } from '../Banner'

const DAY = 86_400_000

/** Whole-trip cost (DIS-12): the cruise, the extras the guest expects to want, and the money spent around it, compared across the fares. */
export function TripCostScreen() {
  useCatalogue()
  const demoSailing = useSailing()
  const { state: memory, update: updateMemory } = useMemory()
  const [budgetText, setBudgetText] = useState('')
  const now = useNow()
  const sailings = usePricedSailings()
  const [pickedSailing, setSailingId] = useState(demoSailing.id)
  // The sailing the guest chose, else the one they are on; if that has no fares, the soonest sailing that does.
  const sailingId = sailings.some((s) => s.id === pickedSailing) ? pickedSailing : (sailings[0]?.id ?? pickedSailing)
  const rooms = useRoomChoices(sailingId)
  useSailingRooms(sailingId)
  const [pickedRoom, setCategory] = useState<CategoryId>('balcony')
  const category = rooms.some((r) => r.id === pickedRoom) ? pickedRoom : (rooms.find((r) => r.id === 'balcony') ?? rooms[0])?.id ?? ''
  const ports = new Set(useDaysOf(sailingId).map((d) => d.port))
  const excursions = EXCURSIONS.filter((x) => ports.has(x.port))
  const [guests, setGuests] = useState(2)
  const [adults, setAdults] = useState(2)
  const [drinks, setDrinks] = useState(false)
  const [wifi, setWifi] = useState(false)
  const [dinners, setDinners] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState({ flights: '', hotel: '', other: '' })

  const sailing = sailingFor(sailingId)
  const days = !sailing ? 0 : Math.max(0, Math.ceil((zonedToEpoch(sailing.departure, '00:00', 'America/New_York') - now) / DAY))
  const amounts = (['flights', 'hotel', 'other'] as const).map((k) => [k, text[k].trim() === '' ? 0 : parseMoney(text[k])] as const)
  const bad = (k: 'flights' | 'hotel' | 'other') => amounts.find(([key]) => key === k)![1] === null
  const money = (k: 'flights' | 'hotel' | 'other') => amounts.find(([key]) => key === k)![1] ?? 0
  const cost = !sailing || !category ? null : tripCost({ sailingId, category, guests, adults: Math.min(adults, guests), daysToDeparture: days, drinks, wifi, dinners, excursionIds: picked.filter((id) => excursions.some((x) => x.id === id)), flights: money('flights'), hotel: money('hotel'), other: money('other') })
  const rows = cost ? [...new Set(cost.options.flatMap((o) => o.lines.map((l) => l.key)))] as CostKey[] : []
  const order: CostKey[] = ['cruise', 'gratuities', 'package', 'drinks', 'wifi', 'dining', 'excursions', 'excursionCredit', 'flights', 'hotel', 'other']
  rows.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const cents = (fare: string, key: CostKey) => cost!.options.find((o) => o.fare === fare)!.lines.find((l) => l.key === key)?.cents

  return (
    <div className="page">
      <p>{t('cost.intro')}</p>

      <Card>
        <div className="field">
          <label htmlFor="cost-sailing">{t('cost.sailing')}</label>
          <select id="cost-sailing" value={sailingId} onChange={(e) => setSailingId(e.target.value)}>
            {sailings.map((s) => <option key={s.id} value={s.id}>{s.departure} · {s.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cost-room">{t('cost.room')}</label>
          <select id="cost-room" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
            {rooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cost-guests">{t('cost.guests')}</label>
          <select id="cost-guests" value={guests} onChange={(e) => { const n = Number(e.target.value); setGuests(n); setAdults(Math.min(adults, n)) }}>
            {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cost-adults">{t('cost.adults')}</label>
          <p className="field__hint">{t('cost.adults.hint')}</p>
          <select id="cost-adults" value={Math.min(adults, guests)} onChange={(e) => setAdults(Number(e.target.value))}>
            {Array.from({ length: guests + 1 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </Card>

      <section aria-labelledby="cost-wants-h">
        <h2 id="cost-wants-h">{th('cost.wants')}</h2>
        <div className="field">
          <label><input type="checkbox" checked={drinks} onChange={(e) => setDrinks(e.target.checked)} /> {t('cost.drinks')}</label>
        </div>
        <div className="field">
          <label><input type="checkbox" checked={wifi} onChange={(e) => setWifi(e.target.checked)} /> {t('cost.wifi')}</label>
        </div>
        <div className="field">
          <label htmlFor="cost-dinners">{t('cost.dinners')}</label>
          <select id="cost-dinners" value={dinners} onChange={(e) => setDinners(Number(e.target.value))}>
            {Array.from({ length: MAX_DINNERS + 1 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <fieldset className="field">
          <legend>{t('cost.excursions')}</legend>
          {excursions.map((x) => (
            <label key={x.id} className="check-row">
              <input type="checkbox" checked={picked.includes(x.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, x.id] : picked.filter((id) => id !== x.id))} /> {x.name} <span className="muted">{formatMoney(x.price)}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section aria-labelledby="cost-out-h">
        <h2 id="cost-out-h">{th('cost.outside')}</h2>
        <p className="muted">{t('cost.outside.hint')}</p>
        {(['flights', 'hotel', 'other'] as const).map((k) => (
          <Field key={k} label={t(`cost.${k}` as StringKey)} inputMode="numeric" value={text[k]} onChange={(e) => setText({ ...text, [k]: e.target.value })} error={bad(k) ? t('cost.bad') : undefined} />
        ))}
      </section>

      <section aria-labelledby="cost-cmp-h" aria-live="polite">
        <h2 id="cost-cmp-h">{th('cost.compare')}</h2>
        {!cost ? <p role="status">{t('cost.notFound')}</p> : (
          <>
            <Card info>
              <p><strong>{t('cost.cheapest', { fare: fareName(cost.cheapest) })}</strong></p>
              <BudgetNote total={cost.options.find((o) => o.fare === cost.cheapest)!.total} budget={memory.budget} text={budgetText} setText={setBudgetText} save={(v) => updateMemory((m) => ({ ...m, budget: v }))} />
              <p>{cost.savingVsStandard > 0 ? t('cost.saving', { fare: fareName(cost.cheapest), amount: formatMoney(cost.savingVsStandard) }) : t('cost.noSaving')}</p>
            </Card>
            <table className="cost-table">
              <caption className="visually-hidden">{t('cost.table')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('cost.item')}</th>
                  {cost.options.map((o) => <th key={o.fare} scope="col">{fareName(o.fare)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((key) => (
                  <tr key={key}>
                    <th scope="row">{t(`cost.line.${key}` as StringKey)}</th>
                    {cost.options.map((o) => { const c = cents(o.fare, key); return <td key={o.fare}>{c === undefined ? '–' : formatMoney(c)}</td> })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t('cost.total')}</th>
                  {cost.options.map((o) => <td key={o.fare}><strong>{formatMoney(o.total)}</strong><br /><span className="muted">{t('cost.perPerson', { amount: formatMoney(o.perPerson) })}</span></td>)}
                </tr>
              </tfoot>
            </table>
          </>
        )}
        <p className="muted">{t('cost.footnote')}</p>
        <p><Link to={`/home/sailings/${sailingId}`}>{t('route.sailing')}</Link></p>
      </section>
    </div>
  )
}

/** Notes at 80 and over 100 percent of the guest's own budget for the whole trip (S4-08). Words and a number, never a block. */
function BudgetNote({ total, budget, text, setText, save }: { total: number; budget: number | null; text: string; setText: (v: string) => void; save: (v: number | null) => void }) {
  const typed = text.trim() === '' ? undefined : parseMoney(text)
  const note = budgetNote(total, budget)
  return (
    <div>
      <Field label={t('cost.budget')} inputMode="decimal" value={text !== '' ? text : budget === null ? '' : String(budget / 100)} error={typed === null ? t('cost.invalid') : undefined}
        onChange={(e) => { setText(e.target.value); const v = e.target.value.trim() === '' ? null : parseMoney(e.target.value); if (v !== undefined && (v === null || v > 0)) save(e.target.value.trim() === '' ? null : v) }} />
      {note && <Banner kind={note.level === 100 ? 'warning' : 'info'} title={t(note.level === 100 ? 'cost.budget.100' : note.level === 80 ? 'cost.budget.80' : 'cost.budget.ok', { percent: note.percent, over: formatMoney(note.over) })} />}
    </div>
  )
}
