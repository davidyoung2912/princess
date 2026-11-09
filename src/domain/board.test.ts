import { describe, expect, it } from 'vitest'
import { addIdea, castVote, EMPTY_BOARD, heartIdea, leader, newPoll, normalizeBoard, findDates, toggleDate, rankIdeas, tally, voteOf, answerOf, extendPoll, isExpired, markOption, takesAnswers, DAY_MS } from './board'

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

  describe('answers beyond the pick, and a closing time (phase 9)', () => {
    const made = newPoll('p', 'Which tour?', ['Snorkel', 'Ruins', 'Beach'], 1_000, 1)!

    it('stamps the time it was made and when it stops, only for a listed number of days', () => {
      expect(made.createdAt).toBe(1_000)
      expect(made.closesAt).toBe(1_000 + DAY_MS)
      expect(newPoll('p', 'Q', ['a', 'b'], 1_000, 2)!.closesAt).toBeUndefined()
      expect(newPoll('p', 'Q', ['a', 'b'])!.createdAt).toBeUndefined()
    })

    it('takes no answer once the time is up, and a poll with no time never expires', () => {
      const late = made.closesAt! + 1
      expect(isExpired(made, late)).toBe(true)
      expect(castVote(made, 'ann', 'o1', late)).toBe(made)
      expect(markOption(made, 'ann', 'o1', 'no', late)).toBe(made)
      expect(takesAnswers(newPoll('p', 'Q', ['a', 'b'])!, 9e15)).toBe(true)
    })

    it('keeps a pick as a yes and marks as maybe or no, never both on one option', () => {
      let p = castVote(made, 'ann', 'o1', 2_000)
      p = markOption(p, 'ann', 'o2', 'no', 2_000)
      p = markOption(p, 'ann', 'o3', 'maybe', 2_000)
      expect(['o1', 'o2', 'o3'].map((o) => answerOf(p, 'ann', o))).toEqual(['yes', 'no', 'maybe'])
      expect(answerOf(p, 'bo', 'o1')).toBeNull()
      p = markOption(p, 'ann', 'o1', 'maybe', 2_000)
      expect(answerOf(p, 'ann', 'o1')).toBe('maybe')
      expect(p.votes.ann).toBeUndefined()
      p = castVote(p, 'ann', 'o2', 2_000)
      expect(answerOf(p, 'ann', 'o2')).toBe('yes')
      p = markOption(p, 'ann', 'o3', null, 2_000)
      expect(answerOf(p, 'ann', 'o3')).toBeNull()
    })

    it('lets the organiser add a day only to an open poll that has a time', () => {
      expect(extendPoll(made, made.closesAt! + 5).closesAt).toBe(made.closesAt! + 5 + DAY_MS)
      expect(extendPoll({ ...made, closedAt: 5 }, 9)).toEqual({ ...made, closedAt: 5 })
      expect(extendPoll(newPoll('p', 'Q', ['a', 'b'])!, 9).closesAt).toBeUndefined()
    })

    it('reads marks and times back defensively', () => {
      const raw = { polls: [{ id: 'p', question: 'Q', options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }], votes: { ann: 'o1' }, answers: { ann: { o1: 'no', o2: 'maybe', zz: 'no' }, bo: { o1: 'because' } }, createdAt: 5, closesAt: -1 }] }
      const poll = normalizeBoard(raw).polls[0]
      expect(poll.answers).toEqual({ ann: { o2: 'maybe' } })
      expect([poll.createdAt, poll.closesAt]).toEqual([5, undefined])
    })
  })
})
