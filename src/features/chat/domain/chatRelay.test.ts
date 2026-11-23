import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../../shared/api/chatTypes'
import { awaitingMe, mayHandOver, photosIn, recapProblem, relayChoices, relayProblem, toggleChoice } from './chatRelay'

const msg = (o: Partial<ChatMessage> & { id: string }): ChatMessage => ({ from: 'a', text: 'hello', at: 1, ...o })

describe('relay to a person', () => {
  it('offers only words a person typed, newest first', () => {
    const list = [msg({ id: '1' }), msg({ id: '2', system: true }), msg({ id: '3', deleted: true }), msg({ id: '4', kind: 'poll' }), msg({ id: '5', stanley: true }), msg({ id: '6', text: '  ' }), msg({ id: '7' })]
    expect(relayChoices(list).map((m) => m.id)).toEqual(['7', '1'])
  })

  it('limits the choice and lets one be taken back', () => {
    const ten = Array.from({ length: 10 }, (_, i) => String(i))
    expect(toggleChoice(ten, 'x')).toEqual(ten)
    expect(toggleChoice(ten, '3')).toHaveLength(9)
    expect(toggleChoice(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('sends only with consent and a text of the right length', () => {
    expect(mayHandOver('Please help', true)).toBe(true)
    expect(mayHandOver('Please help', false)).toBe(false)
    expect(mayHandOver('  ', true)).toBe(false)
    expect(mayHandOver('a'.repeat(1001), true)).toBe(false)
  })

  it('maps refusals to one sentence', () => {
    expect(relayProblem('forbidden', 'child')).toBe('child')
    expect(relayProblem('invalid', 'none')).toBe('none')
    expect(relayProblem('network', undefined)).toBe('offline')
    expect(relayProblem('server', 'boom')).toBe('other')
  })
})

describe('the group recap', () => {
  it('maps refusals to one sentence', () => {
    expect(recapProblem('conflict', 'waiting')).toBe('waiting')
    expect(recapProblem('forbidden', 'small')).toBe('small')
    expect(recapProblem('timeout', undefined)).toBe('offline')
    expect(recapProblem('x', 'y')).toBe('other')
  })

  it('counts only my own pending plans and my own included photos', () => {
    const plans = [
      { messageId: '1', title: 'a', mine: true, decision: 'pending' as const },
      { messageId: '2', title: 'b', mine: true, decision: 'approved' as const },
      { messageId: '3', title: 'c', mine: false, decision: 'pending' as const },
    ]
    expect(awaitingMe({ plans })).toBe(1)
    expect(photosIn({ photos: [{ messageId: '1', mine: true, decision: 'approved' }, { messageId: '2', mine: false, decision: 'approved' }, { messageId: '3', mine: true, decision: 'declined' }] })).toBe(1)
  })
})
