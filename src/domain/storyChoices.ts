/**
 * What the guest chose about their Voyage Story (phase 13): the tone, the lines they removed and the lines they reworded. Kept in their memory document, so it follows them to every device.
 * Framework-free, so it is tested in node.
 */

// ---- tone and audience ----

export const TONES = ['warm', 'plain', 'playful'] as const
export type Tone = (typeof TONES)[number]
export const isTone = (v: unknown): v is Tone => TONES.includes(v as Tone)

export const VERSIONS = ['private', 'family', 'public'] as const
export type Version = (typeof VERSIONS)[number]
export const RANK: Record<Version, number> = { public: 0, family: 1, private: 2 }

export const CHOICE_TEXT_MAX = 200
export const CHOICE_IDS_MAX = 60

// ---- what the guest changed in the story ----

/** What the guest chose about the Voyage Story: the tone, the lines they removed, and the lines they reworded. Kept in their memory document so it follows them to every device. */
export interface StoryChoices { tone: Tone; removed: string[]; corrected: Record<string, string> }
export const EMPTY_STORY: StoryChoices = { tone: 'warm', removed: [], corrected: {} }

const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
export const oneLine = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export function normalizeStory(raw: unknown): StoryChoices {
  const o = rec(raw)
  const removed = (Array.isArray(o.removed) ? o.removed : []).map((x) => oneLine(x, 80)).filter(Boolean)
  const corrected: Record<string, string> = {}
  for (const [id, v] of Object.entries(rec(o.corrected)).slice(0, CHOICE_IDS_MAX)) {
    const text = oneLine(v, CHOICE_TEXT_MAX)
    if (id.length <= 80 && text) corrected[id] = text
  }
  return { tone: isTone(o.tone) ? o.tone : 'warm', removed: [...new Set(removed)].slice(0, CHOICE_IDS_MAX), corrected }
}

export const setTone = (s: StoryChoices, tone: Tone): StoryChoices => ({ ...s, tone })

/** Takes a line out of the story (it comes back with `restoreLine`). A removed line also forgets any correction. */
export function removeLine(s: StoryChoices, id: string): StoryChoices {
  const { [id]: _gone, ...corrected } = s.corrected
  return { ...s, removed: s.removed.includes(id) || s.removed.length >= CHOICE_IDS_MAX ? s.removed : [...s.removed, id], corrected }
}
export const restoreLine = (s: StoryChoices, id: string): StoryChoices => ({ ...s, removed: s.removed.filter((x) => x !== id) })

/** The guest's own words for a line; empty text puts the sourced line back. */
export function correctLine(s: StoryChoices, id: string, text: string): StoryChoices {
  const clean = oneLine(text, CHOICE_TEXT_MAX)
  const { [id]: _old, ...rest } = s.corrected
  if (!clean) return { ...s, corrected: rest }
  if (!(id in s.corrected) && Object.keys(s.corrected).length >= CHOICE_IDS_MAX) return s
  return { ...s, corrected: { ...rest, [id]: clean } }
}
