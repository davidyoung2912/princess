// Generated from docs/stage-experience-plan.md sections 6 and 8 (P2). Edit the data here; the tests in screens.test.ts keep it honest.
import type { StringKey } from '../i18n'
import type { JourneyStage } from './hubs'

/** The content family an ID's letter shows. It does not set the colour; the tab does (plan 5.3). */
export type ScreenFamily = 'H' | 'P' | 'S' | 'C' | 'M' | 'X'

/** One screen of the app. Where it appears, and under which tab, is in {@link STAGE_TABS}, not here. */
export interface ScreenDef {
  id: string
  path: string
  /** Title Case, unique across the app; the text is in the locale files. */
  titleKey: StringKey
  /** One or two sentences that say what the guest can accomplish here; the text is in the locale files. */
  subtextKey: StringKey
  family: ScreenFamily
}

export type TabColour = 'blue' | 'teal' | 'pink' | 'gold' | 'plum'

export interface StageTab {
  /** One word, shown on the tab. */
  label: string
  colour: TabColour
  subtext: string
  /** Screen IDs under the tab, in priority order. A screen may sit under more than one tab; the first tab that lists it is its primary one. */
  screens: readonly string[]
}

export interface StageDef {
  homeSubtext: string
  /** The six tile destinations on Home, in order (empty-state actions are content, not screens). */
  tiles: readonly string[]
  /** The stage tabs between Home and Me: two or three, most important first. */
  tabs: readonly StageTab[]
  me: { subtext: string; screens: readonly string[] }
}

