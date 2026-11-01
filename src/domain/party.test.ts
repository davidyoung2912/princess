import { describe, expect, it } from 'vitest'
import { addInvite, addNote, EMPTY_PARTY, MAX_INVITES, MAX_NOTE_LENGTH, MAX_NOTES, normalizePartyState, partyCheckin, removeInvite, removeNote } from './party'

describe('travel party', () => {
  it('invites by a valid address, once, up to the limit', () => {
    expect(addInvite(EMPTY_PARTY, 'nope', 1, 'a').problem).toBe('email')
    const one = addInvite(EMPTY_PARTY, ' Sam@Example.com ', 1, 'a')
    expect(one.state.invites).toEqual([{ id: 'a', email: 'sam@example.com', at: 1 }])
    expect(addInvite(one.state, 'sam@example.com', 2, 'b').problem).toBe('duplicate')
    let s = EMPTY_PARTY
    for (let i = 0; i < MAX_INVITES; i++) s = addInvite(s, `p${i}@example.com`, i, `i${i}`).state
    expect(addInvite(s, 'extra@example.com', 9, 'x').problem).toBe('tooMany')
    expect(removeInvite(s, 'i0').invites).toHaveLength(MAX_INVITES - 1)
  })
  it('adds notes, trims them and refuses empty or long ones', () => {
    expect(addNote(EMPTY_PARTY, 'gerald', '   ', 1, 'n').problem).toBe('empty')
    expect(addNote(EMPTY_PARTY, 'gerald', 'x'.repeat(MAX_NOTE_LENGTH + 1), 1, 'n').problem).toBe('tooLong')
    expect(addNote(EMPTY_PARTY, 'gerald', '  Meet at the pool  ', 1, 'n').state.notes[0]).toEqual({ id: 'n', by: 'gerald', text: 'Meet at the pool', at: 1 })
  })
  it('drops the oldest note when the list is full', () => {
    let s = EMPTY_PARTY
    for (let i = 0; i < MAX_NOTES + 3; i++) s = addNote(s, 'gerald', `note ${i}`, i, `n${i}`).state
    expect(s.notes).toHaveLength(MAX_NOTES)
    expect(s.notes[0].text).toBe('note 3')
  })
  it('lets only the writer take a note away', () => {
    const s = addNote(EMPTY_PARTY, 'gerald', 'hi', 1, 'n').state
    expect(removeNote(s, 'n', 'maria').notes).toHaveLength(1)
    expect(removeNote(s, 'n', 'gerald').notes).toHaveLength(0)
  })
  it('reads saved records safely', () => {
    expect(normalizePartyState(null)).toEqual(EMPTY_PARTY)
    expect(normalizePartyState({ invites: [{ id: 'a', email: 'bad', at: 1 }, { id: 'b', email: 'ok@example.com', at: 2 }], notes: [{ id: 'n', by: 'g', text: ' ', at: 1 }, 7] }))
      .toEqual({ invites: [{ id: 'b', email: 'ok@example.com', at: 2 }], notes: [] })
  })
  it('says who is still waiting on check-in', () => {
    expect(partyCheckin([{ first: 'Ann', progress: { complete: true } }, { first: 'Bo', progress: { complete: false } }])).toEqual({ done: 1, total: 2, waiting: ['Bo'] })
  })
})
