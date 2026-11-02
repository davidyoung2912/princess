import { describe, expect, it } from 'vitest'
import { addItem, addParty, EMPTY_SPLIT, removeItem, removeParty } from '../domain/ledgerSplit'
import { addIdea, castVote, heartIdea, newPoll } from '../domain/board'
import { addRendezvous, EMPTY_PORT_PARTY, removeRendezvous, setAlertBefore, setMeetState, setPresence, proposePlan } from '../domain/portParty'
import { diffState, layer, legacyRows, normalizeRows, rowId, stateOfRows, valuesOf, winner, type PortRow } from './rows'
import { EMPTY_PORT, type PortState } from './store'

const sample = (): PortState => {
  let split = addParty(EMPTY_SPLIT, 'Harper', 4, 'h').state
  split = addParty(split, 'Brennan', 2, 'b').state
  split = addItem(split, { title: 'Taxi', kind: 'taxi', amount: '20', paidBy: 'h', among: ['h', 'b'], mode: 'equal', date: '2027-03-23' }, 100, 'i1').state
  split = addItem(split, { title: 'Lunch', kind: 'meal', amount: '31.50', paidBy: 'b', among: ['h', 'b'], mode: 'byPeople', date: null }, 200, 'i2').state
  let party = setPresence(EMPTY_PORT_PARTY, '2027-03-23', 'daniel', 'back', 50)
  party = setPresence(party, '2027-03-23', 'priya', 'ashore', 60)
  party = proposePlan(party, '2027-03-23', { outing: 'coz-snorkel', title: 'Snorkel', travelMinutes: 20, buffer: 45 }, 'daniel')
  party = setAlertBefore(party, 60)
  party = addRendezvous(party, { place: 'Pier', at: 999, fallback: 'Gangway', members: ['daniel', 'priya'] }, 'daniel', 'm1')
  const poll = castVote(castVote(newPoll('p1', 'Where to eat?', ['Pizza', 'Tacos'])!, 'daniel', 'o1'), 'priya', 'o2')
  const board = { polls: [poll], ideas: heartIdea(addIdea([], 'i1', 'Swim with rays'), 'i1', 'priya') }
  return { party, split, board }
}

describe('the group poll and dream board as rows', () => {
  it('keeps each vote and heart as its own row, so two phones never overwrite each other', () => {
    const rows = [...valuesOf(sample()).values()]
    expect(rows.filter((r) => r.kind === 'vote').map((r) => r.key).sort()).toEqual(['p1|daniel', 'p1|priya'])
    expect(rows.filter((r) => r.kind === 'heart').map((r) => r.key)).toEqual(['i1|priya'])
    expect(rows.find((r) => r.kind === 'poll')?.data).toMatchObject({ question: 'Where to eat?' })
  })
  it('turns a vote from one phone into one row change, and a withdrawn poll into deletes', () => {
    const before = sample()
    const poll = castVote(before.board.polls[0], 'cy', 'o1')
    const ops = diffState(before, { ...before, board: { ...before.board, polls: [poll] } }, 500)
    expect(ops.map((o) => `${o.kind}/${o.key}`)).toEqual(['vote/p1|cy'])
    const gone = diffState(before, { ...before, board: { ...before.board, polls: [] } }, 600)
    expect(gone.every((o) => o.deleted)).toBe(true)
    expect(gone.map((o) => o.kind).sort()).toEqual(['poll', 'vote', 'vote'])
  })
  it('rebuilds the board from the rows another phone sent', () => {
    const rows = [...valuesOf(sample()).values()].map((v) => ({ ...v, at: 10, deleted: false }))
    expect(stateOfRows(rows).board).toEqual(sample().board)
  })
})

