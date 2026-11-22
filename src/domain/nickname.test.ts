import { describe, expect, it } from 'vitest'
import { nicknameFits, tidyNickname } from './nickname'

describe('chat nickname', () => {
  it('tidies spaces', () => expect(tidyNickname('  Sunny   Sam ')).toBe('Sunny Sam'))
  it('accepts empty, or 2 to 30 plain characters', () => {
    for (const ok of ['', '   ', 'Sam', "O'Neil", 'sam_r.99', 'Zoë']) expect(nicknameFits(ok), ok).toBe(true)
    for (const bad of ['S', 'x'.repeat(31), 'no<tags>', 'a@b']) expect(nicknameFits(bad), bad).toBe(false)
  })
})
