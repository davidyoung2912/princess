import { describe, expect, it } from 'vitest'
import { addPlanCard, clock12, encodePlanCard, hasPlanCard, newPlanCard, parsePlanCard, planCardLine } from './planCard'

describe('chat plan cards', () => {
  const card = newPlanCard(3, '19:00', ' the  Piazza ')!

  it('makes a card only from a good day, time and place', () => {
    expect(card).toEqual({ day: 3, time: '19:00', place: 'the Piazza' })
    expect(newPlanCard(0, '19:00', 'x')).toBeNull()
    expect(newPlanCard(3, '25:00', 'x')).toBeNull()
    expect(newPlanCard(3, '19:00', '  ')).toBeNull()
    expect(newPlanCard(3, '19:00', 'a|b⟦c⟧')!.place).toBe('a b c')
  })

  it('reads 12-hour times', () => {
    expect([clock12('00:05'), clock12('12:00'), clock12('19:30')]).toEqual(['12:05 AM', '12:00 PM', '7:30 PM'])
  })

  it('travels as readable text and comes back as the same card', () => {
    const text = encodePlanCard(card)
    expect(text).toBe('Meet at the Piazza at 7:00 PM on day 3. ⟦plan|3|19:00|the Piazza⟧')
    expect(parsePlanCard(text)).toEqual(card)
  })

  it('leaves ordinary and broken messages alone', () => {
    expect(parsePlanCard('see you at 7')).toBeNull()
    expect(parsePlanCard('x ⟦plan|3|99:00|Pier⟧')).toBeNull()
    expect(parsePlanCard('x ⟦plan|3|19:00|Pier⟧ and more')).toBeNull()
  })

  it('adds a card to the guest plan once', () => {
    const once = addPlanCard([], card)
    expect(once).toEqual([planCardLine(card)])
    expect(once[0]).toEqual({ day: 3, text: '7:00 PM, meet at the Piazza' })
    expect(addPlanCard(once, card)).toEqual(once)
    expect(hasPlanCard(once, card)).toBe(true)
  })
})
