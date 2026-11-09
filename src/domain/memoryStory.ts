import { formatDate } from './cruise'
import { PORTS, type ItineraryDay } from './sailings'
import type { TripEntry } from './tripDiary'

/**
 * Photo-to-memory curation (QOL-18): from the photos the guest has already marked as favourites and the diary notes they wrote,
 * propose a story one day at a time, in port order. It only arranges what the guest chose: no faces are matched, nothing is uploaded,
 * and every photo and note can be left out before anything is copied. Pure; the screen supplies the choices.
 */
export interface StoryPhoto { id: string; day: number; time: string; title: string }

export interface StoryDay {
  day: number
  heading: string
  /** The guest's own diary line for the day, if there is one (never an app-written line). */
  note: string | null
  photos: StoryPhoto[]
}

const portName = (port: string): string => PORTS[port as keyof typeof PORTS]?.name ?? port

/** Days that have a chosen photo or a note of the guest's own, in trip order. Photos on a day not on the sailing are left out. */
export function buildStory(photos: readonly StoryPhoto[], diary: readonly TripEntry[], days: readonly ItineraryDay[]): StoryDay[] {
  const out: StoryDay[] = []
  for (const d of days) {
    const shots = photos.filter((p) => p.day === d.day).sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))
    const own = diary.filter((e) => e.day === d.day && !e.auto && e.text.trim() !== '').sort((a, b) => a.at - b.at)
    if (shots.length === 0 && own.length === 0) continue
    // A day without a chosen photo is kept only when the guest wrote about it; the note stands alone.
    out.push({ day: d.day, heading: `Day ${d.day}, ${formatDate(d.date)}: ${d.port === 'sea' ? 'At sea' : portName(d.port)}`, note: own[0]?.text ?? null, photos: shots })
  }
  return out
}

/** Takes out the photos and days the guest dropped. A day left with neither photo nor note disappears. */
export function applyOmissions(story: readonly StoryDay[], omitPhotos: ReadonlySet<string>, omitNotes: ReadonlySet<number>): StoryDay[] {
  return story
    .map((s) => ({ ...s, note: omitNotes.has(s.day) ? null : s.note, photos: s.photos.filter((p) => !omitPhotos.has(p.id)) }))
    .filter((s) => s.photos.length > 0 || s.note !== null)
}

/** The story as plain text to copy or send. The guest's notes are included only when they were kept, so it never carries more than they approved. */
export function storyText(story: readonly StoryDay[]): string {
  return story.map((s) => [s.heading, ...(s.note ? [s.note] : []), ...s.photos.map((p) => `- ${p.title}`)].join('\n')).join('\n\n')
}

export const storyCount = (story: readonly StoryDay[]): { days: number; photos: number } => ({ days: story.length, photos: story.reduce((n, s) => n + s.photos.length, 0) })
