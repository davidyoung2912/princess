import { describe, expect, it } from 'vitest'
import type { JourneyStage } from '../../../../app/routes/hubs'
import { JOURNEY_STAGES } from '../../../../app/routes/hubs'
import { understand } from './understand'

/**
 * Stage depth (docs/stanley-answers-plan.md, Phase 8): what a guest typically asks at each of the eleven stages, read with that stage as the context. Each line is a question and the topic it must reach at that stage.
 * Some questions are the same words at two stages with a different best answer ("the cabin"), which is what the stage lean is for.
 */
const BY_STAGE: Record<JourneyStage, readonly (readonly [string, string])[]> = {
  dream: [['which ship is best for families', 'ships'], ['when is the best time to cruise the Caribbean', 'sailings'], ['how much does a cruise cost', 'sailings'], ['what is there to do on a cruise', 'activities'], ['compare two ships', 'ships'], ['what kind of cabin should I get', 'cabinchoose']],
  discover: [['show me sailings in March', 'sailings'], ['which cabin is quietest', 'cabinchoose'], ['which itinerary is better', 'itinerary'], ['what ports does the cruise visit', 'ports'], ['what is the difference between a balcony and an ocean view', 'cabinchoose'], ['how do I save this sailing', 'decide']],
  book: [['I want to book this cruise', 'booking'], ['how do I book a cruise', 'booking'], ['which cabin should I pick', 'cabinchoose'], ['how do I pay a deposit', 'payments'], ['can I add travel insurance', 'insurance'], ['book a cabin for four of us', 'booking']],
  manage: [['where is my booking', 'trips'], ['change my payment method', 'payments'], ['what documents do I need', 'documents'], ['how do I check in online', 'checkin'], ['reserve dinner for my first night', 'dining'], ['add a person to my booking', 'trips']],
  prebook: [['what should I pack', 'packing'], ['book a shore excursion in advance', 'excursions'], ['reserve a table for the first night', 'dining'], ['book a massage before the cruise', 'spa'], ['what is the dress code', 'dresscode'], ['how do I get a drinks package', 'packages']],
  getToShip: [['where do I check in', 'checkin'], ['I lost my boarding pass', 'boardingpass'], ['how do I get to the port', 'travelplan'], ['what time do I need to arrive', 'embarkation'], ['do I need my passport', 'documents'], ['where do my bags go', 'luggage']],
  embark: [['where is the muster station', 'muster'], ['when can I get into my cabin', 'embarkation'], ['where do I eat on the first day', 'dining'], ['where is my cabin', 'deckmap'], ['how do I connect to the wifi', 'wifi'], ['when do my bags arrive', 'luggage']],
  sea: [['what is on tonight', 'plan.day'], ['where is the buffet', 'dining'], ['what time is the show', 'entertainment'], ['how do I order room service', 'roomservice'], ['book a spa treatment', 'spa'], ['what is the plan for today', 'plan.day']],
  port: [['what time do I need to be back on the ship', 'port.allaboard'], ['what tours are there today', 'excursions'], ['where can I change money', 'port.practical'], ['is the port safe', 'port.safety'], ['how do I get a taxi', 'port.practical'], ['what is there to see near the port', 'port.nearby']],
  disembark: [['when do I have to leave my cabin', 'disembark'], ['where do I collect my bags', 'luggage'], ['how do customs work', 'customs'], ['what time can I get off the ship', 'disembark'], ['how do I settle my bill', 'bill'], ['how do I get to the airport', 'flights']],
  remember: [['can I see my trip photos', 'photos'], ['how do I leave feedback', 'feedback'], ['I left something in my cabin', 'lostitem'], ['when will my final bill be ready', 'finalbill'], ['how do I book my next cruise', 'nextcruise'], ['what is my loyalty status', 'loyalty']],
}

describe('what guests ask at each stage', () => {
  it('has questions for every stage', () => {
    for (const s of JOURNEY_STAGES) expect(BY_STAGE[s].length, s).toBeGreaterThanOrEqual(6)
  })

  it('reads them with the stage as the context', () => {
    const misses: string[] = []
    let total = 0
    for (const s of JOURNEY_STAGES) for (const [q, topic] of BY_STAGE[s]) {
      total++
      const u = understand(q, { stage: s, hasBooking: s !== 'dream' && s !== 'discover' && s !== 'book' }, (d) => d)
      const ok = u.outcome === 'confident' ? u.topics[0]?.id === topic : u.outcome === 'ambiguous' && u.topics.slice(0, 2).some((t) => t.id === topic)
      if (!ok) misses.push(`${s}: "${q}" wants ${topic} -> ${u.outcome} ${u.topics.map((t) => t.id).join(',')}`)
    }
    expect((total - misses.length) / total, misses.join('\n')).toBeGreaterThanOrEqual(0.85)
  })
})
