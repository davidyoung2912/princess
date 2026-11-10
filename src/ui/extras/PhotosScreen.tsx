import { canTakeBack, mySharedIds } from '../../domain/albumRules'
import { StanleyCaption } from '../ai/StanleyRemember'
import { useConfirmCharge } from '../ConfirmCharge'
import { useState } from 'react'
import { asPhotosView, asPrintView } from '../../api/guards'
import type { PhotoQuote, PhotoReceipt, PhotosView, PrintProductId, PrintView } from '../../api/types'
import { formatDate, formatTime } from '../../domain/cruise'
import { formatMoney } from '../../domain/money'
import { NO_PHOTO_FILTER, PHOTO_VENUES, filterPhotos, unsavedPhotos, type OptionId, type PhotoFilter, type PhotoVenue } from '../../domain/photos'
import { itinerary } from '../../domain/sailings'
import { placeName } from '../../domain/family'
import { api } from '../../runtime'
import { useAction } from '../../hooks/useAction'
import { usePersona, useSailing } from '../../hooks/useDemo'
import { useSavedCopy } from '../../hooks/useSavedCopy'
import { t, th, type StringKey } from '../../i18n'
import { Link } from 'react-router'
import { addAuto, entriesFor } from '../../domain/tripDiary'
import { photoDiaryKey, photoDiaryLine } from '../../domain/diarySources'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Chip } from '../Chip'
import { DeferredImage } from '../DeferredImage'
import { BackLink, Saved } from '../onboard/common'
import { ExtraError } from './common'
import { MemoryStory } from './MemoryStory'
import { buildStory } from '../../domain/memoryStory'

