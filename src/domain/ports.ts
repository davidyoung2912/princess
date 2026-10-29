import type { PortId } from './sailings'

export interface Excursion {
  id: string
  name: string
  hours: number
  /** Dollars per adult; authored sample. */
  price: number
  /** How much walking, steps or uneven ground it involves. */
  access: 'easy' | 'some' | 'demanding'
}

export interface PortGuide {
  id: Exclude<PortId, 'sea'>
  short: string
  /** How the ship reaches shore. */
  landing: 'pier' | 'tender'
  blurb: string
  bestTime: string
  /** Plain statement of what getting ashore and around is like. */
  access: string
  doThis: readonly string[]
  excursions: readonly Excursion[]
}

export const PORT_GUIDES: Record<Exclude<PortId, 'sea'>, PortGuide> = {
  fll: {
    id: 'fll', short: 'Fort Lauderdale', landing: 'pier',
    blurb: 'Port Everglades, about 5 miles from the airport. You board here on day 1 and leave on day 8.',
    bestTime: 'Winter is dry and mild, the busiest season for sailing.',
    access: 'Level terminal with wheelchair assistance from the curb. Ask for assistance when you check in online.',
    doThis: ['Arrive at your check-in time, not earlier', 'Fly in the day before if you can', 'Stay at an airport hotel with a shuttle'],
    excursions: [],
  },
  cozumel: {
    id: 'cozumel', short: 'Cozumel', landing: 'pier',
    blurb: 'A Mexican island with clear water, beach clubs and the Mayan ruins at San Gervasio. The ship docks at a pier, so there is no tender.',
    bestTime: 'November to April is dry and warm. Hurricane season runs June to November.',
    access: 'Pier dock with a flat walk to shops and taxis. Beach clubs are a short taxi ride; most have level paths but soft sand.',
    doThis: ['Snorkel the Palancar Reef', 'Visit San Gervasio ruins', 'Relax at a beach club', 'Shop at the pier'],
    excursions: [
      { id: 'coz-snorkel', name: 'Reef snorkel by boat', hours: 3.5, price: 79, access: 'some' },
      { id: 'coz-ruins', name: 'San Gervasio Mayan ruins', hours: 4, price: 69, access: 'some' },
      { id: 'coz-beach', name: 'Beach club day pass', hours: 6, price: 59, access: 'easy' },
    ],
  },
  belize: {
    id: 'belize', short: 'Belize City', landing: 'tender',
    blurb: 'Home to the Belize Barrier Reef, Mayan temples and jungle caves. The ship anchors offshore and small boats, called tenders, carry you in.',
    bestTime: 'February to May is driest. Showers are common the rest of the year.',
    access: 'Tender boats have steps and a gap to step across. Guests who cannot manage steps may be unable to go ashore, and staff cannot lift a wheelchair. Plan with Guest Services before you book.',
    doThis: ['Tour the Altun Ha temples', 'Tube through a jungle cave', 'Snorkel the reef', 'Visit Lamanai by river'],
    excursions: [
      { id: 'bze-altunha', name: 'Altun Ha Mayan temples', hours: 4, price: 85, access: 'some' },
      { id: 'bze-cave', name: 'Cave tubing adventure', hours: 6, price: 129, access: 'demanding' },
      { id: 'bze-reef', name: 'Barrier reef snorkel', hours: 4, price: 99, access: 'some' },
    ],
  },
  roatan: {
    id: 'roatan', short: 'Roatán', landing: 'pier',
    blurb: 'A Honduran island with white beaches, reef snorkelling and wildlife parks. The ship docks at a pier beside shops and a beach.',
    bestTime: 'February to June is driest. October to January is the rainy season.',
    access: 'Level pier and a short walk to shops and a beach. Taxis and tour vans wait at the gate; vans may have a step up.',
    doThis: ['Zip-line over the canopy', 'Snorkel West Bay', 'See sloths and monkeys', 'Walk the beach by the pier'],
    excursions: [
      { id: 'rtb-zip', name: 'Zip-line canopy tour', hours: 3, price: 89, access: 'demanding' },
      { id: 'rtb-snorkel', name: 'West Bay snorkel', hours: 3.5, price: 75, access: 'some' },
      { id: 'rtb-wildlife', name: 'Wildlife and monkey park', hours: 3, price: 65, access: 'easy' },
    ],
  },
}

export const portGuideById = (id: unknown): PortGuide | undefined => (typeof id === 'string' ? (PORT_GUIDES as Record<string, PortGuide | undefined>)[id] : undefined)

/** Approximate longitude and latitude, for the route sketch only. */
export const PORT_COORDS: Record<Exclude<PortId, 'sea'>, [number, number]> = {
  fll: [-80.1, 26.1],
  cozumel: [-86.9, 20.5],
  belize: [-88.2, 17.5],
  roatan: [-86.5, 16.3],
}
