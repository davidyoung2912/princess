import { describe, expect, it } from 'vitest'
import type { ChatReaction } from '../api/chatTypes'
import { chipLabel, isReaction, myReaction, REACTIONS, toggleReaction, whoReacted, withReactions } from './chatReactions'

const chip = (emoji: string, count: number, mine = false, names: string[] = []): ChatReaction => ({ emoji, count, mine, names })

describe('the reaction set', () => {
  it('has the six and refuses anything else', () => {
    expect(REACTIONS).toHaveLength(6)
    expect(isReaction('👍')).toBe(true)
    expect(isReaction('🔥')).toBe(false)
    expect(isReaction(3)).toBe(false)
  })
})

describe('toggling a reaction before the server answers', () => {
  it('adds the first reaction to a bare message', () => {
    expect(toggleReaction(undefined, '👍')).toEqual([chip('👍', 1, true)])
  })

  it('joins a chip others already started', () => {
    expect(toggleReaction([chip('👍', 2, false, ['Sam R.', 'Ana K.'])], '👍')).toEqual([chip('👍', 3, true, ['Sam R.', 'Ana K.'])])
  })

  it('takes your reaction away when you pick the one you hold', () => {
    expect(toggleReaction([chip('👍', 1, true)], '👍')).toEqual([])
    expect(toggleReaction([chip('👍', 2, true, ['Sam R.'])], '👍')).toEqual([chip('👍', 1, false, ['Sam R.'])])
  })

  it('has one reaction per person: a new one replaces the old', () => {
    const after = toggleReaction([chip('👍', 2, true, ['Sam R.']), chip('❤️', 1, false, ['Ana K.'])], '❤️')
    expect(after).toEqual([chip('👍', 1, false, ['Sam R.']), chip('❤️', 2, true, ['Ana K.'])])
    expect(after.filter((c) => c.mine)).toHaveLength(1)
  })

  it('keeps the chips in picker order and does not change the input', () => {
    const before = [chip('🙏', 1, false, ['Sam R.'])]
    const after = toggleReaction(before, '👍')
    expect(after.map((c) => c.emoji)).toEqual(['👍', '🙏'])
    expect(before).toEqual([chip('🙏', 1, false, ['Sam R.'])])
  })

  it('finds your own reaction', () => {
    expect(myReaction([chip('👍', 1), chip('❤️', 1, true)])).toBe('❤️')
    expect(myReaction([chip('👍', 1)])).toBeNull()
    expect(myReaction(undefined)).toBeNull()
  })
})

describe('what a screen reader hears', () => {
  it('names the others and then you', () => {
    expect(whoReacted(chip('👍', 3, true, ['Sam R.', 'Ana K.']), 'you')).toBe('Sam R., Ana K. and you')
    expect(whoReacted(chip('👍', 2, true, ['Sam R.']), 'you')).toBe('Sam R. and you')
    expect(whoReacted(chip('👍', 1, true), 'you')).toBe('you')
    expect(whoReacted(chip('👍', 1, false, ['Sam R.']), 'you')).toBe('Sam R.')
  })

  it('reads a chip as the emoji, the count and who', () => {
    expect(chipLabel(chip('👍', 2, true, ['Sam R.']), 'you')).toBe('👍 2: Sam R. and you')
  })

  it('still reads the count when names are not known', () => {
    expect(chipLabel(chip('❤️', 2), 'you')).toBe('❤️ 2')
  })
})

describe('putting chips on a message', () => {
  it('sets them, and removes the field when there are none', () => {
    const base: { id: string; text: string; reactions?: ChatReaction[] } = { id: 'a', text: 'hi' }
    const set = withReactions(base, [chip('👍', 1, true)])
    expect(set.reactions).toEqual([chip('👍', 1, true)])
    expect('reactions' in withReactions(set, [])).toBe(false)
    expect(base).toEqual({ id: 'a', text: 'hi' })
  })
})
