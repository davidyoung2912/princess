import { describe, expect, it } from 'vitest'
import { normalizeCatalogue, tryExample } from './stanleyCapabilities'

const item = (over: Record<string, unknown> = {}) => ({ id: 'a', group: 'answer', title: 'T', summary: 'S', example: 'Ask me', stages: [], rung: 0, appliesWhen: 'always', state: 'available', ...over })
const raw = (items: unknown[]) => ({ groups: [{ id: 'answer', title: 'I answer', intro: 'Ask' }], items })

describe('normalizeCatalogue', () => {
  it('reads a well-formed reply', () => {
    const c = normalizeCatalogue(raw([item()]))
    expect(c?.items).toHaveLength(1)
    expect(c?.items[0].state).toBe('available')
  })
  it('drops an item that is not in the agreed shape', () => {
    const c = normalizeCatalogue(raw([item(), item({ id: '' }), item({ group: 'nope' }), item({ rung: 9 }), item({ example: 3 }), 'x']))
    expect(c?.items.map((i) => i.id)).toEqual(['a'])
  })
  it('ignores a reply that is not a catalogue', () => {
    expect(normalizeCatalogue(null)).toBeNull()
    expect(normalizeCatalogue({ groups: [], items: [] })).toBeNull()
    expect(normalizeCatalogue({ items: [] })).toBeNull()
  })
})

describe('tryExample', () => {
  it('uses the first ability of the group the guest can use now', () => {
    const c = normalizeCatalogue(raw([item({ id: 'x', example: 'Needs trip', state: 'needsBooking' }), item({ id: 'y', example: 'Works now' })]))
    expect(tryExample(c, 'answer')).toBe('Works now')
    expect(tryExample(c, 'do')).toBeNull()
    expect(tryExample(null, 'answer')).toBeNull()
  })
})
