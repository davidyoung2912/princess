import type { PortId } from './sailings'

/**
 * Getting ready: port clearance guidance (CHK-10), the weather outlook for each port (MNG-09), health and comfort preparation
 * (MNG-19) and guided fix-it flows (MNG-18). Authored concept content; check official sources before you travel.
 */

// ---- Units (ACT-08) ----
export type Units = 'imperial' | 'metric'
export const UNITS: readonly Units[] = ['imperial', 'metric']
export const isUnits = (v: unknown): v is Units => v === 'imperial' || v === 'metric'

export const toCelsius = (f: number): number => Math.round(((f - 32) * 5) / 9)
export const formatTemp = (f: number, units: Units): string => (units === 'metric' ? `${toCelsius(f)}°C` : `${Math.round(f)}°F`)
export const formatLength = (inches: number, units: Units): string => (units === 'metric' ? `${Math.round(inches * 2.54)} mm` : `${inches.toFixed(1)} in`)

// ---- Port clearance (CHK-10) ----
export type ClearanceCitizenship = 'us' | 'other'
export interface Clearance {
  port: Exclude<PortId, 'sea'>
  country: string
  /** Papers to carry, by citizenship. */
  documents: Record<ClearanceCitizenship, string>
  /** Forms or fees, with who handles them. */
  forms: string[]
  notes: string[]
}

export const CLEARANCE: readonly Clearance[] = [
  {
    port: 'fll', country: 'United States (embarkation and return)',
    documents: { us: 'A valid passport book or card, or an enhanced driver’s licence and a birth certificate for a closed-loop cruise. A passport is the easiest.', other: 'A valid passport, and the visa you need for the United States. Check this before you pay the balance.' },
    forms: ['Your cruise line shares your passenger list with U.S. Customs and Border Protection (CBP) before you sail, so there is no separate form to file.', 'On return, complete the customs declaration in the app (Disembark, then Customs) or on the paper form.'],
    notes: ['Allow time at the terminal for CBP on your return day.', 'Fresh fruit, meat and plants cannot be brought into the United States.'],
  },
  {
    port: 'cozumel', country: 'Mexico',
    documents: { us: 'Passport or the closed-loop papers above. Carry a photo copy ashore and leave the original in the cabin safe.', other: 'A valid passport. Some nationalities need a Mexican visa even for a day ashore: check before you go.' },
    forms: ['Cruise arrivals do not file a visitor form beforehand. The ship’s manifest covers entry.', 'A small port tax is included in your cruise fare.'],
    notes: ['Bring your ship card; you need it to get back on board.', 'Do not bring camouflage-patterned clothing ashore: it is not allowed in Mexico.'],
  },
  {
    port: 'belize', country: 'Belize',
    documents: { us: 'Passport or the closed-loop papers. Belize checks your ship card at the tender dock.', other: 'A valid passport. Some nationalities need a visa; ask Guest Services at least 30 days before you sail.' },
    forms: ['No form to file ahead. A departure tax and port fee are in your fare.', 'A Belize tourist guide is required for some sites; book through a ship excursion to be covered.'],
    notes: ['Belize City is a tender port. Tenders have steps; ask Guest Services about help getting aboard.'],
  },
  {
    port: 'roatan', country: 'Honduras',
    documents: { us: 'Passport or the closed-loop papers. Keep a copy with you ashore.', other: 'A valid passport. Check whether your nationality needs a visa to enter Honduras, even for a day.' },
    forms: ['No form to file ahead for a cruise stop. The ship handles the manifest.', 'Port charges are in your fare; you pay for anything you buy ashore, often in U.S. dollars.'],
    notes: ['Use ship-booked tours or licensed taxis only.', 'Bring a refillable bottle and reef-safe sunscreen: some beaches ask for it.'],
  },
]

export const clearanceFor = (port: PortId): Clearance | undefined => CLEARANCE.find((c) => c.port === port)

// ---- Weather and climate outlook (MNG-09) ----
export interface Climate { highF: number; lowF: number; seaF: number; rainInches: number; rainDays: number; uv: number }
export type ClimatePort = Exclude<PortId, 'sea'>

/** Averages by month, January first. Authored typical values, not a forecast. */
const row = (highs: number[], lows: number[], sea: number[], rain: number[], days: number[], uv: number[]): Climate[] =>
  highs.map((highF, i) => ({ highF, lowF: lows[i], seaF: sea[i], rainInches: rain[i], rainDays: days[i], uv: uv[i] }))

