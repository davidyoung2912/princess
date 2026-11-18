import { describe, expect, it } from 'vitest'
import { actionWords } from './pageTitle'

describe('actionWords', () => {
  it('names the reserve and change pages of dining, with a line under each', () => {
    expect(actionWords('/dining-today', '?day=2&reserve=new')).toEqual({ title: 'exp.res.newTitle', subtext: 'exp.res.newSub' })
    expect(actionWords('/dining-today/crown', '?reserve=r12')).toEqual({ title: 'exp.res.moveTitle', subtext: 'exp.res.moveSub' })
  })
  it('names the book and change pages of the spa, with a line under each', () => {
    expect(actionWords('/spa-explorer', '?book=new&treatment=t1')).toEqual({ title: 'spa.newTitle', subtext: 'spa.newSub' })
    expect(actionWords('/spa-explorer/serenity', '?book=a3')).toEqual({ title: 'spa.changeTitle', subtext: 'spa.changeSub' })
  })
  it('leaves an Explorer\'s own page, and other pages, alone', () => {
    expect(actionWords('/dining-today', '?day=2')).toBeNull()
    expect(actionWords('/dining-today', '?view=trip')).toBeNull()
    expect(actionWords('/plan/reservations', '?reserve=new')).toBeNull()
  })
})
