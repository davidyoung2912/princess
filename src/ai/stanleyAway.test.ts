import { describe, expect, it } from 'vitest'
import { AWAY_CHIPS, awayTopic } from './stanleyAway'

describe('Stanley away topics', () => {
  it.each([
    ['When do I need to be back?', 'back'],
    ['What time does the ship leave', 'back'],
    ['I think I am going to miss the ship', 'late'],
    ['we are running late', 'late'],
    ['How do I get a taxi back', 'taxi'],
    ['Is 40 dollars too much to pay?', 'money'],
    ['How do I say thank you', 'say'],
    ['Where can I sit and eat lunch near here', 'near'],
    ['Any scams to avoid?', 'safe'],
  ])('reads "%s" as %s', (text, topic) => expect(awayTopic(text)).toBe(topic))

  it('puts being late ahead of the return time, and returns null for anything else', () => {
    expect(awayTopic('I am late, what time does the ship leave?')).toBe('late')
    expect(awayTopic('What is the capital of France')).toBeNull()
    expect(awayTopic('')).toBeNull()
  })

  it('offers only topics it can answer', () => {
    for (const c of AWAY_CHIPS) expect(['back', 'late', 'taxi', 'money', 'say', 'near', 'safe', 'help']).toContain(c)
  })
})

import { awayAnswer, type AwayFacts } from './stanleyAway'

const say = (key: string, p: Record<string, string | number> = {}) => `${key}${Object.keys(p).length ? JSON.stringify(p) : ''}`
const facts: AwayFacts = {
  portName: 'Cozumel', tender: false, allAboard: '4:30 pm', gangwayBy: '3:30 pm', sails: '5:00 pm', minutesLeft: 120, shipPhone: '555-0100', localEmergency: '911', agent: null,
  takeMeBack: null, taxiStand: null, fare: null, firstWalk: null, firstScam: null, firstPhrase: null,
}

describe('Stanley away answers', () => {
  it('gives the return times and the minutes left for "back"', () => {
    const a = awayAnswer('back', facts, say)
    expect(a).toContain('"aboard":"4:30 pm"')
    expect(a).toContain('"by":"3:30 pm"')
    expect(a).toContain('away.s.left{"minutes":120}')
  })

  it('ends every other answer with the return time, and says all aboard has passed once it has', () => {
    expect(awayAnswer('near', facts, say)).toContain('away.s.closing{')
    expect(awayAnswer(null, facts, say)).toContain('away.s.unknown')
    expect(awayAnswer('taxi', { ...facts, minutesLeft: 0 }, say)).toContain('away.s.closingPast')
  })

  it('answers being late with the phone number and no reassurance, adding the agent only when there is one', () => {
    expect(awayAnswer('late', facts, say)).not.toContain('closing')
    expect(awayAnswer('late', facts, say)).not.toContain('lateAgent')
    expect(awayAnswer('late', { ...facts, agent: '555-0111' }, say)).toContain('away.s.lateAgent{"agent":"555-0111"}')
  })

  it('leaves out a fact the port does not have instead of inventing one', () => {
    expect(awayAnswer('taxi', facts, say)).toContain('away.s.taxiPlain')
    expect(awayAnswer('taxi', facts, say)).not.toContain('away.s.fare')
    expect(awayAnswer('safe', { ...facts, localEmergency: null }, say)).not.toContain('away.s.emergency')
  })

  it('uses the tender wording on a tender day', () => {
    expect(awayAnswer('back', { ...facts, tender: true }, say)).toContain('away.s.where.tender')
  })
})
