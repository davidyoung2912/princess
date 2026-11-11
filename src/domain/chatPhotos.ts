import type { ChatMessage } from '../api/chatTypes'

/**
 * Photos in chat (phase 9b): up to ten in one message, each shrunk on the device before it is sent, shown as a grid in the thread, in a full-screen viewer
 * and in a "Photos in this chat" gallery. The server decides what is accepted; these limits only save a trip. Framework-free so it can be tested in node.
 */

export const MAX_PHOTOS_PER_MESSAGE = 10

/** How many photos a message carries: 0 for none (or a deleted message), 1 for one, more when the server says so. */
export const photoCountOf = (m: Pick<ChatMessage, 'photo' | 'hasPhoto' | 'photoCount' | 'deleted'>): number => {
  if (m.deleted || !(m.photo || m.hasPhoto)) return 0
  return Math.min(MAX_PHOTOS_PER_MESSAGE, Math.max(1, Math.floor(m.photoCount ?? 1)))
}

export interface PhotoPick { type: string; size: number }

/** What to do with the files the guest picked: the first ten of the allowed types are kept, and the rest are counted so the screen can say so. */
export function planPicks(picks: readonly PhotoPick[], allowed: readonly string[]): { keep: number[]; badType: number; over: number } {
  const keep: number[] = []
  let badType = 0
  let over = 0
  picks.forEach((p, i) => {
    if (!allowed.includes(p.type)) badType++
    else if (keep.length >= MAX_PHOTOS_PER_MESSAGE) over++
    else keep.push(i)
  })
  return { keep, badType, over }
}

/** Columns of the grid for a message with this many photos. */
export const gridColumns = (count: number): 1 | 2 | 3 => (count <= 1 ? 1 : count === 2 || count === 4 ? 2 : 3)

/** How many fetched photos the screen keeps (each can be several megabytes as a data URL); the oldest used are forgotten first and fetched again if needed. */
export const PHOTO_CACHE_MAX = 40

/** Keeps a map to at most `max` entries by dropping the oldest. Reading an entry with `touch` moves it to the newest end. */
export function trimCache<V>(cache: Map<string, V>, max = PHOTO_CACHE_MAX): void {
  while (cache.size > max) {
    const oldest = cache.keys().next()
    if (oldest.done) return
    cache.delete(oldest.value)
  }
}

/** Marks an entry as just used, so it is the last to be dropped. */
export function touchCache<V>(cache: Map<string, V>, key: string): V | undefined {
  const v = cache.get(key)
  if (v !== undefined) { cache.delete(key); cache.set(key, v) }
  return v
}

/** The viewer moves one photo at a time and stops at the ends (it never wraps, so the end is clear to everyone). */
export const stepIndex = (index: number, count: number, delta: number): number => Math.min(Math.max(index + delta, 0), Math.max(count - 1, 0))

/** A swipe of at least `threshold` pixels sideways (and more sideways than up or down) is a move: left goes to the next photo, right to the one before. */
export function swipeDelta(dx: number, dy: number, threshold = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

export interface GalleryPhoto { messageId: string; index: number; count: number; fromName: string; at: number }

/** Every photo in the messages the screen holds, newest message first, each message's photos in the order they were sent. `youName` stands for your own. */
export function galleryOf(messages: readonly ChatMessage[], youName: string): GalleryPhoto[] {
  const out: GalleryPhoto[] = []
  for (const m of [...messages].reverse()) {
    const count = photoCountOf(m)
    for (let index = 0; index < count; index++) out.push({ messageId: m.id, index, count, fromName: m.fromName ?? youName, at: m.at })
  }
  return out
}
