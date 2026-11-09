import { useState } from 'react'
import { Link } from 'react-router'
import { parseMoney } from '../../domain/money'
import { formatMoney } from '../../domain/money'
import { ADD_ONS } from '../../domain/packages'
import { formatDate } from '../../domain/cruise'
import { buildReel } from '../../domain/highlightReel'
import { entriesFor } from '../../domain/tripDiary'
import { HighlightReel } from '../delights/HighlightReel'
import { anniversaryOn, buildWrapped, cardText, expenseCsv, packageHindsight, type ExpenseRow } from '../../domain/wrapped'
import { api } from '../../runtime'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useMemory } from '../../hooks/useMemory'
import { useMine } from '../../hooks/useMine'
import { useRecapData } from '../../hooks/useRecapData'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { BackLink } from '../onboard/common'
import { Load } from './parts'

const num = (v: string): number => (v.trim() === '' ? 0 : Math.max(0, Math.round(Number(v)) || 0))

async function shareText(text: string, title: string): Promise<'shared' | 'copied' | 'failed' | null> {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return 'shared' }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (e) {
    return (e as Error).name === 'AbortError' ? null : 'failed'
  }
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Wrapped, package hindsight, "this day last year" and the expense export (S8-01, S8-04, S8-07, S8-08). Nothing is posted; a card is text the guest chooses to send. */
export function WrappedScreen() {
  const sailing = useSailing()
  const now = useNow()
  const { state, update } = useMemory()
  const recap = useRecapData()
  const folio = useMine(() => api.onboard.folio())
  const [shared, setShared] = useState<Record<string, string>>({})
  const [paidText, setPaidText] = useState(state.use.paid > 0 ? String(state.use.paid / 100) : '')
  const [drinksText, setDrinksText] = useState(state.drinks === null ? '' : String(state.drinks))

  const paid = parseMoney(paidText)
  const hindsight = paid !== null && paid > 0 ? packageHindsight({ paid, drinks: state.use.drinks, specialtyDinners: state.use.dinners, wifiNights: state.use.wifiNights, wifiNight: ADD_ONS.wifi.base, otherFarePaid: null }) : null
  const today = new Date(now).toISOString().slice(0, 10)
  const memory = anniversaryOn(sailing, today, state.anniversary)
  const setUse = (k: 'drinks' | 'dinners' | 'wifiNights', v: string) => update((s) => ({ ...s, use: { ...s.use, [k]: num(v) } }))

  const share = async (id: string, text: string, title: string) => {
    const r = await shareText(text, title)
    setShared((s) => ({ ...s, [id]: r ?? '' }))
  }

  const rows = (): ExpenseRow[] => (folio.data?.lines ?? []).map((l) => ({ date: new Date(l.at).toISOString().slice(0, 10), description: l.description, category: l.category, cents: l.cents })).filter((r) => r.cents !== 0)

  return (
    <div className="page">
      <p>{t('wrapped.intro')}</p>

      {memory && (
        <Card info labelledBy="wrapped-ann">
          <h2 id="wrapped-ann" className="card__title">{th('wrapped.annTitle')}</h2>
          <p>{memory.text}</p>
        </Card>
      )}

      <Load state={recap}>
        {(r) => {
          const diary = entriesFor(state.diary, sailing.id)
          const cards = buildWrapped(r, { drinks: state.drinks }, { steps: state.aboard.steps, sightings: state.aboard.sightings.length, diary })
          return (
            <>
              <HighlightReel slides={buildReel(sailing, r, cards, diary)} />
              {cards.map((c) => (
                <Card key={c.id} labelledBy={`w-${c.id}`}>
                  <div className="wrapped-card">
                    <h2 id={`w-${c.id}`} className="card__title">{c.title}</h2>
                    <p className="wrapped-card__big">{c.big}</p>
                    <p>{c.line}</p>
                  </div>
                  <Button variant="secondary" onClick={() => void share(c.id, cardText(c), c.title)}>{t('wrapped.share')}</Button>
                  {shared[c.id] && <p role="status">{t(`recap.shared.${shared[c.id]}` as StringKey)}</p>}
                </Card>
              ))}
              <p className="muted">{t('wrapped.never')}</p>
            </>
          )
        }}
      </Load>

      <Card labelledBy="wrapped-drinks">
        <h2 id="wrapped-drinks" className="card__title">{th('wrapped.drinks')}</h2>
        <p>{t('wrapped.drinksBody')}</p>
        <Field label={t('wrapped.drinksCount')} inputMode="numeric" value={drinksText} onChange={(e) => setDrinksText(e.target.value)} />
        <div className="actions">
          <Button variant="secondary" onClick={() => update((s) => ({ ...s, drinks: num(drinksText) > 0 ? num(drinksText) : null }))}>{t('wrapped.drinksShow')}</Button>
          <Button variant="tertiary" onClick={() => { setDrinksText(''); update((s) => ({ ...s, drinks: null })) }}>{t('wrapped.drinksHide')}</Button>
        </div>
      </Card>

      <Card labelledBy="wrapped-hind">
        <h2 id="wrapped-hind" className="card__title">{th('wrapped.hindsight')}</h2>
        <p>{t('wrapped.hindsightBody')}</p>
        <Field label={t('wrapped.paid')} help={t('helptip.packagePaid')} inputMode="decimal" value={paidText} onChange={(e) => { setPaidText(e.target.value); const c = parseMoney(e.target.value); update((m) => ({ ...m, use: { ...m.use, paid: c ?? 0 } })) }} error={paidText.trim() !== '' && paid === null ? t('wrapped.paidBad') : undefined} />
        <Field label={t('wrapped.useDrinks')} inputMode="numeric" value={state.use.drinks ? String(state.use.drinks) : ''} onChange={(e) => setUse('drinks', e.target.value)} />
        <Field label={t('wrapped.useDinners')} inputMode="numeric" value={state.use.dinners ? String(state.use.dinners) : ''} onChange={(e) => setUse('dinners', e.target.value)} />
        <Field label={t('wrapped.useWifi')} inputMode="numeric" value={state.use.wifiNights ? String(state.use.wifiNights) : ''} onChange={(e) => setUse('wifiNights', e.target.value)} />
        {hindsight ? <p role="status"><strong>{hindsight.line}</strong></p> : <p className="muted">{t('wrapped.hindsightEmpty')}</p>}
        <p className="muted">{t('wrapped.hindsightNote', { drink: formatMoney(1100) })}</p>
      </Card>

      <Card labelledBy="wrapped-ann-set">
        <h2 id="wrapped-ann-set" className="card__title">{th('wrapped.annSetting')}</h2>
        <label className="choice"><input type="checkbox" checked={state.anniversary} onChange={(e) => update((s) => ({ ...s, anniversary: e.target.checked }))} /><span>{t('wrapped.annOn')}<small>{t('wrapped.annHint', { date: formatDate(sailing.departure) })}</small></span></label>
      </Card>

      <Card labelledBy="wrapped-exp">
        <h2 id="wrapped-exp" className="card__title">{th('wrapped.expenses')}</h2>
        <p>{t('wrapped.expensesBody')}</p>
        <Load state={folio}>
          {(f) => (
            <>
              <p>{t('wrapped.expenseCount', { count: f.lines.filter((l) => l.cents !== 0).length })}</p>
              <div className="actions no-print">
                <Button variant="secondary" onClick={() => download('princess-expenses.csv', expenseCsv(rows()), 'text/csv')}>{t('wrapped.csv')}</Button>
                <Button variant="secondary" onClick={() => window.print()}>{t('wrapped.print')}</Button>
              </div>
            </>
          )}
        </Load>
        <p className="muted">{t('wrapped.expensesNote')}</p>
      </Card>

      <p><Link to="/me/memories">{t('route.memories')}</Link> · <Link to="/me/recap">{t('route.recap')}</Link> · <Link to="/me/bill">{t('route.bill')}</Link></p>
      <BackLink to="/me" label={t('route.me')} />
    </div>
  )
}
