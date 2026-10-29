import { useState } from 'react'
import { formatTemp } from '../../domain/readiness'
import { useSettings } from '../../hooks/useSettings'
import { PACK_GROUPS, packingText } from '../../domain/packing'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Printer, Share } from '../icons'
import { Load } from '../account/parts'
import { Back, PlanError } from './common'

/** A packing list built from the itinerary, the season, the dress codes and what the party has booked (MNG-08), shareable as text. */
export function PackingScreen() {
  const [settings] = useSettings()
  const list = useMine(() => api.plan.packing.get())
  const tick = useAction(async (id: string, done: boolean) => { await api.plan.packing.tick(id, done); list.retry() })
  const [note, setNote] = useState('')

  return (
    <div className="page">
      <h1>{t('route.packing')}</h1>
      <p>{t('pack.intro')}</p>
      <Load state={list}>
        {(p) => {
          const text = packingText(t('route.packing'), p.items, p.ticked)
          const share = async () => {
            try {
              if (typeof navigator.share === 'function') await navigator.share({ title: t('route.packing'), text })
              else { await navigator.clipboard.writeText(text); setNote(t('pack.copied')) }
            } catch (e) {
              if (!(e instanceof DOMException && e.name === 'AbortError')) setNote(t('pack.shareFailed'))
            }
          }
          return (
            <>
              <Card info>
                <h2 className="card__title">{t('pack.weather')}</h2>
                <p>{t('pack.weatherLine', { high: formatTemp(p.weather.highF, settings.units), low: formatTemp(p.weather.lowF, settings.units) })} {p.weather.note}</p>
              </Card>
              <p className="progress-line" role="status">{t('pack.progress', { done: p.ticked.length, total: p.items.length })}</p>
              <progress className="meter" max={p.items.length} value={p.ticked.length} aria-label={t('pack.progress', { done: p.ticked.length, total: p.items.length })} />
              <div className="button-row">
                <Button variant="secondary" onClick={() => void share()}><Share aria-hidden="true" /> {t('pack.share')}</Button>
                <Button variant="tertiary" onClick={() => window.print()}><Printer aria-hidden="true" /> {t('pack.print')}</Button>
              </div>
              <p className="muted" role="status">{note}</p>
              <PlanError error={tick.error} />
              {PACK_GROUPS.map((g) => {
                const items = p.items.filter((i) => i.group === g)
                if (items.length === 0) return null
                return (
                  <section key={g} aria-labelledby={`pg-${g}`}>
                    <h2 id={`pg-${g}`}>{t(`pack.group.${g}` as never)}</h2>
                    {items.map((i) => (
                      <div key={i.id} className="check-row">
                        <input type="checkbox" id={`p-${i.id}`} checked={p.ticked.includes(i.id)} disabled={tick.busy} onChange={() => void tick.run(i.id, !p.ticked.includes(i.id))} />
                        <div className="check-row__text"><label htmlFor={`p-${i.id}`}><strong>{i.label}</strong></label><small>{i.why}</small></div>
                      </div>
                    ))}
                  </section>
                )
              })}
              <p className="muted">{t('pack.note', { nights: p.nights })}</p>
            </>
          )
        }}
      </Load>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}
