import { ApiError } from './errors'
import type { Http } from './http'
import type { AheadApi } from './aheadTypes'
import type { FeedbackApi } from './aboardTypes'
import type { BudgetApi, PrivacyApi, ShowsApi, WaitsApi } from './careTypes'
import type { AboardApi } from './aboardTypes'
import type { Api, Booking, Identity, ProgramView, TripsView } from './types'
import type { Tier } from '../domain/people'

/** The groups of the `Api` that Phase 13 serves from the REST API (account, trips, payments, documents, notifications, support, privacy, budget). */
export interface HttpGroups {
  auth: Api['auth']
  bookings: Api['bookings']
  account: Api['account']
  trips: Api['trips']
  payments: Api['payments']
  documents: Api['documents']
  notifications: Api['notifications']
  push: Api['push']
  calendar: Api['calendar']
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
  /** Phase 17: everything on board. */
  onboard: Api['onboard']
  ports: Api['ports']
  folio: Api['folio']
  service: Api['service']
  orders: Api['orders']
  messages: Api['messages']
  family: Api['family']
  health: Api['health']
  room: Api['room']
  photos: Api['photos']
  laundry: Api['laundry']
  wifi: Api['wifi']
  updates: Api['updates']
  /** The `aboard` group without `feedback` (Phase 13). */
  aboard: Omit<AboardApi, 'feedback'>
  /** Phase 18: after the cruise. */
  disembark: Api['disembark']
  cases: Api['cases']
  post: Api['post']
}

interface WireMe { id: string; firstName: string | null; lastName: string | null; tier: string }
interface WireCore { personaId: string; bookerId: string; sailingId: string; party: string[]; stateroom: string; tier: string; package: string }

const seg = encodeURIComponent

