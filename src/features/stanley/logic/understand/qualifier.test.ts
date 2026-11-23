import { describe, expect, it } from 'vitest'
import { readUrlFilter } from '../../../explorer/domain/urlFilter'
import { understand } from './understand'

const read = (text: string, ctx = {}) => understand(text, ctx, (d) => d)
const paths = (text: string, ctx = {}) => read(text, ctx).pills.map((p) => p.path)

describe('a filter asked for in the words', () => {
  it('opens dining with a diet the ship marks', () => {
    expect(paths('where can I find vegan food for dinner')[0]).toBe('/dining-today?diet=vegan')
    expect(paths('any vegetarian restaurants tonight')[0]).toBe('/dining-today?diet=vegetarian')
    expect(paths('sugar free dessert options at dinner')[0]).toBe('/dining-today?diet=nas')
  })
  it('never makes a filter out of an allergy, and keeps the official screens', () => {
    const p = paths('I have a peanut allergy and want vegan dinner')
    expect(p.some((x) => x.includes('diet='))).toBe(false)
  })
  it('gives no filter for a diet the ship does not mark', () => {
    expect(paths('gluten free dinner options').some((x) => x.includes('diet='))).toBe(false)
  })
  it('opens tours for a child of the age named', () => {
    expect(paths('what tours are there for my 5 year old')).toContain('/excursions-explorer?age=5')
    expect(paths('shore excursions for kids aged 9')).toContain('/excursions-explorer?age=9')
  })
  it('ignores an age that is not a child’s or is not about tours', () => {
    expect(paths('shore excursions for a 45 year old').some((x) => x.includes('age='))).toBe(false)
    expect(paths('where is the spa for a 9 year old').some((x) => x.includes('age='))).toBe(false)
  })
})

describe('the address filters', () => {
  it('reads a diet and an age, and ignores anything else', () => {
    expect(readUrlFilter(new URLSearchParams('diet=Vegan&age=7'))).toMatchObject({ diet: 'vegan', age: 7 })
    expect(readUrlFilter(new URLSearchParams('diet=gluten&age=40'))).toMatchObject({ diet: null, age: null })
    expect(readUrlFilter(new URLSearchParams('age=-1')).age).toBeNull()
    expect(readUrlFilter(new URLSearchParams('age=3.5')).age).toBeNull()
  })
})
