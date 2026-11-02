import type { Level, QualityNote, SailingQuality } from '../domain/dream'
import { createFeed, isRecord, oneOf } from './feed'

const KEYS: readonly QualityNote['key'][] = ['crowds', 'weather', 'hurricane', 'school', 'price']
const LEVELS: readonly Level[] = ['low', 'medium', 'high']

/** Reads the server's notes for a sailing: the five notes in order, each with a level and short text. Anything else gives null. */
export function normalizeQuality(raw: unknown): SailingQuality | null {
  if (!isRecord(raw) || typeof raw.sailingId !== 'string' || !Array.isArray(raw.notes) || raw.notes.length !== KEYS.length) return null
  const notes: QualityNote[] = []
  for (let i = 0; i < KEYS.length; i++) {
    const n = raw.notes[i]
    if (!isRecord(n) || n.key !== KEYS[i] || !oneOf(n.level, LEVELS) || typeof n.text !== 'string' || !n.text || n.text.length > 200 || typeof n.why !== 'string' || n.why.length > 300) return null
    notes.push({ key: KEYS[i], level: n.level, text: n.text, why: n.why })
  }
  return { sailingId: raw.sailingId, notes, source: 'sim' }
}

/** The decide notes for a sailing, by sailing id. */
export const qualityFeed = createFeed<[sailingId: string], SailingQuality>((id) => id, normalizeQuality, 'quality')
