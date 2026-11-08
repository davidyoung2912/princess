import { describe, expect, it } from 'vitest'
import { addIdea, castVote, EMPTY_BOARD, heartIdea, leader, newPoll, normalizeBoard, findDates, toggleDate, rankIdeas, tally, voteOf } from './board'

describe('group poll and dream board (shared by the booking)', () => {
  it('runs a poll with one vote each and no winner on a tie', () => {
    let p = newPoll('p', 'Where to eat?', ['Pizza', 'Tacos', 'Pizza'])!
    expect(p.options).toHaveLength(2)
    expect(newPoll('p', '', ['a', 'b'])).toBeNull()
    expect(newPoll('p', 'q', ['only'])).toBeNull()
    p = castVote(p, 'ann', 'o1'); p = castVote(p, 'bo', 'o2')
    expect(leader(p)).toBeNull()
    p = castVote(p, 'bo', 'o1')
    expect(leader(p)?.label).toBe('Pizza')
    expect(tally(p).map((x) => x.votes)).toEqual([2, 0])
    expect(castVote(p, 'cy', 'nope')).toBe(p)
    expect(castVote(p, '', 'o1')).toBe(p)
  })
  it('tells a person which option they chose, and only theirs', () => {
    let p = newPoll('p', 'Where to eat?', ['Pizza', 'Tacos'])!
    p = castVote(p, 'ann', 'o2')
    expect(voteOf(p, 'ann')?.label).toBe('Tacos')
    expect(voteOf(p, 'bo')).toBeNull()
  })
  it('two people voting from two phones both count', () => {
    const p = newPoll('p', 'Where to eat?', ['Pizza', 'Tacos'])!
    const fromAnn = castVote(p, 'ann', 'o1')
    const fromBo = castVote(p, 'bo', 'o1')
    // Each phone sends only its own vote row; the union is what the server holds.
    expect(tally({ ...p, votes: { ...fromAnn.votes, ...fromBo.votes } })[0].votes).toBe(2)
  })
  it('hearts toggle on the dream board, and the loved ideas come first', () => {
    let i = addIdea([], 'a', ' Swim with rays ')
    i = addIdea(i, 'b', 'Spa day')
    i = heartIdea(i, 'a', 'ann'); i = heartIdea(i, 'a', 'bo'); i = heartIdea(i, 'a', 'ann')
    expect(i[0].hearts).toEqual(['bo'])
    i = heartIdea(i, 'b', 'ann'); i = heartIdea(i, 'b', 'cy')
    expect(rankIdeas(i).map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('reads junk as an empty board', () => {
    expect(normalizeBoard(null)).toEqual(EMPTY_BOARD)
    expect(normalizeBoard({ polls: [{ id: 'x' }], ideas: [{ id: 'i', text: '  ' }] })).toEqual(EMPTY_BOARD)
  })
  it('finds the sailings everyone can do, cheapest first', () => {
    let d = toggleDate({}, 'ann', 's1'); d = toggleDate(d, 'ann', 's2'); d = toggleDate(d, 'ann', 's3')
    d = toggleDate(d, 'bo', 's2'); d = toggleDate(d, 'bo', 's3'); d = toggleDate(d, 'bo', 's4')
    const prices: Record<string, number> = { s2: 900, s3: 700 }
    const f = findDates(d, (id) => prices[id] ?? null)
    expect(f).toMatchObject({ people: 2, everyone: ['s3', 's2'], cheapest: 's3', best: null })
  })
  it('says the best partial match when nobody agrees, and waits for a second person', () => {
    let d = toggleDate({}, 'ann', 's1')
    expect(findDates(d, () => null)).toMatchObject({ everyone: [], cheapest: null, best: null })
    d = toggleDate(d, 'bo', 's2'); d = toggleDate(d, 'cy', 's2')
    expect(findDates(d, () => null).best).toEqual({ id: 's2', count: 2 })
  })
  it('unticking the last sailing removes the person, and bad data is cleaned', () => {
    expect(toggleDate(toggleDate({}, 'ann', 's1'), 'ann', 's1')).toEqual({})
    expect(toggleDate({}, '', 's1')).toEqual({})
    expect(normalizeBoard({ dates: { ann: ['s1', 's1', 4, ''], bo: [], '': ['x'] } }).dates).toEqual({ ann: ['s1'] })
  })
})
