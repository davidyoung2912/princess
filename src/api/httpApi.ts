import { ApiError } from './errors'
import type { Http } from './http'
import { fromWire, toWireId } from './personaIds'
import type { AheadApi } from './aheadTypes'
import type { FeedbackApi } from './aboardTypes'
import type { BudgetApi, PrivacyApi, ShowsApi, WaitsApi } from './careTypes'
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
  /** Phase 15: the pre-cruise plan, waits, shows and the services ahead of the cruise. */
  plan: Api['plan']
  waits: WaitsApi
  shows: ShowsApi
  ahead: AheadApi
  /** Phase 16: check-in and boarding. */
  checkin: Api['checkin']
  boarding: Api['boarding']
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
  const ids = (guests: readonly string[]) => guests.map(toWireId)
  /** A write under the current trip: `/bookings/{number}{path}`. */
  const inTrip = async <T>(method: 'post' | 'put' | 'delete', path: string, body?: unknown): Promise<T> =>
    send<T>(method, `/bookings/${seg(await number())}${path}`, body)

  const checkin: HttpGroups['checkin'] = {
    status: () => inBooking('/checkin/status'),
    view: () => inBooking('/checkin'),
    receipt: () => inBooking('/checkin/receipt'),
    submit: () => inTrip('post', '/checkin/submit'),
    save: (input) => {
      const { step, ...rest } = input
      const body: Record<string, unknown> = { ...rest }
      if ('guests' in input) body.guests = ids(input.guests)
      if ('guest' in input) body.guest = toWireId(input.guest)
      return inTrip('put', `/checkin/steps/${seg(step)}`, body)
    },
  }
  const boarding: HttpGroups['boarding'] = {
    pass: () => inBooking('/boarding'),
    lookup: (n, lastName) => get(`/pass/lookup?number=${seg(n)}&lastName=${seg(lastName)}`),
    addToWallet: () => inTrip('post', '/boarding/wallet'),
    embark: () => inBooking('/embark'),
    setCompanion: (step, done) => inTrip('put', `/embark/companion/${seg(step)}`, { done }),
    setCarryOn: (item, done) => inTrip('put', `/embark/carry-on/${seg(item)}`, { done }),
    setBags: (dropped) => inTrip('put', '/embark/bags', { dropped }),
  }
  const groups: HttpGroups = {
    checkin,
    boarding,
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
    plan: {
      overview: () => inBooking('/plan'),
      excursions: {
        list: () => inBooking('/excursions'),
        addToCart: (id, guests) => inTrip('put', `/excursions/cart/${seg(id)}`, { guests: ids(guests) }),
        removeFromCart: (id) => inTrip('delete', `/excursions/cart/${seg(id)}`),
        checkout: (parts, challenge) => inTrip('post', '/excursions/checkout', { parts, challenge }),
        changeGuests: (id, guests) => inTrip('put', `/excursions/bookings/${seg(id)}`, { guests: ids(guests) }),
        cancel: (id) => inTrip('delete', `/excursions/bookings/${seg(id)}`),
      },
      dining: {
        view: () => inBooking('/dining'),
        slots: (venueId, day) => inBooking(`/dining/slots?venue=${seg(venueId)}&day=${day}`),
        reserve: (input) => inTrip('post', '/dining/reservations', { ...input, guests: ids(input.guests) }),
        cancel: (id) => inTrip('delete', `/dining/reservations/${seg(id)}`),
        move: (id, to) => inTrip('post', `/dining/reservations/${seg(id)}/move`, to),
        late: (id, minutes) => inTrip('post', `/dining/reservations/${seg(id)}/late`, { minutes }),
      },
      packages: {
        view: () => inBooking('/packages'),
        buy: (input, parts, challenge) => inTrip('post', '/packages/purchases', { ...input, guests: ids(input.guests), parts, challenge }),
        claimDrop: (id) => inTrip('post', `/packages/purchases/${seg(id)}/claim-drop`),
        cancel: (id) => inTrip('delete', `/packages/purchases/${seg(id)}`),
      },
      checklist: {
        get: () => inBooking('/checklist'),
        tick: (id, done) => inTrip('put', `/checklist/${seg(id)}`, { done }),
      },
      packing: {
        get: () => inBooking('/packing'),
        tick: (id, done) => inTrip('put', `/packing/${seg(id)}`, { done }),
      },
      travel: {
        get: () => inBooking('/travel'),
        save: (plan) => inTrip('put', '/travel', plan),
      },
      assistance: {
        get: () => inBooking('/assistance'),
        request: (input) => inTrip('post', '/assistance', { ...input, guest: toWireId(input.guest) }),
        cancel: (id) => inTrip('delete', `/assistance/${seg(id)}`),
      },
    },
    waits: {
      list: () => inBooking('/waits'),
      joinQueue: (venueId) => inTrip('post', '/waits/queue', { venueId }),
      leaveQueue: (id) => inTrip('delete', `/waits/queue/${seg(id)}`),
      joinWaitlist: (input) => inTrip('post', '/waits/waitlist', { ...input, guests: ids(input.guests) }),
      leaveWaitlist: (id) => inTrip('delete', `/waits/waitlist/${seg(id)}`),
      acceptWaitlist: (id) => inTrip('post', `/waits/waitlist/${seg(id)}/accept`),
    },
    shows: {
      day: (day) => inBooking(`/shows?day=${day}`),
      mine: () => inBooking('/shows/tickets'),
      reserve: (eventId, day, guests) => inTrip('post', '/shows/tickets', { eventId, day, guests: ids(guests) }),
      cancel: (id) => inTrip('delete', `/shows/tickets/${seg(id)}`),
    },
    ahead: {
      advisors: {
        list: () => get('/me/advisor-requests'),
        ask: (input) => send('post', '/me/advisor-requests', input),
      },
      marketing: {
        view: () => get('/me/marketing'),
        subscribe: (channel, contact, region) => send('post', `/me/marketing/${seg(channel)}/subscribe`, { contact, region }),
        confirm: (channel, code) => send('post', `/me/marketing/${seg(channel)}/confirm`, { code }),
        withdraw: (channel) => send('delete', `/me/marketing/${seg(channel)}`),
      },
      perks: { mine: () => get('/me/loyalty') },
      upgrades: {
        view: () => inBooking('/upgrades'),
        bid: (category, cents) => inTrip('post', '/upgrades', { category, cents }),
        withdraw: (id) => inTrip('delete', `/upgrades/${seg(id)}`),
      },
      clubs: {
        view: () => inBooking('/clubs'),
        save: ({ childId, ...registration }) => inTrip('put', `/clubs/${seg(toWireId(childId))}`, registration),
        withdraw: (childId) => inTrip('delete', `/clubs/${seg(toWireId(childId))}`),
      },
      medallion: {
        view: () => inBooking('/medallion'),
        activate: () => inTrip('post', '/medallion/activate'),
        lost: () => inTrip('post', '/medallion/lost'),
      },
      tags: {
        view: () => inBooking('/bag-tags'),
        choose: (way) => inTrip('put', '/bag-tags/way', { way }),
        handedOver: (on) => inTrip('put', '/bag-tags/handed-over', { on }),
      },
      fix: {
        list: () => get('/me/fix-cases'),
        escalate: (flow, note) => send('post', '/me/fix-cases', { flow, note }),
      },
      assist: {
        list: () => get('/me/assist-cases'),
        ask: (input) => send('post', '/me/assist-cases', input),
        choose: (id, choice) => send('post', `/me/assist-cases/${seg(id)}/choice`, { choice }),
      },
      prep: {
        get: () => inBooking('/prep'),
        set: (id, on) => inTrip('put', `/prep/${seg(id)}`, { done: on }),
      },
      saved: {
        list: () => get('/me/favourites'),
        toggle: (key) => send('post', '/me/favourites/toggle', { key }),
      },
    },
  }
  return { groups, reset: () => { current = null } }
}

/** The mock `Api` with the Phase 13 to 16 groups replaced by the REST ones. */
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
    plan: g.plan,
    waits: g.waits,
    shows: g.shows,
    ahead: g.ahead,
    checkin: g.checkin,
    boarding: g.boarding,
  }
}
