/** Numbered deals for the card games: a deal number picks one shuffle, so a deal can be replayed or shared. */
export const MAX_DEAL = 999999
export const randomDealNumber = (rng: () => number = Math.random): number => 1 + Math.floor(rng() * MAX_DEAL)
