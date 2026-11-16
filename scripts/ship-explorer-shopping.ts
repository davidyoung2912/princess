// The Shopping Explorer content of each ship (docs/princess-shopping.md): the boutiques, the photo and fine arts gallery, the pop-up markets, and the sales, trunk shows, tastings and auctions
// that run there. The doc gives each event as Morning / Noon / Night, so the start times and lengths are authored here for review. Nothing here is booked or charged by the app: purchases
// are made at the shop, so every event is free to attend.
//
// Retail rules (the doc): the shops are closed while the ship is alongside, open 45 minutes after sailaway until 10 pm, and open 9:30 am to 10 pm on sea days. On embarkation day they open at
// 5:30 pm. The gallery displays are open round the clock; its desk is staffed 9 am to 10 pm at sea and 5 pm to 10 pm after a port. Champagne art auctions are held in a lounge (Princess Live!,
// Vista or Explorers Lounge) but listed under the gallery, since the Fine Arts Gallery runs them.
//
// The doc's week maps onto day kinds as in the Entertainment content: Day 1 `embark`, Day 2 `firstSea`, Day 3 `earlyPortOdd` and Day 6 `lastPort`, Day 4
// `portEven`, Day 5 `laterSea`, Day 7 `last`. On a port day every event starts after the sailaway reopening.
import type { HoursRule } from '../src/domain/explorer/types.ts'
import type { ExplorerEventRow, ExplorerVenueRow } from './ship-explorer-data.ts'

/** Closed alongside; open 45 minutes after the ship sails until 10 pm; open at 5:30 pm on embarkation day; 9:30 am to 10 pm at sea. */
const SHOP_HOURS: HoursRule[] = [
  { kind: 'sailaway', when: ['port'], afterMinutes: 45, until: '22:00' },
  { kind: 'fixed', when: ['embark'], windows: [['17:30', '22:30']] },
  { kind: 'fixed', when: ['night'], windows: [['09:30', '22:00']] },
]
/** The displays are open round the clock; the desk is staffed 9 am to 10 pm at sea and 5 pm to 10 pm in the evening of a port day or embarkation. */
const GALLERY_HOURS: HoursRule[] = [
  { kind: 'fixed', when: ['embark'], windows: [['00:00', '24:00']], staffed: [['17:30', '22:00']] },
  { kind: 'fixed', when: ['port'], windows: [['00:00', '24:00']], staffed: [['17:00', '22:00']] },
  { kind: 'fixed', when: ['night'], windows: [['00:00', '24:00']], staffed: [['09:00', '22:00']] },
]
/** The Piazza tables: a preview and raffle desk is open on embarkation morning; sales follow the shop rules. */
const PIAZZA_HOURS: HoursRule[] = [
  { kind: 'sailaway', when: ['port'], afterMinutes: 45, until: '22:00' },
  { kind: 'fixed', when: ['embark'], windows: [['10:00', '22:30']] },
  { kind: 'fixed', when: ['night'], windows: [['09:30', '22:00']] },
]
/** The poolside market sets up on sea days and, weather permitting, for a few hours after sailaway. */
const POOL_HOURS: HoursRule[] = [
  { kind: 'sailaway', when: ['port'], afterMinutes: 45, until: '19:00' },
  { kind: 'fixed', when: ['embark'], windows: [['17:30', '19:00']] },
  { kind: 'fixed', when: ['night'], windows: [['10:00', '17:00']] },
]

type Kind = 'shop' | 'gallery' | 'popup'
type Key = string

interface VenueSpec { key: Key; kind: Kind; title: string; deck: string; short: string; long: string; hours?: HoursRule[]; features?: string[] }

const STEP_FREE = ['Step-free from the lifts']
const DUTY_FREE = 'Duty and tax free in international waters.'
const TAX = ['Tax and duty free']
const MARKET_LONG = 'Folding tables set up for the day. They follow the shops’ rules, so they are closed alongside and open after the ship sails.'

interface ShipSpec { prefix: string; venues: VenueSpec[] }

