import { describe, expect, it } from 'vitest'
import { addIdea, castVote, EMPTY_BOARD, heartIdea, leader, newPoll, normalizeBoard, rankIdeas, tally, voteOf } from './board'

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
})
