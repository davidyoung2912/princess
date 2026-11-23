import type { Side } from './placement'

/** One stop on the first-visit tour: a part of the screen (found by its `data-tour` mark), what it is called and what to say about it. */
export interface TourStep {
  /** Stable id, saved on the device once the guest has said Got It!. */
  id: string
  /** The `data-tour` value of the part of the screen to point at. */
  target: string
  /** Which side of the target the card would like to sit on. */
  side: Side
  /** The icon shown beside the title (a key into the tour's icon table). */
  icon: 'nav' | 'search' | 'stanley' | 'help' | 'menu' | 'date' | 'header' | 'tip' | 'chat' | 'today' | 'explorers' | 'weather' | 'navigation' | 'itinerary'
    | 'pin' | 'pass' | 'bill' | 'clock' | 'ship' | 'anchor' | 'waves' | 'pack'
    | 'me' | 'settings' | 'bell' | 'doc' | 'wallet' | 'food' | 'stats' | 'people' | 'wifi' | 'cart' | 'list'
  /** True for a step about one page's own content (found by the same `data-tour` mark) rather than the screen's frame: it shows when the guest reaches that page, and is not counted in "n/total". */
  page?: boolean
}

/**
 * The tour, in the order it is told. Each step's words are `tour.<id>.title` and `tour.<id>.body`. A step whose part of the screen is not
 * showing at this size or on this page is passed over (and shown later if it turns up, such as the tip card on a page that has one).
 */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'date', target: 'date', side: 'bottom', icon: 'date' },
  { id: 'chat', target: 'chat', side: 'bottom', icon: 'chat' },
  { id: 'today', target: 'today', side: 'bottom', icon: 'today' },
  { id: 'explorers', target: 'explorers', side: 'bottom', icon: 'explorers' },
  { id: 'weather', target: 'weather', side: 'bottom', icon: 'weather' },
  { id: 'navigation', target: 'navigation', side: 'bottom', icon: 'navigation' },
  { id: 'itinerary', target: 'itinerary', side: 'bottom', icon: 'itinerary' },
  { id: 'header', target: 'header', side: 'bottom', icon: 'header' },
  { id: 'tip', target: 'tip', side: 'bottom', icon: 'tip' },
  { id: 'nav', target: 'nav', side: 'right', icon: 'nav' },
  { id: 'search', target: 'search', side: 'right', icon: 'search' },
  { id: 'stanley', target: 'stanley', side: 'right', icon: 'stanley' },
  { id: 'help', target: 'help', side: 'right', icon: 'help' },
  { id: 'menu', target: 'menu', side: 'bottom', icon: 'menu' },
  // The steps below are about the content of one page each. They wait until the guest reaches that page, and run top to bottom there.
  { id: 'homeNext', target: 'home-next', side: 'bottom', icon: 'today', page: true },
  { id: 'homeShortcuts', target: 'home-shortcuts', side: 'bottom', icon: 'pin', page: true },
  { id: 'homeTiles', target: 'home-tiles', side: 'top', icon: 'nav', page: true },
  { id: 'meTrip', target: 'me-trip', side: 'bottom', icon: 'header', page: true },
  { id: 'meStats', target: 'me-stats', side: 'top', icon: 'stats', page: true },
  { id: 'chatMore', target: 'chat-more', side: 'top', icon: 'chat', page: true },
  { id: 'planCard', target: 'plan-card', side: 'bottom', icon: 'today', page: true },
  { id: 'pickDate', target: 'pick-date', side: 'bottom', icon: 'date', page: true },
  { id: 'planFirst', target: 'plan-first', side: 'bottom', icon: 'clock', page: true },
  { id: 'planAdd', target: 'plan-add', side: 'top', icon: 'explorers', page: true },
  { id: 'expClock', target: 'exp-clock', side: 'bottom', icon: 'clock', page: true },
  { id: 'expList', target: 'exp-list', side: 'top', icon: 'explorers', page: true },
  { id: 'expPin', target: 'exp-pin', side: 'left', icon: 'pin', page: true },
  { id: 'itinDays', target: 'itin-days', side: 'bottom', icon: 'itinerary', page: true },
  { id: 'wxNow', target: 'wx-now', side: 'bottom', icon: 'weather', page: true },
  { id: 'wxForecast', target: 'wx-forecast', side: 'top', icon: 'weather', page: true },
  { id: 'nautJump', target: 'naut-jump', side: 'bottom', icon: 'waves', page: true },
  { id: 'nautPos', target: 'naut-pos', side: 'top', icon: 'navigation', page: true },
  { id: 'mapSearch', target: 'map-search', side: 'right', icon: 'search', page: true },
  { id: 'mapFilters', target: 'map-filters', side: 'right', icon: 'ship', page: true },
  { id: 'mapDeck', target: 'map-deck', side: 'top', icon: 'ship', page: true },
  { id: 'shipJump', target: 'ship-jump', side: 'bottom', icon: 'ship', page: true },
  { id: 'passList', target: 'pass-list', side: 'bottom', icon: 'pass', page: true },
  { id: 'passKeep', target: 'pass-keep', side: 'top', icon: 'pass', page: true },
  { id: 'portClocks', target: 'clocks', side: 'bottom', icon: 'clock', page: true },
  { id: 'portTender', target: 'port-tender', side: 'top', icon: 'anchor', page: true },
  { id: 'packWeather', target: 'pack-weather', side: 'bottom', icon: 'pack', page: true },
  { id: 'packAdd', target: 'pack-add', side: 'bottom', icon: 'pack', page: true },
  { id: 'billTotal', target: 'bill-total', side: 'bottom', icon: 'bill', page: true },
  { id: 'billLines', target: 'bill-lines', side: 'top', icon: 'bill', page: true },
  { id: 'planList', target: 'plan-list', side: 'bottom', icon: 'today', page: true },
  { id: 'planCheck', target: 'plan-check', side: 'bottom', icon: 'list', page: true },
  { id: 'planDays', target: 'plan-days', side: 'top', icon: 'date', page: true },
  { id: 'checkMilestone', target: 'check-milestone', side: 'bottom', icon: 'list', page: true },
  { id: 'shipList', target: 'ship-list', side: 'bottom', icon: 'ship', page: true },
  { id: 'venuesGrid', target: 'venues-grid', side: 'top', icon: 'food', page: true },
  { id: 'pulseVenues', target: 'pulse-venues', side: 'bottom', icon: 'ship', page: true },
  { id: 'pulseLines', target: 'pulse-lines', side: 'top', icon: 'clock', page: true },
  { id: 'deckFind', target: 'deck-find', side: 'bottom', icon: 'search', page: true },
  { id: 'orderMine', target: 'order-mine', side: 'bottom', icon: 'cart', page: true },
  { id: 'orderCart', target: 'order-cart', side: 'top', icon: 'cart', page: true },
  { id: 'wifiHelp', target: 'wifi-help', side: 'bottom', icon: 'wifi', page: true },
  { id: 'wifiAdd', target: 'wifi-add', side: 'top', icon: 'wifi', page: true },
  { id: 'chatPeople', target: 'chat-people', side: 'bottom', icon: 'people', page: true },
  { id: 'chatRooms', target: 'chat-rooms', side: 'bottom', icon: 'chat', page: true },
  { id: 'chatSearch', target: 'chat-search', side: 'bottom', icon: 'search', page: true },
  { id: 'chatService', target: 'chat-service', side: 'bottom', icon: 'help', page: true },
  { id: 'meList', target: 'me-list', side: 'bottom', icon: 'me', page: true },
  { id: 'meHistory', target: 'me-history', side: 'top', icon: 'clock', page: true },
  { id: 'meSettings', target: 'me-settings-list', side: 'top', icon: 'settings', page: true },
  { id: 'statsHero', target: 'stats-hero', side: 'bottom', icon: 'stats', page: true },
  { id: 'statsJokes', target: 'stats-jokes', side: 'top', icon: 'tip', page: true },
  { id: 'statsJump', target: 'stats-jump', side: 'bottom', icon: 'list', page: true },
  { id: 'notifInbox', target: 'notif-inbox', side: 'bottom', icon: 'bell', page: true },
  { id: 'notifPrefs', target: 'notif-prefs', side: 'top', icon: 'bell', page: true },
  { id: 'docsCheck', target: 'docs-check', side: 'bottom', icon: 'doc', page: true },
  { id: 'docsEntry', target: 'docs-entry', side: 'top', icon: 'doc', page: true },
  { id: 'paySummary', target: 'pay-summary', side: 'bottom', icon: 'wallet', page: true },
  { id: 'payCards', target: 'pay-cards', side: 'top', icon: 'wallet', page: true },
  { id: 'settingsAvatar', target: 'settings-avatar', side: 'bottom', icon: 'me', page: true },
]

/** The steps about the screen's frame, which are counted ("3/14") and can be finished in one go; the page steps are not. */
export const GENERAL_STEPS: readonly TourStep[] = TOUR_STEPS.filter((s) => !s.page)

/** The first step not yet seen whose target can be shown now (`visible` says so), or null when there is none. */
export function nextStep(seen: readonly string[], visible: (target: string) => boolean): TourStep | null {
  return TOUR_STEPS.find((s) => !seen.includes(s.id) && visible(s.target)) ?? null
}
