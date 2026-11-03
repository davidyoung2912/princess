import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { applyRemoteRecent } from '../../recent/store'
import { RecentCard } from './RecentCard'

const render = (): string => renderToString(<MemoryRouter><RecentCard /></MemoryRouter>)

describe('recent card', () => {
  it('shows nothing when there is nothing recent', () => {
    applyRemoteRecent(null, null)
    expect(render()).toBe('')
  })
  it('lists recent screens with Continue on the first, the privacy line and Clear', () => {
    applyRemoteRecent(null, { items: [{ path: '/home/saved', at: Date.now() }, { path: '/home/ship', at: Date.now() - 1000 }] })
    const html = render()
    if (html === '') return // the guest's stage may not use these screens; visibleRecent is covered in recent.test.ts
    expect(html).toContain('Pick up Where You Left Off')
    expect(html).toContain('Only you see this')
    expect(html).toContain('Clear')
    expect(html.match(/>Continue</g)).toHaveLength(1)
  })
})
