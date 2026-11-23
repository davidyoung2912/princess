import { describe, expect, it } from 'vitest'
import type { ChatBundle, ChatTally } from '../../../shared/api/chatTypes'
import { applyBoardToggle, boardAdds, boardIn, boardItemWords, cleanBoardDraft } from './chatBoards'

const tally = (counts: number[], mine = 0): ChatTally => ({ counts, mine, closed: false, mayClose: false })
const ev = (id: string, day = 2): ChatBundle => ({ type: 'event', v: 1, title: id, ref: `event:${id}:${day}`, day, time: '10:00' })

describe('day board answers', () => {
  it('reads and sets one bit per item', () => {
    const t = applyBoardToggle(tally([1, 0, 0]), 2, true)
    expect(t.mine).toBe(4)
    expect(t.counts).toEqual([1, 0, 1])
    expect(boardIn(t, 2)).toBe(true)
    expect(boardIn(t, 0)).toBe(false)
    const off = applyBoardToggle(t, 2, false)
    expect(off.mine).toBe(0)
    expect(off.counts).toEqual([1, 0, 0])
  })
  it('changes nothing for a repeat, an item off the board or a count already at zero', () => {
    const t = tally([0, 0], 1)
    expect(applyBoardToggle(t, 0, true)).toBe(t)
    expect(applyBoardToggle(t, 9, true)).toBe(t)
    expect(applyBoardToggle(tally([0, 0], 1), 0, false).counts).toEqual([0, 0])
    expect(boardIn(undefined, 0)).toBe(false)
  })
})

describe('board draft', () => {
  it('drops blanks and repeats, and needs a day and one to eight things', () => {
    expect(cleanBoardDraft(3, ['a', '', 'a', 'b'])).toEqual({ day: 3, refs: ['a', 'b'] })
    expect(cleanBoardDraft(0, ['a'])).toBeNull()
    expect(cleanBoardDraft(3, [])).toBeNull()
    expect(cleanBoardDraft(3, Array.from({ length: 9 }, (_, i) => `e${i}`))).toBeNull()
  })
})

describe('add to my day', () => {
  const items = [ev('trivia~1'), { ...ev('tour~x'), type: 'excursion' }, null, ev('yoga~2')]
  it('offers only programme events, never a booked tour, dinner or a gone item', () => {
    expect(boardAdds(items, tally([], 0), false).map((a) => a.eventId)).toEqual(['trivia~1', 'yoga~2'])
  })
  it('can keep just the ones you are in for', () => {
    expect(boardAdds(items, tally([], 8), true)).toEqual([{ index: 3, eventId: 'yoga~2', day: 2 }])
    expect(boardAdds(items, tally([], 0), true)).toEqual([])
  })
})

describe('words', () => {
  it('say the count and whether you are in', () => {
    const w = { count: (n: number) => `${n} in`, yours: 'you are in' }
    expect(boardItemWords(2, true, w)).toBe('2 in, you are in')
    expect(boardItemWords(0, false, w)).toBe('0 in')
  })
})
