import { describe, expect, it } from 'vitest'
import type { ChatRoomAdminItem, ChatRoomInfo, ChatRoomListItem } from '../api/chatTypes'
import { canJoinRoom, canOpenRoom, checkNewRoom, staffOrder, staffProblem, cleanQuestion, groupRooms, isRoomChat, needsRules, roomPostState, roomProblem } from './chatRooms'
import { sendProblem } from './chatThread'

const info = (o: Partial<ChatRoomInfo> = {}): ChatRoomInfo => ({ roomKind: 'interest', rules: 'Be kind.', slow: false, rulesAccepted: true, canPost: true, staffOnly: false, members: 3, ...o })
const item = (o: Partial<ChatRoomListItem>): ChatRoomListItem => ({ id: 'x', kind: 'room', roomKind: 'interest', name: 'A', members: 1, joined: false, closed: false, ...o })

describe('rooms', () => {
  it('knows a channel or room', () => {
    expect(isRoomChat({ kind: 'room' })).toBe(true)
    expect(isRoomChat({ kind: 'channel' })).toBe(true)
    expect(isRoomChat({ kind: 'group' })).toBe(false)
    expect(isRoomChat(null)).toBe(false)
  })
  it('tidies a suggested question', () => {
    expect(cleanQuestion('  Is   the  buffet open? ')).toBe('Is the buffet open?')
    expect(cleanQuestion('hi')).toBeNull()
    expect(cleanQuestion('x'.repeat(201))).toBeNull()
  })
  it('maps join and suggestion problems by title, then code', () => {
    expect(roomProblem('forbidden', 'noBooking')).toBe('noBooking')
    expect(roomProblem('conflict', 'full')).toBe('full')
    expect(roomProblem('invalid', 'contactInfo')).toBe('contactInfo')
    expect(roomProblem('tooMany', undefined)).toBe('tooMany')
    expect(roomProblem('boom', 'what')).toBe('other')
  })
  it('says why the post box is hidden, and that the rules do not hide it', () => {
    expect(roomPostState({ kind: 'room', closed: false, room: info() })).toBe('open')
    expect(roomPostState({ kind: 'room', closed: false, room: info({ rulesAccepted: false }) })).toBe('open')
    expect(roomPostState({ kind: 'channel', closed: false, room: info({ canPost: false, why: 'staffOnly', staffOnly: true }) })).toBe('staffOnly')
    expect(roomPostState({ kind: 'room', closed: false, room: info({ canPost: false, why: 'muted' }) })).toBe('muted')
    expect(roomPostState({ kind: 'room', closed: false, room: info({ canPost: false, why: 'closed' }) })).toBe('closed')
    expect(roomPostState({ kind: 'room', closed: true, room: info() })).toBe('closed')
    expect(roomPostState({ kind: 'group', closed: false })).toBe('open')
  })
  it('asks for the rules only until they are accepted', () => {
    expect(needsRules({ room: info({ rulesAccepted: false }) })).toBe(true)
    expect(needsRules({ room: info() })).toBe(false)
    expect(needsRules({})).toBe(false)
  })
  it('groups the directory with the guest\'s own first', () => {
    const g = groupRooms([
      item({ id: '1', name: 'Zed', kind: 'channel', roomKind: undefined }),
      item({ id: '2', name: 'Alpha', kind: 'channel', roomKind: undefined, joined: true }),
      item({ id: '3', name: 'March sailing', roomKind: 'sailing' }),
      item({ id: '4', name: 'Photography' }),
      item({ id: '5', name: 'Birds', joined: true }),
    ])
    expect(g.channels.map((r) => r.id)).toEqual(['2', '1'])
    expect(g.sailing.map((r) => r.id)).toEqual(['3'])
    expect(g.interest.map((r) => r.id)).toEqual(['5', '4'])
  })
  it('joins only what is open and not yet joined', () => {
    expect(canJoinRoom({ joined: false })).toBe(true)
    expect(canJoinRoom({ joined: true })).toBe(false)
    expect(canJoinRoom({ joined: false, blocked: 'full' })).toBe(false)
  })
  it('reads the room send problems', () => {
    expect(sendProblem('forbidden', 'staffOnly')).toBe('staffOnly')
    expect(sendProblem('forbidden', 'muted')).toBe('muted')
    expect(sendProblem('tooMany', 'slow')).toBe('slow')
    expect(sendProblem('conflict', 'held')).toBe('held')
    expect(sendProblem('conflict', 'rulesNotAccepted')).toBe('rules')
    expect(sendProblem('invalid', 'emergency')).toBe('emergency')
    expect(sendProblem('conflict', 'closed')).toBe('closed')
    expect(sendProblem('forbidden', 'age')).toBe('age')
  })
})

describe('room staff screens', () => {
  const admin = (o: Partial<ChatRoomAdminItem>): ChatRoomAdminItem => ({ id: 'a', kind: 'room', roomKind: 'interest', name: 'A', members: 0, cap: 500, moderators: 0, closed: true, slow: false, inHours: true, rules: 'x', ...o })
  it('opens a closed room only with two moderators', () => {
    expect(canOpenRoom(admin({ moderators: 1 }))).toBe(false)
    expect(canOpenRoom(admin({ moderators: 2 }))).toBe(true)
    expect(canOpenRoom(admin({ moderators: 2, closed: false }))).toBe(false)
    expect(canOpenRoom(admin({ kind: 'channel', moderators: 5 }))).toBe(false)
  })
  it('puts open rooms without a rota first, then open, then closed', () => {
    const list = [admin({ id: 'c', name: 'C' }), admin({ id: 'o', name: 'B', closed: false, moderators: 2 }), admin({ id: 'g', name: 'Z', closed: false, moderators: 1 })]
    expect(staffOrder(list).map((r) => r.id)).toEqual(['g', 'o', 'c'])
  })
  it('maps staff problems', () => {
    expect(staffProblem('conflict', 'rota')).toBe('rota')
    expect(staffProblem('invalid', 'sailing')).toBe('sailing')
    expect(staffProblem('server', undefined)).toBe('other')
  })
  it('checks a new room', () => {
    expect(checkNewRoom({ kind: 'channel', roomKind: 'interest', name: ' Ship  news ', topic: '', sailingId: '' })).toEqual({ ok: true, body: { kind: 'channel', name: 'Ship news' } })
    expect(checkNewRoom({ kind: 'room', roomKind: 'interest', name: 'Birders', topic: '', sailingId: '' })).toEqual({ ok: false, field: 'topic' })
    expect(checkNewRoom({ kind: 'room', roomKind: 'sailing', name: 'Alaska May', topic: '', sailingId: '' })).toEqual({ ok: false, field: 'sailing' })
    expect(checkNewRoom({ kind: 'room', roomKind: 'sailing', name: 'Alaska May', topic: '', sailingId: 's1' })).toEqual({ ok: true, body: { kind: 'room', roomKind: 'sailing', name: 'Alaska May', sailingId: 's1' } })
    expect(checkNewRoom({ kind: 'channel', roomKind: 'interest', name: 'ab', topic: '', sailingId: '' })).toEqual({ ok: false, field: 'name' })
  })
})
