import { useState } from 'react'
import { Link } from 'react-router'
import { BAG_STAGES, TAGS_PER_GUEST, TAG_ORDER_DAYS, TAG_WAYS } from '../../domain/ahead'
import { formatDate, formatDayMonth } from '../../domain/cruise'
import { CLEARANCE, formatTemp, outlook, prepDue, PREP, uvBand, type ClimatePort, type ClearanceCitizenship, type PrepGroup } from '../../domain/readiness'
import { itinerary } from '../../domain/sailings'
import { PORTS } from '../../domain/sailings'
import { addDays, dateIn } from '../../domain/timezones'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { useMine } from '../../hooks/useMine'
import { useNow, useSailing } from '../../hooks/useDemo'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'
import { Load } from '../account/parts'
import { formatDateTime } from '../account/format'
import { AheadError, Back, ChildNote } from './common'

/** The medallion: where it is, how to switch it on, and what to do if it is lost (CHK-06). */
export function MedallionScreen() {
  const view = useMine(() => api.ahead.medallion.view())
  const activate = useAction(async () => { await api.ahead.medallion.activate(); view.retry() })
  const lost = useAction(async () => { await api.ahead.medallion.lost(); view.retry() })
  return (
    <div className="page">
      <h1>{t('route.medallion')}</h1>
      <p>{t('med.intro')}</p>
      <ChildNote />
      <Load state={view}>
        {(v) => (
          <>
            <Card hero labelledBy="med-h">
              <h2 id="med-h" className="card__title">{t(`med.stage.${v.stage}` as StringKey)}</h2>
              <p>{t(`med.stageBody.${v.stage}` as StringKey)}</p>
              {v.stage !== 'collect' && <p className="muted">{t('med.tracking', { number: v.trackingNumber })}</p>}
              <ol className="plain-bullets">
                {v.events.map((e) => <li key={e.id}>{t(`med.event.${e.id}` as StringKey)} · {formatDateTime(e.at)}</li>)}
              </ol>
              <p>{t('med.for', { names: v.guests.map((g) => g.name.split(' ')[0]).join(', ') })}</p>
            </Card>
            {v.lostAt !== null ? (
              <Banner kind="warning" title={t('med.lostTitle')}><p>{t('med.lostBody')}</p></Banner>
            ) : v.activatedAt !== null ? (
              <Banner kind="success" title={t('med.active')}><p>{t('med.activeBody')}</p></Banner>
            ) : (
              <Card>
                <h2 className="card__title">{t('med.activate')}</h2>
                <p>{v.canActivate ? t('med.activateBody') : t('med.activateWait')}</p>
                <Button disabled={!v.canActivate || activate.busy || !v.canEdit} onClick={() => void activate.run()}>{t('med.activateButton')}</Button>
              </Card>
            )}
            <AheadError error={activate.error ?? lost.error} />
            {v.lostAt === null && (
              <Card>
                <h2 className="card__title">{t('med.lost')}</h2>
                <p>{t('med.lostHelp')}</p>
                <Button variant="secondary" disabled={lost.busy || !v.canEdit} onClick={() => void lost.run()}>{t('med.lostButton')}</Button>
              </Card>
            )}
          </>
        )}
      </Load>
      <Back to="/" label={t('route.home')} />
    </div>
  )
}

