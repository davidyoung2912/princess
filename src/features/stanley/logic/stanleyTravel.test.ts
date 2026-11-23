import { describe, expect, it } from 'vitest'
import {
  flightNeedsAttention, isReviewed, minutesBetween, normalizeConnection, normalizeReading, photoProblem, normalizeEmbark, normalizeEntry, normalizeFlight, normalizePack, normalizePhrases, normalizePort, normalizeTraffic, packText, planIsSafe, safeLink,
} from './stanleyTravel'

describe('flight and traffic', () => {
  it('reads a flight answer and keeps at most three alternatives', () => {
    const f = normalizeFlight({
      state: 'ok', flight: 'AA123', status: 'delayed', delayMinutes: 75, provider: 'Flight status feed', asOf: 5, confidence: 'provider', flightAt: '09:00', newFlightAt: '10:15', clock: 'airport time', verdict: 'tight', spare: 10,
      alternatives: [1, 2, 3, 4].map((i) => ({ offOption: 'selfAssist', mode: 'rideshare', offAt: '07:30', leaveBy: '07:00', spare: 50 + i, text: `Option ${i}` })), message: 'Hi', notes: ['n'],
    })!
    expect(f.alternatives).toHaveLength(3)
    expect(f.newFlightAt).toBe('10:15')
    expect(flightNeedsAttention(f)).toBe(true)
  })
  it('does not need attention when the flight is fine, and rejects nonsense', () => {
    expect(flightNeedsAttention(normalizeFlight({ state: 'ok', verdict: 'ok' })!)).toBe(false)
    expect(normalizeFlight(null)).toBeNull()
    expect(normalizeFlight({ confidence: 'maybe', state: 'weird' })!.state).toBe('unknown')
    expect(normalizeFlight({ state: 'ok', confidence: 'maybe' })!.confidence).toBe('none')
  })
  it('reads traffic', () => {
    expect(normalizeTraffic({ traffic: 'heavy', sky: 'storm', leaveEarlierMinutes: 45, provider: 'p', asOf: 1, confidence: 'provider', message: 'm', notes: [] })!.leaveEarlierMinutes).toBe(45)
    expect(normalizeTraffic({})).toBeNull()
  })
})

describe('shore plan', () => {
  const raw = {
    port: 'cozumel', portName: 'Cozumel', day: 3, clock: 'port time', ashoreFrom: '07:30',
    stops: [{ id: 'a', kind: 'walk', title: 'Walk', start: '08:00', end: '09:20', mode: 'walk', travelMinutes: 0, cost: 'free', cents: 0, opens: '08:00', closes: '18:00', why: 'w' }],
    return: { backBy: '15:45', allAboard: '16:30', bufferMinutes: 45, clock: 'port time', leaveLastStopBy: '15:45', text: 't' }, notes: [], complete: true,
  }
  it('reads a plan and checks it ends before back-by', () => {
    const p = normalizePort(raw)!
    expect(p.stops).toHaveLength(1)
    expect(planIsSafe(p)).toBe(true)
    expect(planIsSafe({ ...p, stops: [{ ...p.stops[0], end: '16:00' }] })).toBe(false)
    expect(planIsSafe({ ...p, stops: [] })).toBe(false)
  })
  it('drops stops with no title and rejects a missing port', () => {
    expect(normalizePort({ ...raw, stops: [{ id: 'x' }] })!.stops).toHaveLength(0)
    expect(normalizePort({ stops: [] })).toBeNull()
  })
  it('counts minutes between times', () => expect(minutesBetween('08:00', '09:20')).toBe(80))
})

