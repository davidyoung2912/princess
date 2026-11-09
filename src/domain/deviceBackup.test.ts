import { describe, expect, it } from 'vitest'
import { backupCount, buildBackup, mergeBackup, parseBackup, scanOutboxes } from './deviceBackup'
import type { OutboxItem } from '../data/outbox'

const item = (id: string): OutboxItem => ({ id, kind: 'chat', payload: { text: `hello ${id}` }, queuedAt: 1, attempts: 0, nextAt: 1 })
const store = (data: Record<string, string>) => ({ length: Object.keys(data).length, key: (i: number) => Object.keys(data)[i] ?? null, getItem: (k: string) => data[k] ?? null })

// proves: MOB-04#1, MOB-04#2
describe('device backup', () => {
  it('exports every waiting item and reads it back', () => {
    const scan = scanOutboxes(store({ 'princess:outbox:u1:chat': JSON.stringify([item('a'), item('b')]), 'princess:cache:pass:x': '{}' }))
    expect(scan.corrupt).toEqual([])
    const file = JSON.stringify(buildBackup(scan.outboxes, new Date('2026-11-08T10:00:00Z')))
    const back = parseBackup(file)
    expect(back && backupCount(back)).toBe(2)
  })

  it('reports an outbox that cannot be read instead of dropping it silently', () => {
    const scan = scanOutboxes(store({ 'princess:outbox:u1:chat': '{not json', 'princess:outbox:u2:chat': JSON.stringify([item('a'), { nope: 1 }]) }))
    expect(scan.corrupt.sort()).toEqual(['princess:outbox:u1:chat', 'princess:outbox:u2:chat'])
    expect(scan.outboxes['u2:chat']).toHaveLength(1)
  })

  it('refuses a file that is not a backup, and leaves out items that fail the check', () => {
    expect(parseBackup('hello')).toBeNull()
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1 }))).toBeNull()
    const b = parseBackup(JSON.stringify({ app: 'princess', version: 1, exportedAt: 'x', outboxes: { k: [item('a'), { bad: true }] } }))
    expect(b && backupCount(b)).toBe(1)
  })

  it('puts items back without duplicating what is already waiting', () => {
    const backup = buildBackup({ k: [item('a'), item('b')] }, new Date(0))
    const { outboxes, added } = mergeBackup({ k: [item('a')] }, backup)
    expect(added).toBe(1)
    expect(outboxes.k.map((x) => x.id)).toEqual(['a', 'b'])
  })
})
