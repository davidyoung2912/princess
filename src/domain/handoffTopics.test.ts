import { describe, expect, it } from 'vitest'
import { CASE_TOPICS } from '../ai/stanleyHandoff'
import { en } from '../i18n/locales/en'
import { buildHandoff, defaultParts, FIELD_MAX, HANDOFF_MAX, TOPIC_FIELDS, topicLines } from './handoff'

const booking = { guest: 'Ana Silva', sailing: '2027-03-20', party: 2, open: 3 }

describe('a draft for each handoff topic', () => {
  it('has fields for every topic the server knows, none for talking to a person, and a screen wording for each field', () => {
    expect(Object.keys(TOPIC_FIELDS).sort()).toEqual([...CASE_TOPICS].sort())
    expect(TOPIC_FIELDS.person).toEqual([])
    for (const topic of CASE_TOPICS) {
      const keys = TOPIC_FIELDS[topic].map((f) => f.key)
      expect(new Set(keys).size, topic).toBe(keys.length)
      for (const f of TOPIC_FIELDS[topic]) {
        expect(f.label.length, `${topic}.${f.key}`).toBeGreaterThan(0)
        expect(en[`handoff.f.${topic}.${f.key}` as keyof typeof en], `${topic}.${f.key}`).toBeTruthy()
      }
    }
  })

  it('writes only the fields the guest filled in, one line each, in the topic\'s own order', () => {
    expect(topicLines('cabin', { since: 'last night', cabin: '8042', what: '   ' })).toEqual(['Cabin: 8042', 'Since when: last night'])
    expect(topicLines('person', { cabin: '8042' })).toEqual([])
    expect(topicLines('lostProperty', { item: 'a blue\n  jacket' })).toEqual(['Item: a blue jacket'])
  })

  it('cuts one answer at the field length and ignores an answer for another topic\'s field', () => {
    expect(topicLines('billing', { charge: 'x'.repeat(500) })[0]).toBe(`Charge: ${'x'.repeat(FIELD_MAX)}`)
    expect(topicLines('billing', { item: 'a jacket' })).toEqual([])
  })

  it('puts the topic\'s lines in the message straight after the question, still within the limit', () => {
    const text = buildHandoff('person', 'My cabin is hot', [], booking, defaultParts('person'), topicLines('cabin', { cabin: '8042', what: 'no air conditioning' }))!
    const lines = text.split('\n')
    expect(lines.slice(1, 4)).toEqual(['Guest asked: My cabin is hot', 'Cabin: 8042', 'What is wrong: no air conditioning'])
    const long = buildHandoff('person', 'q'.repeat(400), [{ role: 'user', text: 'z'.repeat(900) }], booking, defaultParts('person'), topicLines('missedShip', { port: 'Roatan', where: 'the pier', phone: '+1 555 0100' }))!
    expect(long.length).toBeLessThanOrEqual(HANDOFF_MAX)
    expect(long).toContain('Port: Roatan')
  })

  it('is unchanged for a topic with no fields', () => {
    expect(buildHandoff('person', 'Help', [], booking, defaultParts('person'), topicLines('person', {}))).toBe(buildHandoff('person', 'Help', [], booking, defaultParts('person')))
  })
})
