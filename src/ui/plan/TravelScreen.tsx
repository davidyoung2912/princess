import { useState } from 'react'
import type { TravelView } from '../../api/types'
import { formatTime } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { HOTELS, MODES, PORT_FACTS, TRANSPORT, type ModeId, type TravelPlan } from '../../domain/travel'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Load } from '../account/parts'
import { Back, PlanError, ReadOnly } from './common'

/** Getting to the ship (MNG-10): the port, ways to get there, a hotel the night before, and an arrival window. */
export function TravelScreen() {
  const view = useMine(() => api.plan.travel.get())
  return (
    <div className="page">
      <h1>{t('route.travel')}</h1>
      <p>{t('travel.intro')}</p>
      <Card labelledBy="port-h">
        <h2 id="port-h" className="card__title">{PORT_FACTS.name}</h2>
        <dl className="summary">
          {([['address', PORT_FACTS.address], ['airport', PORT_FACTS.airport], ['terminal', PORT_FACTS.terminal], ['boarding', PORT_FACTS.boarding], ['porters', PORT_FACTS.porters]] as const).map(([k, v]) => (
            <div key={k} className="summary__row"><dt>{t(`travel.fact.${k}` as never)}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p className="muted">{t('travel.verify')}</p>
      </Card>
      <Load state={view}>{(v) => <Planner view={v} onSaved={view.retry} />}</Load>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

function Planner({ view, onSaved }: { view: TravelView; onSaved: () => void }) {
  const [plan, setPlan] = useState<TravelPlan>(view.plan)
  const [saved, setSaved] = useState(false)
  const save = useAction(async (p: TravelPlan) => { const v = await api.plan.travel.save(p); onSaved(); return v })
  const set = (change: Partial<TravelPlan>) => { setPlan({ ...plan, ...change }); setSaved(false) }
  const submit = async () => { if (await save.run(plan)) setSaved(true) }
  const disabled = !view.canEdit || save.busy

  return (
    <>
      <ReadOnly canDo={view.canEdit} />
      {view.priority && <Banner kind="info" title={t('travel.priority')}><p>{t('travel.priorityBody')}</p></Banner>}
      <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <fieldset>
          <legend>{t('travel.window')}</legend>
          <p className="field__hint">{t('travel.windowHint', { time: formatTime(view.suggested) })}</p>
          {view.windows.map((w) => (
            <label key={w.start} className="choice">
              <input type="radio" name="window" checked={plan.window === w.start} disabled={disabled} onChange={() => set({ window: w.start })} />
              <span>{formatTime(w.start)} to {formatTime(w.end)}<small>{t(`travel.crowd.${w.crowd}` as never)}{w.start === view.suggested ? ` · ${t('travel.suggested')}` : ''}</small></span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>{t('travel.how')}</legend>
          {MODES.map((m: ModeId) => (
            <label key={m} className="choice choice--top">
              <input type="radio" name="mode" checked={plan.mode === m} disabled={disabled} onChange={() => set({ mode: m })} />
              <span>{TRANSPORT[m].name}<small>{TRANSPORT[m].blurb}</small><small>{TRANSPORT[m].cost}{TRANSPORT[m].stepFree ? ` · ${t('travel.stepFree')}` : ''}</small></span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>{t('travel.hotel')}</legend>
          <p className="field__hint">{t('travel.hotelHint')}</p>
          <label className="choice">
            <input type="radio" name="hotel" checked={plan.hotel === null} disabled={disabled} onChange={() => set({ hotel: null })} />
            <span>{t('travel.noHotel')}</span>
          </label>
          {HOTELS.map((h) => (
            <label key={h.id} className="choice choice--top">
              <input type="radio" name="hotel" checked={plan.hotel === h.id} disabled={disabled} onChange={() => set({ hotel: h.id })} />
              <span>{h.name}<small>{h.blurb}</small><small>{t('travel.rate', { rate: formatMoney(h.rate) })}{h.shuttle ? ` · ${t('travel.shuttle')}` : ''}{h.stepFree ? ` · ${t('travel.stepFree')}` : ''}</small></span>
            </label>
          ))}
          <p className="muted">{t('travel.noBooking')}</p>
        </fieldset>

        <PlanError error={save.error} />
        {saved && <p role="status" className="muted">{t('travel.saved')}</p>}
        <Button type="submit" disabled={disabled || plan.window === null}>{save.busy ? t('account.saving') : t('travel.save')}</Button>
        {plan.window === null && view.canEdit && <p className="muted">{t('travel.chooseWindow')}</p>}
      </form>
    </>
  )
}
