import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { linkState, normalizeSharedView, normalizeShareLink, normalizeShareLinks, type ShareKind, type ShareLink, type SharedView } from '../../domain/partyShare'
import { useAction } from '../../hooks/useAction'
import { useNow } from '../../hooks/useDemo'
import { useMine } from '../../hooks/useMine'
import { t } from '../../i18n'
import { api, partyShare } from '../../runtime'
import { applyPageMeta } from '../../seo'
import { Banner } from '../Banner'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field } from '../Field'
import { ActionError, Load } from '../account/parts'
import { BackLink } from '../onboard/common'

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/
const day = (ms: number): string => new Date(ms).toLocaleDateString()

/** Read-only links for someone at home or a travel advisor (N4.6): the guest makes them, sees them listed and ends one at any time. Never a position. */
export function ShareLinksScreen() {
  const trips = useMine(() => api.trips.list())
  return (
    <div className="page">
      <BackLink to="/plan" label={t('route.plan')} />
      <h1>{t('route.shareLinks')}</h1>
      <p>{t('links.intro')}</p>
      <Card info>
        <h2 className="card__title">{t('links.sees')}</h2>
        <p>{t('links.seesBody')}</p>
        <h2 className="card__title">{t('links.never')}</h2>
        <p>{t('links.neverBody')}</p>
      </Card>
      <Load state={trips}>
        {(v) => {
          const number = (v.upcoming.find((x) => x.kind === 'current') ?? v.upcoming[0])?.number
          return number ? <Links number={number} /> : <p>{t('org.noBooking')}</p>
        }}
      </Load>
    </div>
  )
}

function Links({ number }: { number: string }) {
  const now = useNow()
  const list = useMine(async () => normalizeShareLinks(await partyShare.links(number)), [number])
  const [kind, setKind] = useState<ShareKind>('caregiver')
  const [label, setLabel] = useState('')
  const [made, setMade] = useState<ShareLink | null>(null)
  const make = useAction(async () => {
    const link = normalizeShareLink(await partyShare.makeLink(number, kind, label))
    if (!link) throw new Error('link')
    return link
  })
  const end = useAction(async (id: string) => { await partyShare.endLink(number, id) })
  const checkIn = useAction(async (id: string, note: string) => { await partyShare.checkIn(number, id, note) })
  const [note, setNote] = useState('')
  const onMake = async () => {
    const link = await make.run()
    if (link) { setMade(link); setLabel(''); list.retry() }
  }
  const address = made?.path ? `${window.location.origin}${made.path}` : ''
  return (
    <>
      <Card labelledBy="links-new">
        <h2 id="links-new" className="card__title">{t('links.new')}</h2>
        <fieldset>
          <legend>{t('links.kind')}</legend>
          {(['caregiver', 'advisor'] as const).map((k) => (
            <label key={k} className="choice"><input type="radio" name="link-kind" checked={kind === k} onChange={() => setKind(k)} /><span>{t(`links.kind.${k}`)}</span></label>
          ))}
        </fieldset>
        <Field label={t('links.label')} hint={t('links.labelHint')} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        <Button disabled={!label.trim() || make.busy} onClick={onMake}>{t('links.make')}</Button>
        <ActionError error={make.error} forbidden="links.err.booker" />
      </Card>
      {made && address && (
        <Banner kind="success" title={t('links.made')}>
          <p>{t('links.madeBody')}</p>
          <p><input className="field__input" readOnly aria-label={t('links.address')} value={address} onFocus={(e) => e.currentTarget.select()} /></p>
          <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(address) }}>{t('links.copy')}</Button>
        </Banner>
      )}
      <Load state={list}>
        {(links) => (
          <section aria-labelledby="links-live">
            <h2 id="links-live">{t('links.yours')}</h2>
            {links.length === 0 && <p>{t('links.none')}</p>}
            <ul className="plain-list">
              {links.map((l) => (
                <li key={l.id}>
                  <Card labelledBy={`link-${l.id}`}>
                    <h3 id={`link-${l.id}`} className="card__title">{l.label}</h3>
                    <p>{t(`links.kind.${l.kind}`)} · {t(`links.state.${linkState(l, now)}`, { date: day(l.expiresAt) })}</p>
                    {l.kind === 'caregiver' && (
                      <>
                        <p>{l.lastCheckInAt ? t('links.lastFine', { date: day(l.lastCheckInAt), note: l.note }) : t('links.noFine')}</p>
                        <Field label={t('links.note')} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
                        <Button variant="secondary" disabled={checkIn.busy} onClick={async () => { if ((await checkIn.run(l.id, note)) !== undefined) { setNote(''); list.retry() } }}>{t('links.fine')}</Button>
                      </>
                    )}
                    <Button variant="danger" disabled={end.busy} onClick={async () => { await end.run(l.id); list.retry() }}>{t('links.end')}</Button>
                  </Card>
                </li>
              ))}
            </ul>
            <ActionError error={end.error ?? checkIn.error} />
          </section>
        )}
      </Load>
    </>
  )
}

