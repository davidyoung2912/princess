import { describe, expect, it } from 'vitest'
import { actionTitleKey } from './pageTitle'

describe('actionTitleKey', () => {
  it('names the reserve and change pages of dining', () => {
    expect(actionTitleKey('/dining-today', '?day=2&reserve=new')).toBe('exp.res.newTitle')
    expect(actionTitleKey('/dining-today/crown', '?reserve=r12')).toBe('exp.res.moveTitle')
  })
  it('names the book and change pages of the spa', () => {
    expect(actionTitleKey('/spa-explorer', '?book=new&treatment=t1')).toBe('spa.newTitle')
    expect(actionTitleKey('/spa-explorer/serenity', '?book=a3')).toBe('spa.changeTitle')
  })
  it('leaves an Explorer\'s own page, and other pages, alone', () => {
    expect(actionTitleKey('/dining-today', '?day=2')).toBeNull()
    expect(actionTitleKey('/dining-today', '?view=trip')).toBeNull()
    expect(actionTitleKey('/plan/reservations', '?reserve=new')).toBeNull()
  })
})
