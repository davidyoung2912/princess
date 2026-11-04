import { describe, expect, it } from 'vitest'
import { en } from '../i18n/locales/en'
import { NOTE_MAX } from '../domain/memoryBook'
import { BITS, bitLabel, draftDayNote, emptyDays, nextEmptyDay, saveDraft, storyShows } from './stanleyStory'

const days = [{ day: 1 }, { day: 2 }, { day: 3 }]

describe('Stanley the storyteller', () => {
  it('writes a draft for every favourite bit, at sea and in port', () => {
    for (const bit of BITS) {
      const sea = draftDayNote({ port: null, bit })
      const port = draftDayNote({ port: 'Cozumel', bit })
      expect(sea, bit).toContain('at sea')
      expect(port, bit).toContain('Cozumel')
      for (const d of [sea, port]) {
        expect(d.length).toBeLessThanOrEqual(NOTE_MAX)
        expect(d).not.toMatch(/!|\{/)
      }
    }
  })

  it('names the meal or the tour only for the bit that asks for it', () => {
    expect(draftDayNote({ port: null, bit: 'food', meal: 'Crown Grill' })).toContain('Crown Grill')
    expect(draftDayNote({ port: 'Roatán', bit: 'ashore', tour: 'Snorkel trip' })).toContain('Snorkel trip')
    expect(draftDayNote({ port: null, bit: 'view', meal: 'Crown Grill', tour: 'Snorkel trip' })).not.toMatch(/Crown Grill|Snorkel/)
  })

  it('keeps every bit label short and plain', () => {
    for (const b of BITS) { expect(bitLabel(b).length).toBeLessThanOrEqual(24); expect(`stanley.story.bit.${b}.line` in en).toBe(true) }
  })

  it('finds days that still have no note, counting blank notes as empty', () => {
    expect(nextEmptyDay(days, {})).toBe(1)
    expect(nextEmptyDay(days, { 1: 'Lovely', 2: '  ' })).toBe(2)
    expect(nextEmptyDay(days, { 1: 'a', 2: 'b', 3: 'c' })).toBeNull()
    expect(emptyDays(days, { 1: 'a' })).toBe(2)
  })

  it('saves a draft only into an empty day and never overwrites the guest', () => {
    const j = { 1: 'My own words' }
    expect(saveDraft(j, 1, 'Draft')).toBeNull()
    expect(saveDraft(j, 2, '   ')).toBeNull()
    expect(saveDraft(j, 2, 'Draft')).toEqual({ 1: 'My own words', 2: 'Draft' })
    expect(j).toEqual({ 1: 'My own words' })
    expect(saveDraft({}, 1, 'x'.repeat(NOTE_MAX + 50))?.[1]).toHaveLength(NOTE_MAX)
  })

  it('starts the conversation at Helpful and Chatty only', () => {
    expect(storyShows('helpful')).toBe(true)
    expect(storyShows('chatty')).toBe(true)
    expect(storyShows('asked')).toBe(false)
    expect(storyShows('off')).toBe(false)
  })
})
