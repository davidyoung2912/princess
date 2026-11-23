import type { LibraryEntry } from './types'

/** Manage: the organiser. Deadlines, documents and who can do what once a booking is confirmed. */
export const MANAGE: readonly LibraryEntry[] = [
  { id: 'manage.balanceDue', stages: ['manage'], screens: ['P14', 'M07'], link: '/plan/money-plan', words: 'final payment deadline remaining owe' },
  { id: 'manage.documents', stages: ['manage'], screens: ['M06', 'P12'], link: '/me/documents', words: 'passport papers need traveller' },
  { id: 'manage.passportExpiry', stages: ['manage'], screens: ['M06', 'M05'], link: '/me/documents', words: 'expire valid months renew' },
  { id: 'manage.ready', stages: ['manage'], screens: ['P12'], link: '/plan/readiness', words: 'readiness traveller complete status' },
  { id: 'manage.fixName', stages: ['manage'], screens: ['M03', 'M05'], words: 'spelling typo mistake correct change' },
  { id: 'manage.addTraveller', stages: ['manage'], screens: ['P47', 'M03'], link: '/plan/party', words: 'party person guest extra' },
  { id: 'manage.contract', stages: ['manage'], screens: ['P13'], link: '/plan/contract', words: 'terms conditions agreement rules' },
  { id: 'manage.updates', stages: ['manage'], screens: ['H21', 'M03'], link: '/home/updates', words: 'changes news notice itinerary' },
  { id: 'manage.access', stages: ['manage'], screens: ['P09', 'P10'], link: '/plan/access', words: 'wheelchair mobility disability assistance' },
  { id: 'manage.allergy', stages: ['manage'], screens: ['P11'], link: '/plan/allergy', words: 'food diet dietary intolerance' },
  { id: 'manage.agent', stages: ['manage'], screens: ['M03', 'M02'], words: 'travel advisor booked through' },
  { id: 'manage.helper', stages: ['manage'], screens: ['M14'], link: '/me/helper', words: 'delegate family friend manage behalf' },
  { id: 'manage.familyLink', stages: ['manage'], screens: ['P48', 'P50'], link: '/plan/family-link', words: 'share plans home relatives follow' },
]