describe('port state as rows', () => {
  it('round-trips through rows', () => {
    const state = sample()
    const rows = [...valuesOf(state).values()].map((v, n): PortRow => ({ ...v, at: 1000 + n, deleted: false }))
    expect(stateOfRows(rows)).toEqual(state)
    expect(stateOfRows([])).toEqual(EMPTY_PORT)
  })

  it('keeps ids and names with odd characters apart and reads them back', () => {
    const state: PortState = { ...EMPTY_PORT, party: setPresence(EMPTY_PORT.party, '2027-03-23', 'a|b c/ü', 'back', 5) }
    const row = [...valuesOf(state).values()][0]
    expect(row.key).toMatch(/^[A-Za-z0-9_|:-]+$/)
    expect(stateOfRows([{ ...row, at: 1, deleted: false }])).toEqual(state)
  })

  it('writes only what changed, and a delete as a deleted row', () => {
    const before = sample()
    expect(diffState(before, before, 9)).toEqual([])
    const after: PortState = { ...before, split: removeItem(before.split, 'i1'), party: setMeetState(before.party, 'm1', 'priya', 'here') }
    const ops = diffState(before, after, 9)
    expect(ops.map((o) => [o.kind, o.key, o.deleted])).toEqual([['meetState', 'm1|priya', false], ['item', 'i1', true]])
    expect(ops.every((o) => o.at === 9)).toBe(true)
    // Taking a meeting place away takes its states with it.
    const gone = diffState(before, { ...before, party: removeRendezvous(before.party, 'm1', 'daniel') }, 9)
    expect(gone.map((o) => o.kind).sort()).toEqual(['meet', 'meetState', 'meetState'])
    expect(gone.every((o) => o.deleted)).toBe(true)
    // A family is a row too; the alert time back at its default is a deleted row.
    const noFamily = diffState({ ...before, split: { ...before.split, items: [] } }, { ...before, split: removeParty({ ...before.split, items: [] }, 'b') }, 9)
    expect(noFamily.some((o) => o.kind === 'party' && o.key === 'b' && o.deleted)).toBe(true)
    expect(diffState(before, { ...before, party: setAlertBefore(before.party, 45) }, 9).map((o) => [o.kind, o.key, o.deleted])).toEqual([['setting', 'alertBefore', true]])
  })

  it('a deleted row stays deleted against an older copy of it', () => {
    const live: PortRow = { kind: 'item', key: 'i1', data: { id: 'i1' }, at: 10, deleted: false }
    const dead: PortRow = { kind: 'item', key: 'i1', data: null, at: 20, deleted: true }
    expect(layer([dead], [live])[0].deleted).toBe(true)
    expect(layer([live], [dead])[0].deleted).toBe(true)
    expect(winner(live, { ...live, data: 'tie' })).toBe(live)
    const state = stateOfRows(layer([dead], [live]))
    expect(state.split.items).toEqual([])
  })

  it('two people changing different rows at once keep both changes', () => {
    const a = { kind: 'meetState', key: 'm1|daniel', data: 'here', at: 5, deleted: false } as const
    const b = { kind: 'meetState', key: 'm1|priya', data: 'onway', at: 6, deleted: false } as const
    const meet: PortRow = { kind: 'meet', key: 'm1', data: { place: 'Pier', at: 1, by: 'daniel', fallback: 'x', fallbackAfter: 15 }, at: 1, deleted: false }
    const r = stateOfRows(layer(layer([meet], [a]), [b])).party.rendezvous[0]
    expect(r.members).toEqual({ daniel: 'here', priya: 'onway' })
  })

  it('orders families and expenses by when they were added, and ignores states of a missing meeting', () => {
    const rows: PortRow[] = [
      { kind: 'party', key: 'b', data: { name: 'B', people: 1 }, at: 20, deleted: false },
      { kind: 'party', key: 'a', data: { name: 'A', people: 1 }, at: 10, deleted: false },
      { kind: 'meetState', key: 'zz|daniel', data: 'here', at: 1, deleted: false },
    ]
    const s = stateOfRows(rows)
    expect(s.split.parties.map((p) => p.id)).toEqual(['a', 'b'])
    expect(s.party.rendezvous).toEqual([])
  })

  it('a first upload keeps the order and gives expenses and presence their own times', () => {
    const rows = legacyRows(sample())
    expect(rows.find((r) => r.kind === 'item' && r.key === 'i1')?.at).toBe(100)
    expect(rows.find((r) => r.key === '2027-03-23|daniel')?.at).toBe(50)
    const stamped = rows.filter((r) => r.kind === 'party').map((r) => r.at)
    expect(stamped[0]).toBeLessThan(stamped[1])
    expect(stateOfRows(rows)).toEqual(sample())
  })

  it('reads rows from the server and drops malformed ones', () => {
    const rows = normalizeRows({ rows: [{ kind: 'item', key: 'i', data: { a: 1 }, at: 3, deleted: false }, { kind: 'nope', key: 'x', at: 1 }, { kind: 'item', key: 'y' }, 7] })
    expect(rows.map(rowId)).toEqual(['item/i'])
    expect(normalizeRows(null)).toEqual([])
  })
})
