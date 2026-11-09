/**
 * Access notes for ship events (SEA-18). Only what the ship's accessibility team has verified is shown; an event with nothing verified shows nothing, never a guess.
 * Requests for help at an event are made on the assistance screen and tracked there.
 */
export type AccessFeature = 'captions' | 'hearingLoop' | 'wheelchairSeating' | 'stepFreeRoute' | 'quietSeating' | 'lowLight'
export const ACCESS_FEATURES: readonly AccessFeature[] = ['captions', 'hearingLoop', 'wheelchairSeating', 'stepFreeRoute', 'quietSeating', 'lowLight']

/** Authored concept values (verify before real use). */
const VERIFIED: Record<string, readonly AccessFeature[]> = {
  'stage-show': ['captions', 'hearingLoop', 'wheelchairSeating', 'stepFreeRoute'],
  'farewell-show': ['captions', 'hearingLoop', 'wheelchairSeating', 'stepFreeRoute'],
  'port-show': ['captions', 'hearingLoop', 'wheelchairSeating', 'stepFreeRoute'],
  movie: ['captions', 'stepFreeRoute', 'quietSeating'],
  'port-lecture': ['captions', 'hearingLoop', 'stepFreeRoute'],
  'port-quiet': ['quietSeating', 'lowLight'],
}

/** The verified features of an event, or an empty list. */
export const eventAccess = (eventId: string): AccessFeature[] => [...(VERIFIED[eventId] ?? [])]
