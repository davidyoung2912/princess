import { t } from '../i18n'
import { Banner } from './Banner'

/** Shown in place of figures the server has not answered yet (and no copy is kept on this device). It is announced politely and never blocks the page. */
export function FeedWaiting() {
  return <Banner kind="info" title={t('feed.waiting')} />
}
