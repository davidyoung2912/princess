import { describe, expect, it } from 'vitest'
import { arrivalPing } from './arrivalPing'

describe('arrivalPing', () => {
  it('moves from before to home along the trip', () => {
    expect(arrivalPing('preCruise', null)).toBe('before')
    expect(arrivalPing('embarkation', 'Fort Lauderdale')).toBe('boarded')
    expect(arrivalPing('disembark', null)).toBe('ashore')
    expect(arrivalPing('postCruise', null)).toBe('home')
  })
  it('says in port or at sea from the ship place', () => {
    expect(arrivalPing('portDay', 'Cozumel')).toBe('inPort')
    expect(arrivalPing('seaDay', null)).toBe('atSea')
    expect(arrivalPing('farewell', null)).toBe('atSea')
  })
})
