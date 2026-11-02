import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { applyPageMeta } from '../../seo'
import { familyView, normalizePublicFamily, POSTCARD_TEXT, tokenOwner, verifyLink, type FamilyView, type LinkProblem, type PublicFamily } from '../../domain/homeLink'
import { delayVisibleToOthers } from '../../domain/delay'
import { familyNotices } from '../../domain/disruptionHub'
import { personFirstName } from '../../account/context'
import { itinerary, portAt, PORTS } from '../../domain/sailings'
import { formatDate } from '../../domain/cruise'
import { getHub } from '../../hub/store'
import { useDemo, useNow, useSailing } from '../../hooks/useDemo'
import { familyHome } from '../../runtime'
import { t, type StringKey } from '../../i18n'

/** Four dot-separated parts of safe characters: anything else cannot be a link, so it is not sent to the server. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+){3}$/

/**
 * The page a family member opens from a link (S3-08, XD-07): ship-level facts only, no sign-in, no tabs. In this concept the link is checked
 * against the guest's device (see `homeLink.ts`); a real build checks a signed token on the server. It says plainly when a link has ended.
 */
export function AtSeaScreen() {
  const { token = '' } = useParams()
  const now = useNow()
  const sailing = useSailing()
  const demo = useDemo()
  const owner = tokenOwner(token)
  // With a server the link is checked there (signature, revoked, expired); without one it is checked against this device.
  const asks = familyHome !== null && TOKEN_SHAPE.test(token)
  const [served, setServed] = useState<PublicFamily | 'loading' | null>(asks ? 'loading' : null)
  useEffect(() => {
    if (!familyHome || !asks) return
    let live = true
    familyHome.view(token).then((raw) => { if (live) setServed(normalizePublicFamily(raw)) }, () => { if (live) setServed({ ok: false, reason: 'malformed' }) })
    return () => { live = false }
  }, [token, asks])
  const hub = owner ? getHub(owner) : null
  const check = owner && hub ? verifyLink(token, owner, hub.home, now) : null
  const guestFirst = owner ? personFirstName(owner) : ''
  const guest = guestFirst ? { firstName: guestFirst } : undefined

  // A private page: never indexed, and the link itself is kept out of the page's address metadata.
  useEffect(() => {
    applyPageMeta(document, { title: `${t('route.atSea')} · ${t('app.name')}`, description: t('seo.private'), indexable: false, url: `${window.location.origin}/at-sea` })
  }, [])

  // A family member opens this page without signing in, so the sailings and ports tables may not be loaded: the ship's itinerary and place are left out then.
  const tablesReady = PORTS.fll !== undefined && itinerary(sailing).length > 0
  const here = tablesReady ? portAt(sailing, now) : { port: 'sea' as const, day: null }
  const shipFacts = {
    shipName: t('route.sunPrincess'),
    itinerary: (tablesReady ? itinerary(sailing) : []).map((d) => ({ day: d.day, date: d.date, place: d.port === 'sea' ? t('plan.atSea') : d.port === 'fll' ? PORTS.fll.name : PORTS[d.port].name })),
    shipAt: here.port === 'sea' ? null : here.port === 'fll' ? PORTS.fll.name : PORTS[here.port].name,
  }
  /** The page's facts, or why there is no page. */
  const found: { view: FamilyView } | { reason: LinkProblem } | 'loading' = (() => {
    if (served === 'loading') return 'loading'
    if (served) {
      // The server checked the link; it also names the guest, the scenarios that are on and a delay the guest chose to share.
      return served.ok
        ? { view: { guestFirst: served.guestFirst, ...shipFacts, notices: familyNotices(served.scenarios), postcards: served.postcards, delayedMinutes: served.delayedMinutes, recap: served.recap, expiresAt: served.expiresAt } }
        : { reason: served.reason }
    }
    if (!check || !check.ok || !hub || !guest) return { reason: check && !check.ok ? check.reason : 'malformed' }
    return {
      view: familyView(hub.home, check.link, {
        guestFirst: guest.firstName, ...shipFacts, notices: familyNotices(demo.scenarios),
        delayedMinutes: delayVisibleToOthers(hub.delay) && hub.delay.current ? hub.delay.current.lateMinutes : null, now,
      }),
    }
  })()

  const body = (() => {
    if (found === 'loading') return <p role="status">{t('shell.loading')}</p>
    if ('reason' in found) return <p role="status">{t(`home.public.bad.${found.reason}` as StringKey)}</p>
    const view = found.view
    return (
      <>
        <p>{t('home.public.intro', { name: view.guestFirst, ship: view.shipName })}</p>
        <section aria-labelledby="pub-status-h">
          <h2 id="pub-status-h">{t('home.public.status')}</h2>
          <p>{view.shipAt ? t('home.public.inPort', { port: view.shipAt }) : t('home.public.atSea')}</p>
          <p className="muted">{t('home.public.noLocation', { name: view.guestFirst })}</p>
        </section>
        {view.notices.length > 0 && (
          <section aria-labelledby="pub-notice-h">
            <h2 id="pub-notice-h">{t('home.public.notice')}</h2>
            {view.notices.map((k) => <p key={k}>{t(k)}</p>)}
          </section>
        )}
        {view.delayedMinutes !== null && <p role="status"><strong>{t('home.public.delayed', { name: view.guestFirst, minutes: view.delayedMinutes })}</strong></p>}
        <section aria-labelledby="pub-cards-h">
          <h2 id="pub-cards-h">{t('home.public.cards')}</h2>
          {view.postcards.length === 0 ? <p>{t('home.public.noCards')}</p> : (
            <ul>{[...view.postcards].reverse().map((p) => <li key={p.id}>{t(POSTCARD_TEXT[p.kind])}{p.note && ` — ${p.note}`}{p.photo && familyHome && <img className="guest-picture" src={familyHome.photoUrl(token, p.photo)} alt={t('home.public.cardPhoto')} loading="lazy" decoding="async" />}</li>)}</ul>
          )}
        </section>
        {view.recap && (
          <section aria-labelledby="pub-recap-h">
            <h2 id="pub-recap-h">{t('home.public.recap', { name: view.guestFirst })}</h2>
            {view.recap.split('\n').map((line) => <p key={line}>{line}</p>)}
          </section>
        )}
        <section aria-labelledby="pub-plan-h">
          <h2 id="pub-plan-h">{t('home.public.plan')}</h2>
          <ol>{view.itinerary.map((d) => <li key={d.day}>{formatDate(d.date)}: {d.place}</li>)}</ol>
        </section>
        <p className="muted">{t('home.public.expires', { date: formatDate(new Date(view.expiresAt).toISOString().slice(0, 10)) })}</p>
      </>
    )
  })()

  return (
    <>
      <a className="skip-link" href="#main">{t('shell.skip')}</a>
      <main id="main" className="page" tabIndex={-1}>
        <h1>{t('route.atSea')}</h1>
        {body}
      </main>
    </>
  )
}
