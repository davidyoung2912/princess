import type { LibraryEntry } from './types'

/** Dream: the enthusiastic friend. Questions people have before they have chosen anything. */
export const DREAM: readonly LibraryEntry[] = [
  { id: 'dream.firstTime', stages: ['dream'], screens: ['H02', 'H13'], link: '/home/decide', words: 'beginner novice never cruised' },
  { id: 'dream.seasick', stages: ['dream'], screens: ['H13'], link: '/home/decide', words: 'motion sickness nausea waves rough' },
  { id: 'dream.included', stages: ['dream'], screens: ['H06', 'H13'], link: '/home/cruise/cost', words: 'fare price covers meals food' },
  { id: 'dream.cabinTypes', stages: ['dream'], screens: ['H02'], link: '/home/cabins', words: 'room inside oceanview balcony suite' },
  { id: 'dream.whenToGo', stages: ['dream'], screens: ['H07', 'H02'], link: '/home/sailings', words: 'season month weather cheapest' },
  { id: 'dream.nights', stages: ['dream'], screens: ['H07', 'H06'], link: '/home/sailings', words: 'length days short long week' },
  { id: 'dream.kids', stages: ['dream'], screens: ['H02', 'H13'], words: 'children family toddlers teens club' },
  { id: 'dream.shipSize', stages: ['dream'], screens: ['H47', 'H48', 'H49'], link: '/home/ships', words: 'big small ships crowded' },
  { id: 'dream.portTime', stages: ['dream'], screens: ['H06', 'H09', 'H50'], link: '/home/cruise', words: 'ashore hours visit stops' },
  { id: 'dream.saving', stages: ['dream'], screens: ['H11', 'H51'], link: '/home/saved', words: 'save heart favourite shortlist' },
  { id: 'dream.priceFinal', stages: ['dream'], screens: ['H07', 'H08'], link: '/home/cruise/cost', words: 'cost total extras fees' },
  { id: 'dream.explore', stages: ['dream'], screens: ['H50'], link: '/home/explore', words: 'region browse search filter' },
  { id: 'dream.solo', stages: ['dream'], screens: ['H02', 'H13'], words: 'alone single traveller myself' },
]