/** The page behind a link (N4.6): read-only, no sign-in, no tabs, never a position. It says plainly when a link has ended. */
export function SharedScreen() {
  const { token = '' } = useParams()
  const [view, setView] = useState<SharedView | 'loading' | 'ended'>(TOKEN_SHAPE.test(token) ? 'loading' : 'ended')
  useEffect(() => {
    applyPageMeta(document, { title: `${t('route.shared')} · ${t('app.name')}`, description: t('seo.private'), indexable: false, url: `${window.location.origin}/shared` })
  }, [])
  useEffect(() => {
    if (!TOKEN_SHAPE.test(token)) return
    let live = true
    partyShare.view(token).then((raw) => { if (live) setView(normalizeSharedView(raw) ?? 'ended') }, () => { if (live) setView('ended') })
    return () => { live = false }
  }, [token])
  return (
    <>
      <a className="skip-link" href="#main">{t('shell.skip')}</a>
      <main id="main" className="page" tabIndex={-1} aria-labelledby="shared-h">
        <h1 id="shared-h">{t('route.shared')}</h1>
        {view === 'loading' && <p role="status" className="muted">{t('account.loading')}</p>}
        {view === 'ended' && <Banner kind="info" title={t('shared.ended')}><p>{t('shared.endedBody')}</p></Banner>}
        {typeof view === 'object' && <Shared v={view} />}
      </main>
    </>
  )
}

function Shared({ v }: { v: SharedView }) {
  return (
    <>
      <p>{t('shared.intro', { name: v.guestFirstName, label: v.label })}</p>
      <Card labelledBy="shared-sail">
        <h2 id="shared-sail" className="card__title">{v.ship}</h2>
        <p>{t('shared.sails', { date: day(v.departure), nights: v.nights })}</p>
        <p>{v.daysToGo > 0 ? t('shared.daysToGo', { count: v.daysToGo }) : t('shared.underway')}</p>
      </Card>
      {v.kind === 'caregiver' ? (
        <Card labelledBy="shared-fine">
          <h2 id="shared-fine" className="card__title">{t('shared.fine')}</h2>
          <p>{v.lastCheckInAt ? t('shared.lastFine', { date: day(v.lastCheckInAt) }) : t('shared.noFine', { name: v.guestFirstName })}</p>
          {v.note && <p>“{v.note}”</p>}
          {v.checkinDone !== null && <p>{v.checkinDone ? t('shared.checkinDone') : t('shared.checkinNot')}</p>}
        </Card>
      ) : (
        <Card labelledBy="shared-progress">
          <h2 id="shared-progress" className="card__title">{t('shared.progress')}</h2>
          {v.paidInFull !== null && <p>{v.paidInFull ? t('shared.paid') : t('shared.notPaid')}</p>}
          {v.progress && v.progress.total > 0 && <p>{t('shared.checkinSteps', { done: v.progress.done, total: v.progress.total })}</p>}
          {v.guests !== null && <p>{t('shared.guests', { count: v.guests })}</p>}
        </Card>
      )}
      <p className="muted">{t('shared.never')}</p>
    </>
  )
}
