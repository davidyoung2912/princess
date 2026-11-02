import { describe, expect, it } from 'vitest'
import { bookPhotos, cabinPhotos, MEDIA_CAPTION_MAX, MEDIA_MAX_COUNT, MEDIA_SEND_SIDE, normalizeMedia, normalizeMediaList, normalizeUsage, pickProblem, shrunkSize, uploadErrorKey, type Media } from './media'

const ID = '0b7a1c52-2f3d-4e0a-9c11-5a1f3b9d7e10'
const raw = { id: ID, purpose: 'cabin', ref: 'balcony', kind: 'view', caption: 'Our view', width: 800, height: 600, status: 'pending', at: 5, mine: true }
const media = (over: Partial<Media>): Media => ({ ...(normalizeMedia(raw) as Media), ...over })

describe('reading the server’s description of a picture', () => {
  it('accepts a well-formed one and nothing else', () => {
    expect(normalizeMedia(raw)).toEqual({ id: ID, purpose: 'cabin', ref: 'balcony', kind: 'view', caption: 'Our view', width: 800, height: 600, status: 'pending', at: 5, mine: true })
    for (const bad of [null, 3, [], {}, { ...raw, id: 'x' }, { ...raw, id: '../../etc' }, { ...raw, purpose: 'album' }, { ...raw, status: 'live' }, { ...raw, width: 0 }, { ...raw, width: '8' }, { ...raw, caption: 'x'.repeat(MEDIA_CAPTION_MAX + 1) }, { ...raw, at: 'now' }]) {
      expect(normalizeMedia(bad)).toBeNull()
    }
  })

  it('treats a missing "mine" as someone else’s and leaves bad rows out of a list', () => {
    expect(normalizeMedia({ ...raw, mine: undefined })?.mine).toBe(false)
    expect(normalizeMediaList([raw, { nope: 1 }, 7])).toHaveLength(1)
    expect(normalizeMediaList('x')).toEqual([])
  })

  it('reads the allowance', () => {
    expect(normalizeUsage({ count: 3, bytes: 900, maxCount: 40, maxBytes: 20_000_000 })).toEqual({ count: 3, bytes: 900, maxCount: 40, maxBytes: 20_000_000 })
    expect(normalizeUsage({ count: -1, bytes: 0, maxCount: 40, maxBytes: 1 })).toBeNull()
    expect(normalizeUsage({ count: 1 })).toBeNull()
  })
})

describe('what is wrong with a chosen file', () => {
  it('checks the type, the words and the allowance before anything is sent', () => {
    expect(pickProblem('image/jpeg', 500_000, '', null)).toBeNull()
    expect(pickProblem('image/png', 1, 'Nice', null)).toBeNull()
    expect(pickProblem('image/gif', 500, '', null)).toBe('type')
    expect(pickProblem('image/svg+xml', 500, '', null)).toBe('type')
    expect(pickProblem('image/jpeg', 0, '', null)).toBe('size')
    expect(pickProblem('image/jpeg', 5, 'me@example.com', null)).toBe('caption')
    expect(pickProblem('image/jpeg', 5, 'https://x.example', null)).toBe('caption')
    expect(pickProblem('image/jpeg', 5, 'call 555 123 4567', null)).toBe('caption')
    expect(pickProblem('image/jpeg', 5, 'x'.repeat(MEDIA_CAPTION_MAX + 1), null)).toBe('caption')
    expect(pickProblem('image/jpeg', 5, '', { count: MEDIA_MAX_COUNT, bytes: 0, maxCount: MEDIA_MAX_COUNT, maxBytes: 1 })).toBe('full')
  })
})

describe('making a picture smaller', () => {
  it('keeps the shape and never makes a small picture larger', () => {
    expect(shrunkSize(4000, 3000)).toEqual({ width: MEDIA_SEND_SIDE, height: 1200 })
    expect(shrunkSize(3000, 4000)).toEqual({ width: 1200, height: MEDIA_SEND_SIDE })
    expect(shrunkSize(800, 600)).toEqual({ width: 800, height: 600 })
    expect(shrunkSize(1600, 1600)).toEqual({ width: 1600, height: 1600 })
    expect(shrunkSize(100000, 1)).toEqual({ width: MEDIA_SEND_SIDE, height: 1 })
    expect(shrunkSize(0, 0)).toEqual({ width: 1, height: 1 })
  })
})

describe('what the server’s refusals mean', () => {
  it('maps each to a sentence and anything else to the general one', () => {
    expect(uploadErrorKey('type')).toBe('type')
    expect(uploadErrorKey('empty')).toBe('size')
    expect(uploadErrorKey('size')).toBe('size')
    expect(uploadErrorKey('badCaption')).toBe('caption')
    expect(uploadErrorKey('unreadable')).toBe('unreadable')
    expect(uploadErrorKey('scan')).toBe('scan')
    expect(uploadErrorKey('full')).toBe('full')
    expect(uploadErrorKey('childCannotUpload')).toBe('child')
    expect(uploadErrorKey('offline')).toBe('network')
    expect(uploadErrorKey('network')).toBe('network')
    expect(uploadErrorKey('timeout')).toBe('network')
    expect(uploadErrorKey('server')).toBe('other')
    expect(uploadErrorKey(undefined)).toBe('other')
  })
})

describe('which pictures are shown where', () => {
  it('puts a day’s pictures on that day, oldest first, and nothing else in the book', () => {
    const list = [media({ id: 'a', purpose: 'book', ref: '2', at: 9 }), media({ id: 'b', purpose: 'book', ref: '2', at: 3 }), media({ id: 'c', purpose: 'book', ref: '3' }), media({ id: 'd', purpose: 'book', ref: 'cover' }), media({ id: 'e', purpose: 'cabin', ref: '2' }), media({ id: 'f', purpose: 'postcard', ref: '2' })]
    expect(bookPhotos(list, 2).map((m) => m.id)).toEqual(['b', 'a'])
    expect(bookPhotos(list, 'cover').map((m) => m.id)).toEqual(['d'])
    expect(bookPhotos(list, 8)).toEqual([])
  })

  it('shows a room type’s own pictures first, and another guest’s only when approved', () => {
    const list = [
      media({ id: 'other-pending', mine: false, status: 'pending', at: 9 }),
      media({ id: 'other-ok', mine: false, status: 'approved', at: 8 }),
      media({ id: 'mine-pending', mine: true, status: 'pending', at: 1 }),
      media({ id: 'other-room', mine: true, ref: 'interior' }),
      media({ id: 'a-book', mine: true, purpose: 'book' }),
    ]
    expect(cabinPhotos(list, 'balcony').map((m) => m.id)).toEqual(['mine-pending', 'other-ok'])
  })
})
