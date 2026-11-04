import { formatDate } from './cruise'
import { itinerary, PORTS, type Sailing } from './sailings'
import type { Recap } from './recap'
import type { TripEntry } from './tripDiary'
import { bestMoment, type WrappedCard } from './wrapped'

/**
 * The Highlight Reel (docs/experience-extension-ideas.md N-R1, X7e): a short slideshow of the trip, built from the recap, the Wrapped cards and the Trip Diary.
 * Plain slides, so it plays in the app and the same slides read as text. Pure; the screen supplies the timing controls. Nothing is posted or saved anywhere.
 */
export interface ReelSlide {
  id: string
  kicker: string
  title: string
  line: string
  /** True when the slide carries the guest's own words (so it is shown in the app and left out of a share). */
  personal: boolean
}

export const REEL_SECONDS = 45
export const REEL_SLIDES_MAX = 12

const portName = (port: string): string => PORTS[port as keyof typeof PORTS]?.name ?? port

/** Seconds each slide stays: the reel aims for 45 seconds, but a slide is never shorter than 3 or longer than 6. */
export const slideSeconds = (count: number): number => (count <= 0 ? 0 : Math.max(3, Math.min(6, Math.round(REEL_SECONDS / count))))

export function buildReel(sailing: Sailing, recap: Recap, cards: readonly WrappedCard[], diary: readonly TripEntry[]): ReelSlide[] {
  const slides: ReelSlide[] = [{ id: 'open', kicker: 'Your trip', title: recap.title, line: `${recap.nights} nights on Sun Princess, ${recap.dates}.`, personal: false }]
  const days = itinerary(sailing)
  const seen = new Set<string>()
  for (const d of days) {
    if (d.port === 'sea' || seen.has(d.port)) continue
    seen.add(d.port)
    // The home port opens and closes the trip; the reel stops at the places in between.
    if (d === days[0] || d === days[days.length - 1]) continue
    const lines = diary.filter((e) => e.day === d.day)
    const own = lines.find((e) => !e.auto)
    slides.push({ id: `port-${d.port}`, kicker: `Day ${d.day}, ${formatDate(d.date)}`, title: portName(d.port), line: own ? own.text : (lines[0]?.text ?? 'A day to remember.'), personal: !!own })
  }
  for (const c of cards.filter((x) => ['miles', 'steps', 'tours', 'meal', 'photos', 'sightings'].includes(x.id))) slides.push({ id: `card-${c.id}`, kicker: c.title, title: c.big, line: c.line, personal: false })
  const best = bestMoment(diary)
  if (best) slides.push({ id: 'best', kicker: `Your best moment, day ${best.day}`, title: 'Loved it', line: best.text, personal: true })
  slides.push({ id: 'close', kicker: 'Until next time', title: 'Thank you for sailing', line: 'Every line here is yours to keep.', personal: false })
  // Over the limit, the middle slides give way first; the opening and the closing always stay.
  if (slides.length <= REEL_SLIDES_MAX) return slides
  return [...slides.slice(0, REEL_SLIDES_MAX - 1), slides[slides.length - 1]]
}

/** The reel as text for sharing: no slide with the guest's own words, and nothing that names a person. */
export const reelText = (slides: readonly ReelSlide[]): string => slides.filter((s) => !s.personal).map((s) => `${s.kicker}: ${s.title}. ${s.line}`).join('\n')
