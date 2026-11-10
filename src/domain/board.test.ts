import { describe, expect, it } from 'vitest'
import { addIdea, EMPTY_BOARD, heartIdea, normalizeBoard, findDates, toggleDate, rankIdeas } from './board'

describe('dream board and date finder (shared by the booking)', () => {
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
