import { describe, expect, it } from 'vitest'
import { cabinCount, findCabin, normalizeCabin } from './cabinFinder'
import { deckPlansFor } from './deckPlans'
import sapphire from './cabins/sapphire.json'
import sky from './cabins/sky.json'
import sun from './cabins/sun.json'

const DATA_FOR_TEST = { sun, sky, sapphire } as unknown as Record<'sun' | 'sky' | 'sapphire', { decks: Record<string, number[]>; cabins: Record<string, number[]> }>

describe('cabin finder', () => {
  it('normalises what a guest types', () => {
    expect(normalizeCabin(' d-422 ')).toBe('D422')
    expect(normalizeCabin('12 302')).toBe('12302')
  })

  it('places a Sun Princess cabin by deck, side and end of the ship', () => {
    const c = findCabin('12302', 'sun')!
    expect(c).toMatchObject({ ship: 'sun', deck: 12, side: 'port', end: 'forward' })
    expect(findCabin('12301', 'sun')).toMatchObject({ deck: 12, side: 'starboard' })
    expect(findCabin('12640', 'sun')).toMatchObject({ deck: 12, end: 'aft' })
  })

  it('places Sky and Sapphire cabins, which are a deck letter and three digits', () => {
    expect(findCabin('d126', 'sky')).toMatchObject({ ship: 'sky', deck: 9 })
    expect(findCabin('P214', 'sapphire')).toMatchObject({ ship: 'sapphire', deck: 5 })
  })

  it('falls back to the other ships, and says which ship it found it on', () => {
    expect(findCabin('12302', 'sky')?.ship).toBe('sun')
  })

  it('finds nothing for an empty entry or a number on no plan', () => {
    expect(findCabin('   ', 'sun')).toBeNull()
    expect(findCabin('99999', 'sun')).toBeNull()
  })

  it('has well over a thousand cabins on each ship, every one inside its deck image', () => {
    for (const ship of ['sun', 'sky', 'sapphire'] as const) {
      expect(cabinCount(ship)).toBeGreaterThan(1000)
      for (const deck of deckPlansFor(ship)) {
        for (const n of Object.keys(DATA_FOR_TEST[ship].cabins).filter((c) => DATA_FOR_TEST[ship].cabins[c][0] === deck.deck)) {
          const [, x, y] = DATA_FOR_TEST[ship].cabins[n]
          const [w, h] = DATA_FOR_TEST[ship].decks[String(deck.deck)]
          expect(x >= 0 && x <= w && y >= 0 && y <= h, `${ship} ${n}`).toBe(true)
        }
      }
    }
  })
})