export const SCREEN_LIST: readonly ScreenDef[] = [
  { id: 'H02', path: '/home/quiz', titleKey: 'screen.H02.title', subtextKey: 'screen.H02.subtext', family: 'H' },
  { id: 'H03', path: '/home/advisors', titleKey: 'screen.H03.title', subtextKey: 'screen.H03.subtext', family: 'H' },
  { id: 'H04', path: '/home/concierge', titleKey: 'screen.H04.title', subtextKey: 'screen.H04.subtext', family: 'H' },
  { id: 'H05', path: '/home/ask', titleKey: 'screen.H05.title', subtextKey: 'screen.H05.subtext', family: 'H' },
  { id: 'H06', path: '/home/cruise', titleKey: 'screen.H06.title', subtextKey: 'screen.H06.subtext', family: 'H' },
  { id: 'H07', path: '/home/sailings', titleKey: 'screen.H07.title', subtextKey: 'screen.H07.subtext', family: 'H' },
  { id: 'H08', path: '/home/sailings/:id', titleKey: 'screen.H08.title', subtextKey: 'screen.H08.subtext', family: 'H' },
  { id: 'H09', path: '/home/ports/:id', titleKey: 'screen.H09.title', subtextKey: 'screen.H09.subtext', family: 'H' },
  { id: 'H10', path: '/home/ship', titleKey: 'screen.H10.title', subtextKey: 'screen.H10.subtext', family: 'H' },
  { id: 'H11', path: '/home/saved', titleKey: 'screen.H11.title', subtextKey: 'screen.H11.subtext', family: 'H' },
  { id: 'H12', path: '/home/cruise/cost', titleKey: 'screen.H12.title', subtextKey: 'screen.H12.subtext', family: 'H' },
  { id: 'H13', path: '/home/decide', titleKey: 'screen.H13.title', subtextKey: 'screen.H13.subtext', family: 'H' },
  { id: 'H14', path: '/home/cabins', titleKey: 'screen.H14.title', subtextKey: 'screen.H14.subtext', family: 'H' },
  { id: 'H15', path: '/home/offers', titleKey: 'screen.H15.title', subtextKey: 'screen.H15.subtext', family: 'H' },
  { id: 'H16', path: '/book', titleKey: 'screen.H16.title', subtextKey: 'screen.H16.subtext', family: 'H' },
  { id: 'H17', path: '/book/:id', titleKey: 'screen.H17.title', subtextKey: 'screen.H17.subtext', family: 'H' },
  { id: 'H18', path: '/book/resume/:id', titleKey: 'screen.H18.title', subtextKey: 'screen.H18.subtext', family: 'H' },
  { id: 'H19', path: '/book/pay/:id', titleKey: 'screen.H19.title', subtextKey: 'screen.H19.subtext', family: 'H' },
  { id: 'H20', path: '/book/confirmed/:id', titleKey: 'screen.H20.title', subtextKey: 'screen.H20.subtext', family: 'H' },
  { id: 'H21', path: '/home/updates', titleKey: 'screen.H21.title', subtextKey: 'screen.H21.subtext', family: 'H' },
  { id: 'H22', path: '/home/briefing', titleKey: 'screen.H22.title', subtextKey: 'screen.H22.subtext', family: 'H' },
  { id: 'H23', path: '/home/summary', titleKey: 'screen.H23.title', subtextKey: 'screen.H23.subtext', family: 'H' },
  { id: 'H24', path: '/home/disruption', titleKey: 'screen.H24.title', subtextKey: 'screen.H24.subtext', family: 'H' },
  { id: 'H25', path: '/home/delayed', titleKey: 'screen.H25.title', subtextKey: 'screen.H25.subtext', family: 'H' },
  { id: 'H26', path: '/home/find-pass', titleKey: 'screen.H26.title', subtextKey: 'screen.H26.subtext', family: 'H' },
  { id: 'H27', path: '/home/check-in', titleKey: 'screen.H27.title', subtextKey: 'screen.H27.subtext', family: 'H' },
  { id: 'H28', path: '/home/check-in/:id', titleKey: 'screen.H28.title', subtextKey: 'screen.H28.subtext', family: 'H' },
  { id: 'H29', path: '/home/check-in/receipt', titleKey: 'screen.H29.title', subtextKey: 'screen.H29.subtext', family: 'H' },
  { id: 'H30', path: '/home/check-in/terminal', titleKey: 'screen.H30.title', subtextKey: 'screen.H30.subtext', family: 'H' },
  { id: 'H31', path: '/home/boarding-pass', titleKey: 'screen.H31.title', subtextKey: 'screen.H31.subtext', family: 'H' },
  { id: 'H32', path: '/home/embarkation', titleKey: 'screen.H32.title', subtextKey: 'screen.H32.subtext', family: 'H' },
  { id: 'H33', path: '/home/embarkation/steps', titleKey: 'screen.H33.title', subtextKey: 'screen.H33.subtext', family: 'H' },
  { id: 'H34', path: '/home/embarkation/plan', titleKey: 'screen.H34.title', subtextKey: 'screen.H34.subtext', family: 'H' },
  { id: 'H35', path: '/home/meeting-point', titleKey: 'screen.H35.title', subtextKey: 'screen.H35.subtext', family: 'H' },
  { id: 'H36', path: '/home/medallion', titleKey: 'screen.H36.title', subtextKey: 'screen.H36.subtext', family: 'H' },
  { id: 'H37', path: '/home/luggage', titleKey: 'screen.H37.title', subtextKey: 'screen.H37.subtext', family: 'H' },
  { id: 'H38', path: '/home/clearance', titleKey: 'screen.H38.title', subtextKey: 'screen.H38.subtext', family: 'H' },
  { id: 'H39', path: '/home/disembark', titleKey: 'screen.H39.title', subtextKey: 'screen.H39.subtext', family: 'H' },
  { id: 'H40', path: '/home/disembark/bags', titleKey: 'screen.H40.title', subtextKey: 'screen.H40.subtext', family: 'H' },
  { id: 'H41', path: '/home/disembark/final-night', titleKey: 'screen.H41.title', subtextKey: 'screen.H41.subtext', family: 'H' },
  { id: 'H42', path: '/home/disembark/sweep', titleKey: 'screen.H42.title', subtextKey: 'screen.H42.subtext', family: 'H' },
  { id: 'H43', path: '/home/disembark/customs', titleKey: 'screen.H43.title', subtextKey: 'screen.H43.subtext', family: 'H' },
  { id: 'H44', path: '/home/disembark/flight', titleKey: 'screen.H44.title', subtextKey: 'screen.H44.subtext', family: 'H' },
  { id: 'H45', path: '/home/disembark/onward', titleKey: 'screen.H45.title', subtextKey: 'screen.H45.subtext', family: 'H' },
  { id: 'H46', path: '/home/disembark/ride', titleKey: 'screen.H46.title', subtextKey: 'screen.H46.subtext', family: 'H' },
  { id: 'P01', path: '/plan/checklist', titleKey: 'screen.P01.title', subtextKey: 'screen.P01.subtext', family: 'P' },
  { id: 'P02', path: '/plan/packing', titleKey: 'screen.P02.title', subtextKey: 'screen.P02.subtext', family: 'P' },
  { id: 'P03', path: '/plan/ship-packing', titleKey: 'screen.P03.title', subtextKey: 'screen.P03.subtext', family: 'P' },
  { id: 'P04', path: '/plan/starter', titleKey: 'screen.P04.title', subtextKey: 'screen.P04.subtext', family: 'P' },
  { id: 'P05', path: '/plan/phone', titleKey: 'screen.P05.title', subtextKey: 'screen.P05.subtext', family: 'P' },
  { id: 'P06', path: '/plan/difficulty', titleKey: 'screen.P06.title', subtextKey: 'screen.P06.subtext', family: 'P' },
  { id: 'P07', path: '/plan/health-prep', titleKey: 'screen.P07.title', subtextKey: 'screen.P07.subtext', family: 'P' },
  { id: 'P08', path: '/plan/medical', titleKey: 'screen.P08.title', subtextKey: 'screen.P08.subtext', family: 'P' },
  { id: 'P09', path: '/plan/access', titleKey: 'screen.P09.title', subtextKey: 'screen.P09.subtext', family: 'P' },
  { id: 'P10', path: '/plan/assistance', titleKey: 'screen.P10.title', subtextKey: 'screen.P10.subtext', family: 'P' },
  { id: 'P11', path: '/plan/allergy', titleKey: 'screen.P11.title', subtextKey: 'screen.P11.subtext', family: 'P' },
  { id: 'P12', path: '/plan/readiness', titleKey: 'screen.P12.title', subtextKey: 'screen.P12.subtext', family: 'P' },
  { id: 'P13', path: '/plan/contract', titleKey: 'screen.P13.title', subtextKey: 'screen.P13.subtext', family: 'P' },
  { id: 'P14', path: '/plan/money-plan', titleKey: 'screen.P14.title', subtextKey: 'screen.P14.subtext', family: 'P' },
  { id: 'P15', path: '/plan/split', titleKey: 'screen.P15.title', subtextKey: 'screen.P15.subtext', family: 'P' },
  { id: 'P16', path: '/plan/shares', titleKey: 'screen.P16.title', subtextKey: 'screen.P16.subtext', family: 'P' },
  { id: 'P17', path: '/plan/price-watch', titleKey: 'screen.P17.title', subtextKey: 'screen.P17.subtext', family: 'P' },
  { id: 'P18', path: '/plan/fare-check', titleKey: 'screen.P18.title', subtextKey: 'screen.P18.subtext', family: 'P' },
  { id: 'P19', path: '/plan/guarantee', titleKey: 'screen.P19.title', subtextKey: 'screen.P19.subtext', family: 'P' },
  { id: 'P20', path: '/plan/hold', titleKey: 'screen.P20.title', subtextKey: 'screen.P20.subtext', family: 'P' },
  { id: 'P21', path: '/plan/paste', titleKey: 'screen.P21.title', subtextKey: 'screen.P21.subtext', family: 'P' },
  { id: 'P22', path: '/plan/what-if', titleKey: 'screen.P22.title', subtextKey: 'screen.P22.subtext', family: 'P' },
  { id: 'P23', path: '/plan/prepay', titleKey: 'screen.P23.title', subtextKey: 'screen.P23.subtext', family: 'P' },
  { id: 'P24', path: '/plan/cart', titleKey: 'screen.P24.title', subtextKey: 'screen.P24.subtext', family: 'P' },
  { id: 'P25', path: '/plan/upgrades', titleKey: 'screen.P25.title', subtextKey: 'screen.P25.subtext', family: 'P' },
  { id: 'P26', path: '/plan/ahead', titleKey: 'screen.P26.title', subtextKey: 'screen.P26.subtext', family: 'P' },
  { id: 'P27', path: '/plan/clubs', titleKey: 'screen.P27.title', subtextKey: 'screen.P27.subtext', family: 'P' },
  { id: 'P28', path: '/plan/gifts', titleKey: 'screen.P28.title', subtextKey: 'screen.P28.subtext', family: 'P' },
  { id: 'P29', path: '/plan/travel', titleKey: 'screen.P29.title', subtextKey: 'screen.P29.subtext', family: 'P' },
  { id: 'P30', path: '/plan/getting-there', titleKey: 'screen.P30.title', subtextKey: 'screen.P30.subtext', family: 'P' },
  { id: 'P31', path: '/plan/weather', titleKey: 'screen.P31.title', subtextKey: 'screen.P31.subtext', family: 'P' },
  { id: 'P32', path: '/plan/storm', titleKey: 'screen.P32.title', subtextKey: 'screen.P32.subtext', family: 'P' },
  { id: 'P33', path: '/plan/away', titleKey: 'screen.P33.title', subtextKey: 'screen.P33.subtext', family: 'P' },
  { id: 'P34', path: '/plan/day', titleKey: 'screen.P34.title', subtextKey: 'screen.P34.subtext', family: 'P' },
  { id: 'P35', path: '/plan/reservations', titleKey: 'screen.P35.title', subtextKey: 'screen.P35.subtext', family: 'P' },
  { id: 'P36', path: '/plan/reservations/:id', titleKey: 'screen.P36.title', subtextKey: 'screen.P36.subtext', family: 'P' },
  { id: 'P37', path: '/plan/excursions', titleKey: 'screen.P37.title', subtextKey: 'screen.P37.subtext', family: 'P' },
  { id: 'P38', path: '/plan/dining', titleKey: 'screen.P38.title', subtextKey: 'screen.P38.subtext', family: 'P' },
  { id: 'P39', path: '/plan/autopilot', titleKey: 'screen.P39.title', subtextKey: 'screen.P39.subtext', family: 'P' },
  { id: 'P40', path: '/plan/rhythm', titleKey: 'screen.P40.title', subtextKey: 'screen.P40.subtext', family: 'P' },
  { id: 'P41', path: '/plan/surprises', titleKey: 'screen.P41.title', subtextKey: 'screen.P41.subtext', family: 'P' },
  { id: 'P42', path: '/plan/taste', titleKey: 'screen.P42.title', subtextKey: 'screen.P42.subtext', family: 'P' },
  { id: 'P43', path: '/plan/organiser', titleKey: 'screen.P43.title', subtextKey: 'screen.P43.subtext', family: 'P' },
  { id: 'P44', path: '/plan/compare', titleKey: 'screen.P44.title', subtextKey: 'screen.P44.subtext', family: 'P' },
  { id: 'P45', path: '/plan/traditions', titleKey: 'screen.P45.title', subtextKey: 'screen.P45.subtext', family: 'P' },
  { id: 'P46', path: '/plan/cabins', titleKey: 'screen.P46.title', subtextKey: 'screen.P46.subtext', family: 'P' },
  { id: 'P47', path: '/plan/party', titleKey: 'screen.P47.title', subtextKey: 'screen.P47.subtext', family: 'P' },
  { id: 'P48', path: '/plan/family-link', titleKey: 'screen.P48.title', subtextKey: 'screen.P48.subtext', family: 'P' },
  { id: 'P49', path: '/plan/group-poll', titleKey: 'screen.P49.title', subtextKey: 'screen.P49.subtext', family: 'P' },
  { id: 'P50', path: '/plan/share-links', titleKey: 'screen.P50.title', subtextKey: 'screen.P50.subtext', family: 'P' },
  { id: 'P51', path: '/plan/child-story', titleKey: 'screen.P51.title', subtextKey: 'screen.P51.subtext', family: 'P' },
  { id: 'P52', path: '/plan/child-brief', titleKey: 'screen.P52.title', subtextKey: 'screen.P52.subtext', family: 'P' },
  { id: 'S01', path: '/ship/map', titleKey: 'screen.S01.title', subtextKey: 'screen.S01.subtext', family: 'S' },
  { id: 'S02', path: '/ship/venues', titleKey: 'screen.S02.title', subtextKey: 'screen.S02.subtext', family: 'S' },
  { id: 'S03', path: '/ship/venues/:id', titleKey: 'screen.S03.title', subtextKey: 'screen.S03.subtext', family: 'S' },
  { id: 'S04', path: '/ship/info', titleKey: 'screen.S04.title', subtextKey: 'screen.S04.subtext', family: 'S' },
  { id: 'S05', path: '/ship/search', titleKey: 'screen.S05.title', subtextKey: 'screen.S05.subtext', family: 'S' },
  { id: 'S06', path: '/ship/steps', titleKey: 'screen.S06.title', subtextKey: 'screen.S06.subtext', family: 'S' },
  { id: 'S07', path: '/ship/loungers', titleKey: 'screen.S07.title', subtextKey: 'screen.S07.subtext', family: 'S' },
  { id: 'S08', path: '/ship/sightings', titleKey: 'screen.S08.title', subtextKey: 'screen.S08.subtext', family: 'S' },
  { id: 'S09', path: '/ship/where', titleKey: 'screen.S09.title', subtextKey: 'screen.S09.subtext', family: 'S' },
  { id: 'S10', path: '/ship/sea', titleKey: 'screen.S10.title', subtextKey: 'screen.S10.subtext', family: 'S' },
  { id: 'S11', path: '/ship/along', titleKey: 'screen.S11.title', subtextKey: 'screen.S11.subtext', family: 'S' },
  { id: 'S12', path: '/ship/sky', titleKey: 'screen.S12.title', subtextKey: 'screen.S12.subtext', family: 'S' },
  { id: 'S13', path: '/ship/pulse', titleKey: 'screen.S13.title', subtextKey: 'screen.S13.subtext', family: 'S' },
  { id: 'S14', path: '/ship/ask-ship', titleKey: 'screen.S14.title', subtextKey: 'screen.S14.subtext', family: 'S' },
  { id: 'S15', path: '/ship/order', titleKey: 'screen.S15.title', subtextKey: 'screen.S15.subtext', family: 'S' },
  { id: 'S16', path: '/ship/drinks', titleKey: 'screen.S16.title', subtextKey: 'screen.S16.subtext', family: 'S' },
  { id: 'S17', path: '/ship/shops', titleKey: 'screen.S17.title', subtextKey: 'screen.S17.subtext', family: 'S' },
  { id: 'S18', path: '/ship/spa', titleKey: 'screen.S18.title', subtextKey: 'screen.S18.subtext', family: 'S' },
  { id: 'S19', path: '/ship/dining-prefs', titleKey: 'screen.S19.title', subtextKey: 'screen.S19.subtext', family: 'S' },
  { id: 'S20', path: '/ship/laundry', titleKey: 'screen.S20.title', subtextKey: 'screen.S20.subtext', family: 'S' },
  { id: 'S21', path: '/ship/requests', titleKey: 'screen.S21.title', subtextKey: 'screen.S21.subtext', family: 'S' },
  { id: 'S22', path: '/ship/room', titleKey: 'screen.S22.title', subtextKey: 'screen.S22.subtext', family: 'S' },
  { id: 'S23', path: '/ship/wifi', titleKey: 'screen.S23.title', subtextKey: 'screen.S23.subtext', family: 'S' },
  { id: 'S24', path: '/ship/tv', titleKey: 'screen.S24.title', subtextKey: 'screen.S24.subtext', family: 'S' },
  { id: 'S25', path: '/ship/muster', titleKey: 'screen.S25.title', subtextKey: 'screen.S25.subtext', family: 'S' },
  { id: 'S26', path: '/ship/emergency', titleKey: 'screen.S26.title', subtextKey: 'screen.S26.subtext', family: 'S' },
  { id: 'S27', path: '/ship/help-now', titleKey: 'screen.S27.title', subtextKey: 'screen.S27.subtext', family: 'S' },
  { id: 'S28', path: '/ship/text-help', titleKey: 'screen.S28.title', subtextKey: 'screen.S28.subtext', family: 'S' },
  { id: 'S29', path: '/ship/report', titleKey: 'screen.S29.title', subtextKey: 'screen.S29.subtext', family: 'S' },
  { id: 'S30', path: '/ship/health', titleKey: 'screen.S30.title', subtextKey: 'screen.S30.subtext', family: 'S' },
  { id: 'S31', path: '/ship/seasick', titleKey: 'screen.S31.title', subtextKey: 'screen.S31.subtext', family: 'S' },
  { id: 'S32', path: '/ship/safe-ashore', titleKey: 'screen.S32.title', subtextKey: 'screen.S32.subtext', family: 'S' },
  { id: 'S33', path: '/ship/allergy-chain', titleKey: 'screen.S33.title', subtextKey: 'screen.S33.subtext', family: 'S' },
  { id: 'S34', path: '/ship/lost-found', titleKey: 'screen.S34.title', subtextKey: 'screen.S34.subtext', family: 'S' },
  { id: 'S35', path: '/ship/access', titleKey: 'screen.S35.title', subtextKey: 'screen.S35.subtext', family: 'S' },
  { id: 'S36', path: '/ship/dnd', titleKey: 'screen.S36.title', subtextKey: 'screen.S36.subtext', family: 'S' },
  { id: 'S37', path: '/ship/port', titleKey: 'screen.S37.title', subtextKey: 'screen.S37.subtext', family: 'S' },
  { id: 'S38', path: '/ship/port/guide', titleKey: 'screen.S38.title', subtextKey: 'screen.S38.subtext', family: 'S' },
  { id: 'S39', path: '/ship/port/snapshot', titleKey: 'screen.S39.title', subtextKey: 'screen.S39.subtext', family: 'S' },
  { id: 'C01', path: '/chat', titleKey: 'screen.C01.title', subtextKey: 'screen.C01.subtext', family: 'C' },
  { id: 'S40', path: '/ship/family', titleKey: 'screen.S40.title', subtextKey: 'screen.S40.subtext', family: 'S' },
  { id: 'S41', path: '/ship/kids-report', titleKey: 'screen.S41.title', subtextKey: 'screen.S41.subtext', family: 'S' },
  { id: 'S42', path: '/ship/teen', titleKey: 'screen.S42.title', subtextKey: 'screen.S42.subtext', family: 'S' },
  { id: 'S43', path: '/ship/games', titleKey: 'screen.S43.title', subtextKey: 'screen.S43.subtext', family: 'S' },
  { id: 'S44', path: '/ship/community', titleKey: 'screen.S44.title', subtextKey: 'screen.S44.subtext', family: 'S' },
  { id: 'S45', path: '/ship/solo', titleKey: 'screen.S45.title', subtextKey: 'screen.S45.subtext', family: 'S' },
  { id: 'S46', path: '/ship/ok-tap', titleKey: 'screen.S46.title', subtextKey: 'screen.S46.subtext', family: 'S' },
  { id: 'S47', path: '/ship/you-said', titleKey: 'screen.S47.title', subtextKey: 'screen.S47.subtext', family: 'S' },
  { id: 'S48', path: '/ship/photos', titleKey: 'screen.S48.title', subtextKey: 'screen.S48.subtext', family: 'S' },
  { id: 'S49', path: '/ship/read-aloud', titleKey: 'screen.S49.title', subtextKey: 'screen.S49.subtext', family: 'S' },
  { id: 'M02', path: '/me/trips', titleKey: 'screen.M02.title', subtextKey: 'screen.M02.subtext', family: 'M' },
  { id: 'M03', path: '/me/trips/:id', titleKey: 'screen.M03.title', subtextKey: 'screen.M03.subtext', family: 'M' },
  { id: 'M04', path: '/me/profile', titleKey: 'screen.M04.title', subtextKey: 'screen.M04.subtext', family: 'M' },
  { id: 'M05', path: '/me/profile/:id', titleKey: 'screen.M05.title', subtextKey: 'screen.M05.subtext', family: 'M' },
  { id: 'M06', path: '/me/documents', titleKey: 'screen.M06.title', subtextKey: 'screen.M06.subtext', family: 'M' },
  { id: 'M07', path: '/me/payments', titleKey: 'screen.M07.title', subtextKey: 'screen.M07.subtext', family: 'M' },
  { id: 'M08', path: '/me/packages', titleKey: 'screen.M08.title', subtextKey: 'screen.M08.subtext', family: 'M' },
  { id: 'M09', path: '/me/loyalty', titleKey: 'screen.M09.title', subtextKey: 'screen.M09.subtext', family: 'M' },
  { id: 'M10', path: '/me/bill', titleKey: 'screen.M10.title', subtextKey: 'screen.M10.subtext', family: 'M' },
  { id: 'M11', path: '/me/ledger', titleKey: 'screen.M11.title', subtextKey: 'screen.M11.subtext', family: 'M' },
  { id: 'M12', path: '/me/money', titleKey: 'screen.M12.title', subtextKey: 'screen.M12.subtext', family: 'M' },
  { id: 'M13', path: '/me/bill/final', titleKey: 'screen.M13.title', subtextKey: 'screen.M13.subtext', family: 'M' },
  { id: 'M14', path: '/me/helper', titleKey: 'screen.M14.title', subtextKey: 'screen.M14.subtext', family: 'M' },
  { id: 'M15', path: '/me/history', titleKey: 'screen.M15.title', subtextKey: 'screen.M15.subtext', family: 'M' },
  { id: 'M16', path: '/me/recap', titleKey: 'screen.M16.title', subtextKey: 'screen.M16.subtext', family: 'M' },
  { id: 'M17', path: '/me/memories', titleKey: 'screen.M17.title', subtextKey: 'screen.M17.subtext', family: 'M' },
  { id: 'M18', path: '/me/wrapped', titleKey: 'screen.M18.title', subtextKey: 'screen.M18.subtext', family: 'M' },
  { id: 'M19', path: '/me/feedback', titleKey: 'screen.M19.title', subtextKey: 'screen.M19.subtext', family: 'M' },
  { id: 'M20', path: '/me/farewell', titleKey: 'screen.M20.title', subtextKey: 'screen.M20.subtext', family: 'M' },
  { id: 'M21', path: '/me/follow-up', titleKey: 'screen.M21.title', subtextKey: 'screen.M21.subtext', family: 'M' },
  { id: 'M22', path: '/me/rebook', titleKey: 'screen.M22.title', subtextKey: 'screen.M22.subtext', family: 'M' },
  { id: 'M23', path: '/me/sustainability', titleKey: 'screen.M23.title', subtextKey: 'screen.M23.subtext', family: 'M' },
  { id: 'M24', path: '/me/cases', titleKey: 'screen.M24.title', subtextKey: 'screen.M24.subtext', family: 'M' },
  { id: 'M25', path: '/me/privacy', titleKey: 'screen.M25.title', subtextKey: 'screen.M25.subtext', family: 'M' },
  { id: 'M26', path: '/me/marketing', titleKey: 'screen.M26.title', subtextKey: 'screen.M26.subtext', family: 'M' },
  { id: 'M27', path: '/me/print', titleKey: 'screen.M27.title', subtextKey: 'screen.M27.subtext', family: 'M' },
  { id: 'M28', path: '/me/notifications', titleKey: 'screen.M28.title', subtextKey: 'screen.M28.subtext', family: 'M' },
  { id: 'M29', path: '/me/alerts', titleKey: 'screen.M29.title', subtextKey: 'screen.M29.subtext', family: 'M' },
  { id: 'M30', path: '/me/calm', titleKey: 'screen.M30.title', subtextKey: 'screen.M30.subtext', family: 'M' },
  { id: 'M31', path: '/me/gentle', titleKey: 'screen.M31.title', subtextKey: 'screen.M31.subtext', family: 'M' },
  { id: 'M32', path: '/me/anxiety', titleKey: 'screen.M32.title', subtextKey: 'screen.M32.subtext', family: 'M' },
  { id: 'M33', path: '/me/settings', titleKey: 'screen.M33.title', subtextKey: 'screen.M33.subtext', family: 'M' },
  { id: 'M34', path: '/me/activity', titleKey: 'screen.M34.title', subtextKey: 'screen.M34.subtext', family: 'M' },
  { id: 'M35', path: '/me/help', titleKey: 'screen.M35.title', subtextKey: 'screen.M35.subtext', family: 'M' },
  { id: 'M36', path: '/me/contact', titleKey: 'screen.M36.title', subtextKey: 'screen.M36.subtext', family: 'M' },
  { id: 'M37', path: '/me/fix-it', titleKey: 'screen.M37.title', subtextKey: 'screen.M37.subtext', family: 'M' },
  { id: 'M38', path: '/me/assist', titleKey: 'screen.M38.title', subtextKey: 'screen.M38.subtext', family: 'M' },
  { id: 'M39', path: '/me/status', titleKey: 'screen.M39.title', subtextKey: 'screen.M39.subtext', family: 'M' },
  { id: 'M40', path: '/me/report-problem', titleKey: 'screen.M40.title', subtextKey: 'screen.M40.subtext', family: 'M' },
  { id: 'M41', path: '/me/demo', titleKey: 'screen.M41.title', subtextKey: 'screen.M41.subtext', family: 'M' },
  { id: 'X01', path: '/kit', titleKey: 'screen.X01.title', subtextKey: 'screen.X01.subtext', family: 'X' },
  { id: 'X02', path: '/trial-day', titleKey: 'screen.X02.title', subtextKey: 'screen.X02.subtext', family: 'X' },
  { id: 'X03', path: '/at-sea/:token', titleKey: 'screen.X03.title', subtextKey: 'screen.X03.subtext', family: 'X' },
  { id: 'X04', path: '/shared/:token', titleKey: 'screen.X04.title', subtextKey: 'screen.X04.subtext', family: 'X' },
]

