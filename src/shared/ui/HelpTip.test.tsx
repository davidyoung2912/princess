import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Field, FieldLabel, TextArea } from './Field'
import { HelpTip } from './HelpTip'

describe('HelpTip', () => {
  it('starts closed, as a named toggle button', () => {
    const html = renderToString(<HelpTip about="Date of birth">Year, month and day.</HelpTip>)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="About: Date of birth"')
    expect(html).not.toContain('Year, month and day.')
  })

  it('appears beside a field label only when the field has help', () => {
    const withHelp = renderToString(<Field label="Name" help="As on your passport." />)
    const without = renderToString(<Field label="Name" />)
    expect(withHelp).toContain('helptip__btn')
    expect(without).not.toContain('helptip')
    expect(renderToString(<TextArea label="Note" help="Anything useful." />)).toContain('helptip__btn')
  })

  it('labels a select with an optional tip', () => {
    const html = renderToString(<FieldLabel htmlFor="x" help="Pick one.">Fare</FieldLabel>)
    expect(html).toContain('<label for="x">Fare</label>')
    expect(html).toContain('aria-label="About: Fare"')
    expect(renderToString(<FieldLabel htmlFor="x">Fare</FieldLabel>)).not.toContain('helptip')
  })
})