const SHIPS: Record<string, ShipSpec> = {
  'sun-princess': {
    prefix: 'shop-',
    venues: [
      { key: 'shops', kind: 'shop', title: 'The Shops of Princess', deck: 'Deck 7 midship', short: 'The flagship logo and souvenir store: apparel, ship models, Stanley plush and travel essentials.',
        long: `Along the Deck 7 Piazza promenade, with exclusive Sun Princess and Sphere-class merchandise, collectible die-cast ship models, Stanley the Bear plush toys, destination hoodies and caps, and the things you forgot: sunscreen, over-the-counter medicines, adapters and snacks. ${DUTY_FREE}`, features: TAX, },
      { key: 'beauty', kind: 'shop', title: 'The Beauty and Fragrance Studio', deck: 'Deck 7 midship', short: 'An open-concept cosmetics and perfumery hall with luxury skincare and signature scents.',
        long: 'Styled like a department-store beauty floor, with counters for Chanel, Dior, Lancôme, Estée Lauder, Clinique and Jo Malone, and complimentary mini-makeovers, skincare consultations and fragrance profiling.', features: TAX },
      { key: 'watch', kind: 'shop', title: 'Fine Timepieces and Luxury Horology Salon', deck: 'Deck 8 midship', short: 'A watch gallery of Swiss horology and certified pre-owned pieces.',
        long: 'On the Deck 8 gallery overlooking the Piazza, with brand corners for TAG Heuer, Breitling, Longines, Tissot, Rado and Hamilton, and a vault of certified pre-owned Rolex and Cartier.', features: TAX },
      { key: 'effy', kind: 'shop', title: 'Effy Fine Jewelry Boutique', deck: 'Deck 8 midship', short: 'A fine jewelry salon for coloured gemstones, diamonds and exclusive Princess collections.',
        long: 'Private viewing salons, custom ring settings, tanzanite and emerald suites, and complimentary daily charm-bracelet giveaways during promotional hours.', features: TAX },
      { key: 'fashion', kind: 'shop', title: 'Luxury Fashion and Accessories Gallery', deck: 'Deck 8 midship', short: 'Designer handbags, resort wear, eyewear and Italian leather goods.',
        long: 'Shop-in-shops including a Lacoste “Le Club” store, a Swarovski crystal gallery, a Ray-Ban and Maui Jim sunglass bar and certified pre-owned luxury handbags, for resort and formal-night styling.', features: TAX },
      { key: 'spirits', kind: 'shop', title: 'Spirits, Wine and Tobacco Duty-Free Market', deck: 'Deck 7 midship', short: 'Single malts, small-batch bourbons, champagne and Swiss chocolates.',
        long: 'Travel-exclusive litre bottles of spirits, vintage champagnes, regional wines and chocolates from Godiva, Toblerone and Lindt. Alcohol bought to take home is held by the ship and delivered to your stateroom on the final evening.', features: ['Alcohol delivered on the last evening', ...TAX] },
      { key: 'gallery', kind: 'gallery', title: 'Fine Arts Gallery and Photo Studio', deck: 'Deck 7 forward and midship', hours: GALLERY_HOURS, short: 'Digital photo kiosks and a walk-through gallery of Romero Britto, Thomas Kinkade and Peter Max.',
        long: 'Facial-recognition photo stations linked to your OceanMedallion, beside a gallery of framed lithographs, sculptures and original paintings for direct purchase or live auction. The displays stay open all day and night; the desk is staffed 9 am to 10 pm at sea and from 5 pm after a port.', features: ['Displays open 24 hours'], },
      { key: 'piazza', kind: 'popup', title: 'Piazza Pop-Up Tables', deck: 'Deck 7 Piazza', hours: PIAZZA_HOURS, short: 'Flash sales, the Inch of Gold chain bar and visiting artisans on the Piazza floor.',
        long: `$10 to $20 grab-and-go deals on pashminas, handbags, fashion watches and T-shirts, the Inch of Gold and Inch of Silver custom chain bar, and on some itineraries a visiting local artisan. ${MARKET_LONG}` },
      { key: 'pool', kind: 'popup', title: 'Poolside Pop-Up Market', deck: 'Deck 17 SeaView Terrace', hours: POOL_HOURS, short: 'Sunglasses, sun hats, cover-ups and logo apparel by the main pool.',
        long: 'An outdoor market set up on sea days, and for a short while after sailaway, weather permitting, by the SeaView Terrace.', features: ['Weather permitting'] },
    ],
  },
  'sky-princess': {
    prefix: 'sky-shop-',
    venues: [
      { key: 'calypso', kind: 'shop', title: 'Calypso Cove', deck: 'Deck 5 Piazza level', short: 'Convenience, duty-free liquor, snacks and Princess logo souvenirs.',
        long: 'Off the Piazza floor: duty-free spirits, travel-size toiletries, over-the-counter remedies, chocolates, Princess T-shirts and magnets.', features: TAX },
      { key: 'essence', kind: 'shop', title: 'Essence', deck: 'Deck 6 Piazza level', short: 'Duty-free fragrance, skincare and luxury cosmetics.',
        long: 'Dior, Chanel, Guerlain, Clinique and Estée Lauder at up to 25 to 30 percent off U.S. mainland prices, with complimentary skin diagnostics from the beauty specialists.', features: TAX },
      { key: 'facets', kind: 'shop', title: 'Facets', deck: 'Deck 6 Piazza level', short: 'Fine jewelry and Swiss watches, including Effy, Tissot and Longines.',
        long: 'A glass-fronted salon of diamond solitaires, coloured gemstones and Swiss watches, hosting nightly trunk shows and gemstone seminars.', features: TAX },
      { key: 'meridian', kind: 'shop', title: 'Meridian Bay', deck: 'Deck 7 Promenade level', short: 'Fashion jewelry, sunglasses, handbags and evening accessories.',
        long: 'On the upper Piazza gallery: Swarovski crystal jewelry, Brighton handbags and charms, designer sunglasses, pashminas and evening clutches.', features: TAX },
      { key: 'limelight', kind: 'shop', title: 'Limelight Fashion Boutique', deck: 'Deck 7 Promenade level', short: 'Resort wear, smart-casual cruise clothes and destination outerwear.',
        long: 'Easy-to-pack linen shirts and swimwear and, on Northern Europe or Alaska sailings, weatherproof jackets, fleeces and cashmere scarves.', features: TAX },
      { key: 'gallery', kind: 'gallery', title: 'Photo and Fine Arts Galleries', deck: 'Decks 6 and 7 midship', hours: GALLERY_HOURS, short: 'Portrait studios, digital photo galleries and Park West fine art.',
        long: 'Portrait studios, a digital photo gallery and Park West exhibitions. The displays stay open all day and night; the desk is staffed 9 am to 10 pm at sea and from 5 pm after a port.', features: ['Displays open 24 hours'] },
      { key: 'piazza', kind: 'popup', title: 'Piazza Pop-Up Tables', deck: 'Deck 5 Piazza', hours: PIAZZA_HOURS, short: 'Flash sales, the Inch of Gold chain bar and visiting artisans on the Piazza floor.',
        long: `$10 to $20 deals on watches, shawls, evening bags and costume jewelry, the Inch of Gold chain bar, and on some itineraries a visiting local artisan. ${MARKET_LONG}` },
      { key: 'pool', kind: 'popup', title: 'Top Deck Pool Pop-Up Market', deck: 'Deck 16 Top Deck Pool', hours: POOL_HOURS, short: 'Sunglasses, cover-ups, logo tees, hats and beach bags by the pool.',
        long: 'An outdoor market set up on sea days, and for a short while after sailaway, weather permitting.', features: ['Weather permitting'] },
    ],
  },
  'sapphire-princess': {
    prefix: 'sapphire-shop-',
    venues: [
      { key: 'calypso', kind: 'shop', title: 'Calypso Cove', deck: 'Deck 6 Fiesta Deck', short: 'The shipboard general store: logo apparel, destination gifts, snacks and duty-free liquor.',
        long: 'Steps from the Princess Theater and the Atrium. Destination souvenirs depend on the itinerary, such as Alaskan ulu knives, glacier apparel or Japanese keepsakes, with duty-free spirits and travel necessities.', features: TAX },
      { key: 'essence', kind: 'shop', title: 'Essence', deck: 'Deck 6 Fiesta Deck', short: 'Duty-free designer perfumes, colognes and skincare.',
        long: 'Travel-exclusive fragrance sets and cosmetics from Lancôme, Clinique, Chanel and Estée Lauder.', features: TAX },
      { key: 'facets', kind: 'shop', title: 'Facets', deck: 'Deck 7 Promenade Deck', short: 'Fine jewelry and luxury watches, specialising in Effy and Swiss brands.',
        long: 'Along the Promenade walkway, with diamond unveilings, tanzanite showcases and watch consultations.', features: TAX },
      { key: 'meridian', kind: 'shop', title: 'Meridian Bay', deck: 'Deck 7 Promenade Deck', short: 'Fashion jewelry, Swarovski crystals, watches and designer handbags.',
        long: 'A popular spot on evening promenades, with Fossil, Citizen and Bulova watches, Brighton accessories and sparkling evening wear.', features: TAX },
      { key: 'limelight', kind: 'shop', title: 'Limelight Boutique', deck: 'Deck 7 Promenade Deck', short: 'Destination clothing, formal accessories and resort fashion.',
        long: 'Casual wear for men and women, formal-night ties and shawls, and outdoor gear matched to the Pacific, Alaska or South America.', features: TAX },
      { key: 'gallery', kind: 'gallery', title: 'Princess Fine Arts and Photo Gallery', deck: 'Deck 7 Promenade Deck', hours: GALLERY_HOURS, short: 'A walk-through art gallery and photo desk beside Explorers Lounge and the Wheelhouse Bar.',
        long: 'The displays stay open all day and night; the desk is staffed 9 am to 10 pm at sea and from 5 pm after a port.', features: ['Displays open 24 hours'] },
      { key: 'piazza', kind: 'popup', title: 'Piazza Pop-Up Tables', deck: 'Deck 5 Piazza', hours: PIAZZA_HOURS, short: 'Flash sales, the Inch of Gold chain bar and visiting artisans on the Piazza floor.',
        long: `$10 to $20 deals on watches, pashminas, jewelry and scarves, the Inch of Gold chain bar, and on some itineraries a visiting local artisan. ${MARKET_LONG}` },
      { key: 'pool', kind: 'popup', title: 'Neptune’s Pool Pop-Up Market', deck: 'Deck 14 Neptune’s Pool', hours: POOL_HOURS, short: 'Sunglasses, hats and cover-ups by the pool.',
        long: 'An outdoor market set up on sea days, and for a short while after sailaway, weather permitting.', features: ['Weather permitting'] },
    ],
  },
}

