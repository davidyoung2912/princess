import type { CategoryId } from './ship'

/**
 * Guest pictures (N7). The limits below are the server's (`MediaRules`); the app also shrinks a picture before it is sent, but only the server decides what is accepted.
 * A picture is the guest's own: it is kept on the server (not on the device), shown to nobody else except what is stated next to each use, and deleted when they say so.
 */

export const MEDIA_TYPES: readonly string[] = ['image/jpeg', 'image/png']
export const MEDIA_MAX_BYTES = 2_000_000
export const MEDIA_MAX_COUNT = 40
export const MEDIA_CAPTION_MAX = 140
/** The longest side the app sends. A phone photo is 4000 pixels or more; 1600 is plenty for a screen and a printed page, and keeps the upload small. */
export const MEDIA_SEND_SIDE = 1600

export type MediaPurpose = 'cabin' | 'book' | 'postcard'
export const CABIN_KINDS = ['room', 'view', 'obstruction', 'noise'] as const
export type CabinKind = (typeof CABIN_KINDS)[number]
export type MediaStatus = 'pending' | 'approved' | 'rejected'

export interface Media {
  id: string
  purpose: MediaPurpose
  /** A stateroom category for a cabin picture, a cruise day "1" to "8" or "cover" for the book, empty for a postcard. */
  ref: string
  kind: string
  caption: string
  width: number
  height: number
  status: MediaStatus
  at: number
  /** The guest's own picture; false for another guest's approved cabin picture. */
  mine: boolean
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One picture as the server describes it, or null when anything is wrong. */
export function normalizeMedia(raw: unknown): Media | null {
  if (!isRecord(raw)) return null
  const { id, purpose, ref, kind, caption, width, height, status, at, mine } = raw
  if (typeof id !== 'string' || !GUID.test(id)) return null
  if (purpose !== 'cabin' && purpose !== 'book' && purpose !== 'postcard') return null
  if (typeof ref !== 'string' || ref.length > 40 || typeof kind !== 'string' || kind.length > 12) return null
  if (typeof caption !== 'string' || caption.length > MEDIA_CAPTION_MAX) return null
  if (typeof width !== 'number' || typeof height !== 'number' || !(width > 0) || !(height > 0)) return null
  if (status !== 'pending' && status !== 'approved' && status !== 'rejected') return null
  if (typeof at !== 'number') return null
  return { id, purpose, ref, kind, caption, width, height, status, at, mine: mine === true }
}

/** A list of pictures; anything that is not a valid picture is left out. */
export const normalizeMediaList = (raw: unknown): Media[] => (Array.isArray(raw) ? raw.flatMap((x) => { const m = normalizeMedia(x); return m ? [m] : [] }) : [])

export interface MediaUsage { count: number; bytes: number; maxCount: number; maxBytes: number }

export function normalizeUsage(raw: unknown): MediaUsage | null {
  if (!isRecord(raw)) return null
  const { count, bytes, maxCount, maxBytes } = raw
  return [count, bytes, maxCount, maxBytes].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0) ? { count: count as number, bytes: bytes as number, maxCount: maxCount as number, maxBytes: maxBytes as number } : null
}

export type PickProblem = 'type' | 'size' | 'caption' | 'full'

/** What is wrong with a chosen file before anything is sent, or null. The size is checked again after the picture is shrunk. */
export function pickProblem(type: string, bytes: number, caption: string, usage: MediaUsage | null): PickProblem | null {
  if (!MEDIA_TYPES.includes(type)) return 'type'
  if (bytes <= 0) return 'size'
  if (caption.length > MEDIA_CAPTION_MAX || /@|https?:|www\.|(\d[\s.-]?){7,}/i.test(caption)) return 'caption'
  if (usage && usage.count >= usage.maxCount) return 'full'
  return null
}

/** The size to draw a picture at so its longest side is at most `side`; never larger than the original. */
export function shrunkSize(width: number, height: number, side: number = MEDIA_SEND_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (!(longest > side)) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
  const scale = side / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** The server's answer to a refused picture, as a key of the `media.err` family. */
export function uploadErrorKey(title: string | undefined): 'type' | 'size' | 'caption' | 'unreadable' | 'scan' | 'full' | 'child' | 'network' | 'other' {
  switch (title) {
    case 'network': case 'offline': case 'timeout': return 'network'
    case 'type': return 'type'
    case 'size': case 'empty': return 'size'
    case 'badCaption': return 'caption'
    case 'unreadable': return 'unreadable'
    case 'scan': return 'scan'
    case 'full': return 'full'
    case 'childCannotUpload': return 'child'
    default: return 'other'
  }
}

/** The pictures a guest has put on a day of the memory book (or its cover), oldest first so they read in the order taken. */
export const bookPhotos = (list: readonly Media[], day: number | 'cover'): Media[] =>
  list.filter((m) => m.purpose === 'book' && m.ref === String(day)).sort((a, b) => a.at - b.at)

export const isCabinKind = (v: unknown): v is CabinKind => CABIN_KINDS.includes(v as CabinKind)

/** The cabin pictures to show, the guest's own first, then the rest. Each is either the guest's own or approved. */
export const cabinPhotos = (list: readonly Media[], category: CategoryId): Media[] =>
  list.filter((m) => m.purpose === 'cabin' && m.ref === category && (m.mine || m.status === 'approved')).sort((a, b) => Number(b.mine) - Number(a.mine) || b.at - a.at)

/** Words for the alternative text of a picture the guest may not have described. */
export const altFor = (m: Media, fallback: string): string => m.caption.trim() || fallback
