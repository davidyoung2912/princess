import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { PICKABLE_KINDS, REQUEST_KINDS, TEXT_HELP_MAX, textHelpProblem } from '../domain/health'
import { SCREENS } from '../screens'
import { AppRoutes } from '../App'

beforeAll(async () => { await Promise.all(Object.values(SCREENS).map((s) => ('preload' in s ? s.preload() : null))) })

describe('text help (N5.6)', () => {
  it('needs words, within the limit the server enforces', () => {
    expect(textHelpProblem('')).toBe('empty')
    expect(textHelpProblem('   ')).toBe('empty')
    expect(textHelpProblem('I cannot hear. Please come to 8123.')).toBeNull()
    expect(textHelpProblem('a'.repeat(TEXT_HELP_MAX))).toBeNull()
    expect(textHelpProblem('a'.repeat(TEXT_HELP_MAX + 1))).toBe('tooLong')
  })

  it('is a request kind but not one of the choices on the health screen', () => {
    expect(REQUEST_KINDS).toContain('textHelp')
    expect(PICKABLE_KINDS).not.toContain('textHelp')
  })

  it('puts the alarm and the emergency number before the form, and says a text is not an alarm', () => {
    const html = renderToString(<MemoryRouter initialEntries={['/ship/text-help']}><AppRoutes /></MemoryRouter>)
    expect(html).toContain('is not an alarm')
    expect(html.indexOf('tel:')).toBeLessThan(html.indexOf('<form'))
    expect(html).toContain('Interpreter Times')
    expect(html).toContain('Stage show with sign-language interpreter')
  })
})
