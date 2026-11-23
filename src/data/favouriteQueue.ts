import { enqueue, hasRoom, loadOutbox, notifyOutbox, saveOutbox, sent, type OutboxItem } from './outbox'
import { deviceStore } from './deviceStorage'

/**
 * Saving or un-saving something with no signal (R1, research 4 P.7): a low-risk change is held on the phone and sent when the connection returns.
 * Each held change says what the guest wants ("on" or "off"), not "flip it", so sending it twice, or after the other device changed the same
 * item, cannot undo the guest's choice. Booking, payment and other high-impact actions are never held here.
 */
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export { deviceStore }

const ownerKey = (owner: string): string => `${owner}:favourite`

export interface HeldFavourite { key: string; on: boolean }

/** The held changes for a person, oldest first. */
export function heldFavourites(store: Store | null, owner: string): HeldFavourite[] {
  return loadOutbox(store, ownerKey(owner)).flatMap((i) => (typeof i.payload.key === 'string' && (i.payload.want === 'on' || i.payload.want === 'off') ? [{ key: i.payload.key, on: i.payload.want === 'on' }] : []))
}

/** Holds a change. A later change to the same item replaces the earlier one. Returns false when the outbox is full so the screen can say so. */
export function holdFavourite(store: Store | null, owner: string, key: string, on: boolean, now: number): boolean {
  const list = loadOutbox(store, ownerKey(owner)).filter((i) => i.payload.key !== key)
  if (!hasRoom(list)) return false
  const item: Pick<OutboxItem, 'id' | 'kind' | 'payload'> = { id: `fav-${key}`, kind: 'favourite', payload: { key, want: on ? 'on' : 'off' } }
  saveOutbox(store, ownerKey(owner), enqueue(list, item, now))
  notifyOutbox()
  return true
}

/** The list as the guest left it: saved items from the server with the held changes applied on top. */
export function withHeld(keys: readonly string[], held: readonly HeldFavourite[]): string[] {
  const out = new Set(keys)
  for (const h of held) { if (h.on) out.add(h.key); else out.delete(h.key) }
  return [...out]
}

/**
 * Sends the held changes. `current` reads the saved list and `toggle` flips one item; a change already in the wanted state is skipped, which is what
 * makes a repeat safe. A change that fails stays held for the next try; the first failure stops the run (the link is down).
 */
export async function flushFavourites(
  store: Store | null,
  owner: string,
  current: () => Promise<readonly string[]>,
  toggle: (key: string) => Promise<unknown>,
): Promise<{ sent: number; left: number }> {
  let list = loadOutbox(store, ownerKey(owner))
  let count = 0
  for (const item of [...list]) {
    try {
      const now = await current()
      if (now.includes(item.payload.key) !== (item.payload.want === 'on')) await toggle(item.payload.key)
      list = sent(list, item.id)
      saveOutbox(store, ownerKey(owner), list)
      count++
    } catch { break }
  }
  notifyOutbox()
  return { sent: count, left: list.length }
}
