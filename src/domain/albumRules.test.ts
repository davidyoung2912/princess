// proves: REM-04
import { describe, expect, it } from 'vitest'
import { canTakeBack, mySharedIds } from './albumRules'

describe('album sharing', () => {
  const album = [{ photoId: 'a', mine: true }, { photoId: 'b', mine: false }, { photoId: 'c', mine: true }]
  it('lets a guest take back only what they shared', () => {
    expect(mySharedIds(album)).toEqual(['a', 'c'])
    expect(album.map(canTakeBack)).toEqual([true, false, true])
  })
  it('has nothing to take back when nothing was shared', () => {
    expect(mySharedIds([{ photoId: 'b', mine: false }])).toEqual([])
  })
})
