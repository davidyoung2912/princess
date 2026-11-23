import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deckPlansFor, type DeckPlanShip } from './deckPlans'

describe('deckPlansFor', () => {
  const ships: DeckPlanShip[] = ['sun', 'sky', 'sapphire']
  it.each(ships)('every %s deck plan file exists', (ship) => {
    const plans = deckPlansFor(ship)
    expect(plans.length).toBeGreaterThan(10)
    for (const plan of plans) {
      expect(existsSync(join('public', plan.src))).toBe(true)
    }
  })
  it('names Sapphire decks', () => {
    expect(deckPlansFor('sapphire').find((p) => p.deck === 9)?.name).toBe('Dolphin')
  })
})
