import { describe, expect, it } from 'vitest'
import { avatarImageUrl, avatarPage, avatarPageCount, avatarPageOf, groupAvatars, isAvatarId, stepAvatarPage, type AvatarChoice } from './chatAvatar'

describe('chat avatars', () => {
  it('accepts catalogue ids and nothing else', () => {
    expect(isAvatarId('bottts-31')).toBe(true)
    for (const bad of [null, undefined, 7, '', 'Bottts-31', 'sea:anchor', '../x', 'a'.repeat(31), '<b>']) expect(isAvatarId(bad)).toBe(false)
  })
  it('builds the picture address, or none', () => {
    expect(avatarImageUrl('/api/v1', 'bottts-31')).toBe('/api/v1/public/avatars/bottts-31')
    expect(avatarImageUrl('/api/v1', null)).toBeNull()
    expect(avatarImageUrl('/api/v1', '../secret')).toBeNull()
  })
  it('groups the catalogue in display order and drops empty or unknown groups', () => {
    const list = [
      { id: 'bottts-31', label: 'Robot 1', group: 'robots' },
      { id: 'avataaars-01', label: 'Person 1', group: 'people' },
      { id: 'thumbs-43', label: 'Critter 1', group: 'critters' },
      { id: 'x-1', label: 'Odd', group: 'weird' },
    ] as unknown as AvatarChoice[]
    expect(groupAvatars(list).map((g) => [g.group, g.choices.map((c) => c.id)])).toEqual([['people', ['avataaars-01']], ['robots', ['bottts-31']], ['critters', ['thumbs-43']]])
  })
})

describe('avatar pages', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ id: `a-${i}` }))
  it('counts pages and shows four at a time', () => {
    expect(avatarPageCount(50)).toBe(13)
    expect(avatarPageCount(0)).toBe(1)
    expect(avatarPage(list, 2).map((c) => c.id)).toEqual(['a-8', 'a-9'])
  })
  it('wraps round at both ends', () => {
    expect(stepAvatarPage(2, 3, 1)).toBe(0)
    expect(stepAvatarPage(0, 3, -1)).toBe(2)
  })
  it('opens on the page of the chosen picture', () => {
    expect(avatarPageOf(list, 'a-5')).toBe(1)
    expect(avatarPageOf(list, null)).toBe(0)
  })
})
