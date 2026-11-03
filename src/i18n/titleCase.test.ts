import { describe, expect, it } from 'vitest'
import { titleCase } from './titleCase'

describe('titleCase', () => {
  it('capitalizes words but keeps short joining words lower case', () => {
    expect(titleCase('Sign in')).toBe('Sign In')
    expect(titleCase('where you are in your trip')).toBe('Where You Are in Your Trip')
    expect(titleCase('the end of the day')).toBe('The End of the Day')
  })
  it('capitalizes the last word, and the word after a colon or hyphen', () => {
    expect(titleCase('What to bring on')).toBe('What to Bring On')
    expect(titleCase('Check-in: what to do')).toBe('Check-In: What to Do')
  })
  it('keeps existing capitals, curly apostrophes and {placeholders}', () => {
    expect(titleCase('You’re booked on WiFi')).toBe('You’re Booked on WiFi')
    expect(titleCase('Details for {name}')).toBe('Details for {name}')
  })
  it('leaves other languages alone', () => {
    expect(titleCase('Iniciar sesión', 'es')).toBe('Iniciar sesión')
  })
})
