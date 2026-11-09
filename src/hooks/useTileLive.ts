import { api } from '../runtime'
import { casesFact, draftFact, loyaltyFact, medallionFact, statusFact, unreadFact, allAboardFact, assistanceFact, billFact, checkinFact, clubsFact, diningFact, excursionsFact, familyFact, laundryFact, musterFact, ordersFact, wifiFact, localDate, packagesFact, paymentFact, sourcesFor, tileLines, tonightsDinner, type TileLine } from '../domain/tileLive'
import { daysBetween } from '../domain/trip'
import { dateIn } from '../domain/timezones'
import { sailingById } from '../domain/sailings'
import { t, type StringKey } from '../i18n'
import { useSharedMine } from './useSharedMine'
import { useNow } from './useDemo'
import { useOnboardToday } from './useOnboardToday'
import { useShipDay } from './useShipDay'
import { DIRECTORY, openAt } from '../domain/menus'

/** Live lines for the tiles of a screen, by screen path. Loads only what the listed paths need (calls shared with other screens on the page); a failed or slow load just leaves the tile plain. */
export function useTileLive(paths: readonly string[], enabled: boolean): Record<string, TileLine> {
  const needs = enabled ? sourcesFor(paths) : new Set<never>()
  const wantChecklist = needs.has('checklist')
  const wantPacking = needs.has('packing')
  const wantPlan = needs.has('plan')
  const wantTrips = needs.has('trips')
  const wantVenues = needs.has('venues')
  const wantExcursions = needs.has('excursions')
  const wantDining = needs.has('dining')
  const wantPackages = needs.has('packages')
  const wantAssistance = needs.has('assistance')
  const wantToday = needs.has('today')
  const wantFolio = needs.has('folio')
  const wantOrders = needs.has('orders')
  const wantLaundry = needs.has('laundry')
  const wantWifi = needs.has('wifi')
  const wantFamily = needs.has('family')
  const wantClubs = needs.has('clubs')
  const wantPush = needs.has('push')
  const wantCases = needs.has('cases')
  const wantLoyalty = needs.has('loyalty')
  const wantOffers = needs.has('offers')
  const wantDraft = needs.has('draft')
  const wantMedallion = needs.has('medallion')
  const wantStatus = needs.has('status')
  const checklist = useSharedMine('plan.checklist', () => api.plan.checklist.get(), wantChecklist)
  const packing = useSharedMine('plan.packing', () => api.plan.packing.get(), wantPacking)
  const plan = useSharedMine('plan.overview', () => api.plan.overview(), wantPlan)
  const trips = useSharedMine('trips.list', () => api.trips.list(), wantTrips)
  const excursions = useSharedMine('plan.excursions', () => api.plan.excursions.list(), wantExcursions)
  const dining = useSharedMine('plan.dining', () => api.plan.dining.view(), wantDining)
  const packages = useSharedMine('plan.packages', () => api.plan.packages.view(), wantPackages)
  const assistance = useSharedMine('plan.assistance', () => api.plan.assistance.get(), wantAssistance)
  const today = useOnboardToday(wantToday)
  const folio = useSharedMine('onboard.folio', () => api.onboard.folio(), wantFolio)
  const orders = useSharedMine('orders.list', () => api.orders.list(), wantOrders)
  const laundry = useSharedMine('laundry.view', () => api.laundry.view(), wantLaundry)
  const wifi = useSharedMine('wifi.view', () => api.wifi.view(), wantWifi)
  const family = useSharedMine('family.view', () => api.family.view(), wantFamily)
  const clubs = useSharedMine('ahead.clubs', () => api.ahead.clubs.view(), wantClubs)
  const push = useSharedMine('push.status', () => api.push.status(), wantPush)
  const cases = useSharedMine('cases.list', () => api.cases.list(), wantCases)
  const loyalty = useSharedMine('ahead.perks', () => api.ahead.perks.mine(), wantLoyalty)
  const offers = useSharedMine('discover.offers', () => api.discover.offers(), wantOffers)
  const draft = useSharedMine('booking.draft', () => api.booking.draft(), wantDraft)
  const medallion = useSharedMine('ahead.medallion', () => api.ahead.medallion.view(), wantMedallion)
  const status = useSharedMine('help.status', () => api.help.status(), wantStatus)
  const ship = useShipDay()
  const venuesOpen = wantVenues ? DIRECTORY.filter((v) => openAt(v, ship.day, ship.time)).length : null
  const now = useNow()
  const date = localDate(now)
  const c = checklist.data
  const p = packing.data
  const dinners = plan.data ? plan.data.days.reduce((n, d) => n + d.entries.filter((e) => e.kind === 'dinner').length, 0) : null
  const tonight = plan.data ? tonightsDinner(plan.data.days, date) : null
  const trip = trips.data?.upcoming.find((x) => x.kind === 'current') ?? null
  const documents = trip?.documents ?? null
  const payment = paymentFact(trip, trip ? daysBetween(dateIn(now, 'America/New_York'), trip.plan.finalDue) : 0)
  const checkin = checkinFact(trip?.checkin, now)
  const daysToDeparture = trip?.daysToDeparture ?? null
  const exc = excursionsFact(excursions.data)
  const din = diningFact(dining.data)
  const pkg = packagesFact(packages.data)
  const assist = assistanceFact(assistance.data)
  const td = today.data
  const muster = td ? musterFact(td.muster, td.shipZone, now) : null
  const allAboard = allAboardFact(td?.portDay, now)
  // Cheap to word, and the facts are rebuilt each render, so this is not memoised.
  return tileLines({ checklist: c ? c.progress : null, packing: p ? { ticked: p.ticked.length, total: p.items.length } : null, dinners, documents, tonight, venuesOpen, payment, checkin, daysToDeparture, excursions: exc, dining: din, packages: pkg, assistance: assist, muster, allAboard, bill: billFact(folio.data), orders: ordersFact(orders.data, now), laundry: laundryFact(laundry.data), wifi: wifiFact(wifi.data), family: familyFact(family.data), clubs: clubsFact(clubs.data),
    unread: unreadFact(push.data), cases: casesFact(cases.data, now), loyalty: loyaltyFact(loyalty.data, (tier) => t(`me.tier.${tier}` as StringKey)), offers: offers.data ? offers.data.length : null,
    draft: draftFact(draft.data, { departure: draft.data ? sailingById(draft.data.sailingId)?.departure ?? null : null, today: dateIn(now, 'America/New_York') }), medallion: medallionFact(medallion.data), status: statusFact(status.data) }, t)
}
