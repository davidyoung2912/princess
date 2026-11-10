import { describe, expect, it } from 'vitest'
import type { ChatPlannable, ChatTally } from '../api/chatTypes'
import {
  OPTION_MAX, QUESTION_MAX, adminCandidates, applyRsvp, applyVote, canAddOption, canPost, cleanPollDraft, eventsOnDay, isPlan, isPoll, isPollClosed, leaders, percentOf, planDays, pollResultText, rsvpIndex, rsvpOf,
} from './chatPlanning'
import { answerJob, readAnswerJob, withHeld } from './chatPlanning'
import { readReactionJob } from './chatReactions'
import { canEditKind } from './chatCards'

const tally = (counts: number[], extra: Partial<ChatTally> = {}): ChatTally => ({ counts, closed: false, mayClose: false, ...extra })

describe('cleanPollDraft', () => {
  it('needs a question and two to five different options', () => {
    expect(cleanPollDraft('Where?', ['Pasta', 'Pizza'])).toEqual({ question: 'Where?', options: ['Pasta', 'Pizza'] })
    expect(cleanPollDraft('Where?', ['Pasta'])).toBeNull()
    expect(cleanPollDraft('Where?', ['Pasta', 'pasta'])).toBeNull()
    expect(cleanPollDraft('', ['a', 'b'])).toBeNull()
    expect(cleanPollDraft('Where?', ['a', 'b', 'c', 'd', 'e'])).not.toBeNull()
    expect(cleanPollDraft('Where?', ['a', 'b', 'c', 'd', 'e', 'f'])).toBeNull()
  })

  it('collapses spaces, leaves out empty rows and refuses lines that are too long', () => {
    expect(cleanPollDraft('  Where   to eat? ', ['  Pasta ', '', 'Pizza'])).toEqual({ question: 'Where to eat?', options: ['Pasta', 'Pizza'] })
    expect(cleanPollDraft('q'.repeat(QUESTION_MAX + 1), ['a', 'b'])).toBeNull()
    expect(cleanPollDraft('Where?', ['a', 'o'.repeat(OPTION_MAX + 1)])).toBeNull()
  })

  it('stops offering another row at five', () => {
    expect(canAddOption(4)).toBe(true)
    expect(canAddOption(5)).toBe(false)
  })
})

describe('poll answers', () => {
  it('closes when the server says so, or when its 24 hours have passed on this device', () => {
    expect(isPollClosed(tally([0, 0], { closed: true }), 0)).toBe(true)
    expect(isPollClosed(tally([0, 0], { closesAt: 1000 }), 999)).toBe(false)
    expect(isPollClosed(tally([0, 0], { closesAt: 1000 }), 1000)).toBe(true)
  })

  it('shares votes as whole percentages and finds the leaders, several on a tie, none with no votes', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(0, 0)).toBe(0)
    expect(leaders([2, 1, 0])).toEqual([0])
    expect(leaders([2, 2, 0])).toEqual([0, 1])
    expect(leaders([0, 0])).toEqual([])
  })

  it('moves your vote from the old option to the new one', () => {
    expect(applyVote(tally([1, 0]), 1)).toEqual(tally([1, 1], { mine: 1 }))
    expect(applyVote(tally([1, 1], { mine: 0 }), 1)).toEqual(tally([0, 2], { mine: 1 }))
  })

  it('reads out the question, each option with its votes and share, your vote and whether it is closed', () => {
    const words = { votes: (n: number) => `${n} ${n === 1 ? 'vote' : 'votes'}`, yours: (o: string) => `You voted ${o}`, closed: 'Closed', open: 'Open' }
    const poll = { question: 'Where to eat?', options: ['Pasta', 'Pizza'] }
    expect(pollResultText(poll, tally([2, 1], { mine: 0 }), words)).toBe('Where to eat?. Pasta: 2 votes (67%). Pizza: 1 vote (33%). You voted Pasta. Open.')
    expect(pollResultText(poll, tally([0, 0], { closed: true }), words)).toBe('Where to eat?. Pasta: 0 votes (0%). Pizza: 0 votes (0%). Closed.')
  })
})