const idOf = (s: ShipSpec, key: string) => `${s.prefix}${key}`

/** The shopping venues of a ship, numbered from `firstOrder`. */
export function shoppingVenues(shipId: string, firstOrder: number): ExplorerVenueRow[] {
  const s = SHIPS[shipId]
  return s.venues.map((v, i) => ({
    id: idOf(s, v.key), explorer: 'shopping', kind: v.kind, title: v.title, short: v.short, long: v.long, placeId: v.kind === 'popup' ? 'piazza' : 'shops',
    deckLabel: v.deck, hours: v.hours ?? SHOP_HOURS, bookable: 'none', order: firstOrder + i, features: v.features ?? [], accessibility: v.kind === 'popup' ? [] : STEP_FREE,
  }))
}

type Interest = 'shows' | 'games' | 'learning' | 'family'
/** One row of a ship's week: slug, kinds of day, start, minutes, title, venue key, interest, and a detail that overrides "At <venue>." (a tasting is for adults). */
type Row = [slug: string, when: string[], start: string, minutes: number, title: string, venue: Key, interest: Interest, detail?: string]

const E = 'embark', F = 'firstSea', P1 = 'earlyPortOdd', P6 = 'lastPort', P2 = 'portEven', S2 = 'laterSea', L = 'last'
const ALL = ['embark', 'night']

