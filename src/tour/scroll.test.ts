// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { resetTourScroll, scrollIntoViewTracked } from './scroll'

describe('tour scrolling', () => {
  it('puts back to the top whatever it scrolled, and nothing else', () => {
    const outer = document.createElement('div')
    const other = document.createElement('div')
    const inner = document.createElement('div')
    outer.append(inner)
    document.body.append(outer, other)
    other.scrollTop = 0
    inner.scrollIntoView = () => { outer.scrollTop = 400 }
    scrollIntoViewTracked(inner)
    expect(outer.scrollTop).toBe(400)
    other.scrollTop = 0
    expect(resetTourScroll()).toBe(true)
    expect(outer.scrollTop).toBe(0)
    expect(resetTourScroll()).toBe(false)
  })
  it('remembers nothing when the target was already in view', () => {
    const el = document.createElement('div')
    document.body.append(el)
    el.scrollIntoView = () => {}
    scrollIntoViewTracked(el)
    expect(resetTourScroll()).toBe(false)
  })
})
