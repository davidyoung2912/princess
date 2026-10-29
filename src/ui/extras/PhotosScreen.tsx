import { useState } from 'react'
import { asPhotosView } from '../../api/guards'
import type { PhotoQuote, PhotoReceipt, PhotosView } from '../../api/types'
import { formatDate, formatTime } from '../../domain/cruise'
import { formatMoney } from '../../domain/pricing'
import { NO_PHOTO_FILTER, PHOTO_VENUES, filterPhotos, type OptionId, type PhotoFilter, type PhotoVenue } from '../../domain/photos'
import { itinerary } from '../../domain/sailings'
import { placeName } from '../../domain/family'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona, useSailing } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, type StringKey } from '../../i18n'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { BackLink, Saved } from '../onboard/common'
import { ExtraError } from './common'

/** Ship photos (SHP-02, SHP-07): browse, favourite, choose, see options priced against the choice, buy, and download in checked batches. */
export function PhotosScreen() {
  const me = usePersona()
  const copy = useSavedCopy('photos', me?.booker ?? 'none', () => api.photos.list(), asPhotosView, [me?.id])
  return (
    <div className="page">
      <h1>{t('route.photos')}</h1>
      <p>{t('pho.intro')}</p>
      <Saved copy={copy}>{(v) => <Photos v={v} reload={copy.retry} offline={copy.fromCopy} canBuy={!me?.child} />}</Saved>
      <BackLink to="/ship" label={t('route.ship')} />
    </div>
  )
}

