import { describe, expect, it } from 'vitest'
import { answerCards } from './answerCards'

const facts = { wifiFrom: '$9.99', dinnerTonight: '19:30' }

describe('answerCards', () => {
  it('answers wifi with the price', () => expect(answerCards('WiFi', facts)).toEqual([{ id: 'wifi', to: '/ship/wifi', value: '$9.99', source: 'ship', scope: 'ship' }]))
  it('answers dinner with tonight\'s time, or none', () => {
    expect(answerCards('dinner', facts)[0]).toMatchObject({ id: 'dinner', value: '19:30' })
    expect(answerCards('dinner', { ...facts, dinnerTonight: null })[0].value).toBeNull()
  })
  it('labels each answer with its source and scope', () => {
    expect(answerCards('dinner', facts)[0]).toMatchObject({ source: 'trip', scope: 'day' })
    expect(answerCards('late', facts)[0]).toMatchObject({ source: 'ship', scope: 'day' })
  })
  it('points "late" at I\'m Delayed', () => expect(answerCards('late', facts)[0].to).toBe('/home/delayed'))
  it('needs two characters and a topic', () => {
    expect(answerCards('w', facts)).toEqual([])
    expect(answerCards('pizza', facts)).toEqual([])
  })
  it('leaves out screens the stage does not show', () => expect(answerCards('wifi', facts, () => false)).toEqual([]))
})