/** The query string of an activity page: older than an id, at most this many. */
const activityQuery = (q?: { before?: number; max?: number }): string => {
  const parts = [q?.max ? `max=${q.max}` : '', q?.before ? `before=${q.before}` : ''].filter(Boolean)
  return parts.length ? `?${parts.join('&')}` : ''
}

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
  const inBooking = async <T>(path: string): Promise<T> => (await http.get(`/bookings/${seg(await number())}${path}`)) as T
  const get = async <T>(path: string): Promise<T> => (await http.get(path)) as T
  const send = async <T>(method: 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown): Promise<T> =>
    (method === 'delete' ? await http.delete(path) : await http[method](path, body)) as T
  /** A write under the current trip: `/bookings/{number}{path}`. */
  const inTrip = async <T>(method: 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown): Promise<T> =>
    send<T>(method, `/bookings/${seg(await number())}${path}`, body)

  const checkin: HttpGroups['checkin'] = {
    status: () => inBooking('/checkin/status'),
    view: () => inBooking('/checkin'),
    receipt: () => inBooking('/checkin/receipt'),
    submit: () => inTrip('post', '/checkin/submit'),
    save: (input) => {
      const { step, ...rest } = input
      const body: Record<string, unknown> = { ...rest }
      if ('guests' in input) body.guests = input.guests
      if ('guest' in input) body.guest = input.guest
      return inTrip('put', `/checkin/steps/${seg(step)}`, body)
    },
  }
  const boarding: HttpGroups['boarding'] = {
    pass: () => inBooking('/boarding'),
    lookup: (n, lastName, dob) => get(`/pass/lookup?number=${seg(n)}&lastName=${seg(lastName)}&dob=${seg(dob)}`),
    addToWallet: () => inTrip('post', '/boarding/wallet'),
    embark: () => inBooking('/embark'),
    setCompanion: (step, done) => inTrip('put', `/embark/companion/${seg(step)}`, { done }),
    setCarryOn: (item, done) => inTrip('put', `/embark/carry-on/${seg(item)}`, { done }),
    setBags: (dropped) => inTrip('put', '/embark/bags', { dropped }),
  }
  /** The cruise day each programme event was last seen on: the plan route is per event and day, the `Api` call has only the event. */
  const eventDay = new Map<string, number>()
  let lastDay = 1
  const onboard: HttpGroups['onboard'] = {
    today: () => inBooking('/onboard/today'),
    program: async (day) => {
      const view = await inBooking<ProgramView>(`/onboard/program/${day}`)
      lastDay = day
      for (const e of view.events) eventDay.set(e.id, day)
      return view
    },
    togglePlan: (eventId, on) => inTrip('put', `/onboard/plan/${seg(eventId)}`, { on, day: eventDay.get(eventId) ?? lastDay }),
    portDay: () => inBooking('/onboard/port-day'),
    muster: () => inBooking('/onboard/muster'),
    confirmMuster: (guests) => inTrip('post', '/onboard/muster', { guests: guests }),
    emergency: () => inBooking('/onboard/emergency'),
    folio: () => inBooking('/onboard/folio'),
  }
  const orders: HttpGroups['orders'] = {
    menu: () => inBooking('/orders/menu'),
    list: () => inBooking('/orders'),
    place: (input) => inTrip('post', '/orders', { ...input, lines: input.lines }),
    resolve: (id, choices) => inTrip('post', `/orders/${seg(id)}/resolve`, { choices }),
    cancel: (id) => inTrip('delete', `/orders/${seg(id)}`),
    moveTo: (id, location) => inTrip('put', `/orders/${seg(id)}/location`, { location }),
    contact: (id) => inTrip('post', `/orders/${seg(id)}/contact`),
  }
  const family: HttpGroups['family'] = {
    view: () => inBooking('/family'),
    setZones: (child, zones) => inTrip('put', `/family/${seg(child)}/zones`, { zones }),
    setAuth: (child, auth) => inTrip('put', `/family/${seg(child)}/auth`, { ...auth, pickup: auth.pickup }),
    checkIn: (child) => inTrip('post', `/family/${seg(child)}/check-in`),
    checkOut: (child) => inTrip('post', `/family/${seg(child)}/check-out`),
    setReunion: (plan) => inTrip('put', '/family/reunion', plan),
  }
  const health: HttpGroups['health'] = {
    view: () => inBooking('/health'),
    report: (input) => inTrip('post', '/health/reports', { ...input, guests: input.guests }),
    request: (kind, note) => inTrip('post', '/health/requests', { kind, note }),
  }
  const room: HttpGroups['room'] = {
    view: () => inBooking('/room'),
    setHousekeeping: (patch) => inTrip('patch', '/room/housekeeping', patch),
    setDevices: (patch) => inTrip('patch', '/room/devices', patch),
  }
  const photos: HttpGroups['photos'] = {
    list: () => inBooking('/photos'),
    toggleFavourite: (photoId) => inTrip('put', `/photos/${seg(photoId)}/favourite`),
    quote: (photoIds) => inTrip('post', '/photos/quote', { photoIds }),
    buy: (photoIds, option) => inTrip('post', '/photos/purchases', { photoIds, option }),
    download: (receiptId) => inTrip('post', `/photos/purchases/${seg(receiptId)}/download`),
  }
  const laundry: HttpGroups['laundry'] = {
    view: () => inBooking('/laundry'),
    request: (input) => inTrip('post', '/laundry', input),
    cancel: (id) => inTrip('delete', `/laundry/${seg(id)}`),
  }
  const wifi: HttpGroups['wifi'] = {
    view: () => inBooking('/wifi'),
    add: (input) => inTrip('post', '/wifi/devices', input),
    upgrade: (id, plan) => inTrip('put', `/wifi/devices/${seg(id)}`, { plan }),
    remove: (id) => inTrip('delete', `/wifi/devices/${seg(id)}`),
  }
  const updates: HttpGroups['updates'] = {
    list: () => inBooking('/updates'),
    acknowledge: (id, option) => inTrip('post', `/updates/${seg(id)}/ack`, { option }),
  }
  const service: HttpGroups['service'] = {
    channels: () => inBooking('/service/channels'),
    thread: (channel) => inBooking(`/service/${seg(channel)}`),
    send: (channel, text) => inTrip('post', `/service/${seg(channel)}`, { text }),
    escalate: (channel, phone) => inTrip('post', `/service/${seg(channel)}/escalate`, { phone }),
  }
  const messages: HttpGroups['messages'] = {
    list: () => get('/me/chat/messages'),
    send: (text) => send('post', '/me/chat/messages', { text }),
    receipts: () => get('/me/chat/receipts'),
    setReceipts: (on) => send('put', '/me/chat/receipts', { on }),
    markSeen: async () => { await http.post('/me/chat/seen') },
  }
  const aboard: HttpGroups['aboard'] = {
    selections: {
      list: () => inBooking('/selections'),
      add: (s) => inTrip('post', '/selections', s),
      remove: (id) => inTrip('delete', `/selections/${seg(id)}`),
    },
    requests: {
      list: () => inBooking('/requests'),
      create: (item, qty, note) => inTrip('post', '/requests', { item, qty, note }),
      cancel: (id) => inTrip('delete', `/requests/${seg(id)}`),
    },
    reports: {
      list: () => inBooking('/safety-reports'),
      create: (input) => inTrip('post', '/safety-reports', input),
    },
    drinks: {
      view: () => inBooking('/drinks'),
      log: (drinkId) => inTrip('post', '/drinks', { drinkId }),
      undo: (id) => inTrip('delete', `/drinks/${seg(id)}`),
    },
    money: {
      view: () => inBooking('/money'),
      topUp: (dollars, source) => inTrip('post', '/money/top-ups', { dollars, source }),
      setPin: (next, current) => inTrip('put', '/money/pin', { next, current }),
      forgotPin: () => inTrip('post', '/money/forgot-pin'),
      gratuity: (choice, reason) => inTrip('put', '/money/gratuity', { choice, reason }),
      setCurrency: (code) => inTrip('put', '/money/currency', { code }),
    },
    parties: {
      list: () => inBooking('/parties'),
      create: (input) => inTrip('post', '/parties', input),
      cancel: (id) => inTrip('delete', `/parties/${seg(id)}`),
    },
    groups: {
      get: (reservationId) => inBooking(`/dining/reservations/${seg(reservationId)}/group`),
      // The seats taken are the guests on the reservation, so the party size is not sent.
      addFriend: (reservationId, friend) => inTrip('post', `/dining/reservations/${seg(reservationId)}/group/friends`, friend),
      removeFriend: (reservationId, index) => inTrip('delete', `/dining/reservations/${seg(reservationId)}/group/friends/${index}`),
      setSplit: (reservationId, split) => inTrip('put', `/dining/reservations/${seg(reservationId)}/group/split`, { split }),
    },
    games: {
      get: () => inBooking('/games'),
      find: (clueId, on) => inTrip('put', `/games/clues/${seg(clueId)}`, { on }),
      answer: (questionId, option) => inTrip('put', `/games/trivia/${seg(questionId)}`, { option }),
      mark: (n, on) => inTrip('put', `/games/bingo/${n}`, { on }),
    },
    tv: {
      get: () => inBooking('/tv'),
      set: (patch) => inTrip('patch', '/tv', patch),
    },
    lastMinute: {
      list: () => inBooking('/last-minute'),
      book: (excursionId, guests) => inTrip('post', `/last-minute/${seg(excursionId)}`, { guests: guests }),
    },
    ready: {
      get: () => inBooking('/ready'),
      set: (id, on) => inTrip('put', `/ready/${seg(id)}`, { on }),
    },
    chat: {
      blocked: () => get('/me/chat/blocks'),
      block: (id, on) => send('put', `/me/chat/blocks/${seg(id)}`, { on }),
      report: async (messageId, reason) => { await http.post('/me/chat/reports', { messageId, reason }) },
      sendPhoto: async (input) => { await http.post('/me/chat/photos', input) },
    },
  }
  const groups: HttpGroups = {
    onboard,
    ports: { today: () => inBooking('/onboard/port') },
    folio: { entitlements: () => inBooking('/entitlements') },
    service,
    orders,
    messages,
    family,
    health,
    room,
    photos,
    laundry,
    wifi,
    updates,
    aboard,
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
      profile: (id) => get(`/users/${seg(id)}/profile`),
      saveProfile: (id, profile) => send('put', `/users/${seg(id)}/profile`, profile),
      helper: () => get('/me/helper'),
      saveHelper: (input) => send('put', '/me/helper', input),
      revokeHelper: () => send('delete', '/me/helper'),
      history: () => get('/me/history'),
      activity: (q) => get(`/me/audit${activityQuery(q)}`),
      exportData: () => get('/me/export'),
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
        const path = `/users/${seg(guest)}/documents/${seg(doc)}?booking=${seg(await number())}`
        return held === null ? send('delete', path) : send('put', path, { expires: held.expires })
      },
    },
    push: {
      status: (endpoint) => get(`/me/push${endpoint ? `?endpoint=${seg(endpoint)}` : ''}`),
      subscribe: (input) => send('put', '/me/push/subscription', { endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, budget: input.budget, calm: input.calm, watch: input.watch }),
      unsubscribe: (endpoint) => send('post', '/me/push/unsubscribe', { endpoint }),
      dispatch: (endpoint) => send('post', `/me/push/dispatch${endpoint ? `?endpoint=${seg(endpoint)}` : ''}`),
      markRead: () => send('post', '/me/push/read'),
    },
    calendar: {
      status: () => get('/me/calendar-feed'),
      create: () => send('post', '/me/calendar-feed'),
      revoke: () => send('delete', '/me/calendar-feed'),
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
      save: async (budget) => send('put', `/bookings/${seg(await number())}/budget`, { ...budget, kids: budget.kids }),
    },
    privacy: {
      view: () => inBooking('/privacy'),
      setConsent: async (person, consent, on) => send('put', `/users/${seg(person)}/consents/${seg(consent)}?booking=${seg(await number())}`, { on }),
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
      thanks: {
        get: () => inBooking('/thanks'),
        add: (team, text) => inTrip('post', '/thanks', { team, text }),
      },
      wishes: {
        get: () => inBooking('/celebrations/wishes'),
        add: (celebrationId, text) => inTrip('post', `/celebrations/${seg(celebrationId)}/wishes`, { text }),
      },
      celebrations: {
        get: () => inBooking('/celebrations'),
        save: (items) => inTrip('put', '/celebrations', { items: items.map((i) => ({ id: i.id, label: i.label, date: i.date, surprise: i.surprise })) }),
      },
      excursions: {
        list: () => inBooking('/excursions'),
        addToCart: (id, guests) => inTrip('put', `/excursions/cart/${seg(id)}`, { guests: guests }),
        removeFromCart: (id) => inTrip('delete', `/excursions/cart/${seg(id)}`),
        checkout: (parts, challenge) => inTrip('post', '/excursions/checkout', { parts, challenge }),
        changeGuests: (id, guests) => inTrip('put', `/excursions/bookings/${seg(id)}`, { guests: guests }),
        cancel: (id) => inTrip('delete', `/excursions/bookings/${seg(id)}`),
      },
      dining: {
        view: () => inBooking('/dining'),
        slots: (venueId, day) => inBooking(`/dining/slots?venue=${seg(venueId)}&day=${day}`),
        reserve: (input) => inTrip('post', '/dining/reservations', { ...input, guests: input.guests }),
        cancel: (id) => inTrip('delete', `/dining/reservations/${seg(id)}`),
        move: (id, to) => inTrip('post', `/dining/reservations/${seg(id)}/move`, to),
        late: (id, minutes) => inTrip('post', `/dining/reservations/${seg(id)}/late`, { minutes }),
      },
      packages: {
        view: () => inBooking('/packages'),
        buy: (input, parts, challenge) => inTrip('post', '/packages/purchases', { ...input, guests: input.guests, parts, challenge }),
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
        request: (input) => inTrip('post', '/assistance', { ...input, guest: input.guest }),
        cancel: (id) => inTrip('delete', `/assistance/${seg(id)}`),
      },
    },
    waits: {
      list: () => inBooking('/waits'),
      joinQueue: (venueId) => inTrip('post', '/waits/queue', { venueId }),
      leaveQueue: (id) => inTrip('delete', `/waits/queue/${seg(id)}`),
      joinWaitlist: (input) => inTrip('post', '/waits/waitlist', { ...input, guests: input.guests }),
      leaveWaitlist: (id) => inTrip('delete', `/waits/waitlist/${seg(id)}`),
      acceptWaitlist: (id) => inTrip('post', `/waits/waitlist/${seg(id)}/accept`),
    },
    shows: {
      day: (day) => inBooking(`/shows?day=${day}`),
      mine: () => inBooking('/shows/tickets'),
      reserve: (eventId, day, guests) => inTrip('post', '/shows/tickets', { eventId, day, guests: guests }),
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
        save: ({ childId, ...registration }) => inTrip('put', `/clubs/${seg(childId)}`, registration),
        withdraw: (childId) => inTrip('delete', `/clubs/${seg(childId)}`),
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
    disembark: {
      view: () => inBooking('/disembark'),
      choose: ({ option, bags }) =>
        inTrip('put', '/disembark/choice', { option, bags: Object.fromEntries(Object.entries(bags).map(([guest, n]) => [guest, n])) }),
      setTagsOn: (on) => inTrip('put', '/disembark/tags', { on }),
      customs: () => inBooking('/disembark/customs'),
      saveCustoms: (d) => inTrip('put', '/disembark/customs', d),
      onward: () => inBooking('/disembark/onward'),
      saveOnward: (plan) => inTrip('put', '/disembark/onward', plan),
      night: () => inBooking('/disembark/night'),
      tick: (id, done) => inTrip('put', `/disembark/night/${seg(id)}`, { done }),
      finalBill: () => inBooking('/disembark/final-bill'),
      adjustTip: (keepPercent) => inTrip('put', '/disembark/final-bill/tip', { keepPercent }),
      emailReceipt: () => inTrip('post', '/disembark/final-bill/email'),
    },
    cases: {
      list: () => inBooking('/cases'),
      open: (input) => inTrip('post', '/cases', input),
      withdraw: (id) => inTrip('delete', `/cases/${seg(id)}`),
    },
    post: {
      history: () => inBooking('/history'),
      feedback: () => inBooking('/post-feedback'),
      saveFeedback: (f) => inTrip('put', '/post-feedback', f),
      loyalty: () => get('/me/loyalty-summary'),
      rebook: () => inBooking('/rebook'),
      hold: (departureId) => inTrip('post', '/rebook/holds', { departureId }),
      releaseHold: (id) => inTrip('delete', `/rebook/holds/${seg(id)}`),
      convertFcc: () => inTrip('post', '/rebook/convert-fcc'),
      bookSlot: (at) => inTrip('post', '/rebook/appointment', { at }),
      cancelSlot: () => inTrip('delete', '/rebook/appointment'),
    },
  }
  return { groups, reset: () => { current = null } }
}

/** The `Api` the screens use: the REST groups, joined. */
export function toApi(g: HttpGroups): Api {
  return {
    auth: g.auth,
    bookings: g.bookings,
    account: g.account,
    trips: g.trips,
    payments: g.payments,
    documents: g.documents,
    notifications: g.notifications,
    push: g.push,
    calendar: g.calendar,
    support: g.support,
    help: g.help,
    budget: g.budget,
    privacy: g.privacy,
    aboard: { ...g.aboard, feedback: g.feedback },
    discover: { ...g.favourites, ...g.discover },
    booking: g.booking,
    plan: g.plan,
    waits: g.waits,
    shows: g.shows,
    ahead: g.ahead,
    checkin: g.checkin,
    boarding: g.boarding,
    onboard: g.onboard,
    ports: g.ports,
    folio: g.folio,
    service: g.service,
    orders: g.orders,
    messages: g.messages,
    family: g.family,
    health: g.health,
    room: g.room,
    photos: g.photos,
    laundry: g.laundry,
    wifi: g.wifi,
    updates: g.updates,
    disembark: g.disembark,
    cases: g.cases,
    post: g.post,
  }
}
