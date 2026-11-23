/**
 * "Download my cruise" (R4, research 4 D.1 to D.7). Fetches, ahead of sailing and while there is a signal, the views a guest needs with none, and keeps them
 * under the same names the screens read, so a screen opened offline finds its copy. Framework-free: the caller supplies the loaders and the store.
 * Nothing here books, pays or changes anything: it only reads. Items fail one at a time; what failed is listed and can be tried again on its own.
 */
export type PackSection = 'essentials' | 'reservations' | 'programme' | 'tours' | 'bill' | 'home'
export const PACK_SECTIONS: readonly PackSection[] = ['essentials', 'reservations', 'programme', 'tours', 'bill', 'home']

export interface PackItem {
  /** Unique, stable: `section:kind:key`. */
  id: string
  section: PackSection
  /** The saved-copy kind and key the screens read (`useSavedCopy(kind, key, ...)`). */
  kind: string
  key: string
  /** Words for the list; a day number where the item is one day. */
  label: string
  day?: number
  /** A port id for a tour item, so a guest can leave ports out. */
  port?: string
  load: () => Promise<unknown>
}

export interface PackChoice { sections: readonly PackSection[]; /** Ports whose tour lists are left out. */ skipPorts: readonly string[] }
export const ALL_SECTIONS: PackChoice = { sections: PACK_SECTIONS, skipPorts: [] }

/** The items a choice asks for. Essentials are always included, whatever the choice says. */
export function selectItems(items: readonly PackItem[], choice: PackChoice): PackItem[] {
  return items.filter((i) => i.section === 'essentials' || (choice.sections.includes(i.section) && !(i.port !== undefined && choice.skipPorts.includes(i.port))))
}

export interface PackFailure { id: string; label: string; code: string }
export interface PackResult { at: number; total: number; done: string[]; failed: PackFailure[]; bytes: number }

export interface PackStore { put: (item: PackItem, value: unknown, at: number) => { kept: boolean; bytes: number } }
export interface PackProgress { finished: number; total: number; current: string | null }

const codeOf = (e: unknown): string => (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : 'server')

/**
 * Runs the items with a small number at once, reporting after each. A failed item never stops the rest; a stored value that the store refuses (storage full)
 * counts as failed with code `storage`, so a guest is never told a copy is kept when it is not.
 */
export async function runPack(items: readonly PackItem[], store: PackStore, o: { now: () => number; onProgress?: (p: PackProgress) => void; concurrency?: number; signal?: { cancelled: boolean } }): Promise<PackResult> {
  const done: string[] = []
  const failed: PackFailure[] = []
  let bytes = 0
  let finished = 0
  let next = 0
  const report = (current: string | null) => o.onProgress?.({ finished, total: items.length, current })
  report(null)
  const worker = async () => {
    for (;;) {
      if (o.signal?.cancelled) return
      const i = items[next++]
      if (!i) return
      report(i.label)
      try {
        const value = await i.load()
        const r = store.put(i, value, o.now())
        if (r.kept) { done.push(i.id); bytes += r.bytes } else failed.push({ id: i.id, label: i.label, code: 'storage' })
      } catch (e) {
        failed.push({ id: i.id, label: i.label, code: codeOf(e) })
      }
      finished++
      report(null)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.concurrency ?? 3, items.length || 1)) }, worker))
  return { at: o.now(), total: items.length, done, failed, bytes }
}

/** The items to try again after a run: those that failed. */
export const retryItems = (items: readonly PackItem[], last: Pick<PackResult, 'failed'> | null): PackItem[] => {
  const ids = new Set((last?.failed ?? []).map((f) => f.id))
  return items.filter((i) => ids.has(i.id))
}

/** "About" size before a download: what is already kept for the same kind and key where known, else a typical size per item. */
export const TYPICAL_ITEM_BYTES = 24 * 1024
export function estimateBytes(items: readonly PackItem[], kept: ReadonlyMap<string, number>): number {
  return items.reduce((n, i) => n + (kept.get(`${i.kind}:${i.key}`) ?? TYPICAL_ITEM_BYTES), 0)
}

/** True when the result covers everything asked for. */
export const isComplete = (r: Pick<PackResult, 'failed' | 'total'>): boolean => r.failed.length === 0 && r.total > 0

/** The last result, read defensively from stored text. */
export function parseResult(text: string | null | undefined): PackResult | null {
  try {
    const o = JSON.parse(text ?? 'null') as Partial<PackResult> | null
    if (!o || typeof o.at !== 'number' || typeof o.total !== 'number' || typeof o.bytes !== 'number' || !Array.isArray(o.done) || !Array.isArray(o.failed)) return null
    const failed = o.failed.filter((f): f is PackFailure => !!f && typeof f.id === 'string' && typeof f.label === 'string' && typeof f.code === 'string')
    return { at: o.at, total: o.total, bytes: o.bytes, done: o.done.filter((d): d is string => typeof d === 'string'), failed }
  } catch { return null }
}
