import { t } from '../../i18n'
import { TripDiary } from '../delights/TripDiary'
import { BackLink } from '../onboard/common'

/** The Trip Diary on a screen of its own (X7b): a private day-by-day timeline with search; the memory book is made from it. */
export function DiaryScreen() {
  return (
    <div className="page">
      <BackLink to="/me" label={t('route.me')} />
      <p className="muted">{t('diary.screenBody')}</p>
      <TripDiary />
    </div>
  )
}
