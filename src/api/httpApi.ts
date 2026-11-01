import { ApiError } from './errors'
import type { Http } from './http'
import { fromWire, toWireId } from './personaIds'
import type { FeedbackApi } from './aboardTypes'
import type { BudgetApi, PrivacyApi } from './careTypes'
import type { Api, Booking, Identity, TripsView } from './types'
import type { Tier } from '../domain/personas'

/** The groups of the `Api` that Phase 13 serves from the REST API (account, trips, payments, documents, notifications, support, privacy, budget). */
export interface HttpGroups {
  auth: Api['auth']
  bookings: Api['bookings']
  account: Api['account']
  trips: Api['trips']
  payments: Api['payments']
  documents: Api['documents']
  notifications: Api['notifications']
  support: Api['support']
  help: Api['help']
  budget: BudgetApi
  privacy: PrivacyApi
  feedback: FeedbackApi
  favourites: { favourites: Api['discover']['favourites']; toggleFavourite: Api['discover']['toggleFavourite'] }
  /** Phase 14: sailing offers and quotes, and the whole booking funnel. */
  discover: Pick<Api['discover'], 'offers' | 'quote'>
  booking: Api['booking']
}

interface WireMe { id: string; firstName: string | null; lastName: string | null; tier: string }
interface WireCore { personaId: string; bookerId: string; sailingId: string; party: string[]; stateroom: string; tier: string; package: string }

const seg = encodeURIComponent

/**
 * The REST implementation of the account area. Journey routes are `/bookings/{number}/...`; the screens do not know the
 * number, so it is the signed-in person's current trip, found once from `GET /trips` (data model D3). Call `reset()` when
 * the signed-in person changes.
 */
