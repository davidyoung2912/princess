import { PLACES, type Place } from './deck'

/**
 * Open-deck places to watch the ship leave (EMB-13), from the deck plan. Only outdoor places are listed; the plan has no record of which side faces the pier
 * or of sight lines, so nothing here says one spot has a better view. Step-free ones come first.
 */
const OUTDOOR = new Set(['promenade', 'lido-pool', 'sea-view', 'sun-bar'])

export function sailAwayViews(opts: { stepFreeOnly: boolean }): Place[] {
  return PLACES.filter((p) => OUTDOOR.has(p.id) && (!opts.stepFreeOnly || p.stepFree))
    .sort((a, b) => Number(b.stepFree) - Number(a.stepFree) || a.deck - b.deck)
}