/** Settings and help: the same group under Me at every stage, and always plum. */
export const SETTINGS_AND_HELP: readonly string[] = ['M04', 'M33', 'M28', 'M25', 'M26', 'M35', 'M36', 'M30', 'M31', 'M32', 'M29', 'M27', 'M34', 'M37', 'M38', 'M39', 'M40', 'M41']

/** The four tab front pages, which become the tab landing pages (plan section 7). */
export const TAB_FRONT_PATHS: readonly string[] = ['/', '/plan', '/ship', '/chat', '/me']

export const STAGE_TABS: Record<JourneyStage, StageDef> = {
  dream: {
    homeSubtext: 'Let\'s find a cruise you\'ll love. Start with the quiz.',
    tiles: ['H02', 'H13', 'H07', 'H04', 'P49', 'H11'],
    tabs: [
      { label: 'Explore', colour: 'teal', subtext: 'Browse the cruise, the sailings and the ports.', screens: ['H06', 'H07', 'H08', 'H09', 'H11', 'P04', 'X02'] },
      { label: 'Ask', colour: 'pink', subtext: 'Get answers and advice before you decide.', screens: ['H04', 'H03', 'H02', 'H13', 'P21', 'P49', 'P50'] },
    ],
    me: { subtext: 'Your details and the sailings you have saved.', screens: ['H11', ...SETTINGS_AND_HELP] },
  },
  discover: {
    homeSubtext: 'Your sailing, its real cost and your room, in one place.',
    tiles: ['H08', 'H12', 'H14', 'H10', 'H11', 'H03'],
    tabs: [
      { label: 'Sailing', colour: 'teal', subtext: 'Everything about the sailing you are considering.', screens: ['H08', 'H07', 'H09', 'H06', 'H10', 'S01', 'S02', 'S03', 'H13', 'X02'] },
      { label: 'Cabin', colour: 'pink', subtext: 'Pick the room that suits you.', screens: ['H14', 'P19', 'H13'] },
      { label: 'Cost', colour: 'gold', subtext: 'The real, all-in price, and ways to pay less.', screens: ['H12', 'H15', 'P17', 'P18', 'H16', 'H03', 'H04'] },
    ],
    me: { subtext: 'Your saved sailings, price watches and details.', screens: ['H11', 'P17', ...SETTINGS_AND_HELP] },
  },
  book: {
    homeSubtext: 'Finish booking. Nothing is lost if you stop.',
    tiles: ['H18', 'H17', 'P47', 'P15', 'P22', 'P13'],
    tabs: [
      { label: 'Booking', colour: 'teal', subtext: 'Your booking, from price to confirmation.', screens: ['H16', 'H17', 'H18', 'H20', 'P13', 'P22', 'P20', 'P19', 'H08', 'H12', 'H14', 'H15', 'H10'] },
      { label: 'Travellers', colour: 'pink', subtext: 'Who is going, and what each person needs.', screens: ['P47', 'M05', 'P09', 'P10', 'P11', 'P46'] },
      { label: 'Pay', colour: 'gold', subtext: 'Deposit, balance and sharing the cost.', screens: ['H19', 'P14', 'P15', 'P16', 'M07'] },
    ],
    me: { subtext: 'Your draft, payments and travellers\' details.', screens: ['M02', 'M07', 'P13', ...SETTINGS_AND_HELP] },
  },
  manage: {
    homeSubtext: 'Your booking is confirmed. Here is what needs you next.',
    tiles: ['P14', 'M06', 'P12', 'H21', 'H10', 'P09'],
    tabs: [
      { label: 'Trip', colour: 'teal', subtext: 'Your confirmed trip, and what changes.', screens: ['M02', 'M03', 'H20', 'H21', 'H23', 'H05', 'H08', 'H09', 'H10', 'S01', 'S02', 'S03', 'P01', 'P13', 'P14'] },
      { label: 'Needs', colour: 'pink', subtext: 'Documents, health and access for every traveller.', screens: ['M06', 'M05', 'P12', 'P08', 'P09', 'P10', 'P11', 'P07', 'H38'] },
      { label: 'Group', colour: 'gold', subtext: 'Your travel party and the people at home.', screens: ['C01', 'P47', 'P48', 'P49', 'P50', 'P43', 'P46', 'P51', 'P52', 'M14'] },
    ],
    me: { subtext: 'Payments, documents and what is due.', screens: ['M02', 'M03', 'M06', 'M07', 'M09', 'P13', 'P14', 'P12', 'P15', 'P16', 'P17', 'P18', 'M14', ...SETTINGS_AND_HELP] },
  },
  prebook: {
    homeSubtext: 'Shape your days before you sail.',
    tiles: ['P37', 'P38', 'M08', 'P02', 'P01', 'P47'],
    tabs: [
      { label: 'Plan', colour: 'teal', subtext: 'Book excursions and dining and shape your days.', screens: ['P37', 'P38', 'P35', 'P36', 'P26', 'P27', 'P24', 'P23', 'P25', 'P28', 'P34', 'P39', 'P40', 'P41', 'P42', 'P44', 'P45', 'P06', 'S18', 'S19', 'S38', 'H09'] },
      { label: 'Prepare', colour: 'pink', subtext: 'Pack, travel and sort things at home.', screens: ['P01', 'P02', 'P03', 'P05', 'P07', 'P29', 'P31', 'P33', 'H38', 'H24'] },
      { label: 'Group', colour: 'gold', subtext: 'Your travel party and the people at home.', screens: ['C01', 'P47', 'P48', 'P49', 'P50', 'P43', 'P46', 'P51', 'P52', 'M14'] },
    ],
    me: { subtext: 'Payments, documents, packages and rewards.', screens: ['M02', 'M03', 'M06', 'M07', 'M08', 'M09', 'P13', 'P14', 'P12', 'P15', 'P16', 'P17', 'P18', 'M14', ...SETTINGS_AND_HELP] },
  },
  getToShip: {
    homeSubtext: 'Get to the ship with time to spare.',
    tiles: ['H31', 'H27', 'P30', 'M06', 'H25', 'S26'],
    tabs: [
      { label: 'Board', colour: 'gold', subtext: 'Check-in, your pass and getting aboard.', screens: ['H27', 'H28', 'H29', 'H30', 'H31', 'H26', 'H32', 'H34', 'H36', 'H37', 'S26'] },
      { label: 'Travel', colour: 'pink', subtext: 'Getting to the ship, on time, and what to do if plans change.', screens: ['P29', 'P30', 'P31', 'P32', 'H24', 'H25', 'H38', 'P22', 'P33'] },
      { label: 'Plan', colour: 'teal', subtext: 'Book excursions and dining and shape your days.', screens: ['P01', 'P02', 'P03', 'P05', 'P07', 'P35', 'P36', 'P37', 'P38', 'P26', 'P24', 'P23', 'P25', 'P47', 'P48', 'C01'] },
    ],
    me: { subtext: 'Your documents and anything still to settle.', screens: ['M02', 'M03', 'M06', 'M07', 'M08', 'P13', 'P12', 'M14', ...SETTINGS_AND_HELP] },
  },
  embark: {
    homeSubtext: 'Welcome aboard. One step at a time.',
    tiles: ['H33', 'H35', 'S25', 'S01', 'S23', 'S27'],
    tabs: [
      { label: 'Board', colour: 'gold', subtext: 'Check-in, your pass and getting aboard.', screens: ['H32', 'H33', 'H34', 'H35', 'H31', 'H36', 'H37', 'H29', 'H26', 'H24', 'H25', 'S40', 'C01', 'S25', 'S26'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S03', 'S04', 'S05', 'S14', 'S15', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31', 'S33', 'S34', 'S35', 'S36'] },
      { label: 'Plan', colour: 'teal', subtext: 'Book excursions and dining and shape your days.', screens: ['P35', 'P36', 'P37', 'P38', 'P34', 'P26'] },
    ],
    me: { subtext: 'Your account on board: bill, top-up and help.', screens: ['M10', 'M12', 'M11', 'M08', 'M02', 'M06', ...SETTINGS_AND_HELP] },
  },
  sea: {
    homeSubtext: 'Today on board, and what is next.',
    tiles: ['H22', 'P38', 'P34', 'S40', 'S01', 'M11'],
    tabs: [
      { label: 'Today', colour: 'teal', subtext: 'Your day on board: events, meals and what is next.', screens: ['H22', 'P34', 'P35', 'P36', 'P37', 'P38', 'P39', 'P40', 'P41', 'P42', 'P26', 'S04', 'H24', 'H25', 'H39', 'H40', 'H41', 'H44', 'H45'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31', 'S33', 'S34', 'S35', 'S36'] },
      { label: 'People', colour: 'gold', subtext: 'Your family, your group and the community.', screens: ['C01', 'S40', 'S41', 'S42', 'S43', 'S44', 'S45', 'S46', 'S47', 'S48', 'S49', 'P27', 'P47', 'P43', 'P45'] },
    ],
    me: { subtext: 'Your bill, your spending and anything to sort out.', screens: ['M10', 'M11', 'M12', 'M08', 'M24', 'M02', 'M06', ...SETTINGS_AND_HELP] },
  },
  port: {
    homeSubtext: 'Your day ashore, and when to be back.',
    tiles: ['S37', 'S38', 'P37', 'S32', 'P31', 'S40'],
    tabs: [
      { label: 'Port', colour: 'teal', subtext: 'Your day ashore, with the all-aboard time.', screens: ['S37', 'S38', 'S39', 'H09', 'P37', 'P44', 'S32', 'P31', 'H38', 'S33', 'S45', 'S46', 'H25', 'H22', 'P34', 'P35'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31', 'S33', 'S34', 'S35', 'S36'] },
      { label: 'People', colour: 'gold', subtext: 'Your family, your group and the community.', screens: ['C01', 'S40', 'S41', 'S42', 'S43', 'S44', 'S45', 'S46', 'S47', 'S48', 'S49', 'P27', 'P47', 'P43', 'P45'] },
    ],
    me: { subtext: 'Your bill, your spending and anything to sort out.', screens: ['M10', 'M11', 'M12', 'M08', 'M24', 'M02', 'M06', ...SETTINGS_AND_HELP] },
  },
  disembark: {
    homeSubtext: 'Getting home: your exit, your bags and your bill.',
    tiles: ['H39', 'H40', 'M13', 'H43', 'H42', 'H45'],
    tabs: [
      { label: 'Leave', colour: 'teal', subtext: 'Everything for leaving the ship.', screens: ['H39', 'H40', 'H41', 'H42', 'H43', 'H44', 'H45', 'H46', 'M13', 'M10', 'S34'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S15', 'S21', 'S23', 'S26', 'S27', 'S28', 'S30', 'S34'] },
      { label: 'People', colour: 'gold', subtext: 'Your family, your group and the community.', screens: ['C01', 'S40', 'S47', 'S48'] },
    ],
    me: { subtext: 'Your final bill, your receipts and goodbye.', screens: ['M13', 'M10', 'M11', 'M12', 'M20', 'M24', 'M19', 'M02', ...SETTINGS_AND_HELP] },
  },
  remember: {
    homeSubtext: 'Your trip, and where to next.',
    tiles: ['M16', 'M17', 'M19', 'M09', 'M15', 'M22'],
    tabs: [
      { label: 'Memories', colour: 'teal', subtext: 'Your trip, kept.', screens: ['M16', 'M17', 'M18', 'S48', 'S47', 'M15'] },
      { label: 'Next', colour: 'pink', subtext: 'Where to next.', screens: ['M22', 'H06', 'H07', 'H08', 'H09', 'H11', 'H02', 'H13', 'H04', 'P28', 'P04', 'M09'] },
      { label: 'Feedback', colour: 'gold', subtext: 'Tell us how it went.', screens: ['M19', 'M21', 'M20', 'M23', 'M24'] },
    ],
    me: { subtext: 'Your history, receipts, rewards and settings.', screens: ['M15', 'M13', 'M09', 'M06', 'M02', 'M03', 'P13', 'H20', ...SETTINGS_AND_HELP] },
  },
}

export const SCREEN_BY_ID: ReadonlyMap<string, ScreenDef> = new Map(SCREEN_LIST.map((s) => [s.id, s]))
const BY_PATH: ReadonlyMap<string, ScreenDef> = new Map(SCREEN_LIST.map((s) => [s.path, s]))

/** The registry entry for a route pattern; undefined for a tab front page. */
export const screenForPath = (path: string): ScreenDef | undefined => BY_PATH.get(path)

/** Where a screen sits in a stage: Home (a tile), one or more stage tabs, or Me. */
export interface Placement {
  /** Label of each stage tab that lists the screen, in tab order; the first is the primary one. */
  tabs: string[]
  inMe: boolean
  isTile: boolean
}

export function placementIn(id: string, stage: JourneyStage): Placement {
  const def = STAGE_TABS[stage]
  return {
    tabs: def.tabs.filter((t) => t.screens.includes(id)).map((t) => t.label),
    inMe: def.me.screens.includes(id),
    isTile: def.tiles.includes(id),
  }
}

/** The IDs of every screen a stage uses (under a tab or Me, or a Home tile), without repeats. */
export function screensOfStage(stage: JourneyStage): string[] {
  const def = STAGE_TABS[stage]
  return [...new Set([...def.tiles, ...def.tabs.flatMap((t) => t.screens), ...def.me.screens])]
}

/**
 * The tab a screen wears at a stage when the guest did not open it from a tab: the first stage tab that lists it, otherwise Me
 * if Me lists it, otherwise Home. Null when the stage does not use the screen. Settings and help are always Me.
 */
export function primaryTab(id: string, stage: JourneyStage): { label: string; colour: TabColour } | null {
  const def = STAGE_TABS[stage]
  if (SETTINGS_AND_HELP.includes(id)) return { label: 'Me', colour: 'plum' }
  const tab = def.tabs.find((t) => t.screens.includes(id))
  if (tab) return { label: tab.label, colour: tab.colour }
  if (def.me.screens.includes(id)) return { label: 'Me', colour: 'plum' }
  if (def.tiles.includes(id)) return { label: 'Home', colour: 'blue' }
  return null
}

/** Whether a stage shows a screen at all. A screen a stage does not use is hidden: not in a tab, on Home or in search. */
export const stageUses = (id: string, stage: JourneyStage): boolean => primaryTab(id, stage) !== null

/** The colours under which a stage lists a screen: every stage tab that lists it, Me (plum) if Me or Settings lists it, Home (blue) if it is a tile. */
export function coloursFor(id: string, stage: JourneyStage): TabColour[] {
  const def = STAGE_TABS[stage]
  const out: TabColour[] = def.tabs.filter((t) => t.screens.includes(id)).map((t) => t.colour)
  if (SETTINGS_AND_HELP.includes(id) || def.me.screens.includes(id)) out.push('plum')
  if (def.tiles.includes(id)) out.push('blue')
  return out
}

const COLOURS: readonly TabColour[] = ['blue', 'teal', 'pink', 'gold', 'plum']
export const isColour = (v: unknown): v is TabColour => COLOURS.includes(v as TabColour)

/**
 * The colour a screen wears (plan 5.3). Settings and help are always plum. Otherwise the colour of the tab the guest opened it from,
 * if the stage lists the screen under that colour; then the colour of the area they were just in, by the same test (so moving about inside
 * one area keeps its colour); then the screen's primary tab for the stage; then `fallback` (the screen's old tab) for a screen the stage does not use.
 */
export function areaFor(id: string, stage: JourneyStage, openedFrom: unknown, previous: TabColour | null, fallback: TabColour): TabColour {
  if (SETTINGS_AND_HELP.includes(id)) return 'plum'
  const listed = coloursFor(id, stage)
  if (isColour(openedFrom) && listed.includes(openedFrom)) return openedFrom
  if (previous && listed.includes(previous)) return previous
  return primaryTab(id, stage)?.colour ?? fallback
}

/** Navigation state a link to a screen carries so the screen keeps the colour of the tab it was opened from. */
export const openedFrom = (colour: TabColour): { area: TabColour } => ({ area: colour })