export function createHttpGroups(http: Http): { groups: HttpGroups; reset: () => void } {
  let current: Promise<string> | null = null
  const number = (): Promise<string> => {
    current ??= http.get<TripsView>('/trips').then((t) => {
      const trip = t.upcoming.find((x) => x.kind === 'current') ?? t.upcoming[0]
      if (!trip) throw new ApiError('notFound', 'noTrip')
      return trip.number
    })
    current.catch(() => { current = null })
    return current
  }
  const inBooking = async <T>(path: string): Promise<T> => fromWire<T>(await http.get(`/bookings/${seg(await number())}${path}`))
  const get = async <T>(path: string): Promise<T> => fromWire<T>(await http.get(path))
  const send = async <T>(method: 'post' | 'put' | 'delete', path: string, body?: unknown): Promise<T> =>
    fromWire<T>(method === 'delete' ? await http.delete(path) : await http[method](path, body))

  const groups: HttpGroups = {
    auth: {
      me: async (): Promise<Identity> => {
        const me = await get<WireMe>('/me')
        return { personaId: me.id as Identity['personaId'], name: [me.firstName, me.lastName].filter(Boolean).join(' '), tier: me.tier as Tier }
      },
    },
    bookings: {
      get: async (): Promise<Booking> => inBooking<WireCore>('').then((b) => ({ personaId: b.personaId, bookerId: b.bookerId, sailingId: b.sailingId, party: b.party, stateroom: b.stateroom, tier: b.tier, package: b.package }) as Booking),
      sailings: async () => (await get<{ id: string; departure: string }[]>('/sailings')).map((s) => ({ id: s.id, departure: s.departure })),
    },
    account: {
      party: () => inBooking('/party'),
      profile: (id) => get(`/users/${seg(toWireId(id))}/profile`),
      saveProfile: (id, profile) => send('put', `/users/${seg(toWireId(id))}/profile`, profile),
      helper: () => get('/me/helper'),
      saveHelper: (input) => send('put', '/me/helper', input),
      revokeHelper: () => send('delete', '/me/helper'),
      history: () => get('/me/history'),
    },
    trips: {
      list: () => get('/trips'),
      get: (n) => get(`/trips/${seg(n)}`),
      link: (n, lastName, departure) => send('post', '/trips/link', { number: n, lastName, departure }),
    },
    payments: {
      get: () => inBooking('/payments'),
      addCard: (brand, last4, expiry) => send('post', '/me/cards', { brand, last4, expiry }),
      removeCard: (id) => send('delete', `/me/cards/${seg(id)}`),
      payBalance: async (cardId) => send('post', `/bookings/${seg(await number())}/payments/balance`, { cardId }),
    },
    documents: {
      get: () => inBooking('/documents'),
      set: async (guest, doc, held) => {
        const path = `/users/${seg(toWireId(guest))}/documents/${seg(doc)}?booking=${seg(await number())}`
        return held === null ? send('delete', path) : send('put', path, { expires: held.expires })
      },
    },
    notifications: {
      list: () => get('/me/notifications'),
      markRead: async (ids) => { await http.post('/me/notifications/read', { ids }) },
      savePrefs: (prefs) => send('put', '/me/notification-prefs', prefs),
    },
    support: {
      tickets: () => get('/me/support-tickets'),
      callback: (phone) => send('post', '/me/support-tickets', { kind: 'callback', phone }),
      email: (message) => send('post', '/me/support-tickets', { kind: 'email', message }),
    },
    help: { contacts: () => get('/help/contacts') },
    budget: {
      get: () => inBooking('/budget'),
      save: async (budget) => send('put', `/bookings/${seg(await number())}/budget`, { ...budget, kids: Object.fromEntries(Object.entries(budget.kids).map(([k, v]) => [toWireId(k), v])) }),
    },
    privacy: {
      view: () => inBooking('/privacy'),
      setConsent: async (person, consent, on) => send('put', `/users/${seg(toWireId(person))}/consents/${seg(consent)}?booking=${seg(await number())}`, { on }),
    },
    feedback: {
      list: () => get('/me/feedback'),
      send: (input) => send('post', '/me/feedback', input),
    },
    favourites: {
      favourites: () => get('/me/favourites'),
      toggleFavourite: (key) => send('post', '/me/favourites/toggle', { key }),
    },
    discover: {
      offers: () => get('/sailings/offers'),
      quote: (sailingId, category, guests) => get(`/sailings/${seg(sailingId)}/quote?category=${seg(category)}&guests=${guests}`),
    },
    booking: {
      dates: () => get('/sailings/bookable'),
      rooms: (sailingId) => get(`/sailings/${seg(sailingId)}/rooms`),
      cabins: (sailingId, category) => get(`/sailings/${seg(sailingId)}/cabins?category=${seg(category)}`),
      fares: (draft) => send('post', '/booking/fares', draft),
      quote: (draft) => send('post', '/booking/quote', draft),
      prefill: () => get('/me/booking-prefill'),
      draft: () => get('/me/draft'),
      saveDraft: (draft) => send('put', '/me/draft', draft),
      discardDraft: async () => { await http.delete('/me/draft') },
      sendResumeLink: (via, to) => send('post', '/me/draft/resume-link', { via, to }),
      book: (input) => send('post', '/bookings', input),
      get: (n) => get(`/bookings/${seg(n)}/detail`),
      payBalance: (n, parts, challenge) => send('post', `/bookings/${seg(n)}/pay-balance`, { parts, challenge }),
      changePreview: (n, sailingId) => get(`/bookings/${seg(n)}/change?sailingId=${seg(sailingId)}`),
      change: (n, sailingId) => send('post', `/bookings/${seg(n)}/change?sailingId=${seg(sailingId)}`),
      cancel: (n) => send('post', `/bookings/${seg(n)}/cancel`),
    },
  }
  return { groups, reset: () => { current = null } }
}

/** The mock `Api` with the Phase 13 and 14 groups replaced by the REST ones. */
export function withHttpGroups(base: Api, g: HttpGroups): Api {
  return {
    ...base,
    auth: g.auth,
    bookings: g.bookings,
    account: g.account,
    trips: g.trips,
    payments: g.payments,
    documents: g.documents,
    notifications: g.notifications,
    support: g.support,
    help: g.help,
    budget: g.budget,
    privacy: g.privacy,
    aboard: { ...base.aboard, feedback: g.feedback },
    discover: { ...base.discover, ...g.favourites, ...g.discover },
    booking: { ...base.booking, ...g.booking },
  }
}
