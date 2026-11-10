import { describe, expect, it } from 'vitest'
import { AVATAR_COLOURS, AVATAR_ICONS, AVATAR_GLYPHS, avatarFace, avatarText, parseAvatar } from './chatAvatar'

describe('chat avatars', () => {
  it('reads a stored choice', () => expect(parseAvatar('coral:anchor')).toEqual({ colour: 'coral', icon: 'anchor' }))
  it('round-trips every colour and icon', () => {
    for (const colour of AVATAR_COLOURS) for (const icon of AVATAR_ICONS) expect(avatarText(parseAvatar(`${colour}:${icon}`)!)).toBe(`${colour}:${icon}`)
  })
  it('treats anything unknown as no avatar', () => {
    for (const bad of [null, undefined, '', 'sea', 'red:anchor', 'sea:skull', 'sea:anchor:x', '<b>:x']) expect(parseAvatar(bad)).toBeNull()
  })
  it('shows the icon, or the initials when there is none', () => {
    expect(avatarFace(parseAvatar('sea:wave'), 'SR')).toBe(AVATAR_GLYPHS.wave)
    expect(avatarFace(parseAvatar('sea:initials'), 'SR')).toBe('SR')
    expect(avatarFace(null, 'SR')).toBe('SR')
  })
  it('has a picture for every icon but initials', () => expect(Object.keys(AVATAR_GLYPHS).sort()).toEqual(AVATAR_ICONS.filter((i) => i !== 'initials').sort()))
})