export const CLIMATE: Record<ClimatePort, Climate[]> = {
  fll: row([76, 78, 80, 83, 86, 89, 90, 90, 89, 86, 81, 78], [60, 62, 65, 69, 73, 76, 77, 77, 76, 73, 67, 62], [75, 75, 77, 79, 82, 85, 86, 87, 86, 83, 80, 77], [2.1, 2.2, 2.8, 3.6, 5.6, 8.4, 5.7, 7.7, 8.2, 6.5, 3.8, 2.4], [7, 6, 7, 7, 11, 16, 17, 18, 18, 12, 8, 7], [6, 8, 9, 10, 11, 12, 12, 12, 10, 8, 6, 5]),
  cozumel: row([82, 83, 85, 87, 89, 90, 91, 91, 90, 87, 85, 83], [70, 70, 72, 74, 76, 77, 77, 77, 76, 75, 73, 71], [79, 79, 80, 82, 84, 85, 86, 86, 85, 84, 82, 80], [3.2, 1.9, 1.6, 2.1, 4.4, 7.4, 4.1, 5.4, 8.6, 7.4, 4.1, 3.3], [8, 6, 5, 5, 8, 12, 11, 12, 15, 13, 9, 9], [8, 10, 11, 12, 12, 12, 12, 12, 11, 9, 8, 7]),
  belize: row([81, 83, 85, 87, 88, 87, 87, 88, 88, 86, 83, 81], [68, 69, 71, 74, 75, 75, 74, 74, 74, 72, 70, 69], [79, 79, 80, 82, 83, 84, 84, 84, 84, 83, 81, 80], [5.3, 2.3, 1.9, 2.3, 4.1, 9.4, 8.6, 6.9, 9.4, 11.7, 8.4, 6.4], [14, 8, 7, 7, 11, 17, 19, 17, 18, 19, 16, 15], [8, 10, 11, 12, 12, 12, 12, 12, 11, 9, 8, 7]),
  roatan: row([82, 83, 85, 86, 87, 87, 87, 88, 88, 86, 84, 82], [71, 71, 72, 74, 75, 75, 74, 75, 75, 74, 73, 72], [80, 80, 81, 82, 84, 85, 85, 86, 86, 84, 82, 81], [9.6, 5.3, 3.6, 3.5, 4.4, 5.9, 6.7, 6.2, 8.6, 15.2, 16.9, 13.8], [16, 11, 9, 8, 10, 14, 15, 15, 17, 20, 20, 19], [8, 10, 11, 12, 12, 12, 12, 12, 11, 9, 8, 7]),
}

export const HURRICANE_MONTHS: readonly number[] = [5, 6, 7, 8, 9, 10]
export const isHurricaneSeason = (date: string): boolean => HURRICANE_MONTHS.includes(Number(date.slice(5, 7)) - 1)

export const monthOf = (date: string): number => Math.min(11, Math.max(0, Number(date.slice(5, 7)) - 1))

export function outlook(port: ClimatePort, date: string): Climate & { month: number; hurricane: boolean } {
  const month = monthOf(date)
  return { ...CLIMATE[port][month], month, hurricane: isHurricaneSeason(date) }
}

export type UvBand = 'moderate' | 'high' | 'veryHigh' | 'extreme'
export const uvBand = (uv: number): UvBand => (uv >= 11 ? 'extreme' : uv >= 8 ? 'veryHigh' : uv >= 6 ? 'high' : 'moderate')

// ---- Health and comfort preparation (MNG-19) ----
export type PrepGroup = 'motion' | 'medicine' | 'insurance'
export interface PrepItem { id: string; group: PrepGroup; text: string; /** Days before sailing to start on it. */ daysBefore: number }

