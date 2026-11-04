import { useState } from 'react'
import stanley from '../../assets/stanley-small.png'
import { BITS, bitLabel, draftDayNote, emptyDays, nextEmptyDay, saveDraft, storyShows, type Bit } from '../../ai/stanleyStory'
import { PORTS, type ItineraryDay } from '../../domain/sailings'
import type { Journal } from '../../domain/memoryBook'
import type { TripEntry } from '../../domain/tripDiary'
import { useSettings } from '../../hooks/useSettings'
import { t } from '../../i18n'
import { stanleyLevelFor } from '../../settings/settings'
import { Button } from '../Button'

const placeOf = (port: string): string | null => (port === 'sea' ? null : (PORTS[port as keyof typeof PORTS]?.name ?? port))

/**
 * Stanley the storyteller (SG6): asks what the favourite bit of the next empty day was, shows a first draft, and saves it as that day's note only when the
 * guest says so. The note then sits in the diary below, where it is edited like any other. Shown at Helpful and Chatty; nothing is sent anywhere.
 */
export function StanleyStoryteller({ days, journal, onSave, diary = [] }: { days: readonly ItineraryDay[]; journal: Journal; diary?: readonly TripEntry[]; onSave: (next: Journal) => void }) {
  const [settings] = useSettings()
  const [bit, setBit] = useState<Bit | null>(null)
  const [saved, setSaved] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)
  if (!storyShows(stanleyLevelFor(settings)) || hidden) return null
  const day = nextEmptyDay(days, journal)
  if (day === null && saved === null) return null
  const info = days.find((d) => d.day === (day ?? saved))
  const place = info ? placeOf(info.port) : null
  const draft = day !== null && bit && info ? draftDayNote({ port: place, bit, diary: diary.filter((e) => e.day === day) }) : ''
  const keep = () => {
    if (day === null) return
    const next = saveDraft(journal, day, draft)
    if (next) { onSave(next); setSaved(day) }
    setBit(null)
  }
  return (
    <aside className="stanley-ask no-print" aria-label={t('stanley.story.title')}>
      <div className="stanley-ask__bubble">
        <img className="stanley-answer__face" src={stanley} alt="" width="192" height="192" />
        <div>
          <h2 className="stanley-ask__q">{t('stanley.story.title')}</h2>
          {day === null ? <p>{t('stanley.story.done')}</p> : <>
            <p className="muted">{t('stanley.story.intro')}</p>
            <p>{t('stanley.story.ask', { day, place: place ?? t('stanley.story.seaPlace') })}</p>
            <p className="muted">{t('stanley.story.left', { n: emptyDays(days, journal) })}</p>
          </>}
          {saved !== null && <p role="status">{t('stanley.story.saved', { day: saved })}</p>}
        </div>
      </div>
      {day !== null && (
        <div className="stanley-ask__options" role="group" aria-label={t('stanley.story.ask', { day, place: place ?? t('stanley.story.seaPlace') })}>
          {BITS.map((b) => <button key={b} type="button" className="chip-q stanley-ask__opt" aria-pressed={bit === b} onClick={() => setBit(b)}>{bitLabel(b)}</button>)}
        </div>
      )}
      {draft && day !== null && (
        <div>
          <h3 className="stanley-ask__q">{t('stanley.story.draftLabel', { day })}</h3>
          <p>{draft}</p>
          <div className="button-row">
            <Button onClick={keep}>{t('stanley.story.use')}</Button>
            <Button variant="secondary" onClick={() => setBit(null)}>{t('stanley.story.another')}</Button>
          </div>
        </div>
      )}
      <div className="button-row"><Button variant="tertiary" onClick={() => setHidden(true)}>{t('stanley.story.notNow')}</Button></div>
    </aside>
  )
}