describe('plan answers', () => {
  it('maps the three answers to their place in the counts', () => {
    expect(rsvpIndex('going')).toBe(0)
    expect(rsvpIndex('no')).toBe(2)
    expect(rsvpOf(1)).toBe('maybe')
    expect(rsvpOf(undefined)).toBeNull()
    expect(rsvpOf(7)).toBeNull()
  })

  it('moves your answer and leaves what the server decides about your programme alone', () => {
    expect(applyRsvp(tally([1, 0, 0]), 'going')).toEqual(tally([2, 0, 0], { mine: 0 }))
    expect(applyRsvp(tally([2, 0, 0], { mine: 0, addedToPlan: true }), 'no')).toEqual(tally([1, 0, 1], { mine: 2, addedToPlan: true }))
  })
})

describe('kinds and who may post', () => {
  it('knows a poll and a plan only when they carry what they need', () => {
    expect(isPoll({ kind: 'poll', poll: { question: 'q', options: ['a', 'b'] } })).toBe(true)
    expect(isPoll({ kind: 'poll' })).toBe(false)
    expect(isPlan({ kind: 'plan', card: { type: 'plan', title: 'Trivia' } })).toBe(true)
    expect(isPlan({ kind: 'card', card: { type: 'dining', title: 'Crown Grill' } })).toBe(false)
  })

  it('is never edited as text', () => {
    expect(canEditKind({ kind: 'poll' })).toBe(false)
    expect(canEditKind({ kind: 'plan' })).toBe(false)
    expect(canEditKind({})).toBe(true)
  })

  it('lets everyone post except in an announcement-only group, where admins do', () => {
    expect(canPost(null)).toBe(true)
    expect(canPost({})).toBe(true)
    expect(canPost({ announcementOnly: true })).toBe(false)
    expect(canPost({ announcementOnly: true, admin: true })).toBe(true)
  })

  it('offers the second admin from everyone but you and the creator', () => {
    const members = [{ id: 'a', you: true, creator: true }, { id: 'b', you: false, creator: false }, { id: 'c', you: false, creator: false }]
    expect(adminCandidates(members).map((m) => m.id)).toEqual(['b', 'c'])
  })
})

describe('plannable events', () => {
  const events: ChatPlannable[] = [
    { ref: 'b:2', title: 'Trivia', day: 2, time: '16:00' },
    { ref: 'a:2', title: 'Pool party', day: 2, time: '11:00' },
    { ref: 'c:1', title: 'Show', day: 1, time: '20:00' },
  ]
  it('groups by day in time order', () => {
    expect(planDays(events)).toEqual([1, 2])
    expect(eventsOnDay(events, 2).map((e) => e.title)).toEqual(['Pool party', 'Trivia'])
    expect(eventsOnDay(events, 9)).toEqual([])
  })
})

describe('answers held for signal', () => {
  it('round-trips a vote and an answer through the outbox payload', () => {
    expect(readAnswerJob(answerJob('c', 'm', 'vote', '1'))).toEqual({ conversation: 'c', messageId: 'm', kind: 'vote', value: '1' })
    expect(readAnswerJob(answerJob('c', 'm', 'rsvp', 'going'))).toEqual({ conversation: 'c', messageId: 'm', kind: 'rsvp', value: 'going' })
  })

  it('refuses anything that is not a vote or answer, and is never mistaken for a reaction', () => {
    expect(readAnswerJob({ conversation: 'c', messageId: 'm', answer: 'vote', value: 'x' })).toBeNull()
    expect(readAnswerJob({ conversation: 'c', messageId: 'm', answer: 'rsvp', value: 'yes' })).toBeNull()
    expect(readAnswerJob({ conversation: 'c', text: 'hi' })).toBeNull()
    expect(readAnswerJob({ conversation: 'c', messageId: 'm', emoji: '👍' })).toBeNull()
    expect(readReactionJob(answerJob('c', 'm', 'vote', '1'))).toBeNull()
  })

  it('lays a held answer over the tally once', () => {
    expect(withHeld(tally([1, 0]), { kind: 'vote', value: '1' })).toEqual(tally([1, 1], { mine: 1 }))
    expect(withHeld(tally([1, 1], { mine: 1 }), { kind: 'vote', value: '1' })).toEqual(tally([1, 1], { mine: 1 }))
    expect(withHeld(tally([0, 0, 0]), { kind: 'rsvp', value: 'maybe' })).toEqual(tally([0, 1, 0], { mine: 1 }))
    expect(withHeld(undefined, { kind: 'vote', value: '0' })).toBeUndefined()
    expect(withHeld(tally([1, 0]), undefined)).toEqual(tally([1, 0]))
  })
})
