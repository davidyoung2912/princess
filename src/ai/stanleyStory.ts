import { t, type StringKey } from '../i18n'
import { NOTE_MAX, type Journal } from '../domain/memoryBook'
import type { TripEntry } from '../domain/tripDiary'
import type { StanleyLevel } from '../settings/settings'

/**
 * The storyteller (docs/experience-extension-ideas.md 13.7, SG6): Stanley asks "what was your favourite bit?" about a day and writes a first draft of
 * that day's note from the answer and the day's place. The guest always edits it; a day that already has the guest's words is never touched.
 * Framework-free, so it is tested in node. No model is called and nothing leaves the device.
 */

export const BITS = ['food', 'view', 'people', 'quiet', 'ashore', 'show', 'surprise'] as const
export type Bit = (typeof BITS)[number]
export const isBit = (v: unknown): v is Bit => BITS.includes(v as Bit)

/** What a draft is built from. `port` is a display name, or null for a day at sea. */
export interface DraftFacts {
  port: string | null
  bit: Bit
  /** The restaurant dined at most, when the guest wants it named in a "food" draft. */
  meal?: string | null
  /** An excursion taken, when the guest wants it named in an "ashore" draft. */
  tour?: string | null
  /** The day's own diary lines (meals, tours, the guest's notes), so the draft can use what really happened. */
  diary?: readonly Pick<TripEntry, 'kind' | 'text'>[]
}

/** The day's diary line of one kind, preferring one the guest wrote, or null. */
export function diaryLineFor(entries: readonly Pick<TripEntry, 'kind' | 'text'>[] | undefined, kind: TripEntry['kind']): string | null {
  return entries?.find((e) => e.kind === kind)?.text ?? null
}

/** A first draft of one day's note: where the day was, the favourite bit, and one closing line. Always within the note limit. */
export function draftDayNote(f: DraftFacts): string {
  const opening = f.port ? t('stanley.story.open.port', { port: f.port }) : t('stanley.story.open.sea')
  const mealLine = f.bit === 'food' ? diaryLineFor(f.diary, 'meal') : null
  const tourLine = f.bit === 'ashore' ? diaryLineFor(f.diary, 'tour') : null
  // What the diary recorded for the day comes first; a name given directly is used when the diary has nothing.
  const detail = mealLine ? t('stanley.story.detail.diary', { line: mealLine })
    : tourLine ? t('stanley.story.detail.diary', { line: tourLine })
      : f.bit === 'food' && f.meal ? t('stanley.story.detail.meal', { meal: f.meal })
        : f.bit === 'ashore' && f.tour ? t('stanley.story.detail.tour', { tour: f.tour })
          : ''
  const bit = t(`stanley.story.bit.${f.bit}.line` as StringKey)
  return [opening, bit, detail, t('stanley.story.close')].filter(Boolean).join(' ').slice(0, NOTE_MAX)
}

export const bitLabel = (b: Bit): string => t(`stanley.story.bit.${b}` as StringKey)

/** The first day with no note of the guest's own, or null when every day has one. */
export function nextEmptyDay(days: readonly { day: number }[], journal: Journal): number | null {
  return days.find((d) => (journal[d.day] ?? '').trim() === '')?.day ?? null
}

/** How many days still have no note. */
export const emptyDays = (days: readonly { day: number }[], journal: Journal): number => days.filter((d) => (journal[d.day] ?? '').trim() === '').length

/** The journal with a draft saved for a day, or null when the day already has the guest's words (a draft never overwrites). */
export function saveDraft(journal: Journal, day: number, draft: string): Journal | null {
  if ((journal[day] ?? '').trim() !== '' || draft.trim() === '') return null
  return { ...journal, [day]: draft.slice(0, NOTE_MAX) }
}

/** The storyteller starts the conversation at Helpful and Chatty; calm and simple mode cap the level at "asked", which removes it. */
export const storyShows = (level: StanleyLevel): boolean => level === 'chatty' || level === 'helpful'
