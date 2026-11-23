import { describe, expect, it } from 'vitest'
import { artUrl } from './urls'
import { flagUrl } from './flags'

// A moved file once left these lookups pointing at the wrong folder, so every picture silently vanished in the build.
describe('art urls', () => {
  it('finds a head, a pose and a hero', () => {
    expect(artUrl({ kind: 'head', id: 'sherlock' })).toBeTruthy()
    expect(artUrl({ kind: 'pose', id: 'wave' })).toBeTruthy()
    expect(artUrl({ kind: 'hero', id: 'embark', size: 'wide' })).toBeTruthy()
  })
  it('finds a flag', () => { expect(flagUrl('gb')).toBeTruthy() })
})