/** Ship photos (SHP-02, SHP-07): browse, favourite, choose, see options priced against the choice, buy, and download in checked batches. */
export function PhotosScreen() {
  const me = usePersona()
  const copy = useSavedCopy('photos', me?.booker ?? 'none', () => api.photos.list(), asPhotosView, [me?.id])
  return (
    <div className="page">
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
  const share = useAction(async (id: string) => { await api.photos.toggleAlbum(id); reload() })
  const takeAll = useAction(async () => { for (const id of mySharedIds(v.album)) await api.photos.toggleAlbum(id); reload() })
  const { state: memory, update } = useMemory()
  const inDiary = (id: string) => memory.diary.entries.some((e) => e.sailingId === s.id && e.key === photoDiaryKey(id))
  const toDiary = (p: PhotosView['photos'][number]) => {
    const line = photoDiaryLine(p, days)
    if (!line) return
    update((m) => { const diary = addAuto(m.diary, { ...line, id: newMemoryId(), sailingId: s.id }); return diary === m.diary ? m : { ...m, diary } })
  }
  const owned = new Set(v.owned)
  const inAlbum = (id: string) => v.album.some((a) => a.photoId === id && a.mine)
  return (
    <>
      {v.includedLeft > 0 && <Banner kind="success" title={t('pho.included', { count: v.includedLeft })}><p>{t('pho.includedBody')}</p></Banner>}

      <Card labelledBy="sched-h">
        <h2 id="sched-h" className="card__title">{th('pho.schedule')}</h2>
        <ul className="plain-bullets">{v.schedule.map((p, i) => <li key={i}>{t('plan.day', { n: p.day })}, {formatTime(p.time)}: {p.what} ({placeName(p.placeId)})</li>)}</ul>
      </Card>

      {v.photos.length === 0 ? <p>{t('pho.none')}</p> : (
        <section aria-labelledby="browse-h">
          <h2 id="browse-h">{th('pho.browse')}</h2>
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
                  {p.preview && <DeferredImage name={p.title} className="photo__img" src={p.preview} alt={t('pho.previewAlt', { title: p.title })} />}
                  <p className="photo__title"><strong>{p.title}</strong></p>
                  <p className="muted">{t('plan.day', { n: p.day })}, {formatTime(p.time)} · {p.people.map((x) => v.people.find((y) => y.id === x)?.name.split(' ')[0]).join(', ')}</p>
                  <div className="button-row">
                    <Button variant="tertiary" aria-pressed={isFav} disabled={fav.busy || offline} onClick={() => void fav.run(p.id)}>{t('pho.fav')}<span className="visually-hidden"> {p.title}</span></Button>
                    {canBuy && <Button variant="tertiary" aria-pressed={inAlbum(p.id)} disabled={share.busy || offline} onClick={() => void share.run(p.id)}>{inAlbum(p.id) ? t('pho.album.shared') : t('pho.album.share')}<span className="visually-hidden"> {p.title}</span></Button>}
                    {inDiary(p.id)
                      ? <span role="status" className="tag">{t('pho.diary.added')} <Link to="/me/diary">{t('pho.diary.open')}</Link></span>
                      : <Button variant="tertiary" onClick={() => toDiary(p)}>{t('pho.diary.add')}<span className="visually-hidden"> {p.title}</span></Button>}
                    <StanleyCaption photoDay={p.day} title={p.title} />
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

      <MemoryStory story={buildStory(v.photos.filter((p) => v.favourites.includes(p.id)), entriesFor(memory.diary, s.id), days)} />

      <ExtraError error={share.error} />
      <Album v={v} share={(id) => void share.run(id)} takeAll={() => void takeAll.run()} busy={share.busy || takeAll.busy || offline} />

      {canBuy && !offline && picked.length > 0 && <Options picked={picked} done={() => { setPicked([]); reload() }} />}
      <Receipts receipts={v.receipts} reload={reload} offline={offline} />
      {canBuy && !offline && <Print v={v} />}
    </>
  )
}

/** Our Album: the photos anyone on the booking has shared; each person can take back only their own. */
function Album({ v, share, takeAll, busy }: { v: PhotosView; share: (id: string) => void; takeAll: () => void; busy: boolean }) {
  const name = (id: string) => v.people.find((x) => x.id === id)?.name.split(' ')[0] ?? ''
  const photos = v.album.flatMap((a) => { const p = v.photos.find((x) => x.id === a.photoId); return p ? [{ a, p }] : [] })
  return (
    <section aria-labelledby="album-h">
      <h2 id="album-h">{th('pho.album.title')}</h2>
      <p>{t('pho.album.intro')}</p>
      {mySharedIds(v.album).length > 1 && <Button variant="tertiary" disabled={busy} onClick={takeAll}>{t('pho.album.takeAll')}</Button>}
      {photos.length === 0 ? <p className="muted">{t('pho.album.empty')}</p> : (
        <ul className="photo-list">
          {photos.map(({ a, p }) => (
            <li key={`${a.photoId}-${a.by}`} className="photo">
              {p.preview && <DeferredImage name={p.title} className="photo__img" src={p.preview} alt={t('pho.previewAlt', { title: p.title })} />}
              <p className="photo__title"><strong>{p.title}</strong></p>
              <p className="muted">{t('pho.album.by', { name: name(a.by) })}</p>
              {canTakeBack(a) && <Button variant="tertiary" disabled={busy} onClick={() => share(p.id)}>{t('pho.album.hide')}<span className="visually-hidden"> {p.title}</span></Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Print It: a printed book or postcard set from photos the booking owns, then the orders and how far each has got. */
function Print({ v }: { v: PhotosView }) {
  const sure = useConfirmCharge()
  const copy = useSavedCopy('photo-print', 'none', () => api.photos.printList(), asPrintView, [v.owned.length])
  return <Saved copy={copy}>{(pv) => <PrintBody v={v} pv={pv} reload={copy.retry} sure={sure} />}</Saved>
}

function PrintBody({ v, pv, reload, sure }: { v: PhotosView; pv: PrintView; reload: () => void; sure: ReturnType<typeof useConfirmCharge> }) {
  const [product, setProduct] = useState<PrintProductId>('book')
  const [picked, setPicked] = useState<string[]>([])
  const spec = pv.products.find((x) => x.id === product)
  const order = useAction(async () => { await api.photos.printOrder(product, picked); setPicked([]); reload() })
  const ok = !!spec && picked.length >= spec.minPhotos && picked.length <= spec.maxPhotos
  const mine = v.photos.filter((p) => v.owned.includes(p.id))
  return (
    <section aria-labelledby="print-h">
      <h2 id="print-h">{th('pho.print.title')}</h2>
      <p>{t('pho.print.intro')}</p>
      {mine.length === 0 ? <p className="muted">{t('pho.print.none')}</p> : (
        <>
          <fieldset className="plain-fieldset">
            <legend>{t('pho.print.product')}</legend>
            {pv.products.map((x) => (
              <label key={x.id} className="choice choice--top">
                <input type="radio" name="pho-print" checked={product === x.id} onChange={() => setProduct(x.id)} />
                <span>{t(`pho.print.${x.id}` as StringKey, { price: formatMoney(x.cents), min: x.minPhotos, max: x.maxPhotos })}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="plain-fieldset">
            <legend>{t('pho.print.pick', { count: picked.length })}</legend>
            {mine.map((p) => (
              <label key={p.id} className="choice">
                <input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])} />
                <span>{p.title}</span>
              </label>
            ))}
          </fieldset>
          {spec && !ok && <p className="muted">{t('pho.print.count', { min: spec.minPhotos, max: spec.maxPhotos })}</p>}
          <ExtraError error={order.error} />
          <Button disabled={!ok || order.busy} onClick={() => sure.ask(spec!.cents, t('pho.print.confirmWhat'), () => void order.run())}>{order.busy ? t('account.saving') : t('pho.print.order', { amount: formatMoney(spec?.cents ?? 0) })}</Button>
          {sure.dialog}
        </>
      )}
      {pv.orders.length > 0 && (
        <>
          <h3>{th('pho.print.orders')}</h3>
          <ul className="order-list">
            {pv.orders.map((o) => (
              <li key={o.id} className="order">
                <p><strong>{t(`pho.print.stage.${o.stage}` as StringKey)}</strong></p>
                <p>{t('pho.print.row', { product: t(`pho.print.name.${o.product}` as StringKey), count: o.photos, amount: formatMoney(o.total), ref: o.reference })}</p>
                {o.stage !== 'delivered' && <p className="muted">{t('pho.print.by', { date: new Date(o.deliverBy).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) })}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Options({ picked, done }: { picked: string[]; done: () => void }) {
  const sure = useConfirmCharge()
  const [quote, setQuote] = useState<PhotoQuote | null>(null)
  const [option, setOption] = useState<OptionId>('each')
  const [bought, setBought] = useState<PhotoReceipt | null>(null)
  const ids = picked.join(',')
  const load = useAction(async () => { const q = await api.photos.quote(picked); setQuote(q); setOption(q.cheapest) })
  const buy = useAction(async () => { const r = await api.photos.buy(picked, option); setBought(r); done() })
  const q = quote
  return (
    <Card hero labelledBy="opt-h">
      <h2 id="opt-h" className="card__title">{th('pho.yourChoice', { count: picked.length })}</h2>
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
            <Button disabled={buy.busy} onClick={() => sure.ask(q.options.find((o) => o.id === option)!.total, t('pho.confirmWhat'), () => void buy.run())}>{buy.busy ? t('account.saving') : t('pho.buy', { amount: formatMoney(q.options.find((o) => o.id === option)!.total) })}</Button>
            {sure.dialog}
          </fieldset>
        )
      )}
      <ExtraError error={buy.error} />
      {bought && <Banner kind="success" title={t('pho.bought')}><p>{t('pho.boughtBody')}</p></Banner>}
    </Card>
  )
}

function Receipts({ receipts, reload, offline }: { receipts: PhotoReceipt[]; reload: () => void; offline: boolean }) {
  const left = unsavedPhotos(receipts)
  const [now, setNow] = useState<number | null>(null)
  const all = useAction(async () => {
    let done = 0
    for (const r of receipts) {
      if (r.saved >= r.photoIds.length) continue
      await saveReceipt(r, (n) => setNow(done + n - r.saved), () => undefined)
      done += r.photoIds.length - r.saved
    }
    setNow(null)
    reload()
  })
  if (receipts.length === 0) return null
  const until = Math.max(...receipts.map((r) => r.until))
  return (
    <section aria-labelledby="rcpt-h">
      <h2 id="rcpt-h">{th('pho.receipts')}</h2>
      <p>{t('pho.availableUntil', { date: new Date(until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) })}</p>
      {left.photos > 0 && (
        <>
          <Button disabled={all.busy || offline} onClick={() => void all.run()}>{all.busy ? t('pho.saving') : t('pho.downloadAll', { count: left.photos })}</Button>
          <p role="status" className="muted">{all.busy && now !== null ? t('pho.downloadAllProgress', { saved: now, total: left.photos }) : ''}</p>
          <ExtraError error={all.error} />
        </>
      )}
      <ul className="order-list">{receipts.map((r) => <Receipt key={`${r.id}-${r.saved}`} r={r} reload={reload} offline={offline} />)}</ul>
    </section>
  )
}

const TRIES = 3

/** Saves every batch of one purchase, trying again after a failed attempt and keeping what was saved; throws once it has failed `TRIES` times in a row. */
async function saveReceipt(r: PhotoReceipt, onSaved: (n: number) => void, onRetry: (n: number) => void): Promise<void> {
  let tries = 0
  let have = r.saved
  const total = r.photoIds.length
  while (have < total) {
    try {
      have = (await api.photos.download(r.id)).saved
      onSaved(have)
      tries = 0
    } catch (e) {
      tries += 1
      onRetry(tries)
      if (tries >= TRIES) throw e
    }
  }
  onRetry(0)
}

function Receipt({ r, reload, offline }: { r: PhotoReceipt; reload: () => void; offline: boolean }) {
  const [saved, setSaved] = useState(r.saved)
  const [retrying, setRetrying] = useState(0)
  const total = r.photoIds.length
  const done = saved >= total
  /** Saves batch after batch, trying again by itself after a failed attempt and keeping what was already saved. */
  const run = useAction(async () => {
    await saveReceipt({ ...r, saved }, setSaved, setRetrying)
    reload()
  })
  return (
    <li className="order">
      <h3 className="order__title">{th(`pho.rcpt.${r.option}` as StringKey, { count: total })}</h3>
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
