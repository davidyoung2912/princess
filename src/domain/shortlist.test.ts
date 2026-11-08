import { describe, expect, it } from 'vitest'
import { shortlistCase, shortlistText, type ShortlistInput } from './shortlist'

const base: ShortlistInput = { departure: '2027-03-21', title: 'Western Caribbean', ship: 'Aurora', nights: 7, from: 'Miami', ports: ['Cozumel, Mexico'], categoryName: 'Balcony', fareName: 'Plus', guests: 2, total: 280_000, budget: 300_000, fit: ['I like quiet mornings'], wantedHere: ['Cozumel, Mexico'] }

describe('shortlistCase', () => {
  it('gathers the choice, the price a night and the budget read', () => {
    const c = shortlistCase(base)
    expect(c.rows.find((r) => r.label === 'Per person a night')!.value).toBe('$200')
    expect(c.rows.find((r) => r.label === 'Your budget')!.value).toMatch(/Fits/)
    expect(c.open).not.toContain('Choose a room type')
  })
  it('says what is left when nothing is chosen, and when over budget', () => {
    const c = shortlistCase({ ...base, categoryName: null, fareName: null, total: null, fit: [] })
    expect(c.open).toEqual(expect.arrayContaining(['Choose a room type', 'Choose a fare', 'Read the honest-fit page']))
    expect(c.rows.some((r) => r.label === 'All-in price')).toBe(false)
    expect(shortlistCase({ ...base, budget: 100_000 }).rows.find((r) => r.label === 'Your budget')!.value).toMatch(/over/)
  })
  it('writes plain text for sharing', () => {
    const text = shortlistText(shortlistCase(base))
    expect(text).toMatch(/^Western Caribbean\n\nSailing: /)
    expect(text).toContain('Why it suits me\n- I like quiet mornings')
  })
})
