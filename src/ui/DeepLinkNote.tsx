import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router'
import { getContext, subscribeContext } from '../account/context'
import { deepLinkNotes, parseDeepLink } from '../push/deepLink'
import { t } from '../i18n'
import { Banner } from './Banner'

/** MOB-07, COM-06: an alert's link names the trip it was about. When that is not the trip the app is on now, say so rather than show the wrong trip's screen as if it were the right one. */
export function DeepLinkNote() {
  const { search } = useLocation()
  const trip = useSyncExternalStore(subscribeContext, getContext, getContext)?.booking?.number ?? null
  if (!deepLinkNotes(parseDeepLink(search), { currentTrip: trip, activeUpdates: null }).includes('otherTrip')) return null
  return <Banner kind="warning" title={t('deeplink.otherTrip.title')}><p>{t('deeplink.otherTrip.body')}</p></Banner>
}
