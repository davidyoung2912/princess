import { useEffect, useMemo, useState } from 'react'
import { addAuto, addNote, dayFor, editEntry, entriesFor, groupByDay, MOODS, removeEntry, searchEntries, ENTRY_MAX, type Mood, type TripEntry } from '../../domain/tripDiary'
import { formatDate } from '../../domain/cruise'
import { itinerary, PORTS } from '../../domain/sailings'
import { useNow, useSailing } from '../../hooks/useDemo'
import { newMemoryId, useMemory } from '../../hooks/useMemory'
import { t, th, type StringKey } from '../../i18n'
import { Button } from '../Button'
import { Card } from '../Card'
import { Field, TextArea } from '../Field'

const portName = (port: string): string => PORTS[port as keyof typeof PORTS]?.name ?? port

/**
 * The Trip Diary (X7, docs/experience-extension-ideas.md 4.6): a private timeline of the trip. The app writes a line when something happens (booking, check-in,
 * boarding pass, each port or sea day as the day comes), and the guest adds a line and a mood in a few seconds. Every line can be edited or removed, and a
 * removed app line stays removed. Text only; it lives in the memory document and follows the guest to every device.
 */
export function TripDiary() {
  const sailing = useSailing()
  const now = useNow()
  const { state, update } = useMemory()
  const days = useMemo(() => itinerary(sailing), [sailing])
  const dates = useMemo(() => days.map((d) => d.date), [days])
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const today = dayFor(dates, now)
  // Each day that has begun gets one line saying where it was (written once; the guest can edit or remove it).
  useEffect(() => {
    if (today < 1) return
    update((s) => {
      let diary = s.diary
      for (const d of days.filter((x) => x.day <= today)) {
        const line = d.port === 'sea' ? t('diary.auto.sea', { day: d.day }) : t('diary.auto.port', { day: d.day, port: portName(d.port) })
        diary = addAuto(diary, { id: newMemoryId(), sailingId: sailing.id, day: d.day, at: Date.parse(`${d.date}T08:00:00Z`) || 0, kind: 'port', text: line, key: `day:${d.day}` })
      }
      return diary === s.diary ? s : { ...s, diary }
    })
  }, [today, days, sailing.id, update])

  const mine = entriesFor(state.diary, sailing.id)
  const shown = searchEntries(mine, query)
  const groups = groupByDay(shown)
  const dateOf = (day: number): string => formatDate(days.find((d) => d.day === day)?.date ?? days[0].date)

  const add = () => {
    update((s) => ({ ...s, diary: addNote(s.diary, { id: newMemoryId(), sailingId: sailing.id, day: today, at: now, text, mood }) }))
    setText('')
    setMood(null)
  }
  const startEdit = (e: TripEntry) => { setEditing(e.id); setDraft(e.text) }
  const saveEdit = (id: string) => {
    update((s) => ({ ...s, diary: editEntry(s.diary, id, draft) }))
    setEditing(null)
  }

  return (
    <Card labelledBy="diary-title">
      <h2 id="diary-title" className="card__title no-print">{th('diary.title')}</h2>
      <div className="no-print">
        <p>{t('diary.intro')}</p>
        <TextArea label={t('diary.add')} hint={t('diary.addHint', { day: today > 0 ? today : 0 })} value={text} maxLength={ENTRY_MAX} onChange={(e) => setText(e.target.value)} />
        <div className="stanley-ask__options" role="group" aria-label={t('diary.mood')}>
          {MOODS.map((m) => <button key={m} type="button" className="chip-q stanley-ask__opt" aria-pressed={mood === m} onClick={() => setMood(mood === m ? null : m)}>{t(`diary.mood.${m}` as StringKey)}</button>)}
        </div>
        <div className="actions"><Button onClick={add} disabled={text.trim() === ''}>{t('diary.save')}</Button></div>

        {mine.length > 0 && <Field label={t('diary.search')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}
        {mine.length === 0 && <p className="muted">{t('diary.empty')}</p>}
        {mine.length > 0 && shown.length === 0 && <p role="status">{t('diary.noMatch')}</p>}
        {groups.map((g) => (
          <section key={g.day} aria-labelledby={`diary-day-${g.day}`}>
            <h3 id={`diary-day-${g.day}`}>{g.day > 0 ? t('diary.day', { day: g.day, date: dateOf(g.day) }) : t('diary.before')}</h3>
            <ul className="plain-list">
              {g.entries.map((e) => (
                <li key={e.id}>
                  {editing === e.id ? (
                    <>
                      <TextArea label={t('diary.edit')} value={draft} maxLength={ENTRY_MAX} onChange={(ev) => setDraft(ev.target.value)} />
                      <div className="actions">
                        <Button onClick={() => saveEdit(e.id)} disabled={draft.trim() === ''}>{t('diary.saveEdit')}</Button>
                        <Button variant="tertiary" onClick={() => setEditing(null)}>{t('diary.cancel')}</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {e.mood && <strong>{t(`diary.mood.${e.mood}` as StringKey)}: </strong>}{e.text}
                      <Button variant="tertiary" onClick={() => startEdit(e)}>{t('diary.editBtn')}</Button>
                      <Button variant="tertiary" onClick={() => update((s) => ({ ...s, diary: removeEntry(s.diary, e.id) }))}>{t('diary.remove')}</Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="muted">{t('diary.private')}</p>
      </div>
    </Card>
  )
}
