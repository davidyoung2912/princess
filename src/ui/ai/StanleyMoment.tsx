import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { Anchor, ClipboardCheck, CircleDot, FileCheck, House, LogOut, MapPin, Megaphone, Moon, Sunset, Ticket } from 'lucide-react'
import stanley from '../../assets/stanley-small.png'
import { momentDiaryKey, momentKey, momentOf, momentsShow, type MomentId, type StampIcon } from '../../ai/stanleyMoments'
import { itinerary } from '../../domain/sailings'
import { addAuto, dayFor } from '../../domain/tripDiary'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { useSettings } from '../../hooks/useSettings'
import { t, type StringKey } from '../../i18n'
import { isSeen, markSeen, seenVersion, subscribeSeen } from '../../settings/stanleySeen'
import { BUZZ, buzz } from '../../settings/haptics'
import { stanleyLevelFor } from '../../settings/settings'
import { Button, LinkButton } from '../Button'
import { WhyThis } from './WhyThis'

const STAMPS: Record<StampIcon, typeof Ticket> = { ticket: Ticket, clipboard: ClipboardCheck, anchor: Anchor, fileCheck: FileCheck, medallion: CircleDot, megaphone: Megaphone, sunset: Sunset, pin: MapPin, moon: Moon, logOut: LogOut, house: House }

type Params = Record<string, string | number>

/** The diary words for a moment. Moments the diary already writes by itself use its own words, so the same event never reads two ways. */
const diaryText = (id: MomentId, subject: string, params: Params): string => {
  switch (id) {
    case 'booked': return t('diary.auto.booked', { number: subject })
    case 'docsReady': return t('diary.auto.docs')
    case 'checkedIn': return t('diary.auto.checkedIn')
    case 'passReady': return t('diary.auto.pass')
    case 'medallion': return t('diary.auto.medallion')
    case 'muster': return t('diary.auto.muster')
    case 'sailAway': return t('diary.auto.sail')
    case 'port': return t('diary.auto.portStamp', params)
    case 'lastNight': return t('diary.auto.lastNight')
    case 'offShip': return t('diary.auto.off')
    case 'home': return t('diary.auto.home')
  }
}

/**
 * A small celebration (docs/experience-extension-ideas.md 4.3): an ink stamp lands, Stanley says one line, and there is one way on. It plays once for each
 * thing (a booking, say) and then stays out of the way. It is plain text in a labelled region (not a live region), the stamp is decorative, and the motion
 * stops under reduced motion and in calm mode. At "Only when asked", Off, calm and simple mode it does not show.
 */
export function StanleyMoment({ id, subject, params = {} }: { id: MomentId; subject: string; params?: Params }) {
  const [settings] = useSettings()
  useSyncExternalStore(subscribeSeen, seenVersion, seenVersion)
  const key = momentKey(id, subject)
  const show = momentsShow(stanleyLevelFor(settings)) && !isSeen(key)
  // A small buzz when it first appears (Android only; calm mode and reduced motion keep it quiet).
  useEffect(() => { if (show) buzz(settings, BUZZ.moment) }, [show, settings])
  if (!show) return null
  const def = momentOf(id)
  const Stamp = STAMPS[def.stamp]
  return (
    <aside className="stanley-moment no-print" aria-label={t('stanley.moment.label')}>
      <span className="stanley-moment__stamp" aria-hidden="true"><Stamp size={28} /></span>
      <img className="stanley-moment__face" src={stanley} alt="" width="192" height="192" />
      <div className="stanley-moment__text">
        <h2 className="stanley-moment__title">{t(`stanley.moment.${id}.title` as StringKey, params)}</h2>
        <p>{t(`stanley.moment.${id}.line` as StringKey, params)}</p>
        <div className="stanley-moment__actions">
          <LinkButton to={def.to} variant="secondary" onClick={() => markSeen(key)}>{t(`stanley.moment.${id}.go` as StringKey)}</LinkButton>
          <AddToDiary id={id} subject={subject} params={params} />
          <Button variant="secondary" onClick={() => markSeen(key)}>{t('stanley.moment.done')}</Button>
          <WhyThis kind="moment" fact={t('stanley.why.fact.moment')} what={t(`stanley.moment.${id}.title` as StringKey, params)} />
        </div>
      </div>
    </aside>
  )
}

/** "Add to my diary": writes the moment's line in the Trip Diary (once; a line the diary already wrote is not doubled), then says so and offers the diary. */
function AddToDiary({ id, subject, params }: { id: MomentId; subject: string; params: Params }) {
  const sailing = useSailing()
  const now = useNow()
  const { update } = useMemory()
  const [added, setAdded] = useState(false)
  const dates = useMemo(() => itinerary(sailing).map((d) => d.date), [sailing])
  if (added) {
    return <span role="status" className="stanley-moment__added">{t('stanley.moment.diaryDone')} <Link to="/me/diary">{t('stanley.moment.diaryOpen')}</Link></span>
  }
  const add = () => {
    const def = momentOf(id)
    update((s) => {
      const diary = addAuto(s.diary, { id: newMemoryId(), sailingId: sailing.id, day: dayFor(dates, now), at: now, kind: def.diary.kind, text: diaryText(id, subject, params), key: momentDiaryKey(id, subject) })
      return diary === s.diary ? s : { ...s, diary }
    })
    setAdded(true)
  }
  return <Button variant="secondary" onClick={add}>{t('stanley.moment.diary')}</Button>
}
