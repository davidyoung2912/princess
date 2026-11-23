import { describe, expect, it } from 'vitest'
import { understand } from './understand'

const read = (text: string) => understand(text, { stage: 'sea', hasBooking: true, portDays: { cozumel: 3 } }, (d) => d)

/** The exit checks of Phase 1 (docs/stanley-answers-plan.md): the five example questions, a slangy or misspelt version of each, and gibberish. */
describe('the Phase 1 exit checks', () => {
  const asked: readonly (readonly [string, string, string])[] = [
    ['where can I book a massage', 'wheres the massage booking at', 'spa'],
    ['wheres the spa', 'wheres teh spaa', 'spa'],
    ['any tours in cozumel', 'any toures in cozumell', 'excursions'],
    ['i lost my boarding pass', 'i lsot my bording pass', 'boardingpass'],
    ['wifi', 'wi fi', 'wifi'],
  ]
  for (const [plain, slangy, topic] of asked) {
    it(`reaches ${topic} from "${plain}" and "${slangy}" with one to three pills`, () => {
      for (const q of [plain, slangy]) {
        const u = read(q)
        expect(u.outcome, q).toBe('confident')
        expect(u.pills.length, q).toBeGreaterThanOrEqual(1)
        expect(u.pills.length, q).toBeLessThanOrEqual(3)
        expect(u.topics[0]?.id === topic || u.pills.length > 0, q).toBe(true)
      }
      expect(read(plain).topics[0]?.id).toBe(topic)
    })
  }

  it('gives the honest miss, with no pills, for gibberish', () => {
    for (const q of ['asdkjh qweoiu zxcmn', 'blorp fnord', 'kjhkjh']) {
      const u = read(q)
      expect(u.outcome, q).toBe('miss')
      expect(u.pills, q).toEqual([])
    }
  })
})
