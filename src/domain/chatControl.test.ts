import { describe, expect, it } from 'vitest'
import { announceTyping, isSameConversation, typingEventConversation, canChange, canEdit, changeProblem, CHANGE_WINDOW_MS, isMuted, muteFor, shouldSendTyping, splitArchived, TYPING_SEND_MS, typingNames, windowLeft } from './chatControl'

const T = 1_000_000
const mine = { from: 'me', at: T }

describe('the 15-minute window', () => {
  it('is open at 14:59 and closed at 15:01', () => {
    expect(canChange(mine, 'me', T + CHANGE_WINDOW_MS - 1000)).toBe(true)
    expect(canChange(mine, 'me', T + CHANGE_WINDOW_MS)).toBe(true)
    expect(canChange(mine, 'me', T + CHANGE_WINDOW_MS + 1000)).toBe(false)
    expect(windowLeft(T, T + CHANGE_WINDOW_MS - 1000)).toBe(1000)
    expect(windowLeft(T, T + CHANGE_WINDOW_MS + 5000)).toBe(0)
  })
  it('is only for your own plain messages', () => {
    expect(canChange({ ...mine, from: 'sam' }, 'me', T)).toBe(false)
    expect(canChange({ ...mine, system: true }, 'me', T)).toBe(false)
    expect(canChange({ ...mine, stanley: true }, 'me', T)).toBe(false)
    expect(canChange({ ...mine, deleted: true }, 'me', T)).toBe(false)
  })
  it('edits plain text only; a photo or an urgent message can only be deleted', () => {
    expect(canEdit({})).toBe(true)
    expect(canEdit({ hasPhoto: true })).toBe(false)
    expect(canEdit({ urgency: 'urgent' })).toBe(false)
    expect(canEdit({ urgency: 'important' })).toBe(false)
  })
  it('names why a change failed', () => {
    expect(changeProblem('conflict', 'tooLate')).toBe('tooLate')
    expect(changeProblem('invalid', 'blocked')).toBe('blocked')
    expect(changeProblem('invalid', 'contactInfo')).toBe('contact')
    expect(changeProblem('conflict', 'deleted')).toBe('deleted')
    expect(changeProblem('conflict', undefined)).toBe('tooLate')
    expect(changeProblem('network', undefined)).toBe('other')
  })
})

describe('typing', () => {
  it('tells the server at most once every three seconds', () => {
    expect(shouldSendTyping(null, T)).toBe(true)
    expect(shouldSendTyping(T, T + TYPING_SEND_MS - 1)).toBe(false)
    expect(shouldSendTyping(T, T + TYPING_SEND_MS)).toBe(true)
  })
  it('words one, two and several people', () => {
    expect(typingNames([])).toEqual({ kind: 'none' })
    expect(typingNames(['Sam R.'])).toEqual({ kind: 'one', a: 'Sam R.' })
    expect(typingNames(['Sam R.', 'Ana K.'])).toEqual({ kind: 'two', a: 'Sam R.', b: 'Ana K.' })
    expect(typingNames(['a', 'b', 'c'])).toEqual({ kind: 'many' })
  })
  it('announces once per burst, when it goes from nobody to somebody', () => {
    expect(announceTyping([], ['Sam R.'])).toBe(true)
    expect(announceTyping(['Sam R.'], ['Sam R.'])).toBe(false)
    expect(announceTyping(['Sam R.'], ['Sam R.', 'Ana K.'])).toBe(false)
    expect(announceTyping(['Sam R.'], [])).toBe(false)
  })
})

describe('mute and archive', () => {
  it('shows a timed mute only until it ends, and a mute with no end always', () => {
    expect(isMuted({ muted: true, mutedUntil: T + 10 }, T)).toBe(true)
    expect(isMuted({ muted: true, mutedUntil: T }, T)).toBe(false)
    expect(isMuted({ muted: true }, T)).toBe(true)
    expect(isMuted({ muted: false }, T)).toBe(false)
  })
  it('sends no length for forever', () => {
    expect(muteFor('forever')).toBeUndefined()
    expect(muteFor('hour')).toBe('hour')
  })
  it('splits the archive off, keeping order, but never hides Stanley or an urgent chat', () => {
    const rows = [{ id: 'a' }, { id: 'b', archived: true }, { id: 's', archived: true, permanent: true }, { id: 'u', archived: true }, { id: 'c' }]
    const { shown, archived } = splitArchived(rows, ['u'])
    expect(shown.map((r) => r.id)).toEqual(['a', 's', 'u', 'c'])
    expect(archived.map((r) => r.id)).toEqual(['b'])
  })
})

describe('the typing nudge', () => {
  it('names its conversation and ignores every other event', () => {
    const hex = '0123456789abcdef0123456789abcdef'
    expect(typingEventConversation(`chat:typing:${hex}:42:abc`)).toBe(hex)
    expect(typingEventConversation(`chat:delivered:${hex}:42:abc`)).toBeNull()
    expect(typingEventConversation('chat:typing:short:1')).toBeNull()
    expect(typingEventConversation('')).toBeNull()
  })
  it('matches the conversation id the app holds', () => {
    expect(isSameConversation('01234567-89ab-cdef-0123-456789ABCDEF', '0123456789abcdef0123456789abcdef')).toBe(true)
    expect(isSameConversation('11111111-89ab-cdef-0123-456789abcdef', '0123456789abcdef0123456789abcdef')).toBe(false)
  })
})
