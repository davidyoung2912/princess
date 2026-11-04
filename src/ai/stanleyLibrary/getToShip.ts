import type { LibraryEntry } from './types'

/** Get to the ship: the steady hand. Calm, short answers for the days before and the morning of boarding. */
export const GET_TO_SHIP: readonly LibraryEntry[] = [
  { id: 'getToShip.checkinOpens', stages: ['getToShip'], screens: ['H27', 'H28'], link: '/home/check-in', words: 'online window open when' },
  { id: 'getToShip.photo', stages: ['getToShip'], screens: ['H27', 'H28'], link: '/home/check-in', words: 'selfie picture face hat glasses' },
  { id: 'getToShip.offlinePass', stages: ['getToShip'], screens: ['H31'], link: '/home/boarding-pass', words: 'signal internet offline saved phone' },
  { id: 'getToShip.arrive', stages: ['getToShip'], screens: ['P30', 'H30'], link: '/plan/getting-there', words: 'terminal early time window' },
  { id: 'getToShip.tags', stages: ['getToShip'], screens: ['H37'], link: '/home/luggage', words: 'luggage bags suitcase label print' },
  { id: 'getToShip.papers', stages: ['getToShip'], screens: ['H38', 'M06'], link: '/home/clearance', words: 'documents passport carry id' },
  { id: 'getToShip.late', stages: ['getToShip'], screens: ['H25', 'H24'], link: '/home/delayed', words: 'delayed traffic flight missed behind' },
  { id: 'getToShip.flight', stages: ['getToShip'], screens: ['P30'], link: '/plan/getting-there', words: 'land arrive airport buffer sail' },
  { id: 'getToShip.dropOff', stages: ['getToShip'], screens: ['P30'], link: '/plan/getting-there', words: 'parking taxi ride car park drop' },
  { id: 'getToShip.medallion', stages: ['getToShip'], screens: ['H36'], link: '/home/medallion', words: 'wearable device key tag' },
  { id: 'getToShip.terminalCheckin', stages: ['getToShip'], screens: ['H30', 'H27'], link: '/home/check-in/terminal', words: 'skip online desk counter' },
  { id: 'getToShip.separated', stages: ['getToShip'], screens: ['H35', 'H32'], link: '/home/meeting-point', words: 'lost group meet rendezvous' },
  { id: 'getToShip.airplane', stages: ['getToShip'], screens: ['P05', 'H31'], link: '/plan/phone', words: 'flight mode roaming signal sailing' },
]