function Photos({ v, reload, offline, canBuy }: { v: PhotosView; reload: () => void; offline: boolean; canBuy: boolean }) {
  const s = useSailing()
  const days = itinerary(s)
  const [filter, setFilter] = useState<PhotoFilter>(NO_PHOTO_FILTER)
  const [picked, setPicked] = useState<string[]>([])
  const shown = filterPhotos(v.photos, filter, v.favourites)
  const set = (patch: Partial<PhotoFilter>) => setFilter({ ...filter, ...patch })
  const fav = useAction(async (id: string) => { await api.photos.toggleFavourite(id); reload() })
  const owned = new Set(v.owned)
  return (
    <>
      <Banner kind="info" title={t('pho.noPreview')}><p>{t('pho.noPreviewBody')}</p></Banner>
      {v.includedLeft > 0 && <Banner kind="success" title={t('pho.included', { count: v.includedLeft })}><p>{t('pho.includedBody')}</p></Banner>}

      <Card labelledBy="sched-h">
        <h2 id="sched-h" className="card__title">{t('pho.schedule')}</h2>
        <ul className="plain-bullets">{v.schedule.map((p, i) => <li key={i}>{t('plan.day', { n: p.day })}, {formatTime(p.time)}: {p.what} ({placeName(p.placeId)})</li>)}</ul>
      </Card>

      {v.photos.length === 0 ? <p>{t('pho.none')}</p> : (
        <section aria-labelledby="browse-h">
          <h2 id="browse-h">{t('pho.browse')}</h2>
          <div className="field">
            <label htmlFor="pho-day">{t('pho.day')}</label>
            <select id="pho-day" className="field__input" value={filter.day ?? ''} onChange={(e) => set({ day: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t('pho.all')}</option>
              {Array.from({ length: v.throughDay }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('plan.day', { n })} · {formatDate(days[n - 1].date)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pho-venue">{t('pho.venue')}</label>
            <select id="pho-venue" className="field__input" value={filter.venue ?? ''} onChange={(e) => set({ venue: (e.target.value || null) as PhotoVenue | null })}>
              <option value="">{t('pho.all')}</option>
              {PHOTO_VENUES.map((x) => <option key={x} value={x}>{t(`pho.venue.${x}` as StringKey)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pho-person">{t('pho.person')}</label>
            <select id="pho-person" className="field__input" value={filter.person ?? ''} onChange={(e) => set({ person: (e.target.value || null) as PhotoFilter['person'] })}>
              <option value="">{t('pho.everyone')}</option>
              {v.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="chip-row"><Chip pressed={filter.favouritesOnly} onToggle={() => set({ favouritesOnly: !filter.favouritesOnly })}>{t('pho.favsOnly')}</Chip></div>
          <p role="status" className="muted">{t('pho.count', { count: shown.length })}</p>
          <ul className="photo-list">
            {shown.map((p) => {
              const isFav = v.favourites.includes(p.id)
              const mine = owned.has(p.id)
              return (
                <li key={p.id} className="photo">
                  <p className="photo__title"><strong>{p.title}</strong></p>
                  <p className="muted">{t('plan.day', { n: p.day })}, {formatTime(p.time)} · {p.people.map((x) => v.people.find((y) => y.id === x)?.name.split(' ')[0]).join(', ')}</p>
                  <div className="button-row">
                    <Button variant="tertiary" aria-pressed={isFav} disabled={fav.busy || offline} onClick={() => void fav.run(p.id)}>{t('pho.fav')}<span className="visually-hidden"> {p.title}</span></Button>
                    {mine ? <span className="tag">{t('pho.owned')}</span> : canBuy && (
                      <label className="choice"><input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])} /><span>{t('pho.choose')}<span className="visually-hidden"> {p.title}</span></span></label>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {canBuy && !offline && picked.length > 0 && <Options picked={picked} done={() => { setPicked([]); reload() }} />}
      <Receipts receipts={v.receipts} reload={reload} offline={offline} />
    </>
  )
}

function Options({ picked, done }: { picked: string[]; done: () => void }) {
  const [quote, setQuote] = useState<PhotoQuote | null>(null)
  const [option, setOption] = useState<OptionId>('each')
  const [bought, setBought] = useState<PhotoReceipt | null>(null)
  const ids = picked.join(',')
  const load = useAction(async () => { const q = await api.photos.quote(picked); setQuote(q); setOption(q.cheapest) })
  const buy = useAction(async () => { const r = await api.photos.buy(picked, option); setBought(r); done() })
  const q = quote
  return (
    <Card hero labelledBy="opt-h">
      <h2 id="opt-h" className="card__title">{t('pho.yourChoice', { count: picked.length })}</h2>
      <Button variant="secondary" disabled={load.busy} onClick={() => void load.run()} key={ids}>{t('pho.price')}</Button>
      <ExtraError error={load.error} />
      {q && (
        q.paid === 0 ? (
          <>
            <p><strong>{t('pho.allIncluded')}</strong></p>
            <Button disabled={buy.busy} onClick={() => void buy.run()}>{t('pho.getIncluded')}</Button>
          </>
        ) : (
          <fieldset className="plain-fieldset">
            <legend>{q.included > 0 ? t('pho.options', { included: q.included, paid: q.paid }) : t('pho.optionsPlain', { paid: q.paid })}</legend>
            {q.options.map((o) => (
              <label key={o.id} className="choice choice--top">
                <input type="radio" name="pho-opt" checked={option === o.id} onChange={() => setOption(o.id)} />
                <span>{t(`pho.opt.${o.id}` as StringKey)}: <strong>{formatMoney(o.total)}</strong>{o.id === q.cheapest && <small>{t('pho.cheapest')}</small>}<small>{t(`pho.optHelp.${o.id}` as StringKey)}</small></span>
              </label>
            ))}
            <Button disabled={buy.busy} onClick={() => void buy.run()}>{buy.busy ? t('account.saving') : t('pho.buy', { amount: formatMoney(q.options.find((o) => o.id === option)!.total) })}</Button>
          </fieldset>
        )
      )}
      <ExtraError error={buy.error} />
      {bought && <Banner kind="success" title={t('pho.bought')}><p>{t('pho.boughtBody')}</p></Banner>}
    </Card>
  )
}

function Receipts({ receipts, reload, offline }: { receipts: PhotoReceipt[]; reload: () => void; offline: boolean }) {
  if (receipts.length === 0) return null
  return (
    <section aria-labelledby="rcpt-h">
      <h2 id="rcpt-h">{t('pho.receipts')}</h2>
      <ul className="order-list">{receipts.map((r) => <Receipt key={r.id} r={r} reload={reload} offline={offline} />)}</ul>
    </section>
  )
}

const TRIES = 3

function Receipt({ r, reload, offline }: { r: PhotoReceipt; reload: () => void; offline: boolean }) {
  const [saved, setSaved] = useState(r.saved)
  const [retrying, setRetrying] = useState(0)
  const total = r.photoIds.length
  const done = saved >= total
  /** Saves batch after batch, trying again by itself after a failed attempt and keeping what was already saved. */
  const run = useAction(async () => {
    let tries = 0
    let have = saved
    while (have < total) {
      try {
        have = (await api.photos.download(r.id)).saved
        setSaved(have)
        tries = 0
      } catch (e) {
        tries += 1
        setRetrying(tries)
        if (tries >= TRIES) throw e
      }
    }
    setRetrying(0)
    reload()
  })
  return (
    <li className="order">
      <h3 className="order__title">{t(`pho.rcpt.${r.option}` as StringKey, { count: total })}</h3>
      <p>{r.paid === 0 ? t('x.free') : formatMoney(r.paid)} · {t('pho.until', { date: new Date(r.until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) })}</p>
      <p role="status"><strong>{done ? t('pho.savedAll', { count: total }) : t('pho.saved', { saved, total })}</strong></p>
      <progress className="photo__progress" max={total} value={saved} aria-label={t('pho.progress')} />
      {retrying > 0 && !done && <p role="status" className="muted">{t('pho.retrying', { n: retrying })}</p>}
      <ExtraError error={run.error} />
      {!done && <Button disabled={run.busy || offline} onClick={() => void run.run()}>{run.busy ? t('pho.saving') : saved > 0 ? t('pho.resume') : t('pho.download')}</Button>}
      {done && <p className="muted">{t('pho.verified')}</p>}
    </li>
  )
}
