import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { placesOnDeck } from '../domain/deck'
import { locate } from '../domain/deckGraph'
import { QUIET_PLACE_IDS } from '../domain/deckPlan'
import { LanguageSwitch } from './LanguageSwitch'
import { DeckPlan } from './onboard/DeckPlan'

describe('graphic deck plan', () => {
  it('is one labelled image whose every fact is also in a numbered list', () => {
    const html = renderToString(<DeckPlan deck={7} />)
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-labelledby="([^"]+) ([^"]+)"/)
    const [, a, b] = html.match(/aria-labelledby="([^"]+) ([^"]+)"/)!
    expect(html).toContain(`id="${a}"`)
    expect(html).toContain(`id="${b}"`)
    for (const p of placesOnDeck(7)) expect(html, p.name).toContain(p.name.replace(/'/g, '&#x27;'))
    for (const letter of ['A', 'B', 'E']) expect(html).toContain(`>${letter}</text>`)
    expect(html).toContain('tabindex="0"')
  })

  it('marks steps and quiet spaces with shape and words, not colour alone', () => {
    const steps = renderToString(<DeckPlan deck={18} stepFree />)
    expect(steps).toContain('deck-plan__place--steps')
    expect(steps).toContain('Not step-free')
    const quiet = renderToString(<DeckPlan deck={6} quiet />)
    expect(quiet).toContain('deck-plan__quiet-ring')
    expect(quiet).toContain('quiet space')
    expect(QUIET_PLACE_IDS.every((id) => locate(id))).toBe(true)
    expect(renderToString(<DeckPlan deck={4} quiet />)).toContain('No quiet spaces are listed')
  })

  it('shows “You are here” only on the deck the guest chose, and a route line only when given one', () => {
    const lido = locate('lido')!
    expect(renderToString(<DeckPlan deck={17} here={lido} />)).toContain('You are here')
    expect(renderToString(<DeckPlan deck={7} here={lido} />)).not.toContain('deck-plan__here"')
    expect(renderToString(<DeckPlan deck={7} />)).not.toContain('<polyline')
    expect(renderToString(<DeckPlan deck={7} line={[{ x: 1, y: 2 }, { x: 3, y: 4 }]} />)).toContain('<polyline')
  })
})

describe('language switch', () => {
  it('names each language in itself, with a label', () => {
    const html = renderToString(<LanguageSwitch />)
    expect(html).toContain('>Language</label>')
    expect(html).toContain('lang="es">Español<')
    expect(html).toContain('>English<')
  })
})
