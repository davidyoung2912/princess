import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXT_SIZE, ROOT_PERCENT, TEXT_SIZES, isTextSize, rootPixels } from './textSize'

describe('text size', () => {
  it('gives 18, 22 and 26 pixels at the browser default', () => {
    expect(rootPixels('standard')).toBe(18)
    expect(rootPixels('large')).toBe(22)
    expect(rootPixels('xlarge')).toBe(26)
  })

  it('scales with a larger browser setting', () => {
    expect(rootPixels('standard', 20)).toBe(22.5)
  })

  it('grows with each step and defaults to standard', () => {
    const values = TEXT_SIZES.map((s) => ROOT_PERCENT[s])
    expect([...values].sort((a, b) => a - b)).toEqual(values)
    expect(DEFAULT_TEXT_SIZE).toBe('standard')
  })

  it('recognises only known sizes', () => {
    expect(isTextSize('large')).toBe(true)
    expect(isTextSize('huge')).toBe(false)
    expect(isTextSize(18)).toBe(false)
  })
})
