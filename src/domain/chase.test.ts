import { describe, expect, it } from 'vitest'
import { chaseText } from './chase'

describe('chaseText', () => {
  it('names the person, amount, date and link in every tone', () => {
    for (const tone of ['friendly', 'neutral', 'firm'] as const) {
      const s = chaseText(tone, 'Bo', 125000, 'https://x.test/pay', 'May 1')
      expect(s).toContain('Bo')
      expect(s).toContain('$1,250')
      expect(s).toContain('May 1')
      expect(s).toContain('https://x.test/pay')
    }
  })
  it('differs by tone and leaves out an empty link', () => {
    expect(chaseText('friendly', 'Bo', 100, '', 'May 1')).not.toBe(chaseText('firm', 'Bo', 100, '', 'May 1'))
    expect(chaseText('neutral', 'Bo', 100, '', 'May 1')).not.toContain('pay here')
  })
})
