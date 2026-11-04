import { describe, expect, it } from 'vitest'
import { cabinsFor, classOf, hasAccessibleCabins, ownCategoryId, SHIP_CABINS, SUN_SHIP } from './cabins'

describe('cabins per ship (AB2)', () => {
  it('names the room class of a ship category', () => {
    expect(classOf('balcony')).toBe('balcony')
    expect(classOf('sky-balcony')).toBe('balcony')
    expect(classOf('sapphire-minisuite')).toBe('miniSuite')
    expect(ownCategoryId('sky-princess', 'miniSuite')).toBe('sky-minisuite')
  })

  it('gives every ship staterooms in every class, on its own decks, with unique numbers', () => {
    for (const [ship, layout] of Object.entries(SHIP_CABINS)) {
      const numbers: string[] = []
      for (const [roomClass, decks] of Object.entries(layout.decks)) {
        const list = cabinsFor('x', ship === SUN_SHIP ? roomClass : ownCategoryId(ship, roomClass), ship)
        expect(list).toHaveLength(9)
        for (const c of list) { expect(decks).toContain(c.deck); numbers.push(c.number) }
        expect(list.filter((c) => c.accessible)).toHaveLength(hasAccessibleCabins(roomClass) ? 1 : 0)
      }
      expect(new Set(numbers).size).toBe(numbers.length)
    }
  })

  it('keeps Sun Princess exactly as it was', () => {
    expect(cabinsFor('s', 'balcony').map((c) => c.number).slice(0, 3)).toEqual(['10177', '11214', '12251'])
    expect(cabinsFor('s', 'balcony', 'sky-princess')[0].number).not.toBe('10177')
  })

  it('returns nothing for an unknown class', () => {
    expect(cabinsFor('s', 'sky-suite', 'sky-princess')).toEqual([])
  })
})