/** Luggage tags to print, show on the phone or have mailed, and an estimate of where the bags are (CHK-09). */
export function LuggageScreen() {
  const view = useMine(() => api.ahead.tags.view())
  const choose = useAction(async (way: (typeof TAG_WAYS)[number]) => { await api.ahead.tags.choose(way); view.retry() })
  const handed = useAction(async (on: boolean) => { await api.ahead.tags.handedOver(on); view.retry() })
  return (
    <div className="page">
      <h1>{t('route.luggage')}</h1>
      <p>{t('tag.intro', { count: TAGS_PER_GUEST })}</p>
      <ChildNote />
      <AheadError error={choose.error ?? handed.error} />
      <Load state={view}>
        {(v) => (
          <>
            <fieldset>
              <legend>{t('tag.how')}</legend>
              {TAG_WAYS.map((w) => (
                <label key={w} className="choice choice--top">
                  <input type="radio" name="tag-way" checked={v.way === w} disabled={choose.busy || !v.canEdit || (w === 'order' && v.daysToDeparture < TAG_ORDER_DAYS)} onChange={() => void choose.run(w)} />
                  <span>{t(`tag.way.${w}` as StringKey)}<small>{t(`tag.wayBody.${w}` as StringKey, { days: TAG_ORDER_DAYS })}</small></span>
                </label>
              ))}
            </fieldset>
            {v.way && (
              <section aria-labelledby="tag-list-h">
                <h2 id="tag-list-h">{t('tag.yours')}</h2>
                <ul className="card-grid">
                  {v.guests.map((g) => (
                    <li key={g.id}>
                      <Card>
                        <h3 className="card__title">{g.printed}</h3>
                        <p>{t('tag.label', { cabin: g.cabin, deck: g.deck })}</p>
                        <p className="muted">{t(`tag.shown.${v.way}` as StringKey)}</p>
                      </Card>
                    </li>
                  ))}
                </ul>
                {v.way === 'print' && <Button variant="secondary" onClick={() => window.print()}>{t('tag.print')}</Button>}
                {v.way === 'order' && v.orderedAt !== null && <p role="status"><StatusBadge kind="booked" label={t('tag.ordered')} /></p>}
                <h2>{t('tag.track')}</h2>
                <p className="muted">{t('tag.trackNote')}</p>
                <ol className="plain-bullets" aria-label={t('tag.track')}>
                  {BAG_STAGES.map((s) => <li key={s}>{v.stage === s ? <strong>{t(`tag.stage.${s}` as StringKey)} ({t('tag.now')})</strong> : t(`tag.stage.${s}` as StringKey)}</li>)}
                </ol>
                {v.handedOverAt === null
                  ? <Button variant="secondary" disabled={handed.busy || !v.canEdit} onClick={() => void handed.run(true)}>{t('tag.handed')}</Button>
                  : <Button variant="tertiary" disabled={handed.busy} onClick={() => void handed.run(false)}>{t('tag.undo')}</Button>}
              </section>
            )}
          </>
        )}
      </Load>
      <Back to="/" label={t('route.home')} />
    </div>
  )
}

/** What to carry, and which forms (if any) each stop needs (CHK-10). */
export function ClearanceScreen() {
  const [who, setWho] = useState<ClearanceCitizenship>('us')
  return (
    <div className="page">
      <h1>{t('route.clearance')}</h1>
      <p>{t('clr.intro')}</p>
      <fieldset>
        <legend>{t('clr.who')}</legend>
        {(['us', 'other'] as const).map((c) => (
          <label key={c} className="choice">
            <input type="radio" name="clr-who" checked={who === c} onChange={() => setWho(c)} />
            {t(`clr.who.${c}` as StringKey)}
          </label>
        ))}
      </fieldset>
      <ul className="card-grid">
        {CLEARANCE.map((c) => (
          <li key={c.port}>
            <Card>
              <h2 className="card__title">{PORTS[c.port].name}: {c.country}</h2>
              <h3>{t('clr.carry')}</h3>
              <p>{c.documents[who]}</p>
              <h3>{t('clr.forms')}</h3>
              <ul className="plain-bullets">{c.forms.map((f) => <li key={f}>{f}</li>)}</ul>
              <h3>{t('clr.notes')}</h3>
              <ul className="plain-bullets">{c.notes.map((f) => <li key={f}>{f}</li>)}</ul>
            </Card>
          </li>
        ))}
      </ul>
      <Banner kind="warning" title={t('clr.check')}><p>{t('clr.checkBody')} <Link to="/plan/travel">{t('route.travel')}</Link></p></Banner>
      <Back to="/" label={t('route.home')} />
    </div>
  )
}

