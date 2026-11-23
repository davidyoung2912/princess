import { t } from '../../../shared/i18n'
import { StampBook } from '../../delights/ui/StampBook'
import { TripDiary } from '../../delights/ui/TripDiary'
import { BackLink } from '../../onboard/ui/common'

/** The Trip Diary on a screen of its own (X7b): a private day-by-day timeline with search; the memory book is made from it. */
export function DiaryScreen() {
  return (
    <div className="page">
      <BackLink to="/me" label={t('route.me')} />
      <p className="muted">{t('diary.screenBody')}</p>
      <StampBook />
      <TripDiary />
    </div>
  )
}