export const PREP: readonly PrepItem[] = [
  { id: 'motion-mid', group: 'motion', text: 'Ask for a cabin in the middle of the ship, on a lower deck. It moves least.', daysBefore: 60 },
  { id: 'motion-eyes', group: 'motion', text: 'At sea, look at the horizon and get fresh air on deck. Reading or looking at a phone makes it worse.', daysBefore: 0 },
  { id: 'motion-food', group: 'motion', text: 'Eat light, avoid heavy or greasy food and too much alcohol the first day. Ginger and green apples help many people.', daysBefore: 0 },
  { id: 'motion-bands', group: 'motion', text: 'Try acupressure wrist bands, or ask your pharmacist about a patch. Patches must go on hours before you sail.', daysBefore: 14 },
  { id: 'med-supply', group: 'medicine', text: 'Pack all your prescription medicines in your carry-on, in their original containers, with a few extra days’ supply.', daysBefore: 7 },
  { id: 'med-list', group: 'medicine', text: 'Carry a list of your medicines, doses and allergies, and a letter from your doctor for anything injectable or controlled.', daysBefore: 14 },
  { id: 'med-otc', group: 'medicine', text: 'Pack basics: pain relief, anti-diarrhoea, antacids, antihistamines, plasters and motion-sickness tablets.', daysBefore: 7 },
  { id: 'med-power', group: 'medicine', text: 'If you use a CPAP or other powered device, tell Guest Services before you sail and pack a plug adapter.', daysBefore: 30 },
  { id: 'ins-buy', group: 'insurance', text: 'Buy travel insurance that covers medical care at sea and evacuation. Cover for a condition you already have usually has to be bought within days of your first payment.', daysBefore: 60 },
  { id: 'ins-card', group: 'insurance', text: 'Keep your policy number and the 24-hour helpline in your phone and on paper. Your health insurance may not pay abroad.', daysBefore: 7 },
  { id: 'ins-fee', group: 'insurance', text: 'The ship’s medical centre charges fees and does not bill your health insurer. Keep receipts to claim later.', daysBefore: 0 },
]

export const prepItem = (id: unknown): PrepItem | undefined => PREP.find((p) => p.id === id)

/** The items still to do, with the date each one should start: soonest due first. */
export function prepDue(done: readonly string[], departure: string, today: string, addDays: (d: string, n: number) => string): { item: PrepItem; start: string; late: boolean }[] {
  return PREP.filter((p) => !done.includes(p.id)).map((item) => {
    const start = addDays(departure, -item.daysBefore)
    return { item, start, late: start < today }
  }).sort((a, b) => a.start.localeCompare(b.start))
}

// ---- Fix-it flows (MNG-18) ----
export type FixId = 'noBooking' | 'nameMismatch' | 'lostDocs'
export interface FixStep { id: string; text: string; /** An app screen that does it. */ link?: string }
export interface FixFlow { id: FixId; title: string; steps: FixStep[] }

export const FIX_FLOWS: readonly FixFlow[] = [
  {
    id: 'noBooking', title: 'I can’t see my booking',
    steps: [
      { id: 'signin', text: 'Check you are signed in with the email you booked with. A different address shows a different account.' },
      { id: 'number', text: 'Look up the booking with its number and the last name of a guest.', link: '/home/find-pass' },
      { id: 'wait', text: 'A booking made in the last hour can take a short while to appear. Pull to refresh in a few minutes.' },
      { id: 'agent', text: 'If you booked through a travel advisor, ask them to confirm the booking number: it is theirs until it is transferred.', link: '/home/advisors' },
    ],
  },
  {
    id: 'nameMismatch', title: 'The name on my booking is wrong',
    steps: [
      { id: 'check', text: 'Compare the name on your booking with your passport, letter by letter.', link: '/me/profile' },
      { id: 'small', text: 'A small typo (one or two letters) can be fixed in My details until 30 days before sailing.', link: '/me/profile' },
      { id: 'large', text: 'A different name or surname needs Guest Services to check your passport. Have a photo of the passport page ready.' },
      { id: 'late', text: 'Within 30 days of sailing, a fee may apply for some changes. Ask before you pay anything.' },
    ],
  },
  {
    id: 'lostDocs', title: 'I lost my documents',
    steps: [
      { id: 'reprint', text: 'Boarding passes and receipts can be shown again from the app, with no paper needed.', link: '/home/boarding-pass' },
      { id: 'passport', text: 'If a passport is lost, report it to the police and your embassy first. They issue an emergency document.' },
      { id: 'terminal', text: 'Tell the check-in team at the terminal. With a police report and photo ID they can often still board you.', link: '/home/check-in' },
      { id: 'copies', text: 'Next time, keep photos of your passport and booking in the app’s Documents section.', link: '/me/documents' },
    ],
  },
]

export const isFixId = (v: unknown): v is FixId => FIX_FLOWS.some((f) => f.id === v)

export type FixStage = 'received' | 'contacted'
export const FIX_CONTACT_HOURS = 24
export const fixStage = (askedAt: number, now: number): FixStage => (now - askedAt >= FIX_CONTACT_HOURS * 3_600_000 ? 'contacted' : 'received')
export const fixReference = (n: number): string => `FX-${String(10_000 + n)}`
