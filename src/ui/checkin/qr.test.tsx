import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { asBoardingView, asEmbarkView, asReceiptView } from '../../api/guards'
import { QrCode } from './QrCode'

describe('QR code', () => {
  it('draws the same text as the same picture, black on white, with a spoken label', () => {
    const a = renderToString(<QrCode text="PCP1|PC482113|1|WHITFIELD/GERALD|2027-03-21|10412|Priority|abcd" label="Boarding pass code for Gerald" />)
    const b = renderToString(<QrCode text="PCP1|PC482113|1|WHITFIELD/GERALD|2027-03-21|10412|Priority|abcd" label="Boarding pass code for Gerald" />)
    expect(a).toBe(b)
    expect(a).toContain('role="img"')
    expect(a).toContain('aria-label="Boarding pass code for Gerald"')
    expect(a).toContain('fill="#fff"')
    expect(a).toMatch(/M\d+ \d+h1v1h-1z/)
  })

  it('draws a different picture for different text', () => {
    expect(renderToString(<QrCode text="one" label="x" />)).not.toBe(renderToString(<QrCode text="two" label="x" />))
  })
})

describe('saved copies are checked before they are trusted', () => {
  const pass = { number: 'PC1', departure: '2027-03-21', checkinDone: true, terminal: { name: 'Terminal 2' }, passes: [{ id: 'gerald', name: 'G', printed: 'W/G', code: 'x', ready: true, cabin: '1', group: 'Priority' }] }

  it('accepts a whole pass and rejects anything missing a field the screens rely on', () => {
    expect(asBoardingView(pass)).not.toBeNull()
    expect(asBoardingView({ ...pass, passes: [{ id: 'gerald' }] })).toBeNull()
    expect(asBoardingView({ ...pass, terminal: null })).toBeNull()
    expect(asBoardingView(null)).toBeNull()
    expect(asBoardingView('text')).toBeNull()
  })

  it('checks receipts and embarkation views the same way', () => {
    expect(asReceiptView({ number: 'PC1', guests: [{ items: [] }], booking: [] })).not.toBeNull()
    expect(asReceiptView({ number: 'PC1', guests: [{}], booking: [] })).toBeNull()
    expect(asEmbarkView({ boarding: pass, companion: [], carryOn: [], afternoon: [] })).not.toBeNull()
    expect(asEmbarkView({ boarding: {}, companion: [], carryOn: [], afternoon: [] })).toBeNull()
  })
})
