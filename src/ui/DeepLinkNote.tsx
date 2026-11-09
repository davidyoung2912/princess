import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'
import { getContext, subscribeContext } from '../account/context'
import { deepLinkNotes, parseDeepLink, type DeepLink } from '../push/deepLink'
import { api } from '../runtime'
import { useMine } from '../hooks/useMine'
import { useOnboardToday } from '../hooks/useOnboardToday'
import { t } from '../i18n'
import { Banner } from './Banner'

/** MOB-07, COM-06: an alert's link names what it was about. When that is no longer what is current (another trip, a reservation that is gone, a case that is closed, a port day that has passed), say so rather than show the screen as if the alert were still true. */
export function DeepLinkNote() {
  const { search } = useLocation()
  const link = parseDeepLink(search)
  const trip = useSyncExternalStore(subscribeContext, getContext, getContext)?.booking?.number ?? null
  const notes = deepLinkNotes(link, { currentTrip: trip, activeUpdates: null })
  return (
    <>
      {notes.includes('otherTrip') && <Banner kind="warning" title={t('deeplink.otherTrip.title')}><p>{t('deeplink.otherTrip.body')}</p></Banner>}
      {link.reservation && <ReservationNote link={link} />}
      {link.caseNumber && <CaseNote link={link} />}
      {link.port && link.date && <PortNote link={link} />}
    </>
  )
}

function ReservationNote({ link }: { link: DeepLink }) {
  const dining = useMine(() => api.plan.dining.view())
  const ids = dining.data ? dining.data.reservations.map((r) => r.id) : null
  if (!deepLinkNotes(link, { currentTrip: null, activeUpdates: null, reservations: ids }).includes('reservationGone')) return null
  return <Banner kind="warning" title={t('deeplink.reservation.title')}><p>{t('deeplink.reservation.body')}</p></Banner>
}

function CaseNote({ link }: { link: DeepLink }) {
  const cases = useMine(() => api.cases.list())
  const open = cases.data ? cases.data.cases.filter((c) => c.stage !== 'resolved' && c.stage !== 'withdrawn').map((c) => c.number) : null
  if (!deepLinkNotes(link, { currentTrip: null, activeUpdates: null, openCases: open }).includes('caseClosed')) return null
  return <Banner kind="info" title={t('deeplink.case.title')}><p>{t('deeplink.case.body')}</p></Banner>
}

function PortNote({ link }: { link: DeepLink }) {
  const today = useOnboardToday()
  if (!deepLinkNotes(link, { currentTrip: null, activeUpdates: null, today: today.data?.date ?? null }).includes('portPassed')) return null
  return <Banner kind="info" title={t('deeplink.port.title')}><p>{t('deeplink.port.body')}</p></Banner>
}
