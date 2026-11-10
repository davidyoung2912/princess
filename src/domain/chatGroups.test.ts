import { describe, expect, it } from 'vitest'
import type { ChatConnection, ChatGroup, ChatGroupInvite } from '../api/chatTypes'
import { canCreateGroup, cleanGroupName, groupProblem, invitable, MAX_GROUP, MAX_GROUP_NAME, ownInvites, placesLeft, togglePicked } from './chatGroups'

const person = (personId: string): ChatConnection => ({ id: `c-${personId}`, kind: 'connected', personId, name: personId, conversationId: null, childId: null, childName: null, isNew: false, at: 0, expiresAt: 0 })
const group = (members: string[], waiting: string[], max = MAX_GROUP): ChatGroup => ({
  id: 'g', name: 'Crew', max, isCreator: true,
  members: members.map((id, i) => ({ id, name: id, you: i === 0, creator: i === 0 })),
  waiting: waiting.map((id) => ({ inviteId: `i-${id}`, personId: id, name: id, needsGuardian: false })),
})

describe('chat groups', () => {
  it('tidies a name and refuses an empty or long one', () => {
    expect(cleanGroupName('  Dinner   crew ')).toBe('Dinner crew')
    expect(cleanGroupName('   ')).toBeNull()
    expect(cleanGroupName('a'.repeat(MAX_GROUP_NAME))).not.toBeNull()
    expect(cleanGroupName('a'.repeat(MAX_GROUP_NAME + 1))).toBeNull()
  })
  it('needs a name and at least two people, and fits in 25 with the creator', () => {
    expect(canCreateGroup('Crew', 1)).toBe(false)
    expect(canCreateGroup('Crew', 2)).toBe(true)
    expect(canCreateGroup('', 2)).toBe(false)
    expect(canCreateGroup('Crew', 24)).toBe(true)
    expect(canCreateGroup('Crew', 25)).toBe(false)
  })
  it('counts places left from people and waiting invitations, never below zero', () => {
    expect(placesLeft(group(['me'], []))).toBe(24)
    expect(placesLeft(group(['me', 'a'], ['b', 'c']))).toBe(21)
    expect(placesLeft(group(['me', 'a'], [], 2))).toBe(0)
    expect(placesLeft(group(['me', 'a', 'b'], [], 2))).toBe(0)
  })
  it('offers only connections who are not in the group or already invited', () => {
    const g = group(['me', 'a'], ['b'])
    expect(invitable([person('a'), person('b'), person('c')], g).map((c) => c.personId)).toEqual(['c'])
    expect(invitable([person('a')], null).map((c) => c.personId)).toEqual(['a'])
  })
  it('toggles a pick in and out in the order chosen', () => {
    expect(togglePicked(['a'], 'b')).toEqual(['a', 'b'])
    expect(togglePicked(['a', 'b'], 'a')).toEqual(['b'])
  })
  it('keeps invitations for the guest apart from those for a child', () => {
    const inv = (kind: ChatGroupInvite['kind']): ChatGroupInvite => ({ id: kind, kind, groupName: 'Crew', from: 'Sam R.', childId: null, childName: null, at: 0, expiresAt: 0 })
    expect(ownInvites([inv('incoming'), inv('approval')]).map((i) => i.kind)).toEqual(['incoming'])
  })
  it('maps the server code or title to a problem, falling back to other', () => {
    expect(groupProblem('invalid', 'tooFew')).toBe('tooFew')
    expect(groupProblem('forbidden', 'supervised')).toBe('supervised')
    expect(groupProblem('conflict', 'full')).toBe('full')
    expect(groupProblem('conflict', undefined)).toBe('other')
    expect(groupProblem('network', undefined)).toBe('other')
  })
})
