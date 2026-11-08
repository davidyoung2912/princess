import { describe, expect, it } from 'vitest'
import { orderForParty, priorityIds, togglePin } from './tileOrder'

describe('priorityIds', () => {
  it('is empty for adults without needs', () => expect(priorityIds({ ages: [40, 42], mobility: false })).toEqual([]))
  it('promotes family screens for children, and the teen screen for teens', () => {
    expect(priorityIds({ ages: [40, 8], mobility: false })).toEqual(['S40', 'S41'])
    expect(priorityIds({ ages: [40, 15], mobility: false })).toEqual(['S40', 'S41', 'S42'])
  })
  it('promotes assistance for a mobility need', () => expect(priorityIds({ ages: [70], mobility: true })).toEqual(['P10', 'M38']))
})

describe('orderForParty', () => {
  it('moves priority ids first and keeps the rest in order', () => {
    expect(orderForParty(['A', 'S41', 'B', 'S40'], ['S40', 'S41', 'S42'])).toEqual(['S40', 'S41', 'A', 'B'])
  })
  it('never adds an id the list does not hold, and changes nothing without priorities', () => {
    expect(orderForParty(['A', 'B'], ['S40'])).toEqual(['A', 'B'])
    expect(orderForParty(['A', 'B'], [])).toEqual(['A', 'B'])
  })
})

describe('togglePin', () => {
  it('adds, removes, and drops the oldest past the limit', () => {
    expect(togglePin([], 'A', 3)).toEqual(['A'])
    expect(togglePin(['A', 'B'], 'A', 3)).toEqual(['B'])
    expect(togglePin(['A', 'B', 'C'], 'D', 3)).toEqual(['B', 'C', 'D'])
  })
})
