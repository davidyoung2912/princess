import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { blankContact, blankGuest, emptyDraft, type Draft } from '../../domain/booking'
import { CancellationTable } from './Policy'
import { DiningStep } from './DiningStep'
import { GuestsStep } from './GuestsStep'
import { ReviewStep } from './ReviewStep'
import { RoomStep } from './RoomStep'
import type { StepProps } from './common'

const draft: Draft = {
  ...emptyDraft('d'), sailingId: 'sun-2027-03-21', category: 'balcony', guests: 2, fare: 'plus', dining: 'anytime', cabinMode: 'pick',
  people: [{ ...blankGuest(), firstName: 'Gerald', dietaryStatus: 'some', dietary: ['vegetarian'] }, { ...blankGuest(), dietaryStatus: 'none' }],
  contact: blankContact(),
}
const props = (error: (path: string) => string | undefined = () => undefined): StepProps => ({ draft, update: () => {}, error, ctx: { departure: '2027-03-21', today: '2026-10-29' } })
const html = (node: ReactNode) => renderToString(<MemoryRouter>{node}</MemoryRouter>).replace(/&#x27;/g, "'")

/** Every form control in the markup has a label that points at it, or sits inside one. */
function unlabelled(markup: string): string[] {
  const ids = new Set([...markup.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]))
  const problems: string[] = []
  for (const m of markup.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[2])?.[1]
    if (/type="(hidden)"/.test(m[2])) continue
    const before = markup.slice(0, m.index)
    const insideLabel = before.lastIndexOf('<label') > before.lastIndexOf('</label>')
    if (!insideLabel && !(id && ids.has(id))) problems.push(m[0])
  }
  return problems
}

describe('booking steps are labelled and structured', () => {
  it('guests: every field has a visible label, each guest is a fieldset with a legend, and autofill hints are set for the lead', () => {
    const markup = html(<GuestsStep {...props()} />)
    expect(unlabelled(markup)).toEqual([])
    expect(markup).toContain('<legend>Guest 1 (the person booking)</legend>')
    expect(markup).toContain('<legend>Guest 2</legend>')
    expect(markup).toMatch(/autocomplete="given-name"/i)
    expect(markup).not.toMatch(/placeholder=/)
  })

  it('dining: radios and checkboxes are labelled, and details show only for a guest with needs', () => {
    const markup = html(<DiningStep {...props()} />)
    expect(unlabelled(markup)).toEqual([])
    expect(markup).toContain('Vegetarian')
    expect(markup.match(/No dietary needs or allergies/g)).toHaveLength(2)
    expect(markup.match(/Nut allergy/g)).toHaveLength(1)
  })

  it('shows a problem as text with an icon, next to its group', () => {
    const markup = html(<DiningStep {...props((path) => (path === 'dining' ? 'A dining choice: please choose one.' : undefined))} />)
    expect(markup).toContain('A dining choice: please choose one.')
    expect(markup).toContain('field__error')
  })

  it('room: the stateroom choice and guest count are labelled', () => {
    const markup = html(<RoomStep {...props()} />)
    expect(unlabelled(markup)).toEqual([])
    expect(markup).toContain('Guests in the room')
    expect(markup).toContain('Choose my stateroom')
  })

  it('review: gives a way to change each choice, with the choice named for screen readers', () => {
    const markup = html(<ReviewStep {...props()} />)
    expect(markup).toContain('href="/book/guests"')
    expect(markup).toMatch(/visually-hidden"> (<!-- -->)?Guests<\/span>/)
    expect(markup).toContain('Princess Plus')
  })
})

describe('cancellation table', () => {
  it('reads as days then fee, and marks the row that applies today', () => {
    const markup = html(<CancellationTable current="mid" />)
    expect(markup).toContain('<caption>')
    expect(markup.match(/<th scope="row">/g)).toHaveLength(5)
    expect(markup.match(/aria-current="true"/g)).toHaveLength(1)
    expect(markup).toContain('Applies today')
    expect(html(<CancellationTable />)).not.toContain('aria-current')
  })
})
