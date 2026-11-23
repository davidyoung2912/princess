import { describe, expect, it } from 'vitest'
import { ALL_SECTIONS, estimateBytes, isComplete, parseResult, retryItems, runPack, selectItems, type PackItem, type PackStore } from './cruisePack'

const item = (id: string, section: PackItem['section'], load: () => Promise<unknown>, extra: Partial<PackItem> = {}): PackItem => ({ id, section, kind: 'k', key: id, label: id, load, ...extra })
const ok = (v: unknown = { a: 1 }) => () => Promise.resolve(v)
const store = (kept = true): PackStore & { put: PackStore['put'] } => ({ put: (_i, v) => ({ kept, bytes: JSON.stringify(v).length }) })

describe('selecting what to download', () => {
  const items = [item('p', 'essentials', ok()), item('d', 'reservations', ok()), item('t1', 'tours', ok(), { port: 'nassau' }), item('t2', 'tours', ok(), { port: 'cozumel' })]
  it('takes everything by default', () => { expect(selectItems(items, ALL_SECTIONS)).toHaveLength(4) })
  it('always keeps essentials', () => { expect(selectItems(items, { sections: [], skipPorts: [] }).map((i) => i.id)).toEqual(['p']) })
  it('leaves out chosen ports', () => { expect(selectItems(items, { sections: ['tours'], skipPorts: ['cozumel'] }).map((i) => i.id)).toEqual(['p', 't1']) })
})

describe('running a download', () => {
  it('keeps what loads and lists what failed, without stopping', async () => {
    const items = [item('a', 'essentials', ok()), item('b', 'bill', () => Promise.reject({ code: 'timeout' })), item('c', 'home', ok({ x: 'yy' }))]
    const seen: number[] = []
    const r = await runPack(items, store(), { now: () => 100, concurrency: 1, onProgress: (p) => seen.push(p.finished) })
    expect(r.done.sort()).toEqual(['a', 'c'])
    expect(r.failed).toEqual([{ id: 'b', label: 'b', code: 'timeout' }])
    expect(r.total).toBe(3)
    expect(r.bytes).toBeGreaterThan(0)
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(3)
    expect(isComplete(r)).toBe(false)
  })
  it('does not claim a copy is kept when the store refuses it', async () => {
    const r = await runPack([item('a', 'essentials', ok())], store(false), { now: () => 1 })
    expect(r.done).toEqual([])
    expect(r.failed[0].code).toBe('storage')
  })
  it('says server for an unknown failure', async () => {
    const r = await runPack([item('a', 'essentials', () => Promise.reject(new Error('x')))], store(), { now: () => 1 })
    expect(r.failed[0].code).toBe('server')
  })
  it('stops when cancelled', async () => {
    const signal = { cancelled: false }
    const items = [item('a', 'essentials', async () => { signal.cancelled = true; return 1 }), item('b', 'bill', ok()), item('c', 'home', ok())]
    const r = await runPack(items, store(), { now: () => 1, concurrency: 1, signal })
    expect(r.done).toEqual(['a'])
    expect(r.failed).toEqual([])
  })
  it('is complete when nothing failed', async () => {
    expect(isComplete(await runPack([item('a', 'essentials', ok())], store(), { now: () => 1 }))).toBe(true)
    expect(isComplete({ total: 0, failed: [] })).toBe(false)
  })
})

describe('retry, estimate and stored result', () => {
  const items = [item('a', 'essentials', ok()), item('b', 'bill', ok())]
  it('retries only what failed', () => { expect(retryItems(items, { failed: [{ id: 'b', label: 'b', code: 'x' }] }).map((i) => i.id)).toEqual(['b']) })
  it('estimates from known sizes, else a typical one', () => {
    expect(estimateBytes(items, new Map([['k:a', 100]]))).toBe(100 + 24 * 1024)
  })
  it('reads a stored result defensively', () => {
    expect(parseResult('nope')).toBeNull()
    expect(parseResult(JSON.stringify({ at: 1, total: 2, bytes: 3, done: ['a', 5], failed: [{ id: 'b', label: 'b', code: 'x' }, 7] }))).toEqual({ at: 1, total: 2, bytes: 3, done: ['a'], failed: [{ id: 'b', label: 'b', code: 'x' }] })
  })
})
