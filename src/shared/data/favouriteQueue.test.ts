import { describe, expect, it } from 'vitest'
import { flushFavourites, heldFavourites, holdFavourite, withHeld } from './favouriteQueue'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('held favourites', () => {
  it('keeps the guest’s last wish for an item', () => {
    const s = memory()
    holdFavourite(s, 'p1', 'tour:a', true, 1)
    holdFavourite(s, 'p1', 'tour:b', true, 2)
    holdFavourite(s, 'p1', 'tour:a', false, 3)
    expect(heldFavourites(s, 'p1')).toEqual([{ key: 'tour:b', on: true }, { key: 'tour:a', on: false }])
    expect(heldFavourites(s, 'p2')).toEqual([])
  })
  it('shows the list with held changes applied', () => {
    expect(withHeld(['x', 'y'], [{ key: 'y', on: false }, { key: 'z', on: true }]).sort()).toEqual(['x', 'z'])
  })
  it('sends only what differs, and a repeat cannot undo the choice', async () => {
    const s = memory()
    holdFavourite(s, 'p', 'a', true, 1)
    holdFavourite(s, 'p', 'b', false, 2)
    const flips: string[] = []
    // The server already has "a" saved (the other device did it) and "b" saved too.
    const r = await flushFavourites(s, 'p', async () => ['a', 'b'], async (k) => { flips.push(k) })
    expect(flips).toEqual(['b'])
    expect(r).toEqual({ sent: 2, left: 0 })
    expect(heldFavourites(s, 'p')).toEqual([])
  })
  it('keeps what it could not send, and stops at the first failure', async () => {
    const s = memory()
    holdFavourite(s, 'p', 'a', true, 1)
    holdFavourite(s, 'p', 'b', true, 2)
    const r = await flushFavourites(s, 'p', async () => [], async () => { throw new Error('offline') })
    expect(r).toEqual({ sent: 0, left: 2 })
    expect(heldFavourites(s, 'p')).toHaveLength(2)
  })
})
