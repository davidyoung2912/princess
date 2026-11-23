import { describe, expect, it } from 'vitest'
import { cameraWanted, dueForFrame, frameSize, phaseOfError, readerFor, SCAN_EVERY_MS } from './scanSession'

describe('which reader a device can use', () => {
  it('uses the browser reader when there is one, the fallback when there is not, and none without a camera', () => {
    expect(readerFor({ mediaDevices: { getUserMedia: () => 1 }, hasDetector: true })).toBe('native')
    expect(readerFor({ mediaDevices: { getUserMedia: () => 1 }, hasDetector: false })).toBe('fallback')
    expect(readerFor({ mediaDevices: {}, hasDetector: true })).toBe('none')
    expect(readerFor({ mediaDevices: null, hasDetector: true })).toBe('none')
    expect(readerFor({ hasDetector: false })).toBe('none')
  })
})

describe('what a camera failure means', () => {
  it('says denied, unavailable or error', () => {
    expect(phaseOfError({ name: 'NotAllowedError' })).toBe('denied')
    expect(phaseOfError(new DOMException('x', 'SecurityError'))).toBe('denied')
    expect(phaseOfError({ name: 'NotFoundError' })).toBe('unavailable')
    expect(phaseOfError({ name: 'NotReadableError' })).toBe('error')
    expect(phaseOfError('boom')).toBe('error')
    expect(phaseOfError(null)).toBe('error')
  })
})

describe('frames and the camera switch', () => {
  it('reads a frame no more often than the interval', () => {
    expect(dueForFrame(1000, 1000 - SCAN_EVERY_MS + 1)).toBe(false)
    expect(dueForFrame(1000, 1000 - SCAN_EVERY_MS)).toBe(true)
  })
  it('shrinks a wide frame, keeps a small one, and never returns zero for a real frame', () => {
    expect(frameSize(1280, 720)).toEqual({ w: 640, h: 360 })
    expect(frameSize(320, 240)).toEqual({ w: 320, h: 240 })
    expect(frameSize(5000, 1)).toEqual({ w: 640, h: 1 })
    expect(frameSize(0, 0)).toEqual({ w: 0, h: 0 })
  })
  it('wants the camera only when open and visible', () => {
    expect(cameraWanted(true, false)).toBe(true)
    expect(cameraWanted(true, true)).toBe(false)
    expect(cameraWanted(false, false)).toBe(false)
  })
})