describe('phrases', () => {
  it('marks only server-reviewed phrases as reviewed', () => {
    const p = normalizePhrases({ port: 'cozumel', language: 'Spanish', phrases: [{ id: 'p0', say: 'Gracias', means: 'Thank you', sounds: 'x', label: 'reviewed', language: 'Spanish' }, { say: 'Hola', means: 'Hello', label: 'whatever' }], showPerson: null, note: '' })!
    expect(p.phrases.map(isReviewed)).toEqual([true, false])
  })
  it('keeps the show-a-person card', () => {
    const p = normalizePhrases({ port: 'x', phrases: [], showPerson: { text: 'Help me', language: 'English', label: 'Not translated' } })!
    expect(p.showPerson?.label).toBe('Not translated')
  })
})

describe('machine phrases, photo reading and connections', () => {
  it('keeps a machine phrase marked machine with its confidence', () => {
    const p = normalizePhrases({ port: 'x', phrases: [{ id: 'm0', say: '¿Dónde está el muelle?', means: 'where is the pier', label: 'machine', confidence: 'medium' }, { say: 'a', means: 'b', label: 'reviewed', confidence: 'bogus' }], showPerson: null })!
    expect(p.phrases.map((x) => [isReviewed(x), x.confidence])).toEqual([[false, 'medium'], [true, null]])
  })
  it('never shows lines for a refused or unclear reading', () => {
    const lines = [{ original: 'PASSPORT', english: 'PASSPORT', confidence: 'high' }]
    expect(normalizeReading({ state: 'refused', lines })!.lines).toEqual([])
    expect(normalizeReading({ state: 'unclear', lines })!.lines).toEqual([])
    expect(normalizeReading({ state: 'read', lines: [{ original: 'Salida', english: 'Exit', confidence: 'weird' }] })!.lines[0].confidence).toBe('low')
    expect(normalizeReading({ state: 'nope' })).toBeNull()
  })
  it('checks a photo before it is sent', () => {
    expect(photoProblem({ type: 'image/jpeg', size: 1000 })).toBeNull()
    expect(photoProblem({ type: 'application/pdf', size: 1000 })).toBe('type')
    expect(photoProblem({ type: 'image/png', size: 5_000_000 })).toBe('size')
  })
  it('reads a connection and rejects an unknown verdict', () => {
    expect(normalizeConnection({ verdict: 'tooEarly', spare: -20, earliestDeparture: '12:00' })!.earliestDeparture).toBe('12:00')
    expect(normalizeConnection({ verdict: 'maybe' })).toBeNull()
  })
})

describe('port pack', () => {
  const pack = { version: 'abc', port: 'cozumel', portName: 'Cozumel', day: 3, clock: 'port time', allAboard: '16:30', backBy: '15:45', tender: false, contacts: ['911'], takeMeBack: null, phrases: [], notes: ['n'], laws: ['l'], basis: 'b' }
  it('reads as text with every time followed by its clock', () => {
    const p = normalizePack(pack)!
    expect(packText(p)).toContain('15:45 (port time)')
    expect(packText(p)).toContain('All aboard 16:30 (port time)')
  })
  it('rejects an answer with no version', () => expect(normalizePack({ port: 'x' })).toBeNull())
})

describe('embark tour and entry', () => {
  it('reads steps and unknown goals fall back', () => {
    const t = normalizeEmbark({ goals: ['family', 'nonsense'], steps: [{ placeId: 'p', name: 'Pool', deck: 16, section: 'aft', goal: 'weird', why: 'w', walkFromPrevious: 3, stepFree: true, note: null }], notes: [] })!
    expect(t.goals).toEqual(['family'])
    expect(t.steps[0].goal).toBe('essentials')
  })
  it('shows only https links', () => {
    expect(safeLink('https://www.cbp.gov/travel')).not.toBeNull()
    expect(safeLink('javascript:alert(1)')).toBeNull()
    expect(safeLink('http://x.test')).toBeNull()
    const e = normalizeEntry({ sources: [{ jurisdiction: 'Mexico', authority: 'INM', role: 'r', links: [{ label: 'a', url: 'https://www.inm.gob.mx' }, { label: 'b', url: 'javascript:1' }], note: '' }], reviewedOn: '2026-11-09', note: 'n' })!
    expect(e.sources[0].links).toHaveLength(1)
  })
})