const WEEKS: Record<string, Row[]> = {
  'sun-princess': [
    ['preview', [E], '10:00', 60, 'Boutique preview and raffle entry desk', 'piazza', 'games', 'Shops open after sailaway; pick up the map and enter the raffle.'],
    ['open', [E], '17:30', 30, 'Grand opening: all Deck 7 and 8 boutiques open', 'shops', 'family'],
    ['spritz', [E], '17:45', 45, 'Complimentary sailaway fragrance spritz', 'beauty', 'family'],
    ['charm', [E], '18:15', 60, 'Welcome aboard charm giveaway and raffle', 'effy', 'games'],
    ['tasting', [E], '18:30', 60, 'Embarkation liquor tasting and multi-bottle promotion', 'spirits', 'learning', 'Adults only. Tastings are in the market on Deck 7.'],
    ['watch-f', [F], '10:00', 120, 'Captain’s Table $19.99 watch and scarf pop-up sale', 'piazza', 'family'],
    ['hunt-f', [F], '10:30', 60, 'Art scavenger hunt and preview', 'gallery', 'games'],
    ['auction-f', [F], '14:00', 60, 'Champagne art auction and mystery bid event', 'gallery', 'shows', 'Held in Princess Live! with complimentary champagne, a guess-the-weight contest and $50 to $500 mystery art bids.'],
    ['rolex-f', [F], '15:30', 60, 'Pre-owned Rolex and designer handbag showcase', 'fashion', 'shows'],
    ['chain-f', [F], '19:00', 120, 'Formal night Inch of Gold custom chain pop-up', 'piazza', 'family'],
    ['gala-f', [F], '20:00', 90, 'Sip and sale: diamond and Swiss watch gala', 'effy', 'shows', 'Complimentary sparkling wine and raffles at the Effy boutique and the horology salon.'],
    ['souvenir-p1', [P1], '18:00', 90, 'Destination souvenir and magnet feature', 'shops', 'family'],
    ['glow-p1', [P1], '18:30', 45, 'Glow at Sea skincare masterclass', 'beauty', 'learning'],
    ['bijoux-p1', [P1], '19:30', 90, 'Pop-up $10 bijoux and evening clutch table', 'piazza', 'family'],
    ['artisan-p6', [P6], '18:00', 120, 'Local destination artisan pop-up market', 'piazza', 'family', 'On the second formal port day, local artisans sell regional crafts on the Piazza.'],
    ['unveil-p6', [P6], '20:00', 60, 'Gala formal night VIP diamond unveiling', 'effy', 'shows'],
    ['portrait-p6', [P6], '19:00', 120, 'Formal night platinum portrait sessions', 'gallery', 'family'],
    ['canvas-p2', [P2], '18:00', 90, 'Port portrait and canvas print promotion', 'gallery', 'family'],
    ['tanzanite-p2', [P2], '18:30', 60, 'Rare tanzanite and coloured gemstone trunk show', 'effy', 'shows'],
    ['resort-p2', [P2], '19:00', 60, 'Resort wear mix-and-match sale', 'fashion', 'family'],
    ['pool-s2', [S2], '10:00', 180, 'Poolside pop-up market: sunglasses, hats and resort wear', 'pool', 'family'],
    ['chain-s2', [S2], '10:30', 90, 'Inch of Gold morning session', 'piazza', 'family'],
    ['auction-s2', [S2], '14:00', 75, 'Major fine art auction with complimentary champagne', 'gallery', 'shows', 'Held in Princess Live!'],
    ['scotch-s2', [S2], '15:00', 60, 'Rare single malt scotch and bourbon tasting', 'spirits', 'learning', 'Adults only.'],
    ['timepiece-s2', [S2], '16:00', 60, 'TAG Heuer and Breitling collector showcase', 'watch', 'shows'],
    ['mega-s2', [S2], '19:00', 120, 'Captain’s Table sidewalk mega-sale: up to 50% off accessories', 'piazza', 'family'],
    ['clear-l', [L], '10:00', 120, 'Last-chance clearance sidewalk sale: logo gear and gifts', 'piazza', 'family'],
    ['pickup-l', [L], '10:00', 240, 'Final art pick-up and framing desk', 'gallery', 'learning'],
    ['order-l', [L], '14:00', 60, 'Final duty-free liquor order deadline at 3:00 pm', 'spirits', 'learning'],
    ['blowout-l', [L], '14:30', 120, '2-for-$30 T-shirt and souvenir blowout across Decks 7 and 8', 'shops', 'family'],
    ['photo-l', [L], '16:00', 120, 'Final digital and print package pick-up', 'gallery', 'learning'],
  ],
  'sky-princess': [
    ['map', [E], '10:00', 60, 'Shopping map and raffle ticket pick-up', 'piazza', 'games', 'Shops open after sailaway.'],
    ['open', [E], '17:30', 30, 'Boutiques open: Calypso Cove, Essence, Facets and Meridian Bay', 'calypso', 'family'],
    ['tasting', [E], '17:45', 60, 'Embarkation liquor tasting', 'calypso', 'learning', 'Adults only.'],
    ['pendant', [E], '18:15', 60, 'Welcome aboard pendant giveaway and raffle drawing', 'facets', 'games'],
    ['perfume', [E], '18:30', 60, 'Signature perfume discovery event', 'essence', 'learning'],
    ['watch-f', [F], '10:00', 120, 'Captain’s Table pop-up sale: watches and shawls', 'piazza', 'family'],
    ['brighton-f', [F], '10:30', 60, 'Brighton charm and Swarovski showcase', 'meridian', 'shows'],
    ['pool-f', [F], '11:00', 180, 'Poolside sunglass and cover-up pop-up', 'pool', 'family'],
    ['auction-f', [F], '14:00', 60, 'Champagne art auction and guess-the-weight contest', 'gallery', 'shows', 'Held in the Vista Lounge on Deck 7.'],
    ['chain-f', [F], '19:00', 120, 'Formal night Inch of Gold custom chain bar', 'piazza', 'family'],
    ['gala-f', [F], '20:00', 90, 'Sip and sale: Effy jewelry and Swiss watches', 'facets', 'shows'],
    ['skincare-p1', [P1], '18:30', 60, 'Dior and Chanel skincare consultation night', 'essence', 'learning'],
    ['bags-p1', [P1], '19:00', 90, '$15 evening bag and costume jewelry pop-up', 'piazza', 'family'],
    ['artisan-p6', [P6], '18:00', 120, 'Regional artisan and craft pop-up', 'piazza', 'family', 'On the second formal port day, local artisans sell regional crafts on the Piazza.'],
    ['vip-p6', [P6], '20:00', 60, 'Second formal night VIP diamond and estate jewelry event', 'facets', 'shows'],
    ['viewing-p6', [P6], '19:00', 120, 'Formal portrait viewing and canvas deals', 'gallery', 'family'],
    ['apparel-p2', [P2], '18:00', 90, 'Destination apparel and outerwear feature', 'limelight', 'family'],
    ['seminar-p2', [P2], '18:30', 60, 'Tanzanite and emerald gemstone seminar', 'facets', 'learning'],
    ['chocolate-p2', [P2], '19:00', 60, 'Swiss chocolate and confectionery tasting', 'calypso', 'learning'],
    ['pool-s2', [S2], '10:00', 180, 'Lido pop-up sale: logo tees, hats and beach bags', 'pool', 'family'],
    ['chain-s2', [S2], '10:30', 90, 'Inch of Gold pop-up', 'piazza', 'family'],
    ['auction-s2', [S2], '14:00', 75, 'Grand finale champagne art auction', 'gallery', 'shows', 'Held in the Vista Lounge on Deck 7.'],
    ['handbag-s2', [S2], '15:00', 60, 'Pre-owned luxury handbag trunk show', 'meridian', 'shows'],
    ['swiss-s2', [S2], '16:00', 60, 'Tissot and Longines Swiss watch showcase', 'facets', 'shows'],
    ['blowout-s2', [S2], '19:00', 120, 'Captain’s Table sidewalk blowout sale', 'piazza', 'family'],
    ['clear-l', [L], '10:00', 120, 'Final voyage $10 and $20 pop-up clearance table', 'piazza', 'family'],
    ['plush-l', [L], '10:30', 90, 'Last-call souvenir and plush sale', 'calypso', 'family'],
    ['order-l', [L], '14:00', 60, 'Final duty-free liquor delivery cutoff at 3:00 pm', 'calypso', 'learning'],
    ['tees-l', [L], '14:30', 120, '2-for-$30 Princess logo apparel sale across Decks 5 to 7', 'calypso', 'family'],
    ['pickup-l', [L], '16:00', 120, 'Last-chance photo and Medallion keepsake pick-up', 'gallery', 'learning'],
  ],
  'sapphire-princess': [
    ['guide', [E], '10:00', 60, 'Boutique guide and free charm voucher desk', 'piazza', 'games', 'Shops open after sailaway.'],
    ['open', [E], '17:30', 30, 'Boutiques open: Calypso Cove, Essence, Facets, Meridian Bay and Limelight', 'calypso', 'family'],
    ['tasting', [E], '17:45', 60, 'Welcome liquor tasting', 'calypso', 'learning', 'Adults only.'],
    ['raffle', [E], '18:15', 60, 'Welcome aboard jewelry raffle and pendant gift', 'facets', 'games'],
    ['launch', [E], '18:30', 60, 'Duty-free fragrance launch', 'essence', 'learning'],
    ['watch-f', [F], '10:00', 120, 'Captain’s Table $19.99 watch and pashmina pop-up', 'piazza', 'family'],
    ['formal-f', [F], '10:30', 60, 'Formal accessories and resort wear event', 'limelight', 'family'],
    ['pool-f', [F], '11:00', 180, 'Poolside sunglass pop-up, weather permitting', 'pool', 'family'],
    ['auction-f', [F], '14:00', 60, 'Champagne art auction and raffle', 'gallery', 'shows', 'Held in Explorers Lounge on Deck 7.'],
    ['chain-f', [F], '19:00', 120, 'Formal night Inch of Gold chain bar', 'piazza', 'family', 'On the Promenade Deck 7.'],
    ['gala-f', [F], '20:00', 90, 'Sip and sale: Effy and Citizen and Bulova watch night', 'facets', 'shows'],
    ['makeover-p1', [P1], '18:30', 60, 'Lancôme and Clinique beauty makeover evening', 'essence', 'learning'],
    ['jewelry-p1', [P1], '19:00', 90, 'Pop-up $10 jewelry and scarf sale', 'piazza', 'family'],
    ['artisan-p6', [P6], '18:00', 120, 'Local port artisan and keepsake pop-up', 'piazza', 'family', 'On the second formal port day, local artisans sell regional crafts on the Piazza.'],
    ['gala-p6', [P6], '20:00', 60, 'Formal night VIP fine jewelry and watch gala', 'facets', 'shows'],
    ['portrait-p6', [P6], '19:00', 120, 'Formal night portrait packages', 'gallery', 'family'],
    ['souvenir-p2', [P2], '18:00', 90, 'Regional souvenir and destination apparel showcase', 'calypso', 'family'],
    ['upgrade-p2', [P2], '18:30', 60, 'Rare gemstone and diamond ring upgrade event', 'facets', 'shows'],
    ['swarovski-p2', [P2], '19:00', 60, 'Swarovski crystal and Brighton trunk show', 'meridian', 'shows'],
    ['chain-s2', [S2], '10:00', 90, 'Inch of Gold custom chain pop-up', 'piazza', 'family'],
    ['camera-s2', [S2], '10:30', 60, 'Portrait and camera gear consultation', 'gallery', 'learning'],
    ['auction-s2', [S2], '14:00', 75, 'Signature champagne art auction', 'gallery', 'shows', 'Held in Explorers Lounge on Deck 7.'],
    ['spirits-s2', [S2], '15:00', 60, 'Duty-free spirits and chocolate tasting', 'calypso', 'learning', 'Adults only.'],
    ['markdown-s2', [S2], '16:00', 120, 'End-of-season apparel markdowns', 'limelight', 'family'],
    ['mega-s2', [S2], '19:00', 120, 'Captain’s Table sidewalk mega-sale', 'piazza', 'family'],
    ['clear-l', [L], '10:00', 120, 'Farewell clearance sidewalk sale: gifts, bags and watches', 'piazza', 'family'],
    ['art-l', [L], '10:30', 120, 'Final art settlement and shipping', 'gallery', 'learning'],
    ['order-l', [L], '14:00', 60, 'Final duty-free liquor order deadline at 3:00 pm', 'calypso', 'learning'],
    ['tees-l', [L], '14:30', 120, 'Last-day logo T-shirt and souvenir blowout across Decks 6 and 7', 'calypso', 'family'],
    ['usb-l', [L], '16:00', 120, 'Final photo and USB pick-up', 'gallery', 'learning'],
  ],
}

/** The shopping events of a ship. Every event is free to attend; a purchase is made at the shop. */
export function shoppingEvents(shipId: string): ExplorerEventRow[] {
  const s = SHIPS[shipId]
  const titles = new Map(s.venues.map((v) => [idOf(s, v.key), v.title]))
  return WEEKS[shipId].map(([slug, when, start, minutes, title, venue, interest, detail]) => {
    const venueId = idOf(s, venue)
    return {
      id: `${s.prefix}${slug}`, venueId, when: when.length ? when : ALL, start, minutes, title, detail: detail ?? `At ${titles.get(venueId) ?? ''}.`, age: detail?.startsWith('Adults only') ? 'adults' : 'all', interest, extra: 0,
    }
  })
}