/** Typical weather for each stop on the dates of this sailing, in the units chosen in Settings (MNG-09). */
export function WeatherScreen() {
  const s = useSailing()
  const [settings] = useSettings()
  const days = itinerary(s)
  return (
    <div className="page">
      <h1>{t('route.weather')}</h1>
      <p>{t('wx.intro')}</p>
      <ul className="card-grid">
        {days.map((day) => {
          const port = day.port === 'sea' ? 'cozumel' : day.port
          const o = outlook(port as ClimatePort, day.date)
          return (
            <li key={day.day}>
              <Card>
                <h2 className="card__title">{t('plan.day', { n: day.day })}: {day.port === 'sea' ? t('plan.atSea') : PORTS[day.port].name}</h2>
                <p className="muted">{formatDate(day.date)}{day.port === 'sea' ? ` · ${t('wx.seaNote')}` : ''}</p>
                <dl className="facts">
                  <div><dt>{t('wx.high')}</dt><dd>{formatTemp(o.highF, settings.units)}</dd></div>
                  <div><dt>{t('wx.low')}</dt><dd>{formatTemp(o.lowF, settings.units)}</dd></div>
                  <div><dt>{t('wx.sea')}</dt><dd>{formatTemp(o.seaF, settings.units)}</dd></div>
                  <div><dt>{t('wx.rain')}</dt><dd>{t('wx.rainBody', { days: o.rainDays })}</dd></div>
                  <div><dt>{t('wx.uv')}</dt><dd>{o.uv} · {t(`wx.uv.${uvBand(o.uv)}` as StringKey)}</dd></div>
                </dl>
              </Card>
            </li>
          )
        })}
      </ul>
      {days.some((d) => d.date.slice(5, 7) >= '06' && d.date.slice(5, 7) <= '11') && <Banner kind="warning" title={t('wx.hurricane')}><p>{t('wx.hurricaneBody')}</p></Banner>}
      <p className="muted">{t('wx.concept', { month: formatDayMonth(days[0].date) })}</p>
      <p><Link to="/plan/packing">{t('route.packing')}</Link></p>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}

const GROUPS: readonly PrepGroup[] = ['motion', 'medicine', 'insurance']

/** Motion-sickness tips, medicines to pack and insurance reminders, with dates to start each one (MNG-19). */
export function HealthPrepScreen() {
  const s = useSailing()
  const now = useNow()
  const done = useMine(() => api.ahead.prep.get())
  const tick = useAction(async (id: string, on: boolean) => { await api.ahead.prep.set(id, on); done.retry() })
  const today = dateIn(now, 'America/New_York')
  return (
    <div className="page">
      <h1>{t('route.healthPrep')}</h1>
      <p>{t('prep.intro')}</p>
      <AheadError error={tick.error} />
      <Load state={done}>
        {(ids) => {
          const due = prepDue(ids, s.departure, today, addDays)
          return (
            <>
              <p className="progress-line" role="status">{t('prep.progress', { done: ids.length, total: PREP.length })}</p>
              {due.filter((x) => x.late || x.item.daysBefore > 0).slice(0, 3).length > 0 && (
                <Banner kind="info" title={t('prep.next')}>
                  <ul className="plain-bullets">{due.filter((x) => x.item.daysBefore > 0).slice(0, 3).map((x) => <li key={x.item.id}>{x.item.text} <em>{x.late ? t('prep.now') : t('prep.by', { date: formatDate(x.start) })}</em></li>)}</ul>
                </Banner>
              )}
              {GROUPS.map((g) => (
                <section key={g} aria-labelledby={`prep-${g}`}>
                  <h2 id={`prep-${g}`}>{t(`prep.g.${g}` as StringKey)}</h2>
                  <ul className="plain-bullets">
                    {PREP.filter((p) => p.group === g).map((p) => (
                      <li key={p.id}>
                        <label className="choice choice--top">
                          <input type="checkbox" checked={ids.includes(p.id)} disabled={tick.busy} onChange={(e) => void tick.run(p.id, e.target.checked)} />
                          <span>{p.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )
        }}
      </Load>
      <p className="muted">{t('prep.notAdvice')}</p>
      <p><Link to="/plan/assistance">{t('route.assistance')}</Link></p>
      <Back to="/plan" label={t('route.plan')} />
    </div>
  )
}
